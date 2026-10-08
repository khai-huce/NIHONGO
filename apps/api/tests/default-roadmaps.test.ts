import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';
import { DEFAULT_ROADMAP, vietnamStudyDate } from '@nihongo/shared/study/default-roadmap';

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
type Roadmap = { id: string; kanjiList: string[]; perDay: number; totalDays: number; currentDay: number;
  assessments: Record<string, boolean>; completedDays: number[]; progressVersion: number; startedAt: string | null;
  activityDays: string[]; streak: number };
const cookie = (response: request.Response) => (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
const get = (user: Learner) => request(api.app).get('/api/roadmaps/default').set('Cookie', user.sid);
const write = (user: Learner, path: string, body: Record<string, unknown>) => request(api.app).post(`/api/roadmaps/default${path}`)
  .set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({ expectedUserId: user.id, catalogId: 'n5-v1', ...body });
const rateBody = (roadmap: Roadmap, kanjiId = 'k-1', memorized = true, day = 1) => ({
  progressVersion: roadmap.progressVersion, day, kanjiId, memorized,
});
async function register(email = 'default-roadmap@example.com'): Promise<Learner> {
  const response = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN)
    .send({ email, name: 'Học viên', password: 'a long test passphrase 123' }).expect(201);
  return { id: response.body.user.id, sid: cookie(response) };
}
async function start(user: Learner, day = 1): Promise<Roadmap> {
  return (await write(user, '/start', { day }).expect(200)).body.roadmap;
}
async function rate(user: Learner, roadmap: Roadmap, kanjiId: string, memorized = true, day = 1): Promise<Roadmap> {
  return (await write(user, '/rate', rateBody(roadmap, kanjiId, memorized, day)).expect(200)).body.roadmap;
}
beforeEach(async () => {
  api = createApp(config);
  await api.db.session.deleteMany();
  await api.db.user.deleteMany();
});
afterEach(async () => { vi.useRealTimers(); vi.restoreAllMocks(); await api.close(); });

