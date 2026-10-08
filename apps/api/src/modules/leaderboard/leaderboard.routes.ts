import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { readLeaderboard } from './leaderboard.service.js';

const querySchema = z.object({ period: z.enum(['all', 'month']).default('all') }).strict();
export function leaderboardRoutes(db: PrismaClient) {
  const router = Router();
  router.use(rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn tải bảng xếp hạng quá nhanh. Vui lòng đợi một phút.' } } }));
  router.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { period } = querySchema.parse(req.query);
    res.json(await readLeaderboard(db, period, req.session.userId ?? null));
  });
  return router;
}
