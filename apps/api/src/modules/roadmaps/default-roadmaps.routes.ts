import { Router } from 'express';
import { awardLearningXp } from '../leaderboard/leaderboard.service.js';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { CatalogDefinition, DefaultRoadmapProgress, Prisma, PrismaClient } from '@prisma/client';
import { studyStreak, vietnamStudyDate } from '@nihongo/shared/study/default-roadmap';
import { roadmapDayKanji } from '@nihongo/shared/study/roadmap';
import { assessRoadmapKanji, roadmapProgress } from '@nihongo/shared/study/roadmap-study';
import { HttpError } from '../../common/errors.js';
import { loadRoadmapDefinition, type ContentDb } from '../content/content.service.js';

const catalogId = 'n5-v1';
async function definition(db: ContentDb) {
  const value = await loadRoadmapDefinition(db, catalogId);
  if (!value) throw new HttpError(503, 'CONTENT_UNAVAILABLE', 'Lộ trình chưa được nhập vào kho nội dung.');
  return value;
}
const pairsFor = (catalog: CatalogDefinition) => catalog.kanjiIds.map((id, index) => [id, catalog.kanjiList[index]] as const);
const identity = { expectedUserId: z.string().uuid(), catalogId: z.literal(catalogId) };
const day = z.number().int().positive().max(2000);
const startInput = z.object({ ...identity, day }).strict();
const rateInput = z.object({ ...identity, day, progressVersion: z.number().int().nonnegative().max(2147483647),
  kanjiId: z.string().min(1).max(32), memorized: z.boolean() }).strict();
const changed = () => new HttpError(409, 'ROADMAP_PROGRESS_CHANGED', 'Tiến độ đã thay đổi ở phiên khác. Vui lòng tải lại trước khi đánh giá tiếp.');

function studyDayIds(day: number, catalog: CatalogDefinition) {
  const { kanjiList, perDay } = catalog;
  const totalDays = Math.ceil(kanjiList.length / perDay);
  const idsByCharacter = new Map(pairsFor(catalog).map(([id, character]) => [character, id]));
  if (day > totalDays) throw new HttpError(400, 'INVALID_ROADMAP_DAY', 'Ngày học không tồn tại trong lộ trình.');
  return roadmapDayKanji(kanjiList, perDay, day).map(character => idsByCharacter.get(character));
}

function toDto(saved: DefaultRoadmapProgress | null, now: Date, catalog: CatalogDefinition) {
  const { kanjiList, perDay } = catalog;
  const totalDays = Math.ceil(kanjiList.length / perDay);
  const progress = roadmapProgress(kanjiList, perDay, saved?.assessments, saved?.completedDays, pairsFor(catalog));
  const activityDays = saved?.activityDays ?? [];
  return {
    id: catalogId, kanjiList, perDay, totalDays, ...progress,
    progressVersion: saved?.progressVersion ?? 0, startedAt: saved?.startedAt ?? null,
    activityDays, streak: studyStreak(activityDays, now),
  };
}

async function lockDefaultRoadmap(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`default-roadmap:${userId}:${catalogId}`}, 0))`;
}

export function defaultRoadmapRoutes(db: PrismaClient) {
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
    const saved = await db.defaultRoadmapProgress.findUnique({ where: { userId_catalogId: { userId, catalogId } } });
    // Looking at the plan creates no progress and never imports personal/global study data.
    const now = new Date();
    res.json({ userId, roadmap: toDto(saved, now, await definition(db)), serverNow: now });
  });
  router.use((req, _res, next) => {
    if (req.body?.expectedUserId !== req.session.userId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    next();
  });
  router.post('/start', async (req, res) => {
    const input = startInput.parse(req.body), userId = req.session.userId!;
    studyDayIds(input.day, await definition(db));
    const saved = await db.$transaction(async tx => {
      await lockDefaultRoadmap(tx, userId);
      const where = { userId_catalogId: { userId, catalogId } };
      const before = await tx.defaultRoadmapProgress.findUnique({ where });
      if (before?.startedAt) return before;
      return tx.defaultRoadmapProgress.upsert({ where,
        create: { userId, catalogId, startedAt: new Date(), progressVersion: 1 },
        update: { startedAt: new Date(), progressVersion: { increment: 1 } },
      });
    });
    const now = new Date();
    res.json({ userId, roadmap: toDto(saved, now, await definition(db)), serverNow: now });
  });
  router.post('/rate', async (req, res) => {
    const input = rateInput.parse(req.body), userId = req.session.userId!;
    const dayIds = studyDayIds(input.day, await definition(db));
    if (!dayIds.includes(input.kanjiId)) throw new HttpError(400, 'INVALID_ROADMAP_KANJI', 'Chữ Kanji không thuộc ngày học này.');
    const saved = await db.$transaction(async tx => {
      await lockDefaultRoadmap(tx, userId);
      const where = { userId_catalogId: { userId, catalogId } };
      const before = await tx.defaultRoadmapProgress.findUnique({ where });
      if (!before?.startedAt) throw new HttpError(409, 'ROADMAP_NOT_STARTED', 'Vui lòng bắt đầu ngày học trước khi đánh giá.');
      if (before.progressVersion !== input.progressVersion) throw changed();
      const catalog = await definition(tx);
      const progress = assessRoadmapKanji(catalog.kanjiList, catalog.perDay, before.assessments, before.completedDays, input.day, input.kanjiId, input.memorized, pairsFor(catalog));
      const now = new Date();
      const activityDays = [...new Set([...before.activityDays, vietnamStudyDate(now)])].sort();
      const updated = await tx.defaultRoadmapProgress.updateMany({
        where: { userId, catalogId, progressVersion: input.progressVersion },
        data: { assessments: progress.assessments, completedDays: progress.completedDays, activityDays, progressVersion: { increment: 1 } },
      });
      if (!updated.count) throw changed();
      // One successful rating updates both statuses; stars and SRS are untouched.
      await tx.kanjiProgress.upsert({ where: { userId_kanjiId: { userId, kanjiId: input.kanjiId } },
        create: { userId, kanjiId: input.kanjiId, memorized: input.memorized, reviewedAt: now },
        update: { memorized: input.memorized, reviewedAt: now },
      });
      if (!before.completedDays.includes(input.day) && progress.completedDays.includes(input.day)) {
        await awardLearningXp(tx, userId, [{ kind: 'roadmap', sourceKey: `default:${catalogId}:${input.day}` }], now);
      }
      return tx.defaultRoadmapProgress.findUniqueOrThrow({ where });
    });
    const now = new Date();
    res.json({ userId, roadmap: toDto(saved, now, await definition(db)), serverNow: now });
  });
  return router;
}
