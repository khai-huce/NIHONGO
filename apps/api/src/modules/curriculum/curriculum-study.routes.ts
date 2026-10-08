import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../../common/errors.js';
import { lockVocabChanges } from '../vocabulary/vocab-review.js';
import { findPublishedWord, lockPublishedLesson, type CurriculumWord } from './curriculum.service.js';
import { authenticatedCurriculumRouter, curriculumStudyEngine, studyUuid, type CurriculumStudyStore } from './curriculum-study.engine.js';

export async function setCurriculumReviewStar(tx: Prisma.TransactionClient, userId: string, sourceId: string, active: boolean) {
  const wordId = studyUuid.parse(sourceId.slice('curriculum:'.length));
  sourceId = `curriculum:${wordId}`;
  const published = await findPublishedWord(tx, wordId);
  await lockVocabChanges(tx, userId);
  const where = { userId_category_sourceId: { userId, category: 'vocab', sourceId } };
  const prior = await tx.reviewCard.findUnique({ where });
  if (!prior && (!published || !active)) throw new HttpError(404, 'NOT_FOUND', 'Từ không còn được xuất bản. Không thể tạo thẻ mới.');
  const data = published ? { front: published.word.word, back: published.word.meaning, reading: published.word.reading } : {};
  if (prior) return tx.reviewCard.update({ where, data: { ...data, active, version: { increment: 1 } } });
  return tx.reviewCard.create({ data: { userId, category: 'vocab', sourceId, active,
    front: published!.word.word, back: published!.word.meaning, reading: published!.word.reading } });
}

const lessonStore: CurriculumStudyStore = {
  maxWords: 500,
  async load(tx, _userId, id) {
    const { lesson } = await lockPublishedLesson(tx, id);
    return { id: lesson.id, title: lesson.title, version: lesson.version, words: lesson.words as CurriculumWord[] };
  },
  progress: (tx, userId, lessonId) => tx.curriculumProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } }),
  saveProgress: (tx, userId, lessonId, progress, completedAt) => tx.curriculumProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, progress, version: 1, completedAt }, update: { progress, version: { increment: 1 }, completedAt },
  }),
  async complete(tx, userId, lessonId, at) {
    const where = { userId_lessonId: { userId, lessonId } }, before = await tx.curriculumProgress.findUnique({ where });
    if (!before?.completedAt) await tx.curriculumProgress.upsert({ where, create: { userId, lessonId, completedAt: at }, update: { completedAt: at } });
  },
  latest: (tx, userId, lessonId, kind) => tx.curriculumStudyResult.findFirst({ where: { userId, lessonId, kind }, orderBy: [{ completedAt: 'desc' }, { id: 'desc' }] }),
  result: (tx, id) => tx.curriculumStudyResult.findUnique({ where: { id } }),
  async createResult(tx, data) { return !!(await tx.curriculumStudyResult.createMany({ data: [data], skipDuplicates: true })).count; },
};

export function curriculumStudyRoutes(db: PrismaClient) {
  const router = authenticatedCurriculumRouter(db);
  router.get('/progress/course', async (req, res) => {
    const { courseId } = z.object({ courseId: studyUuid }).strict().parse(req.query), userId = req.session.userId!;
    const rows = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM curriculum_courses WHERE id=${courseId}::uuid FOR SHARE`;
      const course = await tx.curriculumCourse.findFirst({ where: { id: courseId, archivedAt: null, publishedVersion: { not: null } }, select: { id: true } });
      if (!course) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy giáo trình đã xuất bản.');
      return tx.curriculumProgress.findMany({ where: { userId, completedAt: { not: null }, lesson: { courseId, active: true } }, select: { lessonId: true } });
    });
    res.json({ userId, completedLessonIds: rows.map(row => row.lessonId) });
  });
  router.use(curriculumStudyEngine(db, lessonStore));
  return router;
}
