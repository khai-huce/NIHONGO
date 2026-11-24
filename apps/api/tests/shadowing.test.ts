import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';
import * as media from '../src/integrations/shadowing-media.js';
import { HttpError } from '../src/common/errors.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const database = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(database.pathname.slice(1))) throw new Error('Refusing a non-test database');
const config: Config = { NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: '', YOUTUBE_API_KEY: 'test-only', GEMINI_API_KEY: 'test-only', GEMINI_MODEL: 'test-model' };
type User = { id: string; sid: string };
let api: ReturnType<typeof createApp>;
let inspect: MockInstance<typeof media.inspectYouTube>;
let generate: MockInstance<typeof media.generateShadowingTranscript>;
const route = '/api/shadowing/videos', adminRoute = '/api/admin/shadowing/videos', aiRoute = '/api/shadowing/ai';
const sourceId = 'shadowing-test-source';
const metadata = { youtubeId: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk', title: '日本語練習', channel: 'Shadowing fixture', durationMs: 10_000 };
const sentenceId = randomUUID(), secondId = randomUUID();
const draft = () => ({ url: metadata.url, level: 'N5', description: 'Test only', transcriptReviewed: true,
  sentences: [{ id: sentenceId, startMs: 0, endMs: 3000, text: '私は学生です。', translationVi: 'Tôi là học sinh.' },
    { id: secondId, startMs: 3500, endMs: 7000, text: '日本語を勉強します。', translationVi: '' }] });
const get = (path: string, user?: User) => user ? request(api.app).get(path).set('Cookie', user.sid) : request(api.app).get(path);
const mutate = (user: User, path: string, body: Record<string, unknown>, method: 'post' | 'patch' = 'post') => request(api.app)[method](path).set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({ expectedUserId: user.id, ...body });
async function register(admin = false) {
  const result = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN).send({ name: 'Shadowing QA', email: `shadowing-${randomUUID()}@example.com`, password: 'shadowing test-only password123' }).expect(201);
  const user = { id: result.body.user.id as string, sid: (result.headers['set-cookie'] as unknown as string[])[0].split(';')[0] };
  if (admin) await api.db.user.update({ where: { id: user.id }, data: { role: 'admin' } });
  return user;
}
async function create(user: User, library = false, extra: Record<string, unknown> = {}) {
  return (await mutate(user, library ? adminRoute : route, { id: randomUUID(), ...draft(), ...(library ? { sourceId } : {}), ...extra }).expect(201)).body.video;
}
async function publish(user: User, video: { id: string; version: number }) {
  return (await mutate(user, `${adminRoute}/${video.id}/publish`, { version: video.version, transcriptReviewed: true }).expect(200)).body.video;
}
async function waitForAi(user: User, id: string) {
  for (let index = 0; index < 30; index++) {
    const response = await get(`${aiRoute}/${id}`, user).expect(200);
    if (response.body.request.status !== 'pending') return response.body.request;
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  throw Error('AI fixture did not complete');
}
beforeEach(async () => {
  inspect = vi.spyOn(media, 'inspectYouTube').mockResolvedValue(metadata);
  generate = vi.spyOn(media, 'generateShadowingTranscript').mockResolvedValue(draft().sentences.map(({ id: _id, ...cue }) => cue));
  api = createApp(config);
  await api.db.session.deleteMany();
  await api.db.shadowingVideo.deleteMany();
  await api.db.user.deleteMany();
  await api.db.contentSource.createMany({ data: [{ id: sourceId, name: 'Shadowing test source', url: 'urn:nihongo:shadowing-test', license: 'Test fixture', licenseUrl: 'urn:nihongo:test', version: 'v1', checksum: '', attribution: 'Test suite', notes: 'Not learning material' }], skipDuplicates: true });
});
afterEach(async () => { await api.close(); vi.restoreAllMocks(); });

describe('Shadowing videos and editorial boundaries', () => {
  it.each(['create', 'ai'] as const)('rejects %s after logout while video metadata is being fetched', async action => {
    const user = await register();
    inspect.mockImplementationOnce(async () => {
      await request(api.app).post('/api/auth/logout').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({}).expect(204);
      return metadata;
    });
    await mutate(user, action === 'create' ? route : aiRoute, action === 'create'
      ? { id: randomUUID(), ...draft() } : { id: randomUUID(), url: metadata.url, level: null, description: '' }).expect(401);
    expect(await api.db.shadowingVideo.count()).toBe(0);
    expect(await api.db.shadowingAiRequest.count()).toBe(0);
    expect(generate).not.toHaveBeenCalled();
  });

  it('rechecks admin role after metadata awaits before publishing any draft', async () => {
    const admin = await register(true), video = await create(admin, true);
    inspect.mockImplementationOnce(async () => {
      await api.db.user.update({ where: { id: admin.id }, data: { role: 'user' } });
      return metadata;
    });
    await mutate(admin, `${adminRoute}/${video.id}/publish`, { version: video.version, transcriptReviewed: true }).expect(403);
    const unchanged = await api.db.shadowingVideo.findUniqueOrThrow({ where: { id: video.id } });
    expect(unchanged).toMatchObject({ version: 0, publishedVersion: null, publishedContent: null });
    await get(`${route}/${video.id}`).expect(404);
  });

  it('keeps guest, owner and admin access separate and never trusts forged metadata', async () => {
    expect((await get(route)).body).toEqual({ userId: null, items: [] });
    await request(api.app).post(route).set('Origin', config.APP_ORIGIN).send({}).expect(401);
    const owner = await register(), other = await register();
    await mutate(owner, route, { id: randomUUID(), ...draft(), title: 'Forged' }).expect(400);
    const video = await create(owner);
    expect(video).toMatchObject({ title: metadata.title, scope: 'personal', status: 'published', version: 0 });
    expect(video.content.sentences[0].tokens.map((token: { text: string }) => token.text).join('')).toBe('私は学生です。');
    expect(video.content.sentences[0].tokens.some((token: { reading: string | null }) => token.reading)).toBe(true);
    await get(`${route}/${video.id}`).expect(404);
    await get(`${route}/${video.id}`, other).expect(404);
    await get(adminRoute, owner).expect(403);
    await mutate(owner, `${route}/${video.id}`, { ...draft(), version: 0, expectedUserId: other.id }, 'patch').expect(409);
    await request(api.app).post(`${route}/${video.id}/archive`).set('Cookie', owner.sid).send({ version: 0, expectedUserId: owner.id }).expect(403);
  });

  it('prepares metadata without writes and requires reviewed, bounded, nonoverlapping cues for personal saves', async () => {
    const user = await register();
    const prepared = await mutate(user, `${route}/prepare`, { url: metadata.url, level: null, description: '', sentences: [] }).expect(200);
    expect(prepared.body.content).toMatchObject({ title: metadata.title, durationMs: 10000, sentences: [] });
    expect(await api.db.shadowingVideo.count()).toBe(0);
    await mutate(user, route, { id: randomUUID(), ...draft(), transcriptReviewed: false }).expect(400);
    await mutate(user, route, { id: randomUUID(), ...draft(), sentences: [] }).expect(400);
    for (const sentences of [
      [{ ...draft().sentences[0], endMs: 10001 }], [{ ...draft().sentences[0], text: '日'.repeat(301) }],
      [draft().sentences[0], { ...draft().sentences[1], startMs: 2000 }], [draft().sentences[0], { ...draft().sentences[1], id: sentenceId }],
    ]) await mutate(user, route, { id: randomUUID(), ...draft(), sentences }).expect(400);
    expect(await api.db.shadowingVideo.count()).toBe(0);
  });

  it('supports exact create retries and version guards, archives without removing history', async () => {
    const user = await register(), payload = { id: randomUUID(), ...draft() };
    const video = (await mutate(user, route, payload).expect(201)).body.video;
    expect((await mutate(user, route, payload).expect(200)).body.video).toEqual(video);
    await mutate(user, route, { ...payload, description: 'different' }).expect(409);
    const concurrent = await Promise.all(['A', 'B'].map(description => mutate(user, `${route}/${video.id}`, { ...draft(), version: 0, description }, 'patch')));
    expect(concurrent.map(result => result.status).sort()).toEqual([200, 409]);
    await mutate(user, `${route}/${video.id}/archive`, { version: 0 }).expect(409);
    await mutate(user, `${route}/${video.id}/archive`, { version: 1 }).expect(200);
    await get(`${route}/${video.id}`, user).expect(404);
    expect(await api.db.shadowingVideo.count()).toBe(1);
  });

  it('publishes snapshots, hides drafts, validates source and restores only to draft', async () => {
    const admin = await register(true), learner = await register();
    await mutate(admin, adminRoute, { id: randomUUID(), ...draft(), sourceId: 'missing-source' }).expect(400);
    const draftVideo = await create(admin, true);
    await get(`${route}/${draftVideo.id}`, admin).expect(404);
    await mutate(admin, `${adminRoute}/${draftVideo.id}/publish`, { version: 0, transcriptReviewed: false }).expect(400);
    const published = await publish(admin, draftVideo);
    const before = (await get(`${route}/${published.id}`).expect(200)).body.video;
    await mutate(admin, `${adminRoute}/${published.id}`, { ...draft(), description: 'private draft', sourceId, version: published.version }, 'patch').expect(200);
    expect((await get(`${route}/${published.id}`).expect(200)).body.video).toEqual(before);
    await mutate(learner, `${adminRoute}/${published.id}/archive`, { version: 2 }).expect(403);
    await mutate(admin, `${adminRoute}/${published.id}/archive`, { version: 2 }).expect(200);
    await get(`${route}/${published.id}`).expect(404);
    const restored = (await mutate(admin, `${adminRoute}/${published.id}/restore`, { version: 3 }).expect(200)).body.video;
    expect(restored).toMatchObject({ status: 'draft', publishedVersion: null });
    await get(`${route}/${published.id}`).expect(404);
    expect(await api.db.contentSource.findUnique({ where: { id: sourceId } })).toMatchObject({ license: 'Test fixture' });
  });
});

describe('Shadowing account study and first grades', () => {
  it('persists cursor/bookmarks/replay counts with conflict and idempotent retry protection', async () => {
    const user = await register(), video = await create(user), url = `${route}/${video.id}/study`;
    const first = (await mutate(user, url, { version: 0, videoVersion: 0, currentSentenceId: sentenceId, positionMs: 1200, bookmark: { sentenceId, active: true } }).expect(200)).body;
    expect(first.study).toMatchObject({ version: 1, currentSentenceId: sentenceId, positionMs: 1200, bookmarks: [sentenceId] });
    await mutate(user, url, { version: 0, videoVersion: 0, positionMs: 2000 }).expect(409);
    const replay = { version: 1, videoVersion: 0, replay: { sentenceId, requestId: randomUUID() } };
    await mutate(user, url, replay).expect(200);
    const again = (await mutate(user, url, replay).expect(200)).body.study;
    expect(again).toMatchObject({ version: 2, replayCounts: { [sentenceId]: 1 } });
    await mutate(user, url, { ...replay, replay: { ...replay.replay, sentenceId: secondId } }).expect(409);
    await mutate(user, url, { version: 2, videoVersion: 0, positionMs: 10001 }).expect(400);
    await mutate(user, url, { version: 2, videoVersion: 0, bookmark: { sentenceId, active: false } }).expect(200);
    expect((await get(`${route}/${video.id}`, user)).body.study.bookmarks).toEqual([]);
    expect(await api.db.reviewCard.count()).toBe(0);
    expect(await api.db.xpEvent.count()).toBe(0);
  });

  it('preserves the first score through retries, correction and separate account sessions', async () => {
    const user = await register(), video = await create(user), path = `${route}/${video.id}/check`;
    const firstInput = { requestId: randomUUID(), videoVersion: 0, sentenceId, mode: 'typing', answer: '学校', hintsUsed: false };
    const wrong = (await mutate(user, path, firstInput).expect(200)).body;
    expect(wrong).toMatchObject({ firstGrade: true, grade: { correct: false }, study: { version: 1 } });
    expect((await mutate(user, path, firstInput).expect(200)).body.grade).toEqual(wrong.grade);
    await mutate(user, path, { ...firstInput, answer: '私は学生です。' }).expect(409);
    const practice = (await mutate(user, path, { ...firstInput, requestId: randomUUID(), answer: ' 私 は 学生 です！ ', hintsUsed: true }).expect(200)).body;
    expect(practice).toMatchObject({ firstGrade: false, grade: { correct: true, hintsUsed: true } });
    const refreshed = (await get(`${route}/${video.id}`, user).expect(200)).body.study;
    expect(refreshed.grades).toHaveLength(1);
    expect(refreshed.grades[0]).toEqual(wrong.grade);
    expect(await api.db.xpEvent.count()).toBe(0);
  });

  it('serializes two grading tabs and preserves original sentence snapshots after editorial changes', async () => {
    const admin = await register(true), user = await register(), video = await publish(admin, await create(admin, true));
    const checks = await Promise.all(['学校', '私は学生です。'].map(answer => mutate(user, `${route}/${video.id}/check`, { requestId: randomUUID(), videoVersion: video.version, sentenceId, mode: 'typing', answer, hintsUsed: false })));
    expect(checks.map(item => item.status)).toEqual([200, 200]);
    expect(checks.filter(item => item.body.firstGrade)).toHaveLength(1);
    const changedDraft = { ...draft(), sourceId, version: video.version, sentences: [{ ...draft().sentences[0], text: '私は先生です。' }] };
    const edited = (await mutate(admin, `${adminRoute}/${video.id}`, changedDraft, 'patch').expect(200)).body.video;
    const republished = await publish(admin, edited);
    await mutate(user, `${route}/${video.id}/check`, { requestId: randomUUID(), videoVersion: video.version, sentenceId, mode: 'typing', answer: '私は学生です。', hintsUsed: false }).expect(409);
    const newest = (await mutate(user, `${route}/${video.id}/check`, { requestId: randomUUID(), videoVersion: republished.version, sentenceId, mode: 'typing', answer: '私は先生です。', hintsUsed: false }).expect(200)).body;
    expect(newest.firstGrade).toBe(true);
    expect(newest.study.grades.map((grade: { sentence: { text: string } }) => grade.sentence.text)).toEqual(['私は学生です。', '私は先生です。']);
  });

  it('grades guests without writes and rejects forged puzzle occurrence indices', async () => {
    const admin = await register(true), video = await publish(admin, await create(admin, true, { sentences: [{ ...draft().sentences[0], text: '私も私も。' }] }));
    const tokens = video.content.sentences[0].tokens;
    const answer = tokens.map((_: unknown, index: number) => index);
    const payload = { requestId: randomUUID(), expectedUserId: null, videoVersion: video.version, sentenceId, mode: 'puzzle', answer, hintsUsed: false };
    const response = await request(api.app).post(`${route}/${video.id}/check`).set('Origin', config.APP_ORIGIN).send(payload).expect(200);
    expect(response.body).toMatchObject({ userId: null, study: null, firstGrade: false, grade: { correct: true } });
    await request(api.app).post(`${route}/${video.id}/check`).set('Origin', config.APP_ORIGIN).send({ ...payload, answer: answer.map(() => 0) }).expect(400);
    await request(api.app).post(`${route}/${video.id}/check`).set('Origin', config.APP_ORIGIN).send({ ...payload, expectedUserId: admin.id }).expect(401);
    expect(await api.db.shadowingGrade.count()).toBe(0);
    expect(await api.db.shadowingStudy.count()).toBe(0);
  });
});

describe('Shadowing AI durable preview requests', () => {
  it('claims once, returns a private preview, requires explicit save, and isolates request ownership', async () => {
    const user = await register(), other = await register(), id = randomUUID();
    const payload = { id, url: metadata.url, level: 'N5', description: 'preview' };
    await mutate(user, aiRoute, payload).expect(202);
    const ready = await waitForAi(user, id);
    expect(ready).toMatchObject({ id, status: 'ready', content: { title: metadata.title } });
    expect(ready.content.sentences).toHaveLength(2);
    const retry = await mutate(user, aiRoute, payload).expect(200);
    expect(retry.body.request).toEqual(ready);
    expect(generate).toHaveBeenCalledTimes(1);
    await get(`${aiRoute}/${id}`, other).expect(404);
    await mutate(other, aiRoute, payload).expect(409);
    expect(await api.db.shadowingVideo.count()).toBe(0);
    expect(await api.db.shadowingAiRequest.count()).toBe(1);
  });

  it('records friendly failures without videos or grades and expires abandoned requests', async () => {
    const user = await register(), id = randomUUID();
    generate.mockRejectedValueOnce(new HttpError(502, 'TEST_AI_FAILURE', 'Phụ đề chưa đầy đủ.'));
    await mutate(user, aiRoute, { id, url: metadata.url, level: null, description: '' }).expect(202);
    expect(await waitForAi(user, id)).toMatchObject({ status: 'failed', content: null, error: 'Phụ đề chưa đầy đủ.' });
    const abandoned = await api.db.shadowingAiRequest.create({ data: { id: randomUUID(), userId: user.id, requestHash: 'a'.repeat(64), leaseUntil: new Date(Date.now() - 1000) } });
    expect((await get(`${aiRoute}/${abandoned.id}`, user).expect(200)).body.request.status).toBe('failed');
    expect(await api.db.shadowingVideo.count()).toBe(0);
    expect(await api.db.shadowingGrade.count()).toBe(0);
  });

  it('enforces three video claims per account including failed requests without provider fallback', async () => {
    const user = await register();
    await api.db.shadowingAiRequest.createMany({ data: Array.from({ length: 3 }, () => ({ id: randomUUID(), userId: user.id, requestHash: 'a'.repeat(64), status: 'failed', leaseUntil: new Date() })) });
    const response = await mutate(user, aiRoute, { id: randomUUID(), url: metadata.url, level: null, description: '' }).expect(429);
    expect(response.body.error.code).toBe('SHADOWING_AI_QUOTA');
    expect(generate).not.toHaveBeenCalled();
    inspect.mockRejectedValueOnce(new HttpError(503, 'YOUTUBE_NOT_CONFIGURED', 'Chưa cấu hình.'));
    await mutate(user, `${route}/prepare`, { url: metadata.url, level: null, description: '', sentences: [] }).expect(503);
    expect(await api.db.shadowingVideo.count()).toBe(0);
  });
});
