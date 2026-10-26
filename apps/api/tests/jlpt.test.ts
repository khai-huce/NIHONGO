import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';
import type { AdminJlptRoadmap, JlptDraft, JlptResourceKind } from '@nihongo/shared/contracts/jlpt';
import { parseJlptDraft } from '../src/modules/jlpt/jlpt.schema.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1))) throw new Error('Refusing non-test database');
const config: Config = { NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', ADMIN_ORIGIN: 'http://localhost:3002', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'jlpt-test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: '' };
let api: ReturnType<typeof createApp>, userIds: string[], roadmapIds: string[], sourceId: string;
let ids: { kanji: string; course: string; topic: string; vocabulary: string; grammarCourse: string; grammarLesson: string; grammar: string; reading: string; shadowing: string };
type User = { id: string; cookie: string };
const endpoint = '/api/admin/jlpt/roadmaps';
const write = (user: User | null, path: string, data: object, method: 'post' | 'patch' = 'post') => request(api.app)[method](path).set('Origin', config.APP_ORIGIN).set('Cookie', user?.cookie ?? '').send({ expectedUserId: user?.id ?? null, ...data });
const get = (path: string, user?: User) => request(api.app).get(path).set('Cookie', user?.cookie ?? '');
async function register(admin = false): Promise<User> {
  const response = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN).send({ name: 'J01 test', email: `j01-${randomUUID()}@example.test`, password: 'J01-test-password-12345' }).expect(201);
  userIds.push(response.body.user.id);
  if (admin) await api.db.user.update({ where: { id: response.body.user.id }, data: { role: 'admin' } });
  return { id: response.body.user.id, cookie: (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0] };
}
function draft(kinds: JlptResourceKind[] = ['kana']): JlptDraft {
  return parseJlptDraft({ title: 'Lộ trình kiểm thử', description: 'Chỉ dữ liệu kiểm thử', sourceId,
    sessions: [{ id: randomUUID(), title: 'Buổi đầu', description: '', estimatedMinutes: 30,
      questions: Array.from({length:5}, (_, i) => ({ id: randomUUID(), prompt: `Câu kiểm thử ${i}`, passage: '', options: ['A','B','C','D'], correctIndex: 0, explanation: 'Đáp án A.' })),
      resources: kinds.map(kind => ({ id: randomUUID(), kind, targetId: kind === 'kana' ? 'hiragana' : ids[kind] })) }] });
}
async function create(admin: User, content = draft(), publish = false, level = 'N5'): Promise<AdminJlptRoadmap> {
  const id = randomUUID(); roadmapIds.push(id);
  const result = (await write(admin, endpoint, { id, level, draft: content }).expect(201)).body.roadmap;
  return publish ? (await write(admin, `${endpoint}/${id}/publish`, { version: result.version }).expect(200)).body.roadmap : result;
}
async function fixtures(admin: User) {
  await api.db.kanjiContent.create({ data: { id: ids.kanji, character: '龘', level: 'N5', hanViet: 'KIỂM THỬ', meaning: 'Kanji đã xuất bản', sourceId, draftSourceId: sourceId, published: {}, draft: {}, status: 'published' } });
  await api.db.curriculumCourse.create({ data: { id: ids.course, slug: `j01-${ids.course}`, draft: {}, sourceId, publishedSourceId: sourceId, publishedVersion: 1, title: 'Từ vựng kiểm thử', level: 'N5' } });
  await api.db.curriculumTopic.create({ data: { id: ids.topic, courseId: ids.course, title: 'Chủ đề', active: true } });
  await api.db.curriculumLesson.create({ data: { id: ids.vocabulary, courseId: ids.course, topicId: ids.topic, title: 'Bài từ vựng', active: true } });
  await api.db.grammarCourse.create({ data: { id: ids.grammarCourse, slug: `j01-${ids.grammarCourse}`, draft: {}, sourceId, publishedSourceId: sourceId, publishedVersion: 1, title: 'Ngữ pháp kiểm thử', level: 'N5' } });
  await api.db.grammarLesson.create({ data: { id: ids.grammarLesson, courseId: ids.grammarCourse, title: 'Bài ngữ pháp', active: true } });
  await api.db.grammarPattern.create({ data: { id: ids.grammar, lessonId: ids.grammarLesson, active: true, content: { pattern: 'N も', meaning: 'N cũng' } } });
  await api.db.readingArticle.create({ data: { id: ids.reading, userId: admin.id, scope: 'library', content: { title: 'Bản nháp bí mật' }, sourceId, publishedSourceId: sourceId,
    publishedVersion: 1, publishedContent: { title: 'Bài đọc public', level: 'N5' } } });
  await api.db.shadowingVideo.create({ data: { id: ids.shadowing, scope: 'library', initialHash: 'test', content: { title: 'Video nháp bí mật' }, sourceId,
    publishedSourceId: sourceId, publishedVersion: 1, publishedContent: { title: 'Video public', channel: 'Kênh kiểm thử', level: 'N5' } } });
}
beforeEach(async () => {
  api = createApp(config); userIds = []; roadmapIds = []; sourceId = `j01-${randomUUID()}`;
  ids = { kanji: `j01-${randomUUID().slice(0, 20)}`, course: randomUUID(), topic: randomUUID(), vocabulary: randomUUID(), grammarCourse: randomUUID(), grammarLesson: randomUUID(), grammar: randomUUID(), reading: randomUUID(), shadowing: randomUUID() };
  await api.db.contentSource.create({ data: { id: sourceId, name: 'J01 disposable tests', url: 'urn:nihongo:j01-test', license: 'Test fixture', licenseUrl: 'urn:nihongo:test', version: '1', checksum: '', attribution: 'J01 tests', notes: '' } });
});
afterEach(async () => {
  await api.db.jlptResource.deleteMany({ where: { session: { roadmapId: { in: roadmapIds } } } });
  await api.db.jlptSession.deleteMany({ where: { roadmapId: { in: roadmapIds } } });
  await api.db.jlptRoadmap.deleteMany({ where: { id: { in: roadmapIds } } });
  await api.db.kanjiContent.deleteMany({ where: { id: ids.kanji } });
  await api.db.curriculumLesson.deleteMany({ where: { id: ids.vocabulary } });
  await api.db.curriculumTopic.deleteMany({ where: { id: ids.topic } });
  await api.db.curriculumCourse.deleteMany({ where: { id: ids.course } });
  await api.db.grammarPattern.deleteMany({ where: { id: ids.grammar } });
  await api.db.grammarLesson.deleteMany({ where: { id: ids.grammarLesson } });
  await api.db.grammarCourse.deleteMany({ where: { id: ids.grammarCourse } });
  await api.db.readingArticle.deleteMany({ where: { id: ids.reading } });
  await api.db.shadowingVideo.deleteMany({ where: { id: ids.shadowing } });
  await api.db.user.deleteMany({ where: { id: { in: userIds } } });
  await api.db.contentSource.delete({ where: { id: sourceId } });
  await api.close();
});

