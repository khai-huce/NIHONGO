import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import type { Pool } from 'pg';
import type { Config } from '../../config/env.js';
import { HttpError } from '../../common/errors.js';
import { googleSchema, loginSchema, registerSchema } from './auth.schema.js';
import { googleLogin, login, publicUser, register } from './auth.service.js';
import { NONCE_AGE, saveSession, signIn, signOut } from './session.js';

export function authRoutes(config: Config, db: PrismaClient, pool: Pool) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const limitMessage = { error: { code: 'RATE_LIMITED', message: 'Bạn đã thử quá nhiều lần. Vui lòng đợi vài phút.' } };
  const ipLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: limitMessage });
  const emailLimit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false, message: limitMessage,
    skipSuccessfulRequests: true,
    keyGenerator: req => createHash('sha256').update(typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'missing-email').digest('hex'),
  });

  router.post('/register', ipLimit, emailLimit, async (req, res) => {
    const user = await register(db, registerSchema.parse(req.body));
    await signIn(req, user.id);
    res.status(201).json({ user: publicUser(user) });
  });
  router.post('/login', ipLimit, emailLimit, async (req, res) => {
    const user = await login(db, loginSchema.parse(req.body));
    await signIn(req, user.id);
    res.json({ user: publicUser(user) });
  });
  router.get('/me', async (req, res) => {
    const user = req.session.userId ? await db.user.findUnique({ where: { id: req.session.userId } }) : null;
    if (!user) {
      if (req.session.userId) await signOut(req, res, config);
      throw new HttpError(401, 'UNAUTHENTICATED', 'Bạn chưa đăng nhập hoặc phiên đã hết hạn.');
    }
    res.json({ user: publicUser(user) });
  });
  router.post('/logout', async (req, res) => {
    await signOut(req, res, config);
    res.status(204).end();
  });
  router.post('/google/nonce', ipLimit, async (req, res) => {
    if (!config.GOOGLE_CLIENT_ID) throw new HttpError(503, 'GOOGLE_NOT_CONFIGURED', 'Đăng nhập Google chưa sẵn sàng. Bạn có thể dùng email.');
    const nonce = randomBytes(32).toString('hex');
    req.session.googleNonce = { value: nonce, expiresAt: Date.now() + NONCE_AGE };
    await saveSession(req);
    res.json({ nonce });
  });
  router.post('/google', ipLimit, async (req, res) => {
    if (!config.GOOGLE_CLIENT_ID) throw new HttpError(503, 'GOOGLE_NOT_CONFIGURED', 'Đăng nhập Google chưa sẵn sàng. Bạn có thể dùng email.');
    const { credential } = googleSchema.parse(req.body);
    const nonce = req.session.googleNonce;
    if (!nonce || nonce.expiresAt <= Date.now()) throw new HttpError(401, 'GOOGLE_NONCE_EXPIRED', 'Vui lòng mở lại đăng nhập Google.');
    // Consume once atomically, including concurrent requests with the same cookie.
    const consumed = await pool.query(
      `UPDATE sessions SET sess = (sess::jsonb - 'googleNonce')::json
       WHERE sid = $1 AND sess->'googleNonce'->>'value' = $2 AND expire > NOW() RETURNING sid`,
      [req.sessionID, nonce.value],
    );
    delete req.session.googleNonce;
    if (!consumed.rowCount) throw new HttpError(401, 'GOOGLE_NONCE_EXPIRED', 'Vui lòng mở lại đăng nhập Google.');
    const user = await googleLogin(db, config.GOOGLE_CLIENT_ID, credential, nonce.value);
    await signIn(req, user.id);
    res.json({ user: publicUser(user) });
  });
  return router;
}
