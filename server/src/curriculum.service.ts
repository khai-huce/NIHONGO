import type { CurriculumCourse, Prisma, PrismaClient } from '@prisma/client';
import { HttpError } from './errors.js';
import { curriculumCounts, curriculumDraftSchema } from './curriculum.schema.js';
import type { CurriculumDraft, CurriculumWord } from './curriculum.schema.js';

export type { CurriculumDraft, CurriculumWord } from './curriculum.schema.js';
const notFound = () => new HttpError(404, 'CURRICULUM_NOT_FOUND', 'Không tìm thấy giáo trình hoặc bài học đã xuất bản.');
const changed = () => new HttpError(409, 'CURRICULUM_CHANGED', 'Giáo trình đã thay đổi ở phiên khác. Vui lòng tải lại trước khi tiếp tục.');
const identityConflict = () => new HttpError(409, 'CURRICULUM_ID_EXISTS', 'ID chủ đề, bài hoặc từ đã thuộc nội dung khác. ID đã bỏ vẫn được giữ để bảo toàn tiến độ.');

export function curriculumMetadata(course: CurriculumCourse) {
  return { id: course.id, slug: course.slug, title: course.title, subtitle: course.subtitle,
    description: course.description, level: course.level, style: course.style,
    topicCount: course.topicCount, lessonCount: course.lessonCount, wordCount: course.wordCount };
}

export function adminCurriculum(course: CurriculumCourse, includeDraft = true) {
  const draft = curriculumDraftSchema.parse(course.draft);
  return { ...curriculumMetadata(course), title: draft.title, subtitle: draft.subtitle,
    description: draft.description, level: draft.level, style: draft.style, ...curriculumCounts(draft),
    version: course.version, publishedVersion: course.publishedVersion, sourceId: course.sourceId,
    publishedSourceId: course.publishedSourceId, archivedAt: course.archivedAt,
    status: course.archivedAt ? 'archived' : course.publishedVersion === null ? 'draft' : 'published',
    hasUnpublishedChanges: course.publishedVersion !== course.version,
    createdAt: course.createdAt, updatedAt: course.updatedAt, ...(includeDraft ? { draft } : {}) };
}

