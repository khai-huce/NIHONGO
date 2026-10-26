import { Prisma, type PrismaClient, type JlptResource, type JlptRoadmap } from '@prisma/client';
import { z } from 'zod';
import type { AdminJlptRoadmap, JlptCounts, JlptDraft, JlptLevel, JlptPreview, JlptResourceInput, JlptResourceKind, JlptRoadmapView, JlptSessionInput, JlptSessionView } from '@nihongo/shared/contracts/jlpt';
import { HttpError } from '../../common/errors.js';
import { parseJlptDraft, jlptQuestion } from './jlpt.schema.js';
import { lockResourceTargets, resolveResources } from './jlpt.resources.js';

const notFound = () => new HttpError(404, 'JLPT_NOT_FOUND', 'Không tìm thấy lộ trình JLPT.');
// Full curricula may wait behind an editorial save holding the roadmap lock.
// Keep the same bounded window for readers and writers instead of Prisma's 5s default.
export const jlptTransactionOptions = { maxWait: 10_000, timeout: 30_000 };
const identityError = () => new HttpError(409, 'JLPT_ID_EXISTS', 'ID buổi học hoặc liên kết đã được sử dụng. Muốn thay nội dung liên kết, hãy thêm mục mới.');
const metadata = z.object({ title: z.string(), description: z.string(), passPercent: z.number().default(80) });
const sessionMetadata = z.object({ title: z.string(), description: z.string(), estimatedMinutes: z.number(), position: z.number(), questions: z.array(jlptQuestion).default([]) });
const targetFields = { kanji: 'kanjiId', vocabulary: 'vocabularyLessonId', grammar: 'grammarPatternId', reading: 'readingArticleId', shadowing: 'shadowingVideoId', kana: 'kanaScript' } as const;
const inputResource = (row: JlptResource): JlptResourceInput => ({ id: row.id, kind: row.kind as JlptResourceKind, targetId: row[targetFields[row.kind as JlptResourceKind]]! });
const sameTarget = (row: JlptResource, item: JlptResourceInput) => row.kind === item.kind && row[targetFields[item.kind]] === item.targetId;
const allResources = (draft: JlptDraft) => draft.sessions.flatMap(session => session.resources);
async function lock(tx: Prisma.TransactionClient) { await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(290929, 7)`; }
async function lockedRoadmap(tx: Prisma.TransactionClient, id: string, version: number) {
  await tx.$queryRaw`SELECT id FROM jlpt_roadmaps WHERE id=${id}::uuid FOR UPDATE`;
  const row = await tx.jlptRoadmap.findUnique({ where: { id } });
  if (!row) throw notFound();
  if (row.version !== version) throw new HttpError(409, 'JLPT_CHANGED', 'Lộ trình đã thay đổi ở phiên khác. Vui lòng tải lại.');
  return row;
}
async function sourceExists(tx: Prisma.TransactionClient, id: string | null) {
  if (id && !await tx.contentSource.findUnique({ where: { id }, select: { id: true } })) {
    throw new HttpError(400, 'SOURCE_NOT_FOUND', 'Nguồn nội dung không tồn tại. Hãy khai báo nguồn thực tế trước.');
  }
}
export async function sessionsFor(tx: Prisma.TransactionClient, roadmapId: string, stage: 'draft' | 'published'): Promise<JlptSessionInput[]> {
  const rows = await tx.jlptSession.findMany({ where: { roadmapId, [stage]: { not: Prisma.DbNull } }, include: {
    resources: { where: { [stage === 'draft' ? 'draftPosition' : 'publishedPosition']: { not: null } },
      orderBy: { [stage === 'draft' ? 'draftPosition' : 'publishedPosition']: 'asc' } },
  } });
  return rows.map(row => ({ row, info: sessionMetadata.parse(row[stage]) }))
    .sort((a, b) => a.info.position - b.info.position).map(({ row, info }) => ({
      id: row.id, title: info.title, description: info.description, estimatedMinutes: info.estimatedMinutes, resources: row.resources.map(inputResource), questions: info.questions,
    }));
}
export async function adminRoadmap(tx: Prisma.TransactionClient, row: JlptRoadmap): Promise<AdminJlptRoadmap> {
  return { id: row.id, level: row.level as JlptLevel, version: row.version, publishedVersion: row.publishedVersion,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    draft: parseJlptDraft({ ...metadata.parse(row.draft), sourceId: row.sourceId, sessions: await sessionsFor(tx, row.id, 'draft') }) };
}
async function resolvedSessions(tx: Prisma.TransactionClient, sessions: JlptSessionInput[]): Promise<JlptSessionView[]> {
  const resolved = await resolveResources(tx, sessions.flatMap(session => session.resources));
  const byId = new Map(resolved.map(item => [item.id, item]));
  return sessions.map(({ questions, ...session }) => ({ ...session, questionCount: questions?.length ?? 0, resources: session.resources.map(item => byId.get(item.id)!) }));
}
const counts = (sessions: JlptSessionView[]): JlptCounts => ({ sessionCount: sessions.length,
  resourceCount: sessions.reduce((total, session) => total + session.resources.length, 0),
  kanjiCount: new Set(sessions.flatMap(session => session.resources.filter(item => item.kind === 'kanji' && item.available).map(item => item.targetId))).size,
  estimatedMinutes: sessions.reduce((total, session) => total + session.estimatedMinutes, 0),
});
export async function previewJlpt(tx: Prisma.TransactionClient, draft: JlptDraft): Promise<JlptPreview> {
  await sourceExists(tx, draft.sourceId);
  const sessions = await resolvedSessions(tx, draft.sessions), issues: string[] = [];
  if (!draft.sourceId) issues.push('Chọn nguồn biên soạn lộ trình trước khi xuất bản.');
  if (!sessions.length) issues.push('Lộ trình cần ít nhất một buổi học.');
  sessions.forEach((session, index) => {
    const questions = draft.sessions[index].questions ?? [];
    if (questions.length < 5) issues.push(`Buổi ${index + 1} cần ít nhất 5 câu kiểm tra.`);
    if (questions.some(q => !q.prompt || !q.explanation || q.options.some(o => !o) || new Set(q.options.map(o => o.normalize('NFKC').trim())).size !== 4)) issues.push(`Buổi ${index + 1}: câu hỏi cần đề, bốn lựa chọn khác nhau và giải thích.`);
    if (!session.resources.length) issues.push(`Buổi ${index + 1} cần ít nhất một nội dung.`);
    if (session.resources.some(item => !item.available)) issues.push(`Buổi ${index + 1} có nội dung chưa xuất bản hoặc không còn khả dụng.`);
  });
  return { draft, sessions, ...counts(sessions), canPublish: issues.length === 0, issues };
}

// Every logical identity remains reserved, even after removal from both draft and publication.
async function saveDraftRows(tx: Prisma.TransactionClient, roadmapId: string, draft: JlptDraft) {
  const resources = allResources(draft), ids = [roadmapId, ...draft.sessions.map(s => s.id), ...resources.map(r => r.id)];
  const [occupiedRoadmaps, occupiedSessions, occupiedResources] = await Promise.all([
    tx.jlptRoadmap.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    tx.jlptSession.findMany({ where: { id: { in: ids } }, select: { id: true, roadmapId: true } }),
    tx.jlptResource.findMany({ where: { id: { in: ids } } }),
  ]);
  const sessionsById = new Map(draft.sessions.map(session => [session.id, session]));
  const resourcesById = new Map(draft.sessions.flatMap(session => session.resources.map(item => [item.id, { item, sessionId: session.id }] as const)));
  if (occupiedRoadmaps.some(row => row.id !== roadmapId) || sessionsById.has(roadmapId) || resourcesById.has(roadmapId)
    || occupiedSessions.some(row => row.roadmapId !== roadmapId || !sessionsById.has(row.id))
    || occupiedResources.some(row => { const expected = resourcesById.get(row.id); return !expected || expected.sessionId !== row.sessionId || !sameTarget(row, expected.item); })) throw identityError();
  const occupied = new Map(occupiedResources.map(row => [row.id, row]));
  const newResources = resources.filter(item => !occupied.has(item.id));
  await lockResourceTargets(tx, newResources);
  const available = await resolveResources(tx, newResources), invalidIds = new Set(available.filter(item => !item.available).map(item => item.id));
  if (invalidIds.size) {
    throw new z.ZodError(draft.sessions.flatMap((session, si) => session.resources.flatMap((item, ri) => invalidIds.has(item.id)
      ? [{ code: 'custom' as const, path: ['draft', 'sessions', si, 'resources', ri, 'targetId'], message: 'Chỉ liên kết nội dung thư viện đã xuất bản và còn khả dụng.' }] : [])));
  }
  await tx.jlptSession.updateMany({ where: { roadmapId }, data: { draft: Prisma.DbNull } });
  await tx.jlptResource.updateMany({ where: { session: { roadmapId } }, data: { draftPosition: null } });
  for (const [si, session] of draft.sessions.entries()) {
    const data = { title: session.title, description: session.description, estimatedMinutes: session.estimatedMinutes, position: si, questions: (session.questions ?? []) as unknown as Prisma.InputJsonArray };
    await tx.jlptSession.upsert({ where: { id: session.id }, create: { id: session.id, roadmapId, draft: data }, update: { draft: data } });
    for (const [ri, resource] of session.resources.entries()) {
      await tx.jlptResource.upsert({ where: { id: resource.id },
        create: { id: resource.id, sessionId: session.id, kind: resource.kind, [targetFields[resource.kind]]: resource.targetId, draftPosition: ri },
        update: { draftPosition: ri } });
    }
  }
}
export async function createJlpt(db: PrismaClient, input: { id: string; level: JlptLevel; draft: JlptDraft }) {
  return db.$transaction(async tx => {
    await lock(tx);
    const occupied = await tx.jlptRoadmap.findFirst({ where: { OR: [{ id: input.id }, { level: input.level }] } });
    if (occupied) {
      const current = await adminRoadmap(tx, occupied);
      if (occupied.id === input.id && occupied.level === input.level && JSON.stringify(current.draft) === JSON.stringify(input.draft)) return { roadmap: current, created: false };
      throw new HttpError(409, 'JLPT_EXISTS', 'Cấp độ hoặc ID này đã có lộ trình. Hãy biên tập lộ trình hiện có.');
    }
    await sourceExists(tx, input.draft.sourceId);
    const row = await tx.jlptRoadmap.create({ data: { id: input.id, level: input.level,
      sourceId: input.draft.sourceId, draft: { title: input.draft.title, description: input.draft.description, passPercent: input.draft.passPercent ?? 80 } } });
    await saveDraftRows(tx, row.id, input.draft);
    return { roadmap: await adminRoadmap(tx, row), created: true };
  }, jlptTransactionOptions);
}
export async function saveJlpt(db: PrismaClient, id: string, version: number, draft: JlptDraft) {
  return db.$transaction(async tx => {
    await lock(tx); const row = await lockedRoadmap(tx, id, version);
    if (row.archivedAt) throw new HttpError(409, 'JLPT_ARCHIVED', 'Hãy khôi phục lộ trình trước khi sửa.');
    await sourceExists(tx, draft.sourceId); await saveDraftRows(tx, id, draft);
    const saved = await tx.jlptRoadmap.update({ where: { id }, data: { draft: { title: draft.title, description: draft.description, passPercent: draft.passPercent ?? 80 },
      sourceId: draft.sourceId, version: { increment: 1 } } });
    return adminRoadmap(tx, saved);
  }, jlptTransactionOptions);
}
export async function publishJlpt(db: PrismaClient, id: string, version: number) {
  return db.$transaction(async tx => {
    await lock(tx); const row = await lockedRoadmap(tx, id, version);
    if (row.archivedAt) throw new HttpError(409, 'JLPT_ARCHIVED', 'Hãy khôi phục lộ trình trước khi xuất bản.');
    const draft = (await adminRoadmap(tx, row)).draft;
    await lockResourceTargets(tx, allResources(draft));
    const preview = await previewJlpt(tx, draft);
    if (!preview.canPublish) {
      const issues: z.core.$ZodIssue[] = preview.issues.map(message => ({ code: 'custom', path: ['draft'], message }));
      if (!draft.sourceId) issues.push({ code: 'custom', path: ['draft', 'sourceId'], message: preview.issues[0] });
      if (!draft.sessions.length) issues.push({ code: 'custom', path: ['draft', 'sessions'], message: 'Lộ trình cần ít nhất một buổi học.' });
      preview.sessions.forEach((session, si) => {
        if (!session.resources.length) issues.push({ code: 'custom', path: ['draft', 'sessions', si, 'resources'], message: `Buổi ${si + 1} cần ít nhất một nội dung.` });
        session.resources.forEach((item, ri) => {
          if (!item.available) issues.push({ code: 'custom', path: ['draft', 'sessions', si, 'resources', ri, 'targetId'], message: `Buổi ${si + 1}: nội dung chưa xuất bản hoặc không còn khả dụng.` });
        });
      });
      throw new z.ZodError(issues);
    }
    await tx.$executeRaw`UPDATE jlpt_sessions SET published=draft WHERE roadmap_id=${id}::uuid`;
    await tx.$executeRaw`UPDATE jlpt_resources r SET published_position=r.draft_position FROM jlpt_sessions s WHERE r.session_id=s.id AND s.roadmap_id=${id}::uuid`;
    const saved = await tx.jlptRoadmap.update({ where: { id }, data: { published: row.draft as Prisma.InputJsonValue,
      publishedSourceId: row.sourceId, publishedVersion: version + 1, version: version + 1 } });
    return adminRoadmap(tx, saved);
  }, jlptTransactionOptions);
}
export async function changeJlptStatus(db: PrismaClient, id: string, version: number, action: 'archive' | 'restore') {
  return db.$transaction(async tx => {
    await lock(tx); const row = await lockedRoadmap(tx, id, version);
    if ((action === 'restore') !== !!row.archivedAt) throw new HttpError(409, 'JLPT_CHANGED', 'Trạng thái lộ trình đã thay đổi. Vui lòng tải lại.');
    const saved = await tx.jlptRoadmap.update({ where: { id }, data: { archivedAt: action === 'archive' ? new Date() : null,
      ...(action === 'restore' ? { publishedVersion: null } : {}), version: { increment: 1 } } });
    return adminRoadmap(tx, saved);
  }, jlptTransactionOptions);
}
export async function publicJlpt(tx: Prisma.TransactionClient, level: JlptLevel): Promise<JlptRoadmapView> {
  await tx.$queryRaw`SELECT id FROM jlpt_roadmaps WHERE level=${level} FOR SHARE`;
  const row = await tx.jlptRoadmap.findUnique({ where: { level }, include: { publishedSource: true } });
  if (!row || row.archivedAt || row.publishedVersion === null || !row.published || !row.publishedSource) throw notFound();
  const sessions = await resolvedSessions(tx, await sessionsFor(tx, row.id, 'published'));
  const source = row.publishedSource;
  return { id: row.id, level, ...metadata.parse(row.published), publishedVersion: row.publishedVersion, ...counts(sessions),
    resourceKinds: [...new Set(sessions.flatMap(session => session.resources.map(resource => resource.kind)))],
    sessions, source: { id: source.id, name: source.name, url: source.url, license: source.license, licenseUrl: source.licenseUrl, attribution: source.attribution } };
}
