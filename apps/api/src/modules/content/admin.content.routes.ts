import { Router, json } from 'express';
import type { ErrorRequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireAdmin } from '../auth/admin.auth.js';
import { HttpError } from '../../common/errors.js';
import { contentId, kanjiContentSchema, radicalContentSchema, contentImportSchema, contentSourceSchema } from './content.schema.js';
import { changeContentStatus, commitContentImport, createContentSource, previewContentImport, saveKanjiDraft, saveRadicalDraft } from './content.service.js';

const owner = { expectedUserId: z.string().uuid() };
const version = z.number().int().nonnegative();
const metadata = { ...owner, expectedVersion: version.nullable(), sourceId: contentSourceSchema.shape.id };
const checkOwner = (input: string, actual: string) => {
  if (input !== actual) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
};

export function adminContentRoutes(db: PrismaClient) {
  const router = Router();
  router.use(requireAdmin(db));
  router.use(rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.' } } }));
  router.use(json({ limit: '2mb' }));
  router.get('/sources', async (req, res) => {
    z.object({}).strict().parse(req.query);
    res.json({ sources: await db.contentSource.findMany({ orderBy: { id: 'asc' } }) });
  });
  router.post('/sources', async (req, res) => {
    const input = z.object({ ...owner, source: contentSourceSchema }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    const result = await createContentSource(db, input.source);
    res.status(result.created ? 201 : 200).json(result);
  });
  router.post('/imports/preview', async (req, res) => {
    const input = z.object({ ...owner, input: contentImportSchema }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    res.json(await previewContentImport(db, input.input));
  });
  router.post('/imports/commit', async (req, res) => {
    const input = z.object({ ...owner, input: contentImportSchema, previewHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    res.json(await commitContentImport(db, input.input, input.previewHash));
  });
  router.get('/kanji', async (req, res) => {
    const { status } = z.object({ status: z.enum(['draft', 'published', 'archived']).optional() }).strict().parse(req.query);
    res.json({ items: await db.kanjiContent.findMany({ where: { status }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }) });
  });
  router.get('/kanji/:id', async (req, res) => {
    const row = await db.kanjiContent.findUnique({ where: { id: contentId.parse(req.params.id) } });
    if (!row) throw new HttpError(404, 'CONTENT_NOT_FOUND', 'Không tìm thấy nội dung.');
    res.json({ item: row });
  });
  router.put('/kanji/:id', async (req, res) => {
    const input = z.object({ ...metadata, data: kanjiContentSchema }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    if (contentId.parse(req.params.id) !== input.data.id) throw new HttpError(400, 'CONTENT_ID_MISMATCH', 'ID không khớp nội dung.');
    const result = await db.$transaction(tx => saveKanjiDraft(tx, input.data, input.sourceId, input.expectedVersion));
    res.json({ item: result.row, changed: result.changed });
  });
  router.get('/radicals', async (req, res) => {
    z.object({}).strict().parse(req.query);
    res.json({ items: await db.radicalContent.findMany({ orderBy: { number: 'asc' } }) });
  });
  router.put('/radicals/:number', async (req, res) => {
    const input = z.object({ ...metadata, data: radicalContentSchema }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    if (z.coerce.number().int().min(1).max(214).parse(req.params.number) !== input.data.number) throw new HttpError(400, 'CONTENT_ID_MISMATCH', 'ID không khớp nội dung.');
    const result = await db.$transaction(tx => saveRadicalDraft(tx, input.data, input.sourceId, input.expectedVersion));
    res.json({ item: result.row, changed: result.changed });
  });
  for (const kind of ['kanji', 'radicals'] as const) for (const action of ['publish', 'archive'] as const) {
    router.post(`/${kind}/:id/${action}`, async (req, res) => {
      const input = z.object({ ...owner, expectedVersion: version }).strict().parse(req.body);
      checkOwner(input.expectedUserId, req.session.userId!);
      const id = kind === 'kanji' ? contentId.parse(req.params.id) : z.coerce.number().int().min(1).max(214).parse(req.params.id);
      res.json({ item: await changeContentStatus(db, kind, id, input.expectedVersion, action === 'publish' ? 'published' : 'archived') });
    });
  }
  const validationErrors: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (!(error instanceof z.ZodError) || res.headersSent) return next(error);
    res.status(400).json({ error: {
      code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.',
      issues: error.issues.map(issue => ({ path: issue.path, message: issue.message })),
    } });
  };
  router.use(validationErrors);
  return router;
}