// Admin writes are infrequent. One transaction lock reserves IDs across draft trees,
// including concurrent edits to different courses, without adding a generic content registry.
async function lockCatalogWrite(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(290929, 2)`;
}

async function sourceExists(tx: Prisma.TransactionClient, sourceId: string | null) {
  if (sourceId && !await tx.contentSource.findUnique({ where: { id: sourceId }, select: { id: true } })) {
    throw new HttpError(400, 'SOURCE_NOT_FOUND', 'Nguồn nội dung không tồn tại. Hãy khai báo nguồn thực tế trước.');
  }
}

async function lockedCourse(tx: Prisma.TransactionClient, id: string, version: number) {
  await tx.$queryRaw`SELECT id FROM curriculum_courses WHERE id = ${id}::uuid FOR UPDATE`;
  const course = await tx.curriculumCourse.findUnique({ where: { id } });
  if (!course) throw new HttpError(404, 'CURRICULUM_NOT_FOUND', 'Không tìm thấy giáo trình.');
  if (course.version !== version) throw changed();
  return course;
}

// Reserve identities on draft save. These inactive rows are never exposed to learners.
// Previously published content is only modified by publishCurriculum.
async function reserveDraftIds(tx: Prisma.TransactionClient, courseId: string, draft: CurriculumDraft) {
  const topics = draft.topics;
  const lessons = topics.flatMap(topic => topic.lessons.map(lesson => ({ ...lesson, topicId: topic.id })));
  const wordOwners = new Map(lessons.flatMap(lesson => lesson.words.map(word => [word.id, lesson.id] as const)));
  const [occupiedTopics, occupiedLessons, occupiedWords] = await Promise.all([
    tx.curriculumTopic.findMany({ where: { id: { in: topics.map(topic => topic.id) } }, select: { id: true, courseId: true } }),
    tx.curriculumLesson.findMany({ where: { id: { in: lessons.map(lesson => lesson.id) } }, select: { id: true, courseId: true, topicId: true, retainedWordIds: true } }),
    tx.curriculumLesson.findMany({ where: { retainedWordIds: { hasSome: [...wordOwners.keys()] } }, select: { id: true, retainedWordIds: true } }),
  ]);
  if (occupiedTopics.some(topic => topic.courseId !== courseId)) throw identityConflict();
  const lessonParents = new Map(lessons.map(lesson => [lesson.id, lesson.topicId]));
  if (occupiedLessons.some(lesson => lesson.courseId !== courseId || lessonParents.get(lesson.id) !== lesson.topicId)) throw identityConflict();
  for (const occupied of occupiedWords) for (const wordId of occupied.retainedWordIds) {
    const owner = wordOwners.get(wordId);
    if (owner && owner !== occupied.id) throw identityConflict();
  }
  const topicIds = new Set(occupiedTopics.map(topic => topic.id));
  const existingLessons = new Map(occupiedLessons.map(lesson => [lesson.id, lesson]));
  const newTopics = topics.filter(topic => !topicIds.has(topic.id));
  if (newTopics.length) await tx.curriculumTopic.createMany({ data: newTopics.map(topic => ({ id: topic.id, courseId })) });
  const newLessons = lessons.filter(lesson => !existingLessons.has(lesson.id));
  if (newLessons.length) await tx.curriculumLesson.createMany({ data: newLessons.map(lesson => ({
    id: lesson.id, courseId, topicId: lesson.topicId, retainedWordIds: lesson.words.map(word => word.id),
  })) });
  for (const lesson of lessons) {
    const existing = existingLessons.get(lesson.id);
    if (!existing) continue;
    const reserved = new Set(existing.retainedWordIds);
    const additions = lesson.words.filter(word => !reserved.has(word.id)).map(word => word.id);
    if (additions.length) await tx.curriculumLesson.update({ where: { id: lesson.id }, data: { retainedWordIds: { push: additions } } });
  }
}

export async function createCurriculum(db: PrismaClient, input: { id: string; slug: string; draft: CurriculumDraft }) {
  return db.$transaction(async tx => {
    await lockCatalogWrite(tx);
    const occupied = await tx.curriculumCourse.findFirst({ where: { OR: [{ id: input.id }, { slug: input.slug }] } });
    if (occupied) {
      if (occupied.id === input.id && occupied.slug === input.slug && JSON.stringify(curriculumDraftSchema.parse(occupied.draft)) === JSON.stringify(input.draft)) {
        return { course: occupied, created: false };
      }
      throw new HttpError(409, 'CURRICULUM_EXISTS', 'ID hoặc đường dẫn giáo trình đã được sử dụng.');
    }
    await sourceExists(tx, input.draft.sourceId);
    const course = await tx.curriculumCourse.create({ data: {
      id: input.id, slug: input.slug, draft: input.draft, sourceId: input.draft.sourceId,
    } });
    await reserveDraftIds(tx, course.id, input.draft);
    return { course, created: true };
  }, { timeout: 30000 });
}

export async function saveCurriculum(db: PrismaClient, id: string, version: number, draft: CurriculumDraft) {
  return db.$transaction(async tx => {
    await lockCatalogWrite(tx);
    const course = await lockedCourse(tx, id, version);
    if (course.archivedAt) throw new HttpError(409, 'CURRICULUM_ARCHIVED', 'Hãy khôi phục giáo trình trước khi sửa.');
    await sourceExists(tx, draft.sourceId);
    await reserveDraftIds(tx, id, draft);
    return tx.curriculumCourse.update({ where: { id }, data: { draft, sourceId: draft.sourceId, version: { increment: 1 } } });
  }, { timeout: 30000 });
}

export async function publishCurriculum(db: PrismaClient, id: string, version: number) {
  return db.$transaction(async tx => {
    await lockCatalogWrite(tx);
    const course = await lockedCourse(tx, id, version);
    if (course.archivedAt) throw new HttpError(409, 'CURRICULUM_ARCHIVED', 'Hãy khôi phục giáo trình trước khi xuất bản.');
    const draft = curriculumDraftSchema.parse(course.draft);
    if (!draft.sourceId) throw new HttpError(400, 'SOURCE_REQUIRED', 'Cần khai báo nguồn và quyền sử dụng thực tế trước khi xuất bản.');
    await sourceExists(tx, draft.sourceId);
    if (!draft.topics.length || draft.topics.some(topic => !topic.lessons.length || topic.lessons.some(lesson => !lesson.words.length))) {
      throw new HttpError(400, 'CURRICULUM_EMPTY', 'Giáo trình cần chủ đề, mỗi chủ đề cần bài và mỗi bài cần ít nhất một từ để xuất bản.');
    }
    await reserveDraftIds(tx, id, draft);
    await tx.curriculumTopic.updateMany({ where: { courseId: id, active: true }, data: { active: false } });
    await tx.curriculumLesson.updateMany({ where: { courseId: id, active: true }, data: { active: false } });
    for (const [topicIndex, topic] of draft.topics.entries()) {
      await tx.curriculumTopic.update({ where: { id: topic.id }, data: {
        title: topic.title, japanese: topic.japanese, sortOrder: topicIndex, active: true,
      } });
      for (const [lessonIndex, lesson] of topic.lessons.entries()) {
        await tx.curriculumLesson.update({ where: { id: lesson.id }, data: {
          title: lesson.title, sortOrder: lessonIndex, active: true, version: version + 1,
          words: lesson.words, wordCount: lesson.words.length,
        } });
      }
    }
    const words = draft.topics.flatMap(topic => topic.lessons.flatMap(lesson => lesson.words));
    // Only refresh existing starred snapshots, including inactive stars. Scheduling and events are untouched.
    await tx.$executeRaw`
      UPDATE review_cards c SET front = item->>'word', back = item->>'meaning',
        reading = item->>'reading', version = c.version + 1
      FROM jsonb_array_elements(${JSON.stringify(words)}::jsonb) item
      WHERE c.category = 'vocab' AND c.source_id = 'curriculum:' || (item->>'id')
        AND (c.front IS DISTINCT FROM item->>'word' OR c.back IS DISTINCT FROM item->>'meaning'
          OR c.reading IS DISTINCT FROM item->>'reading')`;
    return tx.curriculumCourse.update({ where: { id }, data: {
      title: draft.title, subtitle: draft.subtitle, description: draft.description, level: draft.level, style: draft.style,
      ...curriculumCounts(draft), publishedSourceId: draft.sourceId, publishedVersion: version + 1, version: version + 1,
    } });
  }, { timeout: 30000 });
}

export async function changeCurriculumStatus(db: PrismaClient, id: string, version: number, action: 'archive' | 'restore') {
  return db.$transaction(async tx => {
    await lockCatalogWrite(tx);
    const course = await lockedCourse(tx, id, version);
    if (action === 'restore' && !course.archivedAt) throw new HttpError(409, 'CURRICULUM_NOT_ARCHIVED', 'Giáo trình chưa được lưu trữ.');
    if (action === 'archive' && course.archivedAt) throw new HttpError(409, 'CURRICULUM_ARCHIVED', 'Giáo trình đã được lưu trữ.');
    return tx.curriculumCourse.update({ where: { id }, data: {
      archivedAt: action === 'archive' ? new Date() : null,
      ...(action === 'restore' ? { publishedVersion: null } : {}), version: { increment: 1 },
    } });
  });
}

export async function publicCurriculum(tx: Prisma.TransactionClient, slug: string) {
  await tx.$queryRaw`SELECT id FROM curriculum_courses WHERE slug = ${slug} FOR SHARE`;
  const course = await tx.curriculumCourse.findUnique({ where: { slug } });
  if (!course || course.archivedAt || course.publishedVersion === null) throw notFound();
  const topics = await tx.curriculumTopic.findMany({
    where: { courseId: course.id, active: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, title: true, japanese: true, lessons: {
      where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, title: true, wordCount: true },
    } },
  });
  return { ...curriculumMetadata(course), topics };
}

// Acquire this lock before account/card locks. Publish acquires the course lock before updating starred snapshots.
export async function lockPublishedLesson(tx: Prisma.TransactionClient, lessonId: string) {
  const identity = await tx.curriculumLesson.findUnique({ where: { id: lessonId }, select: { courseId: true } });
  if (!identity) throw notFound();
  await tx.$queryRaw`SELECT id FROM curriculum_courses WHERE id = ${identity.courseId}::uuid FOR SHARE`;
  const [lesson, course] = await Promise.all([
    tx.curriculumLesson.findUnique({ where: { id: lessonId } }),
    tx.curriculumCourse.findUnique({ where: { id: identity.courseId } }),
  ]);
  if (!lesson || !lesson.active || !course || course.archivedAt || course.publishedVersion === null) throw notFound();
  return { lesson, course };
}

export async function findPublishedWord(tx: Prisma.TransactionClient, wordId: string) {
  const identity = await tx.curriculumLesson.findFirst({ where: { retainedWordIds: { has: wordId } }, select: { id: true } });
  if (!identity) return null;
  try {
    const result = await lockPublishedLesson(tx, identity.id);
    const word = (result.lesson.words as CurriculumWord[]).find(item => item.id === wordId);
    return word ? { ...result, word } : null;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}
