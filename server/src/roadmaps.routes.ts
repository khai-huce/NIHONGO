import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { PersonalRoadmap, Prisma, PrismaClient } from '@prisma/client';
import { analyzeRoadmapKanji, MAX_ROADMAP_TEXT, MAX_ROADMAPS, ROADMAP_PER_DAY, ROADMAP_KANJI, roadmapDayKanji } from '../../shared/roadmap.mjs';
import { assessRoadmapKanji, roadmapProgress } from '../../shared/roadmap-study.mjs';
import { HttpError } from './errors.js';

const identity = { id: z.string().uuid(), expectedUserId: z.string().uuid() };
const name = z.string().trim().min(1, 'Vui lòng nhập tên lộ trình.').max(100, 'Tên lộ trình tối đa 100 ký tự.');
const perDay = z.number().int().refine(value => (ROADMAP_PER_DAY as readonly number[]).includes(value), 'Số Kanji mỗi ngày phải là 5, 10, 15, 20, 25 hoặc 30.');
const version = z.number().int().nonnegative().max(2147483647);
const createInput = z.object({ ...identity, name, rawKanji: z.string().max(MAX_ROADMAP_TEXT, `Danh sách tối đa ${MAX_ROADMAP_TEXT} ký tự.`), perDay }).strict();
const updateInput = z.object({ ...identity, version, name, perDay }).strict();
const deleteInput = z.object({ ...identity, version }).strict();
const day = z.number().int().positive().max(2000);
const startInput = z.object({ ...identity, version, day }).strict();
const rateInput = z.object({ ...identity, progressVersion: version, day, kanjiId: z.string().min(1).max(32), memorized: z.boolean() }).strict();
const changed = () => new HttpError(409, 'ROADMAP_CHANGED', 'Lộ trình đã thay đổi ở phiên khác. Tải lại trước khi sửa tiếp; nội dung bạn đang nhập chưa được lưu.');
const progressChanged = () => new HttpError(409, 'ROADMAP_PROGRESS_CHANGED', 'Tiến độ đã thay đổi ở phiên khác. Vui lòng tải lại trước khi đánh giá tiếp.');
const missing = () => new HttpError(404, 'NOT_FOUND', 'Không tìm thấy lộ trình.');
const idsByCharacter = new Map(ROADMAP_KANJI.map(([id, character]) => [character, id]));

function studyDayIds(roadmap: PersonalRoadmap, day: number) {
  const unsupported = roadmap.kanjiList.filter(character => !idsByCharacter.has(character));
  if (unsupported.length) throw new HttpError(400, 'UNSUPPORTED_KANJI', `Chưa có dữ liệu cho các chữ: ${unsupported.join('、')}.`);
  if (day > Math.ceil(roadmap.kanjiList.length / roadmap.perDay)) throw new HttpError(400, 'INVALID_ROADMAP_DAY', 'Ngày học không tồn tại trong lộ trình.');
  return roadmapDayKanji(roadmap.kanjiList, roadmap.perDay, day).map(character => idsByCharacter.get(character)!);
}

function toDto(roadmap: PersonalRoadmap) {
  const progress = roadmapProgress(roadmap.kanjiList, roadmap.perDay, roadmap.assessments, roadmap.completedDays);
  return {
    id: roadmap.id, name: roadmap.name, rawKanji: roadmap.rawKanji, kanjiList: roadmap.kanjiList,
    perDay: roadmap.perDay, totalDays: Math.ceil(roadmap.kanjiList.length / roadmap.perDay), ...progress,
    progressVersion: roadmap.progressVersion,
    version: roadmap.version, startedAt: roadmap.startedAt, createdAt: roadmap.createdAt,
  };
}

