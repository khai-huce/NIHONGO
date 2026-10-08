import { Router, json } from 'express';
import type { ErrorRequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireAdmin } from '../auth/admin.auth.js';
import { HttpError } from '../../common/errors.js';
import { grammarCounts, grammarDraftSchema, grammarId, grammarSlug } from './grammar.schema.js';
import { adminGrammar, changeGrammarStatus, createGrammar, grammarMetadata, publicGrammarCourse, publicGrammarPattern, publishGrammar, saveGrammar } from './grammar.service.js';

const owner = { expectedUserId: z.string().uuid() };
const versionInput = z.object({ ...owner, version: z.number().int().nonnegative() }).strict();
const emptyQuery = z.object({}).strict();
const checkOwner = (expected: string, actual: string) => {
  if (expected !== actual) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
};
export function grammarRoutes(db: PrismaClient) {
  const publicRouter = Router(), admin = Router();
  publicRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const publicUser = async (id: string | undefined) => id && await db.user.findUnique({ where: { id }, select: { id: true } }) ? id : null;
  publicRouter.get('/courses', async (req, res) => {
    emptyQuery.parse(req.query);
    const courses = await db.grammarCourse.findMany({ where: { archivedAt: null, publishedVersion: { not: null } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    res.json({ courses: courses.map(grammarMetadata), userId: await publicUser(req.session.userId) });
  });
  publicRouter.get('/courses/:slug', async (req, res) => {
    emptyQuery.parse(req.query);
    const slug = grammarSlug.parse(req.params.slug);
    const course = await db.$transaction(tx => publicGrammarCourse(tx, slug));
    res.json({ course, userId: await publicUser(req.session.userId) });
  });
  publicRouter.get('/patterns/:id', async (req, res) => {
    emptyQuery.parse(req.query);
    const id = grammarId.parse(req.params.id);
    const pattern = await db.$transaction(tx => publicGrammarPattern(tx, id));
    res.json({ pattern, userId: await publicUser(req.session.userId) });
  });
  admin.use(requireAdmin(db));
  admin.use(rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.' } } }));
  admin.use(json({ limit: '4mb' }));
  admin.get('/', async (req, res) => {
    emptyQuery.parse(req.query);
    const courses = await db.grammarCourse.findMany({ orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] });
    res.json({ items: courses.map(adminGrammar) });
  });
  admin.get('/:id', async (req, res) => {
    emptyQuery.parse(req.query);
    const course = await db.grammarCourse.findUnique({ where: { id: grammarId.parse(req.params.id) } });
    if (!course) throw new HttpError(404, 'GRAMMAR_NOT_FOUND', 'Không tìm thấy giáo trình ngữ pháp.');
    res.json({ course: adminGrammar(course) });
  });
  admin.post('/preview', async (req, res) => {
    const input = z.object({ ...owner, draft: grammarDraftSchema }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    res.json({ draft: input.draft, counts: grammarCounts(input.draft) });
  });
  admin.post('/', async (req, res) => {
    const input = z.object({ ...owner, id: grammarId, slug: grammarSlug, draft: grammarDraftSchema }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    const result = await createGrammar(db, input);
    res.status(result.created ? 201 : 200).json({ course: adminGrammar(result.course) });
  });
  admin.patch('/:id', async (req, res) => {
    const input = versionInput.extend({ draft: grammarDraftSchema }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    const course = await saveGrammar(db, grammarId.parse(req.params.id), input.version, input.draft);
    res.json({ course: adminGrammar(course) });
  });
  for (const action of ['publish', 'archive', 'restore'] as const) admin.post(`/:id/${action}`, async (req, res) => {
    const input = versionInput.parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    const id = grammarId.parse(req.params.id);
    const course = action === 'publish' ? await publishGrammar(db, id, input.version) : await changeGrammarStatus(db, id, input.version, action);
    res.json({ course: adminGrammar(course) });
  });
  const validationErrors: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (!(error instanceof z.ZodError) || res.headersSent) return next(error);
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.',
      issues: error.issues.map(issue => ({ path: issue.path, message: issue.message })) } });
  };
  admin.use(validationErrors);
  return { public: publicRouter, admin };
}
