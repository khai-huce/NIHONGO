import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { searchPitchAccent } from './pitch.service.js';

const integerQuery = (fallback: string, minimum: number, maximum: number) => z.string()
  .regex(/^\d+$/, 'Tham số phân trang phải là số nguyên không âm.').default(fallback)
  .transform(Number).pipe(z.number().int().min(minimum).max(maximum));
const querySchema = z.object({
  q: z.string().default('').transform(value => value.normalize('NFKC').trim())
    .refine(value => Array.from(value).length <= 100, 'Từ tra cứu tối đa 100 ký tự.')
    .refine(value => !value.includes('\0'), 'Từ tra cứu chứa ký tự không hợp lệ.'),
  offset: integerQuery('0', 0, 1_000_000),
  limit: integerQuery('20', 1, 50),
}).strict();

export function pitchAccentRoutes(db: PrismaClient) {
  const router = Router();
  router.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn tra cứu quá nhanh. Vui lòng đợi một phút.' } } }));
  router.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { q, offset, limit } = querySchema.parse(req.query);
    res.json(await searchPitchAccent(db, q, offset, limit));
  });
  return router;
}
