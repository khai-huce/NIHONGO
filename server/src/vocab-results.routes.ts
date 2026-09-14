import { createHash } from 'node:crypto';
import { Router, json } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { rateLimit } from 'express-rate-limit';
import { eligibleWords, isStudyAnswerCorrect, type StudyWord } from '../../shared/vocab-study.mjs';
import { HttpError } from './errors.js';
import { lockVocabChanges } from './vocab-review.js';

const kind = z.enum(['quiz', 'cram']);
const queryInput = z.object({ lessonId: z.string().uuid(), kind }).strict();
const resultInput = z.object({
  id: z.string().uuid(), expectedUserId: z.string().uuid(), lessonId: z.string().uuid(),
  lessonVersion: z.number().int().nonnegative(), kind,
  mode: z.enum(['reading', 'kanji', 'meaning', 'hanViet']),
  answers: z.array(z.object({ wordId: z.string().uuid(), answer: z.string().max(500).nullable() }).strict())
    .min(1, 'Chưa có câu trả lời để lưu.').max(500)
    .refine(items => new Set(items.map(item => item.wordId)).size === items.length, 'Mỗi từ chỉ được trả lời một lần trong lượt học.'),
}).strict().refine(input => input.kind === 'quiz'
  ? ['reading', 'kanji', 'meaning'].includes(input.mode)
  : ['reading', 'hanViet'].includes(input.mode), 'Chế độ học không hợp lệ.');

const resultSelect = {
  id: true, lessonId: true, lessonName: true, lessonVersion: true,
  kind: true, mode: true, total: true, correct: true, answers: true, completedAt: true,
} as const;
const conflict = () => new HttpError(409, 'RESULT_CONFLICT', 'Mã lượt học đã được dùng cho kết quả khác. Vui lòng mở lượt học mới.');

export function vocabResultsRoutes(db: PrismaClient) {
  const router = Router();
  router.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!req.session.userId || !await db.user.findUnique({ where: { id: req.session.userId }, select: { id: true } })) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để lưu kết quả học.');
    }
    next();
  });
  router.use(rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.' } },
  }));
  router.use(json({ limit: '512kb' }));

  router.get('/', async (req, res) => {
    const input = queryInput.parse(req.query), userId = req.session.userId!;
    const snapshot = await db.$transaction(async tx => {
      await lockVocabChanges(tx, userId);
      const lesson = await tx.vocabLesson.findFirst({ where: { id: input.lessonId, userId },
        select: { id: true, name: true, words: true, version: true } });
      if (!lesson) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy bài học.');
      const result = await tx.vocabStudyResult.findFirst({
        where: { userId, lessonId: lesson.id, kind: input.kind }, select: resultSelect,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      });
      return { lesson, result };
    });
    res.json({ userId, ...snapshot });
  });

  router.get('/:id', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id), userId = req.session.userId!;
    const result = await db.vocabStudyResult.findFirst({ where: { id, userId }, select: resultSelect });
    if (!result) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy kết quả học.');
    res.json({ userId, result });
  });

  router.post('/', async (req, res) => {
    const userId = req.session.userId!;
    if (req.body?.expectedUserId !== userId) {
      throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    }
    const input = resultInput.parse(req.body);
    // Order does not change the submitted answers. Keep exact answer text in the retry identity.
    const submissionHash = createHash('sha256').update(JSON.stringify({
      lessonId: input.lessonId, lessonVersion: input.lessonVersion, kind: input.kind, mode: input.mode,
      answers: [...input.answers].sort((a, b) => a.wordId.localeCompare(b.wordId)),
    })).digest('hex');
    const saved = await db.$transaction(async tx => {
      await lockVocabChanges(tx, userId);
      const prior = await tx.vocabStudyResult.findUnique({ where: { id: input.id } });
      if (prior) {
        if (prior.userId !== userId || prior.submissionHash !== submissionHash) throw conflict();
        return { created: false, result: await tx.vocabStudyResult.findUniqueOrThrow({ where: { id: input.id }, select: resultSelect }) };
      }
      const lesson = await tx.vocabLesson.findFirst({ where: { id: input.lessonId, userId },
        select: { id: true, name: true, version: true, words: true } });
      if (!lesson) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy bài học.');
      if (lesson.version !== input.lessonVersion) {
        throw new HttpError(409, 'LESSON_CHANGED', 'Bài học đã thay đổi. Tải lại bài và bắt đầu lượt mới; kết quả này chưa được lưu.');
      }
      const words = eligibleWords(lesson.words as StudyWord[], input.kind, input.mode);
      if (!words.length) throw new HttpError(400, 'NO_ELIGIBLE_WORDS', 'Bài chưa có từ đủ dữ liệu cho chế độ này.');
      const answerMap = new Map(input.answers.map(item => [item.wordId, item.answer]));
      if (answerMap.size !== words.length || words.some(item => !answerMap.has(item.id))) {
        throw new HttpError(400, 'INCOMPLETE_RESULT', 'Cần trả lời đủ các từ của lượt học trước khi lưu kết quả.');
      }
      const answers = words.map(item => {
        const answer = answerMap.get(item.id)!;
        return { wordId: item.id, answer, correct: isStudyAnswerCorrect(item, input.kind, input.mode, answer) };
      });
      // skipDuplicates also handles a UUID collision across accounts, whose user locks differ.
      const created = await tx.vocabStudyResult.createMany({ data: [{
        id: input.id, userId, lessonId: lesson.id, lessonName: lesson.name, lessonVersion: lesson.version,
        kind: input.kind, mode: input.mode, total: answers.length,
        correct: answers.filter(answer => answer.correct).length, answers, submissionHash, completedAt: new Date(),
      }], skipDuplicates: true });
      const result = await tx.vocabStudyResult.findUniqueOrThrow({ where: { id: input.id } });
      if (result.userId !== userId || result.submissionHash !== submissionHash) throw conflict();
      return { created: !!created.count,
        result: await tx.vocabStudyResult.findUniqueOrThrow({ where: { id: input.id }, select: resultSelect }) };
    });
    res.status(saved.created ? 201 : 200).json({ userId, result: saved.result });
  });
  return router;
}
