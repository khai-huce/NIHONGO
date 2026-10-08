import { Router, json } from 'express';
import type { ErrorRequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireAdmin } from '../auth/admin.auth.js';
import { HttpError } from '../../common/errors.js';
import { curriculumCounts, curriculumDraftSchema, curriculumId, curriculumSlug } from './curriculum.schema.js';
import {
  adminCurriculum, changeCurriculumStatus, createCurriculum, curriculumMetadata,
  lockPublishedLesson, publicCurriculum, publishCurriculum, saveCurriculum,
} from './curriculum.service.js';

const owner = { expectedUserId: z.string().uuid() };
const versionInput = z.object({ ...owner, version: z.number().int().nonnegative() }).strict();
const emptyQuery = z.object({}).strict();
const checkOwner = (expected: string, actual: string) => {
  if (expected !== actual) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
};

export function curriculumRoutes(db: PrismaClient) {
  const publicRouter = Router(), admin = Router();
  publicRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const publicUser = async (id: string | undefined) => id && await db.user.findUnique({ where: { id }, select: { id: true } }) ? id : null;
  publicRouter.get('/', async (req, res) => {
    emptyQuery.parse(req.query);
    const courses = await db.curriculumCourse.findMany({
      where: { publishedVersion: { not: null }, archivedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    res.json({ courses: courses.map(curriculumMetadata), userId: await publicUser(req.session.userId) });
  });
  publicRouter.get('/:slug', async (req, res) => {
    emptyQuery.parse(req.query);
    const slug = curriculumSlug.parse(req.params.slug);
    const course = await db.$transaction(tx => publicCurriculum(tx, slug));
    res.json({ course, userId: await publicUser(req.session.userId) });
  });
  publicRouter.get('/:slug/lessons/:lessonId', async (req, res) => {
    emptyQuery.parse(req.query);
    const slug = curriculumSlug.parse(req.params.slug), id = curriculumId.parse(req.params.lessonId);
    const lesson = await db.$transaction(async tx => {
      const { lesson, course } = await lockPublishedLesson(tx, id);
      if (course.slug !== slug) throw new HttpError(404, 'CURRICULUM_NOT_FOUND', 'Bài học không thuộc giáo trình này.');
      return { id: lesson.id, courseId: lesson.courseId, topicId: lesson.topicId,
        name: lesson.title, version: lesson.version, words: lesson.words };
    });
    res.json({ lesson, userId: await publicUser(req.session.userId) });
  });

  admin.use(requireAdmin(db));
  admin.use(rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.' } } }));
  admin.use(json({ limit: '4mb' }));
  admin.get('/', async (req, res) => {
    emptyQuery.parse(req.query);
    const items = await db.curriculumCourse.findMany({ orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] });
    res.json({ items: items.map(course => adminCurriculum(course, false)) });
  });
  admin.get('/:id', async (req, res) => {
    emptyQuery.parse(req.query);
    const course = await db.curriculumCourse.findUnique({ where: { id: curriculumId.parse(req.params.id) } });
    if (!course) throw new HttpError(404, 'CURRICULUM_NOT_FOUND', 'Không tìm thấy giáo trình.');
    res.json({ course: adminCurriculum(course) });
  });
  admin.post('/preview', async (req, res) => {
    const input = z.object({ ...owner, draft: curriculumDraftSchema }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    res.json({ draft: input.draft, counts: curriculumCounts(input.draft) });
  });
  admin.post('/', async (req, res) => {
    const input = z.object({ ...owner, id: curriculumId, slug: curriculumSlug, draft: curriculumDraftSchema }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    const result = await createCurriculum(db, input);
    res.status(result.created ? 201 : 200).json({ course: adminCurriculum(result.course) });
  });
  admin.patch('/:id', async (req, res) => {
    const input = versionInput.extend({ draft: curriculumDraftSchema }).strict().parse(req.body);
    checkOwner(input.expectedUserId, req.session.userId!);
    const course = await saveCurriculum(db, curriculumId.parse(req.params.id), input.version, input.draft);
    res.json({ course: adminCurriculum(course) });
  });
  for (const action of ['publish', 'archive', 'restore'] as const) {
    admin.post(`/:id/${action}`, async (req, res) => {
      const input = versionInput.parse(req.body);
      checkOwner(input.expectedUserId, req.session.userId!);
      const id = curriculumId.parse(req.params.id);
      const course = action === 'publish'
        ? await publishCurriculum(db, id, input.version)
        : await changeCurriculumStatus(db, id, input.version, action);
      res.json({ course: adminCurriculum(course) });
    });
  }
  const validationErrors: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (!(error instanceof z.ZodError) || res.headersSent) return next(error);
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.',
      issues: error.issues.map(issue => ({ path: issue.path, message: issue.message })),
    } });
  };
  admin.use(validationErrors);
  return { public: publicRouter, admin };
}
