import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from './errors.js';
import { contentId } from './content.schema.js';
import { getKanji, loadPublicContent } from './content.service.js';

export function contentRoutes(db: PrismaClient) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/catalog', async (req, res) => {
    z.object({}).strict().parse(req.query);
    res.json(await loadPublicContent(db));
  });
  router.get('/kanji/:id', async (req, res) => {
    z.object({}).strict().parse(req.query);
    const item = await getKanji(db, contentId.parse(req.params.id), { allowArchived: true });
    if (!item) throw new HttpError(404, 'CONTENT_NOT_FOUND', 'Không tìm thấy nội dung đã xuất bản.');
    res.json({ item });
  });
  return router;
}
