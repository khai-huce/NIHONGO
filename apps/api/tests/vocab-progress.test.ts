import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1))) {
  throw new Error('Refusing to clean a non-test database.');
}
const config: Config = {
  NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
};
const credentials = { email: 'vocab-progress@example.com', name: 'Học viên', password: 'a long test passphrase 123' };
let api: ReturnType<typeof createApp>;
type Learner = { id: string; sid: string };
const word = () => ({ id: randomUUID(), word: '学校', reading: 'がっこう', hanViet: 'HỌC HIỆU', meaning: 'Trường học' });
type Word = ReturnType<typeof word>;
type Snapshot = { userId: string; lessonId: string; lessonVersion: number; progressVersion: number;
  words: Word[]; progress: { wordId: string; memorized: boolean }[] };
const cookie = (response: request.Response) => (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
const get = (user: Learner, lessonId: string) => request(api.app).get('/api/vocab/progress').query({ lessonId }).set('Cookie', user.sid);
const lessonWrite = (user: Learner, path: string, body: Record<string, unknown>) => request(api.app)
  .post(`/api/vocab/lessons${path}`).set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({ expectedUserId: user.id, ...body });
const progressWrite = (user: Learner, path: string, body: Record<string, unknown>) => request(api.app)
  .post(`/api/vocab/progress${path}`).set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({ expectedUserId: user.id, ...body });
const versions = (snapshot: Snapshot) => ({ lessonId: snapshot.lessonId, lessonVersion: snapshot.lessonVersion, progressVersion: snapshot.progressVersion });
const rate = (user: Learner, snapshot: Snapshot, wordId: string, memorized: boolean) => progressWrite(user, '/rate', { ...versions(snapshot), wordId, memorized });
const reset = (user: Learner, snapshot: Snapshot, confirmedCount = snapshot.progress.length) =>
  progressWrite(user, '/reset', { ...versions(snapshot), confirmedCount });
const state = async (user: Learner, lessonId: string) => (await get(user, lessonId).expect(200)).body as Snapshot;
async function register(email = credentials.email): Promise<Learner> {
  const result = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN).send({ ...credentials, email }).expect(201);
  return { id: result.body.user.id, sid: cookie(result) };
}
async function create(user: Learner, words = [word(), word()]): Promise<Snapshot> {
  const id = randomUUID();
  await lessonWrite(user, '', { id, name: 'Bài tự nhập' }).expect(201);
  if (words.length) await lessonWrite(user, '/update', { id, version: 0, words }).expect(200);
  return state(user, id);
}
async function starredHistory(user: Learner, item: Word) {
  const result = await request(api.app).post('/api/review/star').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
    .send({ expectedUserId: user.id, category: 'vocab', sourceId: `custom:${item.id}`,
      front: item.word, back: item.meaning, reading: item.reading, active: true }).expect(200);
  const card = result.body.card;
  await request(api.app).post('/api/review/rate').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
    .send({ expectedUserId: user.id, id: card.id, version: card.version, rating: 'good', elapsedMs: 2500 }).expect(200);
  return { cards: await api.db.reviewCard.findMany(), events: await api.db.reviewEvent.findMany() };
}

beforeEach(async () => {
  api = createApp(config);
  await api.db.session.deleteMany();
  await api.db.user.deleteMany();
});
afterEach(async () => { vi.restoreAllMocks(); await api.close(); });

