import type { GrammarCourse, Prisma, PrismaClient } from '@prisma/client';
import { HttpError } from './errors.js';
import { grammarCounts, grammarDraftSchema, grammarId, grammarPatternSchema } from './grammar.schema.js';
import type { GrammarDraft, GrammarPatternContent } from './grammar.schema.js';

const notFound = () => new HttpError(404, 'GRAMMAR_NOT_FOUND', 'Không tìm thấy giáo trình hoặc mẫu ngữ pháp đã xuất bản.');
const conflict = () => new HttpError(409, 'GRAMMAR_CHANGED', 'Giáo trình đã thay đổi ở phiên khác. Vui lòng tải lại.');
const identityConflict = () => new HttpError(409, 'GRAMMAR_ID_EXISTS', 'ID bài, mẫu, ví dụ hoặc bài tập đã thuộc nội dung khác. ID đã bỏ vẫn được giữ để bảo toàn lịch sử.');
export function grammarMetadata(course: GrammarCourse) {
  return { id: course.id, slug: course.slug, title: course.title, subtitle: course.subtitle, description: course.description,
    level: course.level, lessonCount: course.lessonCount, patternCount: course.patternCount };
}
export function adminGrammar(course: GrammarCourse) {
  return { id: course.id, slug: course.slug, version: course.version, publishedVersion: course.publishedVersion,
    archivedAt: course.archivedAt, draft: grammarDraftSchema.parse(course.draft) };
}
async function sourceExists(tx: Prisma.TransactionClient, id: string | null) {
  if (id && !await tx.contentSource.findUnique({ where: { id }, select: { id: true } })) {
    throw new HttpError(400, 'SOURCE_NOT_FOUND', 'Nguồn nội dung không tồn tại. Hãy khai báo nguồn thực tế trước.');
  }
}
async function lockWrite(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(290929, 3)`;
}
async function lockedCourse(tx: Prisma.TransactionClient, id: string, version: number) {
  await tx.$queryRaw`SELECT id FROM grammar_courses WHERE id = ${id}::uuid FOR UPDATE`;
  const course = await tx.grammarCourse.findUnique({ where: { id } });
  if (!course) throw notFound();
  if (course.version !== version) throw conflict();
  return course;
}

// Reserve even unpublished and removed IDs, so editing cannot reattach somebody's progress to another item.
async function reserveIds(tx: Prisma.TransactionClient, courseId: string, draft: GrammarDraft) {
  const lessons = draft.lessons;
  const patterns = lessons.flatMap(lesson => lesson.patterns.map(pattern => ({ ...pattern, lessonId: lesson.id })));
  const exerciseOwners = new Map(patterns.flatMap(pattern => pattern.exercises.map(item => [item.id, pattern.id] as const)));
  const exampleOwners = new Map(patterns.flatMap(pattern => pattern.examples.map(item => [item.id, pattern.id] as const)));
  const lessonParents = new Map(lessons.map(lesson => [lesson.id, courseId]));
  const patternParents = new Map(patterns.map(pattern => [pattern.id, pattern.lessonId]));
  const allIds = [...lessonParents.keys(), ...patternParents.keys(), ...exerciseOwners.keys(), ...exampleOwners.keys()];
  if (allIds.includes(courseId)) throw identityConflict();
  const [courses, existingLessons, existingPatterns] = await Promise.all([
    tx.grammarCourse.findMany({ where: { id: { in: allIds } }, select: { id: true } }),
    tx.grammarLesson.findMany({ where: { id: { in: [courseId, ...allIds] } } }),
    tx.grammarPattern.findMany({ where: { OR: [
      { id: { in: [courseId, ...allIds] } }, { retainedExerciseIds: { hasSome: [courseId, ...allIds] } }, { retainedExampleIds: { hasSome: [courseId, ...allIds] } },
    ] } }),
  ]);
  if (courses.length || existingLessons.some(row => lessonParents.get(row.id) !== row.courseId)) throw identityConflict();
  for (const row of existingPatterns) {
    if (allIds.includes(row.id) && patternParents.get(row.id) !== row.lessonId) throw identityConflict();
    if (row.id === courseId) throw identityConflict();
    for (const id of row.retainedExerciseIds) if ((allIds.includes(id) || id === courseId) && exerciseOwners.get(id) !== row.id) throw identityConflict();
    for (const id of row.retainedExampleIds) if ((allIds.includes(id) || id === courseId) && exampleOwners.get(id) !== row.id) throw identityConflict();
  }
  const lessonIds = new Set(existingLessons.map(row => row.id));
  const occupied = new Map(existingPatterns.map(row => [row.id, row]));
  const newLessons = lessons.filter(row => !lessonIds.has(row.id));
  if (newLessons.length) await tx.grammarLesson.createMany({ data: newLessons.map(row => ({ id: row.id, courseId })) });
  const newPatterns = patterns.filter(row => !occupied.has(row.id));
  if (newPatterns.length) await tx.grammarPattern.createMany({ data: newPatterns.map(row => ({ id: row.id, lessonId: row.lessonId,
    retainedExerciseIds: row.exercises.map(item => item.id), retainedExampleIds: row.examples.map(item => item.id) })) });
  for (const pattern of patterns) {
    const previous = occupied.get(pattern.id);
    if (!previous) continue;
    const exercises = pattern.exercises.map(item => item.id).filter(id => !previous.retainedExerciseIds.includes(id));
    const examples = pattern.examples.map(item => item.id).filter(id => !previous.retainedExampleIds.includes(id));
    if (exercises.length || examples.length) await tx.grammarPattern.update({ where: { id: pattern.id }, data: {
      ...(exercises.length ? { retainedExerciseIds: { push: exercises } } : {}), ...(examples.length ? { retainedExampleIds: { push: examples } } : {}),
    } });
  }
}

export async function createGrammar(db: PrismaClient, input: { id: string; slug: string; draft: GrammarDraft }) {
  return db.$transaction(async tx => {
    await lockWrite(tx);
    const occupied = await tx.grammarCourse.findFirst({ where: { OR: [{ id: input.id }, { slug: input.slug }] } });
    if (occupied) {
      if (occupied.id === input.id && occupied.slug === input.slug && JSON.stringify(grammarDraftSchema.parse(occupied.draft)) === JSON.stringify(input.draft)) return { course: occupied, created: false };
      throw new HttpError(409, 'GRAMMAR_EXISTS', 'ID hoặc đường dẫn giáo trình đã được sử dụng.');
    }
    await sourceExists(tx, input.draft.sourceId);
    const course = await tx.grammarCourse.create({ data: { id: input.id, slug: input.slug, draft: input.draft, sourceId: input.draft.sourceId } });
    await reserveIds(tx, course.id, input.draft);
    return { course, created: true };
  }, { timeout: 30000 });
}
export async function saveGrammar(db: PrismaClient, id: string, version: number, draft: GrammarDraft) {
  return db.$transaction(async tx => {
    await lockWrite(tx);
    const course = await lockedCourse(tx, id, version);
    if (course.archivedAt) throw new HttpError(409, 'GRAMMAR_ARCHIVED', 'Hãy khôi phục giáo trình trước khi sửa.');
    await sourceExists(tx, draft.sourceId);
    await reserveIds(tx, id, draft);
    return tx.grammarCourse.update({ where: { id }, data: { draft, sourceId: draft.sourceId, version: { increment: 1 } } });
  }, { timeout: 30000 });
}
export async function publishGrammar(db: PrismaClient, id: string, version: number) {
  return db.$transaction(async tx => {
    await lockWrite(tx);
    const course = await lockedCourse(tx, id, version);
    if (course.archivedAt) throw new HttpError(409, 'GRAMMAR_ARCHIVED', 'Hãy khôi phục giáo trình trước khi xuất bản.');
    const draft = grammarDraftSchema.parse(course.draft);
    if (!draft.sourceId) throw new HttpError(400, 'SOURCE_REQUIRED', 'Cần khai báo nguồn và quyền sử dụng thực tế trước khi xuất bản.');
    await sourceExists(tx, draft.sourceId);
    if (!draft.lessons.length || draft.lessons.some(lesson => !lesson.patterns.length)) throw new HttpError(400, 'GRAMMAR_EMPTY', 'Giáo trình cần ít nhất một bài, mỗi bài cần ít nhất một mẫu ngữ pháp.');
    const patterns = draft.lessons.flatMap(lesson => lesson.patterns);
    if (patterns.some(pattern => !pattern.structure || !pattern.explanation || !pattern.usage)) {
      throw new HttpError(400, 'GRAMMAR_INCOMPLETE', 'Mỗi mẫu cần cấu trúc, giải nghĩa và phạm vi sử dụng trước khi xuất bản.');
    }
    const ownIds = new Set(patterns.map(pattern => pattern.id));
    // Related links are stable UUIDs. Cross-course links must target currently published content.
    const externalIds = [...new Set(patterns.flatMap(pattern => pattern.relatedIds).filter(id => !ownIds.has(id)))];
    const external = await tx.grammarPattern.findMany({ where: { id: { in: externalIds }, active: true, lesson: { active: true, course: { archivedAt: null, publishedVersion: { not: null } } } }, select: { id: true } });
    if (external.length !== externalIds.length) throw new HttpError(400, 'GRAMMAR_RELATED_INVALID', 'Mẫu liên quan chưa tồn tại hoặc chưa xuất bản.');
    await reserveIds(tx, id, draft);
    const existing = await tx.grammarPattern.findMany({ where: { lesson: { courseId: id } } });
    const prior = new Map(existing.map(row => [row.id, row]));
    await tx.grammarLesson.updateMany({ where: { courseId: id }, data: { active: false } });
    await tx.grammarPattern.updateMany({ where: { lesson: { courseId: id } }, data: { active: false } });
    for (const [li, lesson] of draft.lessons.entries()) {
      await tx.grammarLesson.update({ where: { id: lesson.id }, data: { title: lesson.title, japanese: lesson.japanese, sortOrder: li, active: true } });
      for (const [pi, pattern] of lesson.patterns.entries()) {
        const previous = prior.get(pattern.id)!;
        const changed = !previous.active || previous.version === 0 || JSON.stringify(grammarPatternSchema.parse(previous.content)) !== JSON.stringify(pattern);
        await tx.grammarPattern.update({ where: { id: pattern.id }, data: { content: pattern, active: true, sortOrder: pi, ...(changed ? { version: { increment: 1 } } : {}) } });
      }
    }
    // Authoritative snapshots are refreshed; schedule, reviewCount, active state and review events are untouched.
    await tx.$executeRaw`
      UPDATE review_cards c SET front = item->>'pattern', back = item->>'meaning', reading = '', hint = '', version = c.version + 1
      FROM jsonb_array_elements(${JSON.stringify(patterns)}::jsonb) item
      WHERE c.category = 'grammar' AND c.source_id = 'grammar:' || (item->>'id')
        AND (c.front IS DISTINCT FROM item->>'pattern' OR c.back IS DISTINCT FROM item->>'meaning' OR c.reading <> '' OR c.hint <> '')`;
    const counts = grammarCounts(draft);
    return tx.grammarCourse.update({ where: { id }, data: { title: draft.title, subtitle: draft.subtitle, description: draft.description,
      level: draft.level, lessonCount: counts.lessonCount, patternCount: counts.patternCount,
      publishedSourceId: draft.sourceId, publishedVersion: version + 1, version: version + 1 } });
  }, { timeout: 30000 });
}
export async function changeGrammarStatus(db: PrismaClient, id: string, version: number, action: 'archive' | 'restore') {
  return db.$transaction(async tx => {
    await lockWrite(tx);
    const course = await lockedCourse(tx, id, version);
    if ((action === 'restore') !== !!course.archivedAt) throw new HttpError(409, 'GRAMMAR_STATUS_CHANGED', 'Trạng thái giáo trình đã thay đổi. Vui lòng tải lại.');
    return tx.grammarCourse.update({ where: { id }, data: { archivedAt: action === 'archive' ? new Date() : null,
      ...(action === 'restore' ? { publishedVersion: null } : {}), version: { increment: 1 } } });
  });
}
export async function publicGrammarCourse(tx: Prisma.TransactionClient, slug: string) {
  await tx.$queryRaw`SELECT id FROM grammar_courses WHERE slug = ${slug} FOR SHARE`;
  const course = await tx.grammarCourse.findUnique({ where: { slug } });
  if (!course || course.archivedAt || course.publishedVersion === null) throw notFound();
  const lessons = await tx.grammarLesson.findMany({ where: { courseId: course.id, active: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: { patterns: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } });
  return { ...grammarMetadata(course), lessons: lessons.map(lesson => ({ id: lesson.id, title: lesson.title, japanese: lesson.japanese,
    patterns: lesson.patterns.map(row => { const pattern = grammarPatternSchema.parse(row.content); return { id: row.id, pattern: pattern.pattern, meaning: pattern.meaning, exerciseCount: pattern.exercises.length }; }) })) };
}

// Acquire the course lock before user/card locks. Publication uses the same lock to avoid stale grades and star snapshots.
export async function lockPublishedGrammarPattern(tx: Prisma.TransactionClient, id: string) {
  const identity = await tx.grammarPattern.findUnique({ where: { id }, select: { lesson: { select: { courseId: true } } } });
  if (!identity) throw notFound();
  await tx.$queryRaw`SELECT id FROM grammar_courses WHERE id = ${identity.lesson.courseId}::uuid FOR SHARE`;
  const pattern = await tx.grammarPattern.findUnique({ where: { id }, include: { lesson: true } });
  const course = await tx.grammarCourse.findUnique({ where: { id: identity.lesson.courseId } });
  if (!pattern?.active || !pattern.lesson.active || !course || course.archivedAt || course.publishedVersion === null) throw notFound();
  return { pattern, course, lesson: pattern.lesson };
}
export async function publicGrammarPattern(tx: Prisma.TransactionClient, id: string) {
  const { pattern: row, course, lesson } = await lockPublishedGrammarPattern(tx, id);
  const pattern = grammarPatternSchema.parse(row.content);
  const related = await tx.grammarPattern.findMany({ where: { id: { in: pattern.relatedIds }, active: true,
    lesson: { active: true, course: { archivedAt: null, publishedVersion: { not: null } } } }, select: { id: true, content: true } });
  const relatedMap = new Map(related.map(row => { const content = grammarPatternSchema.parse(row.content); return [row.id, { id: row.id, pattern: content.pattern, meaning: content.meaning }]; }));
  return { ...pattern, version: row.version, courseId: course.id, courseSlug: course.slug, courseTitle: course.title,
    lessonId: lesson.id, lessonTitle: lesson.title,
    exercises: pattern.exercises.map(({ answers: _answers, correctOrder: _order, explanation: _explanation, translation: _translation, ...exercise }) => exercise),
    related: pattern.relatedIds.flatMap(id => relatedMap.has(id) ? [relatedMap.get(id)!] : []),
  };
}

export async function setGrammarReviewStar(tx: Prisma.TransactionClient, userId: string, sourceId: string, active: boolean) {
  let published: GrammarPatternContent | null = null;
  if (sourceId.startsWith('grammar:')) {
    const id = grammarId.parse(sourceId.slice('grammar:'.length));
    sourceId = `grammar:${id}`;
    try { published = grammarPatternSchema.parse((await lockPublishedGrammarPattern(tx, id)).pattern.content); }
    catch (error) { if (!(error instanceof HttpError && error.status === 404)) throw error; }
  }
  const where = { userId_category_sourceId: { userId, category: 'grammar', sourceId } };
  const previous = await tx.reviewCard.findUnique({ where });
  if (!published && (!previous || active && sourceId.startsWith('grammar:'))) throw new HttpError(404, 'GRAMMAR_NOT_FOUND', 'Mẫu ngữ pháp chưa được xuất bản hoặc không còn nhận thẻ mới.');
  if (!previous && !active) throw notFound();
  const snapshot = published ? { front: published.pattern, back: published.meaning, reading: '', hint: '' } : {};
  if (previous) return tx.reviewCard.update({ where, data: { ...snapshot, active, version: { increment: 1 } } });
  return tx.reviewCard.upsert({ where, create: { userId, category: 'grammar', sourceId, active, front: published!.pattern, back: published!.meaning },
    update: { ...snapshot, active, version: { increment: 1 } } });
}