describe('J01 relational JLPT catalog', () => {
  it('protects admin, checks current account and origin, and makes no draft public', async () => {
    await get(endpoint).expect(401); const user = await register(), admin = await register(true);
    await get(endpoint, user).expect(403);
    const row = await create(admin);
    await get('/api/jlpt/roadmaps/N5').expect(404);
    expect((await get('/api/jlpt/roadmaps')).body.items).toEqual([]);
    await write(admin, `${endpoint}/${row.id}/publish`, { version: row.version, expectedUserId: user.id }).expect(409);
    await request(api.app).post(`${endpoint}/${row.id}/publish`).set('Origin', 'https://invalid.example').set('Cookie', admin.cookie).send({ version: 0, expectedUserId: admin.id }).expect(403);
    await api.db.user.update({ where: { id: admin.id }, data: { role: 'user' } });
    await get(`${endpoint}/${row.id}`, admin).expect(403);
  });
  it('links all six published resource kinds and returns real counts, paths and sources', async () => {
    const admin = await register(true); await fixtures(admin);
    const content = draft(['kanji', 'vocabulary', 'grammar', 'reading', 'shadowing', 'kana']);
    content.sessions.push({ id: randomUUID(), title: 'Ôn Kanji', description: '', estimatedMinutes: 10, resources: [{ id: randomUUID(), kind: 'kanji', targetId: ids.kanji }], questions: draft().sessions[0].questions });
    const row = await create(admin, content, true);
    const result = (await get('/api/jlpt/roadmaps/N5').expect(200)).body.roadmap;
    expect(result).toMatchObject({ id: row.id, sessionCount: 2, resourceCount: 7, kanjiCount: 1, estimatedMinutes: 40, source: { id: sourceId } });
    expect(result.sessions[0].resources.map((item: { available: boolean }) => item.available)).toEqual(Array(6).fill(true));
    expect(result.sessions[0].resources[1].href).toBe(`/tu-vung/giao-trinh/j01-${ids.course}/bai/${ids.vocabulary}`);
    expect(result.sessions[0].resources[3].title).toBe('Bài đọc public');
    expect(JSON.stringify(result)).not.toContain('bí mật');
    expect(result).not.toHaveProperty('progress');
    expect(await api.db.xpEvent.count({ where: { userId: admin.id } })).toBe(0);
    expect(await api.db.reviewCard.count({ where: { userId: admin.id } })).toBe(0);
    expect(await api.db.defaultRoadmapProgress.count({ where: { userId: admin.id } })).toBe(0);
    await get('/api/jlpt/roadmaps/N4').expect(404);
    const picker = (await get('/api/admin/jlpt/resources?kind=reading&q=public&level=N5', admin)).body;
    expect(picker.userId).toBe(admin.id); expect(picker.items.some((item: { targetId: string }) => item.targetId === ids.reading)).toBe(true);
  });
  it('draft edits and removal do not alter publication; publish retains identities and never copies knowledge bodies', async () => {
    const admin = await register(true); await fixtures(admin); const row = await create(admin, draft(['kanji', 'grammar']), true);
    const content = structuredClone(row.draft); content.title = 'Tên nháp'; content.sessions[0].resources.pop(); content.sessions[0].title = 'Buổi nháp';
    const saved = (await write(admin, `${endpoint}/${row.id}`, { version: row.version, draft: content }, 'patch').expect(200)).body.roadmap;
    expect((await get('/api/jlpt/roadmaps/N5')).body.roadmap.title).toBe('Lộ trình kiểm thử');
    expect((await get('/api/jlpt/roadmaps/N5')).body.roadmap.resourceCount).toBe(2);
    await api.db.kanjiContent.update({ where: { id: ids.kanji }, data: { meaning: 'Nghĩa mới xuất bản' } });
    expect((await get('/api/jlpt/roadmaps/N5')).body.roadmap.sessions[0].resources[0].subtitle).toContain('Nghĩa mới xuất bản');
    await write(admin, `${endpoint}/${row.id}/publish`, { version: saved.version }).expect(200);
    const published = (await get('/api/jlpt/roadmaps/N5')).body.roadmap;
    expect(published.title).toBe('Tên nháp'); expect(published.resourceCount).toBe(1);
    const removed = await api.db.jlptResource.findUniqueOrThrow({ where: { id: row.draft.sessions[0].resources[1].id } });
    expect(removed.draftPosition).toBeNull(); expect(removed.publishedPosition).toBeNull(); expect(removed.grammarPatternId).toBe(ids.grammar);
    const metadata = await api.db.jlptRoadmap.findUniqueOrThrow({ where: { id: row.id } }); expect(metadata.draft).not.toHaveProperty('sessions');
  });
  it('rejects new unpublished/private/missing targets without leaking their titles', async () => {
    const admin = await register(true); await fixtures(admin);
    await api.db.readingArticle.update({ where: { id: ids.reading }, data: { scope: 'personal' } });
    await api.db.shadowingVideo.update({ where: { id: ids.shadowing }, data: { publishedVersion: null } });
    for (const kind of ['reading', 'shadowing'] as const) {
      const content = draft([kind]); const id = randomUUID(); roadmapIds.push(id);
      const response = await write(admin, endpoint, { id, level: 'N5', draft: content }).expect(400);
      expect(response.body.error.issues[0].path).toContain('targetId'); expect(JSON.stringify(response.body)).not.toContain('bí mật');
      expect((await get(`/api/admin/jlpt/resources?kind=${kind}`, admin)).body.items.some((item: { targetId: string }) => item.targetId === ids[kind])).toBe(false);
    }
    const missing = draft(['kanji']); missing.sessions[0].resources[0].targetId = 'missing-kanji';
    const preview = (await write(admin, `${endpoint}/preview`, { draft: missing }).expect(200)).body;
    expect(preview.canPublish).toBe(false); expect(preview.sessions[0].resources[0]).toMatchObject({ available: false, href: null, subtitle: '' });
  });
  it('marks archived targets unavailable, keeps saved references editable, and blocks re-publication', async () => {
    const admin = await register(true); await fixtures(admin); const row = await create(admin, draft(['reading']), true);
    await api.db.readingArticle.update({ where: { id: ids.reading }, data: { archivedAt: new Date() } });
    const resource = (await get('/api/jlpt/roadmaps/N5')).body.roadmap.sessions[0].resources[0];
    expect(resource).toMatchObject({ available: false, href: null, title: 'Nội dung hiện không khả dụng' });
    const content = structuredClone(row.draft); content.title = 'Vẫn được chỉnh nháp';
    const saved = (await write(admin, `${endpoint}/${row.id}`, { version: row.version, draft: content }, 'patch').expect(200)).body.roadmap;
    await write(admin, `${endpoint}/${row.id}/publish`, { version: saved.version }).expect(400);
    expect((await get(`${endpoint}/${row.id}`, admin)).body.roadmap.draft.title).toBe(content.title);
  });
  it('requires source, sessions and resources for publication, but permits incomplete drafts', async () => {
    const admin = await register(true), content = draft(); content.sourceId = null; content.sessions = [];
    const row = await create(admin, content);
    const preview = (await write(admin, `${endpoint}/preview`, { draft: content }).expect(200)).body;
    expect(preview.canPublish).toBe(false); expect(preview.issues).toHaveLength(2);
    await write(admin, `${endpoint}/${row.id}/publish`, { version: row.version }).expect(400);
    content.sourceId = sourceId; content.sessions = draft().sessions; content.sessions[0].resources = [];
    const saved = (await write(admin, `${endpoint}/${row.id}`, { version: row.version, draft: content }, 'patch').expect(200)).body.roadmap;
    await write(admin, `${endpoint}/${row.id}/publish`, { version: saved.version }).expect(400);
  });
  it('canonicalizes UUIDs, rejects duplicate targets and prevents immutable identity reassignment', async () => {
    const admin = await register(true), content = draft(); content.sessions[0].id = content.sessions[0].id.toUpperCase();
    const row = await create(admin, content);
    expect(row.draft.sessions[0].id).toBe(content.sessions[0].id.toLowerCase());
    const duplicate = structuredClone(row.draft); duplicate.sessions[0].resources.push({ ...duplicate.sessions[0].resources[0], id: randomUUID() });
    await write(admin, `${endpoint}/preview`, { draft: duplicate }).expect(400);
    const repeatedUuid = draft(['reading']);
    repeatedUuid.sessions[0].resources[0].targetId = ids.reading.toUpperCase();
    expect(parseJlptDraft(repeatedUuid).sessions[0].resources[0].targetId).toBe(ids.reading);
    repeatedUuid.sessions[0].resources.push({ id: randomUUID(), kind: 'reading', targetId: ids.reading });
    expect(() => parseJlptDraft(repeatedUuid)).toThrow();
    const changed = structuredClone(row.draft); changed.sessions[0].resources[0].targetId = 'katakana';
    await write(admin, `${endpoint}/${row.id}`, { version: row.version, draft: changed }, 'patch').expect(409);
    const moved = structuredClone(row.draft); moved.sessions[0].id = randomUUID();
    await write(admin, `${endpoint}/${row.id}`, { version: row.version, draft: moved }, 'patch').expect(409);
  });
  it('serializes concurrent edits, idempotent creation, and unique levels', async () => {
    const admin = await register(true), row = await create(admin);
    await write(admin, endpoint, { id: row.id, level: 'N5', draft: row.draft }).expect(200);
    const otherId = randomUUID(); roadmapIds.push(otherId);
    await write(admin, endpoint, { id: otherId, level: 'N5', draft: draft() }).expect(409);
    const a = structuredClone(row.draft), b = structuredClone(row.draft); a.title = 'A'; b.title = 'B';
    const responses = await Promise.all([write(admin, `${endpoint}/${row.id}`, { version: row.version, draft: a }, 'patch'), write(admin, `${endpoint}/${row.id}`, { version: row.version, draft: b }, 'patch')]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    await write(admin, `${endpoint}/${row.id}/publish`, { version: row.version }).expect(409);
  });
  it('archives without deleting and restores only as draft', async () => {
    const admin = await register(true), row = await create(admin, draft(), true);
    const archived = (await write(admin, `${endpoint}/${row.id}/archive`, { version: row.version }).expect(200)).body.roadmap;
    await get('/api/jlpt/roadmaps/N5').expect(404);
    await write(admin, `${endpoint}/${row.id}`, { version: archived.version, draft: row.draft }, 'patch').expect(409);
    const restored = (await write(admin, `${endpoint}/${row.id}/restore`, { version: archived.version }).expect(200)).body.roadmap;
    expect(restored.publishedVersion).toBeNull(); await get('/api/jlpt/roadmaps/N5').expect(404);
    expect(await api.db.jlptResource.count({ where: { sessionId: row.draft.sessions[0].id } })).toBe(1);
    await write(admin, `${endpoint}/${row.id}/publish`, { version: restored.version }).expect(200);
  });
  it('enforces FK and exactly-one matching target constraints in PostgreSQL itself', async () => {
    const admin = await register(true); await fixtures(admin); const row = await create(admin, draft(['kanji']));
    const sessionId = row.draft.sessions[0].id;
    await expect(api.db.jlptResource.create({ data: { id: randomUUID(), sessionId, kind: 'kanji' } })).rejects.toThrow();
    await expect(api.db.jlptResource.create({ data: { id: randomUUID(), sessionId, kind: 'kana', kanaScript: 'romaji' } })).rejects.toThrow();
    await expect(api.db.jlptResource.create({ data: { id: randomUUID(), sessionId, kind: 'kanji', kanjiId: ids.kanji, kanaScript: 'hiragana' } })).rejects.toThrow();
    await expect(api.db.jlptResource.create({ data: { id: randomUUID(), sessionId, kind: 'reading', kanjiId: ids.kanji } })).rejects.toThrow();
    await expect(api.db.jlptResource.create({ data: { id: randomUUID(), sessionId, kind: 'kana', kanjiId: ids.kanji } })).rejects.toThrow();
    await expect(api.db.jlptResource.create({ data: { id: randomUUID(), sessionId, kind: 'kanji', kanjiId: 'does-not-exist' } })).rejects.toThrow();
    await expect(api.db.kanjiContent.delete({ where: { id: ids.kanji } })).rejects.toThrow();
    await expect(api.db.jlptResource.update({ where: { id: row.draft.sessions[0].resources[0].id }, data: { draftPosition: -1 } })).rejects.toThrow();
  });
});
