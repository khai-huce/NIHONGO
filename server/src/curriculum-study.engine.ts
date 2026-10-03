import { createHash } from 'node:crypto';
import { Router, json } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { eligibleWords, isStudyAnswerCorrect } from '../../shared/vocab-study.mjs';
import { HttpError } from './errors.js';
import { lockVocabChanges } from './vocab-review.js';
import type { CurriculumWord } from './curriculum.schema.js';

export const studyUuid = z.string().uuid().transform(value => value.toLowerCase());
const identity = { lessonId: studyUuid, expectedUserId: studyUuid, lessonVersion: z.number().int().nonnegative() };
const rating = z.object({ ...identity, progressVersion: z.number().int().nonnegative(), wordId: studyUuid, memorized: z.boolean() }).strict();
const changed = () => new HttpError(409, 'PROGRESS_CHANGED', 'Bài học hoặc tiến độ đã thay đổi. Vui lòng tải lại trước khi học tiếp.');
const conflict = () => new HttpError(409, 'RESULT_CONFLICT', 'Mã lượt học đã được dùng cho kết quả khác.');
export function checkStudyOwner(actual: string, expected: unknown) {
  if (actual !== expected) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã thay đổi. Vui lòng tải lại trang.');
}

export type StudyUnit = { id: string; title: string; version: number; words: CurriculumWord[] };
export type StudyProgress = { progress: Prisma.JsonValue; version: number; completedAt: Date | null };
export type StoredStudyResult = {
  id: string; userId: string; lessonId: string; lessonName: string; lessonVersion: number;
  kind: string; mode: string; total: number; correct: number; answers: Prisma.JsonValue;
  submissionHash: string; completedAt: Date;
};
type NewStudyResult = Omit<StoredStudyResult, 'completedAt' | 'answers'> & { answers: Prisma.InputJsonValue };

// Only content resolution and persistence differ between a lesson and a selected-lesson review.
export type CurriculumStudyStore = {
  maxWords: number;
  load(tx: Prisma.TransactionClient, userId: string, id: string): Promise<StudyUnit>;
  progress(tx: Prisma.TransactionClient, userId: string, id: string): Promise<StudyProgress | null>;
  saveProgress(tx: Prisma.TransactionClient, userId: string, id: string, progress: Record<string, boolean>, completedAt: Date | null): Promise<StudyProgress>;
  complete(tx: Prisma.TransactionClient, userId: string, id: string, at: Date): Promise<void>;
  latest(tx: Prisma.TransactionClient, userId: string, id: string, kind: string): Promise<StoredStudyResult | null>;
  result(tx: Prisma.TransactionClient, id: string): Promise<StoredStudyResult | null>;
  createResult(tx: Prisma.TransactionClient, result: NewStudyResult): Promise<boolean>;
};

