import { Router, json } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import type { Config } from '../../config/env.js';
import { HttpError } from '../../common/errors.js';
import { evaluateVocabAi, parseVocabAiInput } from './vocab-ai.js';

export function vocabAiRoutes(db: PrismaClient, config: Config) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn gửi quá nhanh. Vui lòng đợi một phút.' } } }));
  router.use(json({ limit: '48kb' }));
  const currentUser = async (id?: string) => id && await db.user.findUnique({ where: { id }, select: { id: true } }) ? id : null;
  const ownedLesson = async (lessonId: string, userId: string) => {
    if (!await db.vocabLesson.findFirst({ where: { id: lessonId, userId }, select: { id: true } })) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy bài học của tài khoản này. Nội dung bạn nhập chưa được lưu.');
  };
  router.post('/', async (req, res) => {
    const userId = await currentUser(req.session.userId);
    if (!userId) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để dùng AI Format.');
    const input = parseVocabAiInput(req.body);
    if (input.expectedUserId !== userId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    await ownedLesson(input.lessonId, userId);
    const { result, cached } = await evaluateVocabAi(db, config, { id: input.id, userId, text: input.text });
    // Do not disclose a private preview to a session that changed while Gemini was running.
    await new Promise<void>((resolve, reject) => req.session.reload(error => error
      ? reject(new HttpError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.')) : resolve()));
    if (req.session.userId !== userId || !await currentUser(userId)) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    await ownedLesson(input.lessonId, userId);
    res.json({ userId, id: input.id, cached, result });
  });
  return router;
}
