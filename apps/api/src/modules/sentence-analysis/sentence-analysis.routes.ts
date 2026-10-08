import { Router, json } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import type { Config } from '../../config/env.js';
import { HttpError } from '../../common/errors.js';
import { sentenceInput, sentenceAiInput } from './sentence-analysis.schema.js';
import { analyzeSentence, matchSentencePatterns } from './sentence-catalog.js';
import { evaluateSentenceAi } from './sentence-ai.js';

export function sentenceAnalysisRoutes(db: PrismaClient, config: Config) {
  const router = Router();
  router.use(json({ limit: '8kb' }));
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(rateLimit({ windowMs: 60000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn phân tích quá nhanh. Vui lòng đợi một phút.' } } }));
  const currentUser = async (id?: string) => id && await db.user.findUnique({ where: { id }, select: { id: true } }) ? id : null;
  router.post('/analyze', async (req, res) => {
    const input = sentenceInput.parse(req.body), userId = await currentUser(req.session.userId);
    if (input.expectedUserId !== userId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    res.json({ userId, analysis: await analyzeSentence(db, input.sentence) });
  });
  router.post('/ai', async (req, res) => {
    const input = sentenceAiInput.parse(req.body), userId = await currentUser(req.session.userId);
    if (!userId) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để phân tích bằng Gemini.');
    if (input.expectedUserId !== userId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    const base = await analyzeSentence(db, input.sentence);
    const { content, cached } = await evaluateSentenceAi(db, config, { id: input.id, userId }, base);
    // A long AI request may outlive a logout/account switch in another tab.
    await new Promise<void>((resolve, reject) => req.session.reload(error => error ? reject(new HttpError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.')) : resolve()));
    if (req.session.userId !== userId || !await currentUser(userId)) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    // Re-resolve public links on every response, including cache hits after an admin archives content.
    res.json({ userId, cached, analysis: { ...content, patterns: await matchSentencePatterns(db, content.patterns) } });
  });
  return router;
}