describe('P08 default N5 roadmap', () => {
  it('returns the approved virtual catalog without creating progress or inheriting global/personal data', async () => {
    const user = await register();
    await api.db.kanjiProgress.create({ data: { userId: user.id, kanjiId: 'k-1', memorized: true } });
    await api.db.personalRoadmap.create({ data: { id: randomUUID(), userId: user.id, name: 'Riêng', rawKanji: '一',
      kanjiList: ['一'], perDay: 5, assessments: { 'k-1': true }, completedDays: [1], startedAt: new Date() } });
    const response = await get(user).expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({ userId: user.id, serverNow: expect.any(String), roadmap: {
      id: 'n5-v1', kanjiList: DEFAULT_ROADMAP.kanjiList, perDay: 10, totalDays: 3, currentDay: 1,
      assessments: {}, completedDays: [], progressVersion: 0, startedAt: null, activityDays: [], streak: 0,
    } });
    expect(await api.db.defaultRoadmapProgress.count()).toBe(0);
    await get(user).expect(200);
    expect(await api.db.defaultRoadmapProgress.count()).toBe(0);
  });

  it('requires a session, same origin and expected account; users cannot read or update each other', async () => {
    const a = await register(), b = await register('default-roadmap-other@example.com');
    await request(api.app).get('/api/roadmaps/default').expect(401);
    for (const [path, body] of [['/start', { day: 1 }], ['/rate', { progressVersion: 0, day: 1, kanjiId: 'k-1', memorized: true }]] as const) {
      await request(api.app).post(`/api/roadmaps/default${path}`).set('Origin', config.APP_ORIGIN).send(body).expect(401);
      await request(api.app).post(`/api/roadmaps/default${path}`).set('Cookie', a.sid).send({ expectedUserId: a.id, ...body }).expect(403);
      expect((await write(b, path, { ...body, expectedUserId: a.id }).expect(409)).body.error.code).toBe('ACCOUNT_CHANGED');
    }
    await rate(a, await start(a), 'k-1', false);
    expect((await get(b).expect(200)).body.roadmap).toMatchObject({ assessments: {}, startedAt: null, completedDays: [] });
    expect(await api.db.defaultRoadmapProgress.count({ where: { userId: b.id } })).toBe(0);
  });

  it('rejects unavailable catalogs, invalid days, crossed-day characters and forged statistics', async () => {
    const user = await register();
    await request(api.app).get('/api/roadmaps/default?catalogId=n4-v1').set('Cookie', user.sid).expect(400);
    for (const invalid of [{ catalogId: 'n4-v1' }, { catalogId: 'n1-v1' }, { day: 0 }, { day: 1.5 }, { day: 4 }, { day: '1' },
      { perDay: 5 }, { completedDays: [1] }, { assessments: { 'k-1': true } }, { activityDays: ['2026-09-15'] }, { streak: 20 }]) {
      await write(user, '/start', { day: 1, ...invalid }).expect(400);
    }
    expect(await api.db.defaultRoadmapProgress.count()).toBe(0);
    expect((await write(user, '/rate', { progressVersion: 0, day: 1, kanjiId: 'k-1', memorized: true }).expect(409)).body.error.code).toBe('ROADMAP_NOT_STARTED');
    const begun = await start(user);
    for (const invalid of [{ catalogId: 'n4-v1' }, { day: 4 }, { day: 2 }, { kanjiId: 'k-11' }, { kanjiId: 'k-101' },
      { memorized: 'true' }, { progressVersion: -1 }, { completedDays: [1] }, { activityDays: ['2026-09-15'] }, { streak: 20 }]) {
      await write(user, '/rate', { ...rateBody(begun), ...invalid }).expect(400);
    }
    expect((await get(user).expect(200)).body.roadmap).toEqual(begun);
    expect(await api.db.kanjiProgress.count()).toBe(0);
  });

  it('starts idempotently without completing a day or earning streak, including simultaneous starts', async () => {
    const user = await register();
    const responses = await Promise.all([write(user, '/start', { day: 3 }), write(user, '/start', { day: 1 })]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(responses[0].body.roadmap).toEqual(responses[1].body.roadmap);
    expect(responses[0].body.roadmap).toMatchObject({ progressVersion: 1, startedAt: expect.any(String),
      currentDay: 1, assessments: {}, completedDays: [], activityDays: [], streak: 0 });
    expect(await api.db.defaultRoadmapProgress.count()).toBe(1);
    expect(await api.db.kanjiProgress.count()).toBe(0);
    expect(await start(user, 2)).toEqual(responses[0].body.roadmap);
  });

  it('persists false/partial assessments across restart and completes exactly 10/10/8 while retaining replay completion', async () => {
    const user = await register();
    let roadmap = await start(user);
    roadmap = await rate(user, roadmap, 'k-1', false);
    expect(roadmap).toMatchObject({ assessments: { 'k-1': false }, completedDays: [], currentDay: 1, streak: 1 });
    await api.close(); api = createApp(config);
    expect((await get(user).expect(200)).body.roadmap).toEqual(roadmap);
    for (let id = 2; id <= 28; id += 1) {
      const day = Math.ceil(id / 10);
      roadmap = await rate(user, roadmap, `k-${id}`, false, day);
      expect(roadmap.completedDays).toEqual(id < 10 ? [] : id < 20 ? [1] : id < 28 ? [1, 2] : [1, 2, 3]);
    }
    expect(roadmap.currentDay).toBe(3);
    expect(Object.keys(roadmap.assessments)).toHaveLength(28);
    roadmap = await rate(user, roadmap, 'k-1', true);
    expect((await api.db.xpEvent.aggregate({ where: { userId: user.id }, _sum: { points: true } }))._sum.points).toBe(30);
    roadmap = await rate(user, roadmap, 'k-1', false);
    expect(roadmap.completedDays).toEqual([1, 2, 3]);
    expect(roadmap.assessments['k-1']).toBe(false);
    expect(roadmap.activityDays).toHaveLength(1);
    expect(await api.db.kanjiProgress.count({ where: { userId: user.id, memorized: false } })).toBe(28);
    expect(await api.db.personalRoadmap.count()).toBe(0);
    expect(await api.db.reviewCard.count()).toBe(0);
  });

  it('completing day three first preserves the first unfinished day as the resume target', async () => {
    const user = await register();
    let roadmap = await start(user, 3);
    for (let id = 21; id <= 28; id += 1) roadmap = await rate(user, roadmap, `k-${id}`, false, 3);
    expect(roadmap).toMatchObject({ completedDays: [3], currentDay: 1 });
    expect((await get(user).expect(200)).body.roadmap).toMatchObject({ completedDays: [3], currentDay: 1 });
  });

  it('serializes two-tab ratings and rejects stale retries without adding activity or rewriting global status', async () => {
    const user = await register(), begun = await start(user);
    const responses = await Promise.all([write(user, '/rate', rateBody(begun, 'k-1', true)), write(user, '/rate', rateBody(begun, 'k-2', false))]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(responses.find(response => response.status === 409)!.body.error.code).toBe('ROADMAP_PROGRESS_CHANGED');
    const saved: Roadmap = responses.find(response => response.status === 200)!.body.roadmap;
    const [savedId] = Object.keys(saved.assessments);
    await write(user, '/rate', rateBody(begun, savedId, !saved.assessments[savedId])).expect(409);
    expect((await get(user).expect(200)).body.roadmap).toEqual(saved);
    expect(saved.activityDays).toHaveLength(1);
    expect(await api.db.kanjiProgress.findMany()).toMatchObject([{ userId: user.id, kanjiId: savedId, memorized: saved.assessments[savedId] }]);
  });

  it('records Vietnam dates on successful ratings, crossing midnight once and ending streak after a skipped day', async () => {
    const user = await register();
    let roadmap = await start(user);
    const today = vietnamStudyDate(new Date());
    const boundary = new Date(`${today}T17:00:00.000Z`).getTime();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(boundary - 1);
    roadmap = await rate(user, roadmap, 'k-1', false);
    expect(roadmap.activityDays).toEqual([today]);
    expect(roadmap.streak).toBe(1);
    vi.setSystemTime(boundary);
    roadmap = await rate(user, roadmap, 'k-2', true);
    roadmap = await rate(user, roadmap, 'k-3', false);
    expect(roadmap.activityDays).toEqual([today, vietnamStudyDate(new Date(boundary))]);
    expect(roadmap.streak).toBe(2);
    vi.setSystemTime(boundary + 86400000);
    expect((await get(user).expect(200)).body.roadmap.streak).toBe(2);
    vi.setSystemTime(boundary + 2 * 86400000);
    expect((await get(user).expect(200)).body.roadmap.streak).toBe(0);
    expect((await get(user).expect(200)).body.roadmap.activityDays).toHaveLength(2);
  });

  it('preserves personal study and existing starred/SRS data when rating the same character in the default plan', async () => {
    const user = await register();
    const personal = await api.db.personalRoadmap.create({ data: { id: randomUUID(), userId: user.id, name: 'Riêng', rawKanji: '一',
      kanjiList: ['一'], perDay: 5, assessments: { 'k-1': true }, completedDays: [1], startedAt: new Date() } });
    const card = await api.db.reviewCard.create({ data: { userId: user.id, category: 'kanji', sourceId: 'k-1', front: '一', back: 'Một',
      active: true, dueAt: new Date('2026-10-01'), intervalSeconds: 86400, reviewCount: 1 } });
    const event = await api.db.reviewEvent.create({ data: { cardId: card.id, rating: 'good', dueAt: card.dueAt, elapsedMs: 1000 } });
    await rate(user, await start(user), 'k-1', false);
    expect(await api.db.personalRoadmap.findMany()).toEqual([personal]);
    expect(await api.db.reviewCard.findMany()).toEqual([card]);
    expect(await api.db.reviewEvent.findMany()).toEqual([event]);
  });

  it('rolls back day progress, study dates and global memorization together on a failed transaction', async () => {
    const user = await register(), begun = await start(user);
    const before = await api.db.defaultRoadmapProgress.findMany();
    const realTransaction = api.db.$transaction.bind(api.db);
    type Callback = (tx: Prisma.TransactionClient) => Promise<unknown>;
    vi.spyOn(api.db, '$transaction').mockImplementationOnce(((callback: Callback) => realTransaction(async tx => {
      await callback(tx);
      throw new Error('private injected default study transaction failure');
    })) as unknown as typeof api.db.$transaction);
    const failed = await write(user, '/rate', rateBody(begun)).expect(503);
    expect(JSON.stringify(failed.body)).not.toContain('private injected');
    vi.restoreAllMocks(); await api.close(); api = createApp(config);
    expect(await api.db.defaultRoadmapProgress.findMany()).toEqual(before);
    expect(await api.db.kanjiProgress.count()).toBe(0);
    expect((await rate(user, begun, 'k-1')).streak).toBe(1);
  });
});