describe('P04 account-owned Flashcard Chủ động progress', () => {
  it('requires a live session, same origin and bounded JSON requests', async () => {
    await request(api.app).get('/api/vocab/progress').query({ lessonId: randomUUID() }).expect(401);
    await request(api.app).post('/api/vocab/progress/rate').set('Origin', config.APP_ORIGIN).send({}).expect(401);
    const user = await register();
    for (const path of ['/rate', '/reset']) {
      await request(api.app).post(`/api/vocab/progress${path}`).set('Cookie', user.sid).send({}).expect(403);
      await request(api.app).post(`/api/vocab/progress${path}`).set('Cookie', user.sid).set('Origin', 'https://other.example').send({}).expect(403);
      await request(api.app).post(`/api/vocab/progress${path}`).set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).type('form').send({}).expect(415);
      await progressWrite(user, path, { padding: 'x'.repeat(17000) }).expect(413);
    }
    await request(api.app).post('/api/auth/logout').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({}).expect(204);
    await get(user, randomUUID()).expect(401);
    expect(await api.db.vocabProgress.count()).toBe(0);
  });

  it('validates IDs, absolute boolean states, both versions, counts and unknown fields', async () => {
    const user = await register(), lesson = await create(user);
    const valid = { ...versions(lesson), wordId: lesson.words[0].id, memorized: true };
    for (const invalid of [
      { wordId: 'w-0' }, { lessonId: 'bad' }, { memorized: 1 }, { memorized: 'true' }, { memorized: null },
      { lessonVersion: -1 }, { progressVersion: 0.5 }, { progressVersion: null },
      { userId: user.id }, { count: 10 }, { status: 'known' },
    ]) await progressWrite(user, '/rate', { ...valid, ...invalid }).expect(400);
    for (const confirmedCount of [-1, 0.5, 501, '0', null]) {
      await progressWrite(user, '/reset', { ...versions(lesson), confirmedCount }).expect(400);
    }
    await progressWrite(user, '/reset', versions(lesson)).expect(400);
    await request(api.app).get('/api/vocab/progress').set('Cookie', user.sid).expect(400);
    await request(api.app).get('/api/vocab/progress').set('Cookie', user.sid).query({ lessonId: lesson.lessonId, userId: user.id }).expect(400);
    expect(await state(user, lesson.lessonId)).toEqual(lesson);
  });

  it('isolates owners and rejects stale-account, foreign lesson and missing word writes', async () => {
    const a = await register(), b = await register('other-progress@example.com'), lesson = await create(a);
    await get(b, lesson.lessonId).expect(404);
    await rate(b, lesson, lesson.words[0].id, true).expect(404);
    await reset(b, lesson).expect(404);
    const stale = await progressWrite(b, '/rate', { ...versions(lesson), wordId: lesson.words[0].id, memorized: true, expectedUserId: a.id }).expect(409);
    expect(stale.body.error.code).toBe('ACCOUNT_CHANGED');
    await progressWrite(b, '/reset', { ...versions(lesson), confirmedCount: 0, expectedUserId: a.id }).expect(409);
    await rate(a, lesson, randomUUID(), true).expect(404);
    await get(a, randomUUID()).expect(404);
    expect(await api.db.vocabProgress.count()).toBe(0);
  });

  it('loads unassessed words without recording visits and persists across restart and another login', async () => {
    const user = await register(), initial = await create(user);
    const first = await get(user, initial.lessonId).expect(200);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(first.body).toEqual(initial);
    expect(initial.progress).toEqual([]);
    expect(initial.progressVersion).toBe(0);
    expect(await api.db.vocabProgress.count()).toBe(0);
    const saved = (await rate(user, initial, initial.words[0].id, false).expect(200)).body as Snapshot;
    await api.close();
    api = createApp(config);
    const login = await request(api.app).post('/api/auth/login').set('Origin', config.APP_ORIGIN)
      .send({ email: credentials.email, password: credentials.password }).expect(200);
    expect(await state({ ...user, sid: cookie(login) }, initial.lessonId)).toEqual(saved);
    expect(saved.progress).toEqual([{ wordId: initial.words[0].id, memorized: false }]);
    expect(saved.lessonVersion).toBe(initial.lessonVersion);
  });

  it('updates the same word absolutely without duplicate counts or automatic stars', async () => {
    const user = await register(), lesson = await create(user), wordId = lesson.words[0].id;
    let saved = (await rate(user, lesson, wordId, true).expect(200)).body as Snapshot;
    saved = (await rate(user, saved, wordId, true).expect(200)).body;
    expect(saved.progress).toEqual([{ wordId, memorized: true }]);
    saved = (await rate(user, saved, wordId, false).expect(200)).body;
    expect(saved.progress).toEqual([{ wordId, memorized: false }]);
    expect(saved.progressVersion).toBe(3);
    expect(saved.lessonVersion).toBe(lesson.lessonVersion);
    expect(await api.db.vocabProgress.count()).toBe(1);
    expect(await api.db.reviewCard.count()).toBe(0);
    expect(await api.db.reviewEvent.count()).toBe(0);
    expect(await api.db.kanjiProgress.count()).toBe(0);
  });

  it('keeps identical vocabulary in separate lessons and accounts independent by ID', async () => {
    const a = await register(), b = await register('independent-progress@example.com');
    const original = word(), first = await create(a, [original]);
    const second = await create(a, [{ ...original, id: randomUUID() }]);
    const other = await create(b, [original]);
    await rate(a, first, original.id, true).expect(200);
    await rate(a, second, second.words[0].id, false).expect(200);
    expect((await state(b, other.lessonId)).progress).toEqual([]);
    await rate(b, other, original.id, false).expect(200);
    expect((await state(a, first.lessonId)).progress).toEqual([{ wordId: original.id, memorized: true }]);
    expect((await state(a, second.lessonId)).progress).toEqual([{ wordId: second.words[0].id, memorized: false }]);
    expect(await api.db.vocabProgress.count()).toBe(3);
  });

  it('retains assessed states on source edits and renames while invalidating old content screens', async () => {
    const user = await register(), initial = await create(user);
    const saved = (await rate(user, initial, initial.words[0].id, true).expect(200)).body as Snapshot;
    const edited = initial.words.map(item => ({ ...item, word: '大学', reading: 'だいがく', hanViet: 'ĐẠI HỌC', meaning: 'Đại học' }));
    await lessonWrite(user, '/update', { id: initial.lessonId, version: saved.lessonVersion, words: edited }).expect(200);
    let fresh = await state(user, initial.lessonId);
    expect(fresh.progress).toEqual(saved.progress);
    expect(fresh.progressVersion).toBe(saved.progressVersion);
    expect(fresh.words).toEqual(edited);
    const rejected = await rate(user, saved, initial.words[1].id, false).expect(409);
    expect(rejected.body.error.code).toBe('PROGRESS_CHANGED');
    await reset(user, saved).expect(409);
    await lessonWrite(user, '/update', { id: initial.lessonId, version: fresh.lessonVersion, name: 'Tên mới' }).expect(200);
    await rate(user, fresh, initial.words[1].id, true).expect(409);
    fresh = await state(user, initial.lessonId);
    expect(fresh.progress).toEqual(saved.progress);
    await rate(user, fresh, initial.words[1].id, false).expect(200);
  });

  it('appends imported words without rating them or invalidating existing statuses', async () => {
    const user = await register(), initial = await create(user);
    const saved = (await rate(user, initial, initial.words[0].id, true).expect(200)).body as Snapshot;
    const addition = { ...word(), word: '先生', meaning: 'Giáo viên' };
    await lessonWrite(user, '/import', { id: initial.lessonId, version: saved.lessonVersion, words: [addition] }).expect(200);
    const fresh = await state(user, initial.lessonId);
    expect(fresh.words).toEqual([...initial.words, addition]);
    expect(fresh.progress).toEqual(saved.progress);
    expect(fresh.progressVersion).toBe(saved.progressVersion);
    await rate(user, saved, initial.words[1].id, true).expect(409);
    await rate(user, fresh, addition.id, false).expect(200);
    expect(await api.db.reviewCard.count()).toBe(0);
  });

  it('prunes only removed word states, and demo replacement or clear starts fresh', async () => {
    const user = await register(), initial = await create(user), other = await create(user);
    let saved = (await rate(user, initial, initial.words[0].id, true).expect(200)).body as Snapshot;
    saved = (await rate(user, saved, initial.words[1].id, false).expect(200)).body;
    const otherSaved = (await rate(user, other, other.words[0].id, true).expect(200)).body as Snapshot;
    const history = await starredHistory(user, initial.words[0]);
    await lessonWrite(user, '/update', { id: initial.lessonId, version: saved.lessonVersion, words: [initial.words[1]] }).expect(200);
    let fresh = await state(user, initial.lessonId);
    expect(fresh.progress).toEqual([{ wordId: initial.words[1].id, memorized: false }]);
    expect(fresh.progressVersion).toBe(saved.progressVersion + 1);
    expect(await state(user, other.lessonId)).toEqual(otherSaved);
    await lessonWrite(user, '/update', { id: initial.lessonId, version: fresh.lessonVersion, words: [word()] }).expect(200);
    fresh = await state(user, initial.lessonId);
    expect(fresh.progress).toEqual([]);
    fresh = (await rate(user, fresh, fresh.words[0].id, true).expect(200)).body;
    await lessonWrite(user, '/update', { id: initial.lessonId, version: fresh.lessonVersion, words: [] }).expect(200);
    fresh = await state(user, initial.lessonId);
    expect(fresh.words).toEqual([]);
    expect(fresh.progress).toEqual([]);
    expect(await api.db.reviewCard.findMany()).toEqual(history.cards);
    expect(await api.db.reviewEvent.findMany()).toEqual(history.events);
  });

  it('cascades deleted lesson progress while preserving other lessons and starred history', async () => {
    const user = await register(), initial = await create(user), other = await create(user);
    const saved = (await rate(user, initial, initial.words[0].id, false).expect(200)).body as Snapshot;
    const otherSaved = (await rate(user, other, other.words[0].id, true).expect(200)).body as Snapshot;
    const history = await starredHistory(user, initial.words[0]);
    await lessonWrite(user, '/delete', { id: initial.lessonId, version: saved.lessonVersion }).expect(200);
    await get(user, initial.lessonId).expect(404);
    await rate(user, saved, initial.words[1].id, true).expect(404);
    await reset(user, saved).expect(404);
    expect(await state(user, other.lessonId)).toEqual(otherSaved);
    expect(await api.db.vocabProgress.count()).toBe(1);
    expect(await api.db.reviewCard.findMany()).toEqual(history.cards);
    expect(await api.db.reviewEvent.findMany()).toEqual(history.events);
  });

  it('requires the confirmed count and resets only this lesson without changing SRS', async () => {
    const user = await register(), otherUser = await register('reset-other@example.com');
    const initial = await create(user), other = await create(user), foreign = await create(otherUser);
    const saved = (await rate(user, initial, initial.words[0].id, true).expect(200)).body as Snapshot;
    const otherSaved = (await rate(user, other, other.words[0].id, false).expect(200)).body as Snapshot;
    const foreignSaved = (await rate(otherUser, foreign, foreign.words[0].id, true).expect(200)).body as Snapshot;
    const history = await starredHistory(user, initial.words[0]);
    await reset(user, saved, 0).expect(409);
    expect(await state(user, initial.lessonId)).toEqual(saved);
    const cleared = (await reset(user, saved).expect(200)).body as Snapshot;
    expect(cleared).toEqual({ ...saved, progress: [], progressVersion: saved.progressVersion + 1 });
    expect(await state(user, other.lessonId)).toEqual(otherSaved);
    expect(await state(otherUser, foreign.lessonId)).toEqual(foreignSaved);
    expect(await api.db.reviewCard.findMany()).toEqual(history.cards);
    expect(await api.db.reviewEvent.findMany()).toEqual(history.events);
    await rate(user, saved, initial.words[1].id, false).expect(409);
    await reset(user, saved).expect(409);
    await rate(user, cleared, initial.words[0].id, false).expect(200);
  });

  it('invalidates even empty reset screens and rejects duplicate ratings or late retries', async () => {
    const user = await register(), initial = await create(user);
    const resetEmpty = (await reset(user, initial).expect(200)).body as Snapshot;
    expect(resetEmpty.progressVersion).toBe(1);
    await rate(user, initial, initial.words[0].id, true).expect(409);
    const saved = (await rate(user, resetEmpty, initial.words[0].id, true).expect(200)).body as Snapshot;
    await rate(user, resetEmpty, initial.words[0].id, true).expect(409);
    expect(await state(user, initial.lessonId)).toEqual(saved);
    const cleared = (await reset(user, saved).expect(200)).body as Snapshot;
    await rate(user, resetEmpty, initial.words[0].id, true).expect(409);
    expect(await state(user, initial.lessonId)).toEqual(cleared);
  });

  it('accepts exactly one concurrent rating per lesson version and recovers using GET', async () => {
    const user = await register(), initial = await create(user);
    const responses = await Promise.all([
      rate(user, initial, initial.words[0].id, true), rate(user, initial, initial.words[1].id, false),
    ]);
    expect(responses.map(result => result.status).sort()).toEqual([200, 409]);
    const saved = await state(user, initial.lessonId);
    expect(saved.progress).toHaveLength(1);
    expect(saved.progressVersion).toBe(1);
    const remaining = saved.words.find(item => !saved.progress.some(progress => progress.wordId === item.id))!;
    const completed = (await rate(user, saved, remaining.id, false).expect(200)).body as Snapshot;
    expect(completed.progress).toHaveLength(2);
    expect(completed.progressVersion).toBe(2);
  });

  it('serializes concurrent rating and reset so the stale request cannot restore cleared state', async () => {
    const user = await register(), initial = await create(user);
    const saved = (await rate(user, initial, initial.words[0].id, true).expect(200)).body as Snapshot;
    const responses = await Promise.all([rate(user, saved, initial.words[1].id, false), reset(user, saved)]);
    expect(responses.map(result => result.status).sort()).toEqual([200, 409]);
    const winner = responses.find(result => result.status === 200)!.body as Snapshot;
    expect(await state(user, initial.lessonId)).toEqual(winner);
    expect(winner.progressVersion).toBe(saved.progressVersion + 1);
    expect(winner.progress.length).toBe(responses[0].status === 200 ? 2 : 0);
  });

  it('serializes deletion against a pending rating without resurrecting removed word progress', async () => {
    const user = await register(), initial = await create(user);
    const responses = await Promise.all([
      rate(user, initial, initial.words[0].id, true),
      lessonWrite(user, '/update', { id: initial.lessonId, version: initial.lessonVersion, words: [initial.words[1]] }),
    ]);
    expect(responses[1].status).toBe(200);
    expect([200, 409]).toContain(responses[0].status);
    const fresh = await state(user, initial.lessonId);
    expect(fresh.words).toEqual([initial.words[1]]);
    expect(fresh.progress).toEqual([]);
    expect(await api.db.vocabProgress.count()).toBe(0);
  });

  it.each(['/rate', '/reset'])('rolls back %s after writes fail and safely permits retry', async path => {
    const user = await register(), initial = await create(user);
    const saved = (await rate(user, initial, initial.words[0].id, true).expect(200)).body as Snapshot;
    const body = path === '/rate'
      ? { ...versions(saved), wordId: initial.words[1].id, memorized: false }
      : { ...versions(saved), confirmedCount: saved.progress.length };
    const realTransaction = api.db.$transaction.bind(api.db);
    type Callback = (tx: Prisma.TransactionClient) => Promise<unknown>;
    vi.spyOn(api.db, '$transaction').mockImplementationOnce(((callback: Callback) => realTransaction(async tx => {
      await callback(tx);
      throw new Error('private simulated failure after transaction writes');
    })) as unknown as typeof api.db.$transaction);
    const failure = await progressWrite(user, path, body).expect(503);
    expect(JSON.stringify(failure.body)).not.toContain('private simulated');
    vi.restoreAllMocks();
    await api.close();
    api = createApp(config);
    expect(await state(user, initial.lessonId)).toEqual(saved);
    const retried = (await progressWrite(user, path, body).expect(200)).body as Snapshot;
    expect(retried.progressVersion).toBe(saved.progressVersion + 1);
    expect(retried.progress.length).toBe(path === '/rate' ? 2 : 0);
  });
});
