import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../../common/errors.js';
import { lockVocabChanges } from './vocab-review.js';

const identity = {
  lessonId: z.string().uuid(),
  expectedUserId: z.string().uuid(),
  lessonVersion: z.number().int().nonnegative(),
  progressVersion: z.number().int().nonnegative(),
};
const rateInput = z.object({ ...identity, wordId: z.string().uuid(), memorized: z.boolean() }).strict();
const resetInput = z.object({ ...identity, confirmedCount: z.number().int().min(0).max(500) }).strict();
const queryInput = z.object({ lessonId: z.string().uuid() }).strict();
const lessonSelect = {
  id: true, words: true, version: true, progressVersion: true,
  progress: { select: { wordId: true, memorized: true }, orderBy: { wordId: 'asc' as const } },
} as const;
type Lesson = Prisma.VocabLessonGetPayload<{ select: typeof lessonSelect }>;

const changed = () => new HttpError(409, 'PROGRESS_CHANGED',
  'Bài học hoặc tiến độ đã thay đổi ở phiên khác. Vui lòng tải lại tiến độ trước khi học tiếp.');

async function loadLesson(tx: Prisma.TransactionClient, userId: string, lessonId: string) {
  const lesson = await tx.vocabLesson.findFirst({ where: { id: lessonId, userId }, select: lessonSelect });
  if (!lesson) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy bài học.');
  return lesson;
}

function snapshot(userId: string, lesson: Lesson) {
  return { userId, lessonId: lesson.id, lessonVersion: lesson.version,
    progressVersion: lesson.progressVersion, words: lesson.words, progress: lesson.progress };
}

function checkVersions(lesson: Lesson, input: { lessonVersion: number; progressVersion: number }) {
  if (lesson.version !== input.lessonVersion || lesson.progressVersion !== input.progressVersion) throw changed();
}

export function vocabProgressRoutes(db: PrismaClient) {
  const router = Router();
  router.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const userId = req.session.userId;
    if (!userId || !await db.user.findUnique({ where: { id: userId }, select: { id: true } })) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập lại để lưu tiến độ.');
    }
    next();
  });
  router.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.' } },
  }));
  router.get('/', async (req, res) => {
    const { lessonId } = queryInput.parse(req.query), userId = req.session.userId!;
    const result = await db.$transaction(async tx => {
      // Content, statuses and both versions must describe the same point in time.
      await lockVocabChanges(tx, userId);
      return snapshot(userId, await loadLesson(tx, userId, lessonId));
    });
    res.json(result);
  });
  router.use((req, _res, next) => {
    if (req.body?.expectedUserId !== req.session.userId) {
      throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã thay đổi. Vui lòng tải lại trang trước khi học tiếp.');
    }
    next();
  });
  router.post('/rate', async (req, res) => {
    const input = rateInput.parse(req.body), userId = req.session.userId!;
    const result = await db.$transaction(async tx => {
      await lockVocabChanges(tx, userId);
      const lesson = await loadLesson(tx, userId, input.lessonId);
      checkVersions(lesson, input);
      const wordExists = Array.isArray(lesson.words) && lesson.words.some(item =>
        item !== null && typeof item === 'object' && !Array.isArray(item) && item.id === input.wordId);
      if (!wordExists) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy từ trong bài học.');
      const existing = await tx.vocabProgress.findUnique({
        where: { userId_wordId: { userId, wordId: input.wordId } }, select: { lessonId: true },
      });
      if (existing && existing.lessonId !== input.lessonId) {
        throw new HttpError(409, 'WORD_ID_EXISTS', 'ID từ đã được dùng trong bài học khác. Vui lòng tải lại bài học.');
      }
      await tx.vocabProgress.upsert({
        where: { userId_wordId: { userId, wordId: input.wordId } },
        create: { userId, lessonId: input.lessonId, wordId: input.wordId, memorized: input.memorized },
        update: { memorized: input.memorized },
      });
      await tx.vocabLesson.update({ where: { id: input.lessonId }, data: { progressVersion: { increment: 1 } } });
      return snapshot(userId, await loadLesson(tx, userId, input.lessonId));
    });
    res.json(result);
  });
  router.post('/reset', async (req, res) => {
    const input = resetInput.parse(req.body), userId = req.session.userId!;
    const result = await db.$transaction(async tx => {
      await lockVocabChanges(tx, userId);
      const lesson = await loadLesson(tx, userId, input.lessonId);
      checkVersions(lesson, input);
      if (lesson.progress.length !== input.confirmedCount) throw changed();
      await tx.vocabProgress.deleteMany({ where: { userId, lessonId: input.lessonId } });
      // Even an empty reset invalidates old study screens.
      await tx.vocabLesson.update({ where: { id: input.lessonId }, data: { progressVersion: { increment: 1 } } });
      return snapshot(userId, await loadLesson(tx, userId, input.lessonId));
    });
    res.json(result);
  });
  return router;
}
