import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { DefaultRoadmapProgress, Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_ROADMAP, studyStreak, vietnamStudyDate } from '../../shared/default-roadmap.mjs';
import { ROADMAP_KANJI, roadmapDayKanji } from '../../shared/roadmap.mjs';
import { assessRoadmapKanji, roadmapProgress } from '../../shared/roadmap-study.mjs';
import { HttpError } from './errors.js';

const { id: catalogId, kanjiList, perDay } = DEFAULT_ROADMAP;
const totalDays = Math.ceil(kanjiList.length / perDay);
const identity = { expectedUserId: z.string().uuid(), catalogId: z.literal(catalogId) };
const day = z.number().int().positive().max(2000);
const startInput = z.object({ ...identity, day }).strict();
const rateInput = z.object({ ...identity, day, progressVersion: z.number().int().nonnegative().max(2147483647),
  kanjiId: z.string().min(1).max(32), memorized: z.boolean() }).strict();
const idsByCharacter = new Map(ROADMAP_KANJI.map(([id, character]) => [character, id]));
const changed = () => new HttpError(409, 'ROADMAP_PROGRESS_CHANGED', 'Tiến độ đã thay đổi ở phiên khác. Vui lòng tải lại trước khi đánh giá tiếp.');

function studyDayIds(day: number) {
  if (day > totalDays) throw new HttpError(400, 'INVALID_ROADMAP_DAY', 'Ngày học không tồn tại trong lộ trình.');
  return roadmapDayKanji(kanjiList, perDay, day).map(character => idsByCharacter.get(character));
}

function toDto(saved: DefaultRoadmapProgress | null, now: Date) {
  const progress = roadmapProgress(kanjiList, perDay, saved?.assessments, saved?.completedDays);
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
    res.json({ userId, roadmap: toDto(saved, now), serverNow: now });
  });
  router.use((req, _res, next) => {
    if (req.body?.expectedUserId !== req.session.userId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    next();
  });
  router.post('/start', async (req, res) => {
    const input = startInput.parse(req.body), userId = req.session.userId!;
    studyDayIds(input.day);
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
    res.json({ userId, roadmap: toDto(saved, now), serverNow: now });
  });
  router.post('/rate', async (req, res) => {
    const input = rateInput.parse(req.body), userId = req.session.userId!;
    const dayIds = studyDayIds(input.day);
    if (!dayIds.includes(input.kanjiId)) throw new HttpError(400, 'INVALID_ROADMAP_KANJI', 'Chữ Kanji không thuộc ngày học này.');
    const saved = await db.$transaction(async tx => {
      await lockDefaultRoadmap(tx, userId);
      const where = { userId_catalogId: { userId, catalogId } };
      const before = await tx.defaultRoadmapProgress.findUnique({ where });
      if (!before?.startedAt) throw new HttpError(409, 'ROADMAP_NOT_STARTED', 'Vui lòng bắt đầu ngày học trước khi đánh giá.');
      if (before.progressVersion !== input.progressVersion) throw changed();
      const progress = assessRoadmapKanji(kanjiList, perDay, before.assessments, before.completedDays, input.day, input.kanjiId, input.memorized);
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
      return tx.defaultRoadmapProgress.findUniqueOrThrow({ where });
    });
    const now = new Date();
    res.json({ userId, roadmap: toDto(saved, now), serverNow: now });
  });
  return router;
}
