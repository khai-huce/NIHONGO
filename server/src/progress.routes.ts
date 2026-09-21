import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from './errors.js';
import { getKanji } from './content.service.js';

const input = z.object({
  kanjiId: z.string().min(1).max(32),
  memorized: z.boolean(),
  expectedUserId: z.string().uuid(),
}).strict();
const select = { kanjiId: true, memorized: true, reviewedAt: true } as const;

export function progressRoutes(db: PrismaClient) {
  const router = Router();
  router.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const userId = req.session.userId;
    if (!userId || !await db.user.findUnique({ where: { id: userId }, select: { id: true } })) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập lại để lưu tiến độ.');
    }
    next();
  });
  router.get('/kanji', async (req, res) => {
    const progress = await db.kanjiProgress.findMany({ where: { userId: req.session.userId! }, select, orderBy: { kanjiId: 'asc' } });
    res.json({ userId: req.session.userId, progress });
  });
  router.post('/kanji', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn đang lưu quá nhanh. Vui lòng thử lại sau một phút.' } },
  }), async (req, res) => {
    const { kanjiId, memorized, expectedUserId } = input.parse(req.body);
    const userId = req.session.userId!;
    // A different tab may have switched the cookie to another account.
    // This value is only a guard; ownership always comes from the server session.
    if (expectedUserId !== userId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã thay đổi. Vui lòng tải lại trang trước khi học tiếp.');
    if (!await getKanji(db, kanjiId, { allowArchived: true })) throw new HttpError(400, 'INVALID_KANJI', 'Kanji không tồn tại.');
    const progress = await db.kanjiProgress.upsert({
      where: { userId_kanjiId: { userId, kanjiId } },
      create: { userId, kanjiId, memorized },
      update: { memorized, reviewedAt: new Date() }, select,
    });
    res.json({ userId, progress });
  });
  return router;
}
