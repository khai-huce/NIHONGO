import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from './errors.js';
import { reviewStats, type DailyReview } from './review.stats.js';
import { setCustomReviewStar } from './vocab-review.js';

const category = z.enum(['kanji', 'vocab', 'grammar']);
const starInput = z.object({ category, sourceId: z.string().trim().min(1).max(300),
  front: z.string().trim().min(1).max(500), back: z.string().trim().min(1).max(2000),
  reading: z.string().max(500).default(''), hint: z.string().max(2000).default(''),
  active: z.boolean(), expectedUserId: z.string().uuid(),
}).strict();
const ratingInput = z.object({ id: z.string().uuid(), expectedUserId: z.string().uuid(),
  version: z.number().int().nonnegative(), rating: z.enum(['again','hard','good','easy']), elapsedMs: z.number().int().min(0).max(3600000),
}).strict();
export function reviewInterval(previous: number, rating: 'again'|'hard'|'good'|'easy') {
  return rating === 'again' ? 60 : rating === 'hard' ? 360 : Math.min(365 * 86400, Math.max(rating === 'good' ? 86400 : 345600, previous * (rating === 'good' ? 2 : 3)));
}
export function reviewRoutes(db: PrismaClient) {
  const router = Router();
  router.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!req.session.userId || !await db.user.findUnique({ where: { id: req.session.userId }, select: { id: true } })) throw new HttpError(401,'UNAUTHENTICATED','Vui lòng đăng nhập để dùng danh sách ôn tập.');
    next();
  });
  router.use(rateLimit({ windowMs: 60000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng đợi một phút.' } },
  }));
  router.get('/', async (req, res) => {
    const userId = req.session.userId!;
    const cards = await db.reviewCard.findMany({ where: { userId }, orderBy: { dueAt: 'asc' } });
    const rows = await db.$queryRaw<DailyReview[]>`
      SELECT c.category, to_char(e.reviewed_at AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD') AS day,
      e.rating, count(*)::int AS count, sum(e.elapsed_ms)::double precision AS elapsed
      FROM review_events e JOIN review_cards c ON c.id=e.card_id WHERE c.user_id=${userId}::uuid
      GROUP BY c.category, day, e.rating`;
    const stats = reviewStats(rows);
    res.json({ userId, serverNow: new Date().toISOString(), cards: cards.map(({userId: _owner, ...card}) => card), stats });
  });
  router.post('/reset', async (req, res) => {
    const input = z.object({ category, expectedUserId: z.string().uuid(), expectedCount: z.number().int().nonnegative() }).strict().parse(req.body);
    const userId = req.session.userId!;
    if (userId !== input.expectedUserId) throw new HttpError(409,'ACCOUNT_CHANGED','Tài khoản đã đổi. Vui lòng tải lại trang.');
    const count = await db.$transaction(async tx => {
      const where = { userId, category: input.category, active: true };
      const cards = await tx.reviewCard.findMany({ where, select: { id: true, version: true } });
      if (cards.length !== input.expectedCount) throw new HttpError(409,'REVIEW_CHANGED','Số thẻ đã thay đổi. Vui lòng tải lại rồi xác nhận lại.');
      const dueAt = new Date();
      for (const card of cards) {
        const result = await tx.reviewCard.updateMany({ where: { ...where, id: card.id, version: card.version }, data: { dueAt, intervalSeconds: 0, reviewCount: 0, version: { increment: 1 } } });
        if (!result.count) throw new HttpError(409,'REVIEW_CHANGED','Tiến độ đã thay đổi ở lượt khác. Vui lòng thử lại.');
      }
      return cards.length;
    });
    res.json({ count });
  });
  router.post('/star', async (req, res) => {
    const { expectedUserId, ...input } = starInput.parse(req.body);
    const userId = req.session.userId!;
    if (userId !== expectedUserId) throw new HttpError(409,'ACCOUNT_CHANGED','Tài khoản đã đổi. Vui lòng tải lại trang.');
    // Atomic upsert keeps existing due date, interval and history when reactivated.
    const card = input.category === 'vocab' && input.sourceId.startsWith('custom:')
      ? await db.$transaction(tx => setCustomReviewStar(tx,userId,input.sourceId,input.active))
      : await db.reviewCard.upsert({ where: { userId_category_sourceId: { userId, category: input.category, sourceId: input.sourceId } },
      create: { userId, ...input }, update: { ...input, version: { increment: 1 } },
    });
    const { userId: _owner, ...result } = card;
    res.json({ card: result });
  });
  router.post('/rate', async (req, res) => {
    const input = ratingInput.parse(req.body), userId = req.session.userId!;
    if (input.expectedUserId !== userId) throw new HttpError(409,'ACCOUNT_CHANGED','Tài khoản đã đổi. Vui lòng tải lại trang.');
    const card = await db.$transaction(async tx => {
      const previous = await tx.reviewCard.findFirst({ where: { id: input.id, userId } });
      if (!previous) throw new HttpError(404,'NOT_FOUND','Không tìm thấy thẻ ôn tập.');
      const now = new Date();
      if (!previous.active || previous.dueAt > now || previous.version !== input.version) throw new HttpError(409,'REVIEW_CHANGED','Thẻ chưa đến hạn hoặc đã thay đổi. Vui lòng tải lại lượt ôn.');
      const intervalSeconds = reviewInterval(previous.intervalSeconds, input.rating), dueAt = new Date(now.getTime() + intervalSeconds * 1000);
      const updated = await tx.reviewCard.updateMany({ where: { id: input.id, userId, version: input.version, active: true },
        data: { intervalSeconds, dueAt, reviewCount: { increment: 1 }, version: { increment: 1 } } });
      if (!updated.count) throw new HttpError(409,'REVIEW_CHANGED','Thẻ đã được đánh giá ở lượt khác. Vui lòng tải lại.');
      await tx.reviewEvent.create({ data: { cardId: input.id, rating: input.rating, dueAt, elapsedMs: input.elapsedMs, reviewedAt: now } });
      return tx.reviewCard.findUniqueOrThrow({ where: { id: input.id } });
    });
    const { userId: _owner, ...result } = card;
    res.json({ card: result });
  });
  return router;
}
