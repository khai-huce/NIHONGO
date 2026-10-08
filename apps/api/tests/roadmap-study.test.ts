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
let api: ReturnType<typeof createApp>;
type Learner = { id: string; sid: string };
type Roadmap = { id: string; name: string; perDay: number; version: number; startedAt: string | null;
  assessments: Record<string, boolean>; completedDays: number[]; progressVersion: number; currentDay: number };
const cookie = (response: request.Response) => (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
const get = (user: Learner) => request(api.app).get('/api/roadmaps').set('Cookie', user.sid);
const write = (user: Learner, path: string, body: Record<string, unknown>) => request(api.app).post(`/api/roadmaps${path}`)
  .set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({ expectedUserId: user.id, ...body });
const startBody = (roadmap: Roadmap, day = 1) => ({ id: roadmap.id, version: roadmap.version, day });
const rateBody = (roadmap: Roadmap, kanjiId = 'k-1', memorized = true, day = 1) => ({ id: roadmap.id,
  progressVersion: roadmap.progressVersion, day, kanjiId, memorized });
async function register(email = 'roadmap-study@example.com'): Promise<Learner> {
  const response = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN)
    .send({ email, name: 'Học viên', password: 'a long test passphrase 123' }).expect(201);
  return { id: response.body.user.id, sid: cookie(response) };
}
async function create(user: Learner, rawKanji = '一二三四五六'): Promise<Roadmap> {
  return (await write(user, '', { id: randomUUID(), name: 'Lộ trình học', rawKanji, perDay: 5 }).expect(201)).body.roadmap;
}
async function start(user: Learner, roadmap: Roadmap, day = 1): Promise<Roadmap> {
  return (await write(user, '/start', startBody(roadmap, day)).expect(200)).body.roadmap;
}
async function rate(user: Learner, roadmap: Roadmap, kanjiId: string, memorized = true, day = 1): Promise<Roadmap> {
  return (await write(user, '/rate', rateBody(roadmap, kanjiId, memorized, day)).expect(200)).body.roadmap;
}
beforeEach(async () => {
  api = createApp(config);
  await api.db.session.deleteMany();
  await api.db.user.deleteMany();
});
afterEach(async () => { vi.restoreAllMocks(); await api.close(); });