export function authenticatedCurriculumRouter(db: PrismaClient, limit: '512kb' | '4mb' = '512kb') {
  const router = Router();
  router.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!req.session.userId || !await db.user.findUnique({ where: { id: req.session.userId }, select: { id: true } })) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để lưu tiến độ giáo trình.');
    }
    next();
  });
  router.use(rateLimit({ windowMs: 60000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.' } } }));
  router.use(json({ limit }));
  return router;
}

function progressSnapshot(userId: string, lesson: StudyUnit, row: StudyProgress | null) {
  const saved = (row?.progress ?? {}) as Record<string, boolean>;
  return { userId, lessonId: lesson.id, lessonVersion: lesson.version, progressVersion: row?.version ?? 0,
    words: lesson.words, completedAt: row?.completedAt ?? null,
    progress: lesson.words.filter(word => typeof saved[word.id] === 'boolean').map(word => ({ wordId: word.id, memorized: saved[word.id] })),
  };
}
function resultDto(row: StoredStudyResult) {
  return { id: row.id, lessonId: row.lessonId, lessonName: row.lessonName, lessonVersion: row.lessonVersion,
    kind: row.kind, mode: row.mode, total: row.total, correct: row.correct, answers: row.answers, completedAt: row.completedAt };
}

export function curriculumStudyEngine(db: PrismaClient, store: CurriculumStudyStore) {
  const router = Router();
  const resetting = z.object({ ...identity, progressVersion: z.number().int().nonnegative(), confirmedCount: z.number().int().min(0).max(store.maxWords) }).strict();
  const submission = z.object({ ...identity, id: studyUuid, kind: z.enum(['quiz', 'cram']), mode: z.enum(['reading', 'kanji', 'meaning', 'hanViet']),
    answers: z.array(z.object({ wordId: studyUuid, answer: z.string().max(2000).nullable() }).strict()).min(1).max(store.maxWords),
  }).strict().refine(input => input.kind === 'quiz' ? ['reading', 'kanji', 'meaning'].includes(input.mode) : ['reading', 'hanViet'].includes(input.mode), 'Chế độ học không hợp lệ.');

  router.get('/progress', async (req, res) => {
    const { lessonId } = z.object({ lessonId: studyUuid }).strict().parse(req.query), userId = req.session.userId!;
    const data = await db.$transaction(async tx => {
      const lesson = await store.load(tx, userId, lessonId);
      await lockVocabChanges(tx, userId);
      return progressSnapshot(userId, lesson, await store.progress(tx, userId, lessonId));
    });
    res.json(data);
  });
  for (const action of ['rate', 'reset'] as const) router.post(`/progress/${action}`, async (req, res) => {
    const userId = req.session.userId!;
    checkStudyOwner(userId, req.body?.expectedUserId);
    const input = action === 'rate' ? rating.parse(req.body) : resetting.parse(req.body);
    const data = await db.$transaction(async tx => {
      const lesson = await store.load(tx, userId, input.lessonId);
      await lockVocabChanges(tx, userId);
      const row = await store.progress(tx, userId, lesson.id);
      if (lesson.version !== input.lessonVersion || (row?.version ?? 0) !== input.progressVersion) throw changed();
      const before = (row?.progress ?? {}) as Record<string, boolean>;
      let progress: Record<string, boolean>;
      if ('wordId' in input) {
        if (!lesson.words.some(word => word.id === input.wordId)) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy từ trong bài.');
        progress = { ...before, [input.wordId]: input.memorized };
      } else {
        if (lesson.words.filter(word => typeof before[word.id] === 'boolean').length !== input.confirmedCount) throw changed();
        progress = {};
      }
      const completedAt = row?.completedAt ?? (lesson.words.length && lesson.words.every(word => typeof progress[word.id] === 'boolean') ? new Date() : null);
      const next = await store.saveProgress(tx, userId, lesson.id, progress, completedAt);
      return progressSnapshot(userId, lesson, next);
    });
    res.json(data);
  });
  router.get('/results', async (req, res) => {
    const input = z.object({ lessonId: studyUuid, kind: z.enum(['quiz', 'cram']) }).strict().parse(req.query), userId = req.session.userId!;
    const data = await db.$transaction(async tx => {
      const lesson = await store.load(tx, userId, input.lessonId);
      await lockVocabChanges(tx, userId);
      const result = await store.latest(tx, userId, lesson.id, input.kind);
      return { lesson: { id: lesson.id, name: lesson.title, version: lesson.version, words: lesson.words }, result: result ? resultDto(result) : null };
    });
    res.json({ userId, ...data });
  });
  router.post('/results', async (req, res) => {
    const userId = req.session.userId!;
    checkStudyOwner(userId, req.body?.expectedUserId);
    const input = submission.parse(req.body);
    const submissionHash = createHash('sha256').update(JSON.stringify({ lessonId: input.lessonId, lessonVersion: input.lessonVersion,
      kind: input.kind, mode: input.mode, answers: [...input.answers].sort((a, b) => a.wordId.localeCompare(b.wordId)) })).digest('hex');
    const saved = await db.$transaction(async tx => {
      const lesson = await store.load(tx, userId, input.lessonId);
      await lockVocabChanges(tx, userId);
      const prior = await store.result(tx, input.id);
      if (prior) {
        if (prior.userId !== userId || prior.submissionHash !== submissionHash) throw conflict();
        return { created: false, result: resultDto(prior) };
      }
      if (lesson.version !== input.lessonVersion) throw new HttpError(409, 'LESSON_CHANGED', 'Bài học đã được cập nhật. Tải lại và bắt đầu lượt mới; kết quả này chưa lưu.');
      const words = eligibleWords(lesson.words, input.kind, input.mode), answersById = new Map(input.answers.map(answer => [answer.wordId, answer.answer]));
      if (!words.length) throw new HttpError(400, 'NO_ELIGIBLE_WORDS', 'Bài chưa có từ đủ dữ liệu cho chế độ này.');
      if (answersById.size !== input.answers.length || answersById.size !== words.length || words.some(word => !answersById.has(word.id))) {
        throw new HttpError(400, 'INCOMPLETE_RESULT', 'Cần trả lời đủ các từ của lượt học trước khi lưu.');
      }
      const answers = words.map(word => ({ wordId: word.id, answer: answersById.get(word.id)!, correct: isStudyAnswerCorrect(word, input.kind, input.mode, answersById.get(word.id)!) }));
      const created = await store.createResult(tx, { id: input.id, userId, lessonId: lesson.id, lessonName: lesson.title,
        lessonVersion: lesson.version, kind: input.kind, mode: input.mode, total: answers.length,
        correct: answers.filter(answer => answer.correct).length, answers, submissionHash });
      const stored = await store.result(tx, input.id);
      if (!stored || stored.userId !== userId || stored.submissionHash !== submissionHash) throw conflict();
      await store.complete(tx, userId, lesson.id, stored.completedAt);
      return { created, result: resultDto(stored) };
    }, { timeout: 30000 });
    res.status(saved.created ? 201 : 200).json({ userId, result: saved.result });
  });
  router.post('/star-lesson', async (req, res) => {
    const userId = req.session.userId!;
    checkStudyOwner(userId, req.body?.expectedUserId);
    const input = z.object(identity).strict().parse(req.body);
    const count = await db.$transaction(async tx => {
      const lesson = await store.load(tx, userId, input.lessonId);
      await lockVocabChanges(tx, userId);
      if (lesson.version !== input.lessonVersion) throw changed();
      // Bound query parameters for the explicitly requested bulk star of up to 5,000 words.
      for (let start = 0; start < lesson.words.length; start += 250) {
        const words = lesson.words.slice(start, start + 250);
        await tx.reviewCard.createMany({ data: words.map(word => ({ userId, category: 'vocab', sourceId: `curriculum:${word.id}`,
          front: word.word, back: word.meaning, reading: word.reading, active: true })), skipDuplicates: true });
        await tx.reviewCard.updateMany({ where: { userId, category: 'vocab', sourceId: { in: words.map(word => `curriculum:${word.id}`) }, active: false },
          data: { active: true, version: { increment: 1 } } });
      }
      return lesson.words.length;
    }, { timeout: 30000 });
    res.json({ userId, count });
  });
  return router;
}
