import { Router, json, type ErrorRequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireAdmin } from '../auth/admin.auth.js';
import { HttpError } from '../../common/errors.js';
import { jlptDraftSchema, jlptId, jlptKind, jlptLevel } from './jlpt.schema.js';
import { adminRoadmap, changeJlptStatus, createJlpt, previewJlpt, publicJlpt, publishJlpt, saveJlpt, jlptTransactionOptions } from './jlpt.service.js';
import { searchResources } from './jlpt.resources.js';

const owner = { expectedUserId: jlptId };
const versionInput = z.object({ ...owner, version: z.number().int().nonnegative() }).strict();
const noQuery = z.object({}).strict();
const checkOwner = (expected: string, actual: string) => {
  if (expected !== actual) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
};
export function jlptRoutes(db: PrismaClient) {
  const publicRouter = Router(), admin = Router();
  const noStore = (_req: unknown, res: { set: (name: string, value: string) => unknown }, next: () => void) => { res.set('Cache-Control', 'no-store'); next(); };
  publicRouter.use(noStore);
  publicRouter.get('/roadmaps', async (req, res) => {
    noQuery.parse(req.query);
    const items = await db.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ level: string }>>`SELECT level FROM jlpt_roadmaps WHERE archived_at IS NULL AND published_version IS NOT NULL ORDER BY level DESC FOR SHARE`;
      const result = [];
      for (const row of rows) {
        const { sessions: _sessions, source: _source, ...summary } = await publicJlpt(tx, jlptLevel.parse(row.level));
        result.push(summary);
      }
      return result;
    }, jlptTransactionOptions);
    res.json({ items });
  });
  publicRouter.get('/roadmaps/:level', async (req, res) => {
    noQuery.parse(req.query);
    const roadmap = await db.$transaction(tx => publicJlpt(tx, jlptLevel.parse(req.params.level)), jlptTransactionOptions);
    res.json({ roadmap });
  });
  admin.use(requireAdmin(db), noStore, rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.' } } }), json({ limit: '4mb' }));
  admin.get('/resources', async (req, res) => {
    const input = z.object({ kind: jlptKind, q: z.string().trim().max(100).default(''), level: jlptLevel.optional(), page: z.coerce.number().int().min(1).max(10000).default(1) }).strict().parse(req.query);
    const result = await db.$transaction(tx => searchResources(tx, input), jlptTransactionOptions);
    res.json({ ...result, userId: req.session.userId });
  });
  admin.get('/roadmaps', async (req, res) => {
    noQuery.parse(req.query);
    const items = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM jlpt_roadmaps ORDER BY id FOR SHARE`;
      const rows = await tx.jlptRoadmap.findMany({ orderBy: [{ level: 'desc' }] });
      return Promise.all(rows.map(row => adminRoadmap(tx, row)));
    }, jlptTransactionOptions);
    res.json({ items, userId: req.session.userId });
  });
  admin.get('/roadmaps/:id', async (req, res) => {
    noQuery.parse(req.query);
    const roadmap = await db.$transaction(async tx => {
      const id = jlptId.parse(req.params.id);
      await tx.$queryRaw`SELECT id FROM jlpt_roadmaps WHERE id=${id}::uuid FOR SHARE`;
      const row = await tx.jlptRoadmap.findUnique({ where: { id } });
      if (!row) throw new HttpError(404, 'JLPT_NOT_FOUND', 'Không tìm thấy lộ trình JLPT.');
      return adminRoadmap(tx, row);
    }, jlptTransactionOptions);
    res.json({ roadmap, userId: req.session.userId });
  });
  admin.post('/roadmaps/preview', async (req, res) => {
    const input = z.object({ ...owner, draft: jlptDraftSchema }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    const result = await db.$transaction(tx => previewJlpt(tx, input.draft), jlptTransactionOptions);
    res.json({ ...result, userId: req.session.userId });
  });
  admin.post('/roadmaps', async (req, res) => {
    const input = z.object({ ...owner, id: jlptId, level: jlptLevel, draft: jlptDraftSchema }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    const result = await createJlpt(db, input);
    res.status(result.created ? 201 : 200).json({ roadmap: result.roadmap, userId: req.session.userId });
  });
  admin.patch('/roadmaps/:id', async (req, res) => {
    const input = versionInput.extend({ draft: jlptDraftSchema }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    const roadmap = await saveJlpt(db, jlptId.parse(req.params.id), input.version, input.draft);
    res.json({ roadmap, userId: req.session.userId });
  });
  for (const action of ['publish', 'archive', 'restore'] as const) admin.post(`/roadmaps/:id/${action}`, async (req, res) => {
    const input = versionInput.parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    const id = jlptId.parse(req.params.id);
    const roadmap = action === 'publish' ? await publishJlpt(db, id, input.version) : await changeJlptStatus(db, id, input.version, action);
    res.json({ roadmap, userId: req.session.userId });
  });
  const validationErrors: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (!(error instanceof z.ZodError) || res.headersSent) return next(error);
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.',
      issues: error.issues.map(issue => ({ path: issue.path, message: issue.message })) } });
  };
  admin.use(validationErrors);
  return { public: publicRouter, admin };
}