describe('P07 personal roadmap day study', () => {
  it('requires session, same origin and the owning account for start and rate', async () => {
    const a = await register(), b = await register('roadmap-study-other@example.com'), roadmap = await create(a);
    for (const [path, body] of [['/start', startBody(roadmap)], ['/rate', rateBody(roadmap)]] as const) {
      await request(api.app).post(`/api/roadmaps${path}`).set('Origin', config.APP_ORIGIN).send(body).expect(401);
      await request(api.app).post(`/api/roadmaps${path}`).set('Cookie', a.sid).send({ expectedUserId: a.id, ...body }).expect(403);
      await write(b, path, body).expect(404);
      expect((await write(b, path, { ...body, expectedUserId: a.id }).expect(409)).body.error.code).toBe('ACCOUNT_CHANGED');
    }
    expect((await get(a).expect(200)).body.roadmaps[0]).toEqual(roadmap);
    expect(await api.db.kanjiProgress.count()).toBe(0);
  });

  it('rejects invalid days, crossed day membership and forged completion data', async () => {
    const user = await register(), roadmap = await create(user);
    for (const invalid of [{ day: 0 }, { day: 1.5 }, { day: 3 }, { day: '1' }, { version: -1 }, { completedDays: [1] }, { assessments: { 'k-1': true } }]) {
      await write(user, '/start', { ...startBody(roadmap), ...invalid }).expect(400);
    }
    expect((await write(user, '/rate', rateBody(roadmap)).expect(409)).body.error.code).toBe('ROADMAP_NOT_STARTED');
    const begun = await start(user, roadmap);
    for (const invalid of [{ day: 0 }, { day: 3 }, { day: 2 }, { kanjiId: 'unknown' }, { kanjiId: 'k-6' },
      { memorized: 'true' }, { progressVersion: -1 }, { completedDays: [1] }, { version: 0 }]) {
      await write(user, '/rate', { ...rateBody(begun), ...invalid }).expect(400);
    }
    expect((await get(user).expect(200)).body.roadmaps[0]).toEqual(begun);
    expect(await api.db.kanjiProgress.count()).toBe(0);
  });

  it('never infers roadmap progress from global flags or merely reading/starting a day', async () => {
    const user = await register();
    await api.db.kanjiProgress.createMany({ data: ['k-1', 'k-2', 'k-3', 'k-4', 'k-5', 'k-6'].map(kanjiId => ({ userId: user.id, kanjiId, memorized: true })) });
    const roadmap = await create(user);
    expect((await get(user).expect(200)).body.roadmaps[0]).toMatchObject({ startedAt: null, assessments: {}, completedDays: [], currentDay: 1 });
    const begun = await start(user, roadmap, 2);
    expect(begun).toMatchObject({ version: 0, progressVersion: 1, assessments: {}, completedDays: [], currentDay: 1, startedAt: expect.any(String) });
    expect(await start(user, roadmap, 1)).toEqual(begun);
    expect(await api.db.kanjiProgress.count()).toBe(6);
    expect(await api.db.reviewCard.count()).toBe(0);
  });

  it('saves partial days, false assessments, the short final day and replay across an API restart', async () => {
    const user = await register();
    let roadmap = await start(user, await create(user));
    for (const kanjiId of ['k-1', 'k-2']) roadmap = await rate(user, roadmap, kanjiId, false);
    expect(roadmap).toMatchObject({ assessments: { 'k-1': false, 'k-2': false }, completedDays: [], currentDay: 1 });
    await api.close(); api = createApp(config);
    expect((await get(user).expect(200)).body.roadmaps[0]).toEqual(roadmap);
    for (const kanjiId of ['k-3', 'k-4', 'k-5']) roadmap = await rate(user, roadmap, kanjiId, false);
    expect(roadmap).toMatchObject({ completedDays: [1], currentDay: 2 });
    roadmap = await rate(user, roadmap, 'k-6', true, 2);
    expect(roadmap).toMatchObject({ completedDays: [1, 2], currentDay: 2 });
    roadmap = await rate(user, roadmap, 'k-6', false, 2);
    expect(roadmap.completedDays).toEqual([1, 2]);
    expect(roadmap.assessments['k-6']).toBe(false);
    expect((await api.db.xpEvent.aggregate({ where: { userId: user.id }, _sum: { points: true } }))._sum.points).toBe(20);
    expect(await api.db.kanjiProgress.findMany({ where: { userId: user.id, memorized: false } })).toHaveLength(6);
    expect(await api.db.reviewCard.count()).toBe(0);
  });

  it('keeps completion separate for two roadmaps with overlapping characters', async () => {
    const user = await register(), first = await create(user, '一'), second = await create(user, '一');
    const complete = await rate(user, await start(user, first), 'k-1', false);
    expect(complete.completedDays).toEqual([1]);
    expect((await get(user).expect(200)).body.roadmaps.find((roadmap: Roadmap) => roadmap.id === second.id)).toMatchObject({ assessments: {}, completedDays: [], startedAt: null });
  });

  it('serializes duplicate starts and rejects duplicate/two-tab ratings without reapplying them', async () => {
    const user = await register(), roadmap = await create(user);
    const starts = await Promise.all([write(user, '/start', startBody(roadmap)), write(user, '/start', startBody(roadmap))]);
    expect(starts.map(response => response.status)).toEqual([200, 200]);
    expect(starts[0].body.roadmap).toEqual(starts[1].body.roadmap);
    const begun: Roadmap = starts[0].body.roadmap;
    const ratings = await Promise.all([write(user, '/rate', rateBody(begun, 'k-1', true)), write(user, '/rate', rateBody(begun, 'k-2', false))]);
    expect(ratings.map(response => response.status).sort()).toEqual([200, 409]);
    expect(ratings.find(response => response.status === 409)!.body.error.code).toBe('ROADMAP_PROGRESS_CHANGED');
    const saved: Roadmap = ratings.find(response => response.status === 200)!.body.roadmap;
    const [savedId] = Object.keys(saved.assessments);
    await write(user, '/rate', rateBody(begun, savedId, saved.assessments[savedId])).expect(409);
    expect((await get(user).expect(200)).body.roadmaps[0]).toEqual(saved);
    expect(await api.db.kanjiProgress.count()).toBe(1);
  });

  it('allows metadata renames during study without resetting progress or accepting stale metadata', async () => {
    const user = await register(), initial = await create(user), begun = await start(user, initial);
    const renamed: Roadmap = (await write(user, '/update', { id: initial.id, version: initial.version, name: 'Tên mới', perDay: 5 }).expect(200)).body.roadmap;
    expect(renamed).toMatchObject({ version: 1, progressVersion: begun.progressVersion });
    const rated = await rate(user, begun, 'k-1');
    expect(rated).toMatchObject({ name: 'Tên mới', version: 1, progressVersion: 2, assessments: { 'k-1': true } });
    expect((await write(user, '/start', startBody(initial)).expect(409)).body.error.code).toBe('ROADMAP_CHANGED');
    expect((await write(user, '/update', { id: rated.id, version: rated.version, name: rated.name, perDay: 10 }).expect(409)).body.error.code).toBe('ROADMAP_STARTED');
  });

  it('orders simultaneous first-start and goal editing so the old day grouping cannot be studied', async () => {
    const user = await register(), roadmap = await create(user);
    const results = await Promise.all([
      write(user, '/start', startBody(roadmap)),
      write(user, '/update', { id: roadmap.id, version: roadmap.version, name: roadmap.name, perDay: 10 }),
    ]);
    expect(results.map(response => response.status).sort()).toEqual([200, 409]);
    const saved: Roadmap = (await get(user).expect(200)).body.roadmaps[0];
    if (results[0].status === 200) {
      expect(saved).toMatchObject({ perDay: 5, startedAt: expect.any(String) });
      expect(results[1].body.error.code).toBe('ROADMAP_STARTED');
    } else {
      expect(saved).toMatchObject({ perDay: 10, startedAt: null, progressVersion: 0 });
      expect(results[0].body.error.code).toBe('ROADMAP_CHANGED');
    }
    expect(saved.completedDays).toEqual([]);
  });

  it('removes a deleted roadmap without erasing global assessments, stars or SRS history', async () => {
    const user = await register();
    let roadmap = await start(user, await create(user));
    const card = await api.db.reviewCard.create({ data: { userId: user.id, category: 'kanji', sourceId: 'k-1', front: '一', back: 'Một',
      active: true, dueAt: new Date('2026-10-01'), intervalSeconds: 86400, reviewCount: 1 } });
    const event = await api.db.reviewEvent.create({ data: { cardId: card.id, rating: 'good', dueAt: card.dueAt, elapsedMs: 1000 } });
    roadmap = await rate(user, roadmap, 'k-1', false);
    const global = await api.db.kanjiProgress.findMany();
    await write(user, '/delete', { id: roadmap.id, version: roadmap.version }).expect(200);
    await write(user, '/rate', rateBody(roadmap)).expect(404);
    await write(user, '/start', startBody(roadmap)).expect(404);
    expect(await api.db.kanjiProgress.findMany()).toEqual(global);
    expect(await api.db.reviewCard.findMany()).toEqual([card]);
    expect(await api.db.reviewEvent.findMany()).toEqual([event]);
  });

  it('rolls back roadmap completion and global progress together when a transaction fails', async () => {
    const user = await register(), roadmap = await start(user, await create(user, '一'));
    const before = await api.db.personalRoadmap.findMany();
    const realTransaction = api.db.$transaction.bind(api.db);
    type Callback = (tx: Prisma.TransactionClient) => Promise<unknown>;
    vi.spyOn(api.db, '$transaction').mockImplementationOnce(((callback: Callback) => realTransaction(async tx => {
      await callback(tx);
      throw new Error('private injected study transaction failure');
    })) as unknown as typeof api.db.$transaction);
    const failed = await write(user, '/rate', rateBody(roadmap)).expect(503);
    expect(JSON.stringify(failed.body)).not.toContain('private injected');
    vi.restoreAllMocks(); await api.close(); api = createApp(config);
    expect(await api.db.personalRoadmap.findMany()).toEqual(before);
    expect(await api.db.kanjiProgress.count()).toBe(0);
    const saved = await rate(user, roadmap, 'k-1');
    expect(saved.completedDays).toEqual([1]);
    expect(await api.db.kanjiProgress.count()).toBe(1);
  });

  it('rejects unsupported persisted characters before starting, preserving the source list', async () => {
    const user = await register(), roadmap = await create(user, '一');
    await api.db.personalRoadmap.update({ where: { id: roadmap.id }, data: { rawKanji: '一猫', kanjiList: ['一', '猫'] } });
    const response = await write(user, '/start', startBody(roadmap)).expect(400);
    expect(response.body.error.code).toBe('UNSUPPORTED_KANJI');
    expect(response.body.error.message).toContain('猫');
    expect(await api.db.personalRoadmap.findUniqueOrThrow({ where: { id: roadmap.id } })).toMatchObject({ kanjiList: ['一', '猫'], startedAt: null });
  });
});