async function lockRoadmaps(tx: Prisma.TransactionClient, userId: string) {
  // Keep quota checks and writes for one account in order without locking unrelated study data.
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`roadmaps:${userId}`}, 0))`;
}

export function roadmapRoutes(db: PrismaClient) {
  const router = Router();
  router.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!req.session.userId || !await db.user.findUnique({ where: { id: req.session.userId }, select: { id: true } })) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để lưu lộ trình.');
    }
    next();
  });
  router.use(rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.' } },
  }));
  router.get('/', async (req, res) => {
    z.object({}).strict().parse(req.query);
    const userId = req.session.userId!;
    const roadmaps = await db.personalRoadmap.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    res.json({ userId, roadmaps: roadmaps.map(toDto) });
  });
  router.use((req, _res, next) => {
    if (req.body?.expectedUserId !== req.session.userId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    next();
  });
  router.post('/', async (req, res) => {
    const input = createInput.parse(req.body), userId = req.session.userId!;
    const { kanjiList, unsupported } = analyzeRoadmapKanji(input.rawKanji);
    if (!kanjiList.length) throw new HttpError(400, 'EMPTY_KANJI', 'Vui lòng nhập ít nhất một chữ Kanji.');
    if (unsupported.length) throw new HttpError(400, 'UNSUPPORTED_KANJI', `Chưa có dữ liệu cho các chữ: ${unsupported.join('、')}. Vui lòng sửa danh sách trước khi lưu.`);
    const result = await db.$transaction(async tx => {
      await lockRoadmaps(tx, userId);
      const before = await tx.personalRoadmap.findUnique({ where: { id: input.id } });
      if (before) {
        if (before.userId !== userId || before.name !== input.name || before.rawKanji !== input.rawKanji || before.perDay !== input.perDay) throw changed();
        return { roadmap: before, created: false };
      }
      if (await tx.personalRoadmap.count({ where: { userId } }) >= MAX_ROADMAPS) {
        throw new HttpError(400, 'ROADMAP_LIMIT', `Mỗi tài khoản tối đa ${MAX_ROADMAPS} lộ trình.`);
      }
      // Different accounts use different locks; an identical UUID still has one winner.
      const created = await tx.personalRoadmap.createMany({ data: [{ id: input.id, userId, name: input.name, rawKanji: input.rawKanji, kanjiList, perDay: input.perDay }], skipDuplicates: true });
      const roadmap = await tx.personalRoadmap.findFirst({ where: { id: input.id, userId } });
      if (!roadmap) throw changed();
      return { roadmap, created: created.count > 0 };
    });
    res.status(result.created ? 201 : 200).json({ userId, roadmap: toDto(result.roadmap) });
  });
  router.post('/update', async (req, res) => {
    const input = updateInput.parse(req.body), userId = req.session.userId!;
    const roadmap = await db.$transaction(async tx => {
      await lockRoadmaps(tx, userId);
      const before = await tx.personalRoadmap.findFirst({ where: { id: input.id, userId } });
      if (!before) throw missing();
      if (before.name === input.name && before.perDay === input.perDay && input.version <= before.version) return before;
      if (before.version !== input.version) throw changed();
      if (before.startedAt && before.perDay !== input.perDay) {
        throw new HttpError(409, 'ROADMAP_STARTED', 'Lộ trình đã bắt đầu học nên không thể đổi số Kanji mỗi ngày. Bạn vẫn có thể đổi tên.');
      }
      const updated = await tx.personalRoadmap.updateMany({ where: { id: input.id, userId, version: input.version,
        ...(before.perDay !== input.perDay ? { startedAt: null } : {}) }, data: { name: input.name, perDay: input.perDay, version: { increment: 1 } } });
      if (!updated.count) throw changed();
      return tx.personalRoadmap.findUniqueOrThrow({ where: { id: input.id } });
    });
    res.json({ userId, roadmap: toDto(roadmap) });
  });
  router.post('/delete', async (req, res) => {
    const input = deleteInput.parse(req.body), userId = req.session.userId!;
    await db.$transaction(async tx => {
      await lockRoadmaps(tx, userId);
      const before = await tx.personalRoadmap.findUnique({ where: { id: input.id } });
      if (!before) return;
      if (before.userId !== userId) throw missing();
      if (before.version !== input.version) throw changed();
      const deleted = await tx.personalRoadmap.deleteMany({ where: { id: input.id, userId, version: input.version } });
      if (!deleted.count) throw changed();
    });
    res.json({ userId, id: input.id });
  });
  router.post('/start', async (req, res) => {
    const input = startInput.parse(req.body), userId = req.session.userId!;
    const roadmap = await db.$transaction(async tx => {
      await lockRoadmaps(tx, userId);
      const before = await tx.personalRoadmap.findFirst({ where: { id: input.id, userId } });
      if (!before) throw missing();
      if (before.version !== input.version) throw changed();
      studyDayIds(before, input.day);
      // Merely opening a roadmap or choosing a day performs no write. Explicit study locks its goal.
      if (before.startedAt) return before;
      const updated = await tx.personalRoadmap.updateMany({
        where: { id: input.id, userId, version: input.version, startedAt: null },
        data: { startedAt: new Date(), progressVersion: { increment: 1 } },
      });
      if (!updated.count) throw changed();
      return tx.personalRoadmap.findUniqueOrThrow({ where: { id: input.id } });
    });
    res.json({ userId, roadmap: toDto(roadmap) });
  });
  router.post('/rate', async (req, res) => {
    const input = rateInput.parse(req.body), userId = req.session.userId!;
    const roadmap = await db.$transaction(async tx => {
      await lockRoadmaps(tx, userId);
      const before = await tx.personalRoadmap.findFirst({ where: { id: input.id, userId } });
      if (!before) throw missing();
      if (!before.startedAt) throw new HttpError(409, 'ROADMAP_NOT_STARTED', 'Vui lòng bắt đầu ngày học trước khi đánh giá.');
      if (before.progressVersion !== input.progressVersion) throw progressChanged();
      if (!studyDayIds(before, input.day).includes(input.kanjiId)) {
        throw new HttpError(400, 'INVALID_ROADMAP_KANJI', 'Chữ Kanji không thuộc ngày học này.');
      }
      const progress = assessRoadmapKanji(before.kanjiList, before.perDay, before.assessments, before.completedDays, input.day, input.kanjiId, input.memorized);
      const updated = await tx.personalRoadmap.updateMany({
        where: { id: input.id, userId, progressVersion: input.progressVersion },
        data: { assessments: progress.assessments, completedDays: progress.completedDays, progressVersion: { increment: 1 } },
      });
      if (!updated.count) throw progressChanged();
      // The existing Kanji status and roadmap assessment succeed together; stars/SRS are independent.
      await tx.kanjiProgress.upsert({ where: { userId_kanjiId: { userId, kanjiId: input.kanjiId } },
        create: { userId, kanjiId: input.kanjiId, memorized: input.memorized },
        update: { memorized: input.memorized, reviewedAt: new Date() },
      });
      return tx.personalRoadmap.findUniqueOrThrow({ where: { id: input.id } });
    });
    res.json({ userId, roadmap: toDto(roadmap) });
  });
  return router;
}
