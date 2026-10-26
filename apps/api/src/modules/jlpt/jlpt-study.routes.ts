import { Router, json } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../../common/errors.js';
import { jlptId, jlptLevel } from './jlpt.schema.js';
import { publicJlpt, jlptTransactionOptions } from './jlpt.service.js';
import { accountLock, attemptView, jlptStudy, openJlptSession, startJlptAttempt, writeJlptAttempt } from './jlpt-study.service.js';

export function jlptStudyRoutes(db: PrismaClient) {
  const router = Router();
  router.use(json({ limit: '64kb' }), async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!req.session.userId || !await db.user.findUnique({ where: { id: req.session.userId }, select: { id: true } })) throw new HttpError(401, 'UNAUTHENTICATED', 'Đăng nhập để học và lưu tiến độ JLPT.');
    if (req.method !== 'GET' && req.body?.expectedUserId !== req.session.userId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại.');
    next();
  });
  router.use(rateLimit({ windowMs: 60000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại.' } } }));
  router.get('/roadmaps/:level', async (req, res) => {
    const level = jlptLevel.parse(req.params.level), userId = req.session.userId!;
    res.json(await db.$transaction(async tx => { await accountLock(tx, userId); return jlptStudy(tx, userId, await publicJlpt(tx, level)); }, jlptTransactionOptions));
  });
  const sessionInput = z.object({ expectedUserId: jlptId, publishedVersion: z.number().int().positive() }).strict();
  router.post('/roadmaps/:level/sessions/:sessionId/open', async (req, res) => {
    const input = sessionInput.parse(req.body), userId = req.session.userId!;
    res.json(await openJlptSession(db, userId, jlptLevel.parse(req.params.level), jlptId.parse(req.params.sessionId), input.publishedVersion));
  });
  router.post('/roadmaps/:level/sessions/:sessionId/attempts', async (req, res) => {
    const input = sessionInput.extend({ id: jlptId }).parse(req.body), userId = req.session.userId!;
    res.json({ userId, attempt: await startJlptAttempt(db, userId, jlptLevel.parse(req.params.level), jlptId.parse(req.params.sessionId), input.publishedVersion, input.id) });
  });
  router.get('/attempts/:id', async (req, res) => {
    const userId = req.session.userId!, row = await db.jlptAttempt.findFirst({ where: { id: jlptId.parse(req.params.id), userId } });
    if (!row) throw new HttpError(404, 'JLPT_ATTEMPT_NOT_FOUND', 'Không tìm thấy lượt kiểm tra.');
    res.json({ userId, attempt: attemptView(row) });
  });
  router.get('/sessions/:id/attempts', async (req, res) => {
    const userId = req.session.userId!, page = z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page), sessionId = jlptId.parse(req.params.id);
    const where = { userId, sessionId, submittedAt: { not: null } };
    const [total, rows] = await Promise.all([db.jlptAttempt.count({ where }), db.jlptAttempt.findMany({ where, skip: (page - 1) * 20, take: 20, orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
      select: { id: true, score: true, passed: true, passPercent: true, submittedAt: true } })]);
    res.json({ userId, items: rows, total, page });
  });
  const answers = z.record(z.string().uuid(), z.number().int().min(0).max(3));
  for (const action of ['save', 'submit'] as const) router.post(`/attempts/:id/${action}`, async (req, res) => {
    const input = z.object({ expectedUserId: jlptId, version: z.number().int().nonnegative(), answers }).strict().parse(req.body), userId = req.session.userId!;
    res.json({ userId, attempt: await writeJlptAttempt(db, userId, jlptId.parse(req.params.id), input.version, input.answers, action === 'submit') });
  });
  return router;
}
