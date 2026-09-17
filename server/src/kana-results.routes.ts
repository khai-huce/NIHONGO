import { createHash } from 'node:crypto';
import { Router, json } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { rateLimit } from 'express-rate-limit';
import { KANA_CATALOG_ID, KANA_COUNT, gradeKanaAnswers } from '../../shared/kana-quiz.mjs';
import { HttpError } from './errors.js';

const resultInput = z.object({
  id: z.string().uuid(), expectedUserId: z.string().uuid(), catalogId: z.literal(KANA_CATALOG_ID),
  mode: z.enum(['hiragana', 'katakana', 'both']),
  answers: z.array(z.object({
    kanaId: z.string().min(1).max(32), script: z.enum(['hiragana', 'katakana']), answerId: z.string().min(1).max(32),
  }).strict()).length(KANA_COUNT, `Cần trả lời đủ ${KANA_COUNT} câu trước khi lưu kết quả.`),
}).strict();
const resultSelect = { id: true, catalogId: true, mode: true, total: true, correct: true, answers: true, completedAt: true } as const;
const conflict = () => new HttpError(409, 'RESULT_CONFLICT', 'Mã lượt học đã được dùng cho kết quả khác. Vui lòng mở lượt học mới.');

export function kanaResultsRoutes(db: PrismaClient) {
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
  router.use(json({ limit: '32kb' }));

  router.get('/', async (req, res) => {
    z.object({}).strict().parse(req.query);
    const userId = req.session.userId!;
    const result = await db.kanaQuizResult.findFirst({ where: { userId }, select: resultSelect,
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    });
    res.json({ userId, result });
  });

  router.post('/', async (req, res) => {
    const userId = req.session.userId!;
    if (req.body?.expectedUserId !== userId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    const input = resultInput.parse(req.body);
    const submissionHash = createHash('sha256').update(JSON.stringify({
      catalogId: input.catalogId, mode: input.mode, answers: input.answers,
    })).digest('hex');
    const saved = await db.$transaction(async tx => {
      const prior = await tx.kanaQuizResult.findUnique({ where: { id: input.id } });
      if (prior) {
        if (prior.userId !== userId || prior.submissionHash !== submissionHash) throw conflict();
        return { created: false, result: await tx.kanaQuizResult.findUniqueOrThrow({ where: { id: input.id }, select: resultSelect }) };
      }
      let graded: ReturnType<typeof gradeKanaAnswers>;
      try { graded = gradeKanaAnswers(input.mode, input.answers); }
      catch (error) {
        throw new HttpError(400, 'INVALID_KANA_RESULT', error instanceof Error ? error.message : 'Kết quả bảng chữ cái không hợp lệ.');
      }
      // The primary key and skipDuplicates also serialize simultaneous submissions across accounts.
      const created = await tx.kanaQuizResult.createMany({ data: [{
        id: input.id, userId, catalogId: input.catalogId, mode: input.mode, total: graded.total,
        correct: graded.correct, answers: graded.answers, submissionHash, completedAt: new Date(),
      }], skipDuplicates: true });
      const result = await tx.kanaQuizResult.findUniqueOrThrow({ where: { id: input.id } });
      if (result.userId !== userId || result.submissionHash !== submissionHash) throw conflict();
      return { created: !!created.count,
        result: await tx.kanaQuizResult.findUniqueOrThrow({ where: { id: input.id }, select: resultSelect }) };
    });
    res.status(saved.created ? 201 : 200).json({ userId, result: saved.result });
  });
  return router;
}
