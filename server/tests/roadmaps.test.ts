import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { MAX_ROADMAPS, ROADMAP_KANJI, ROADMAP_PER_DAY } from '../../shared/roadmap.mjs';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1))) {
  throw new Error('Refusing to clean a non-test database.');
}
const config: Config = {
  NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
};
const credentials = { email: 'roadmaps@example.com', name: 'Học viên', password: 'a long test passphrase 123' };
let api: ReturnType<typeof createApp>;
type Learner = { id: string; sid: string };
type Roadmap = { id: string; name: string; rawKanji: string; kanjiList: string[]; perDay: number;
  totalDays: number; currentDay: number; version: number; startedAt: string | null; createdAt: string };
type Creation = { id: string; name: string; rawKanji: string; perDay: number };
const cookie = (response: request.Response) => (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
const get = (user: Learner) => request(api.app).get('/api/roadmaps').set('Cookie', user.sid);
const write = (user: Learner, path: string, body: Record<string, unknown>) => request(api.app).post(`/api/roadmaps${path}`)
  .set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({ expectedUserId: user.id, ...body });
const creation = (changes: Partial<Creation> = {}): Creation => ({ id: randomUUID(), name: 'Lộ trình của tôi', rawKanji: '一二三四五六', perDay: 5, ...changes });
const edit = (roadmap: Roadmap, changes: Record<string, unknown> = {}) => ({
  id: roadmap.id, version: roadmap.version, name: roadmap.name, perDay: roadmap.perDay, ...changes,
});
async function register(email = credentials.email): Promise<Learner> {
  const response = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN)
    .send({ ...credentials, email }).expect(201);
  return { id: response.body.user.id, sid: cookie(response) };
}
async function create(user: Learner, changes: Partial<Creation> = {}): Promise<Roadmap> {
  return (await write(user, '', creation(changes)).expect(201)).body.roadmap;
}
beforeEach(async () => {
  api = createApp(config);
  await api.db.session.deleteMany();
  await api.db.user.deleteMany();
});
afterEach(async () => { vi.restoreAllMocks(); await api.close(); });

describe('P06 personal Kanji roadmaps', () => {
  it('requires a live session, same origin and bounded JSON without relaxing other API limits', async () => {
    await request(api.app).get('/api/roadmaps').expect(401);
    await request(api.app).post('/api/roadmaps').set('Origin', config.APP_ORIGIN).send({}).expect(401);
    const user = await register();
    await request(api.app).post('/api/roadmaps').set('Cookie', user.sid).send({}).expect(403);
    await request(api.app).post('/api/roadmaps').set('Cookie', user.sid).set('Origin', 'https://other.example').send({}).expect(403);
    await request(api.app).post('/api/roadmaps').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).type('form').send({}).expect(415);
    await write(user, '', { padding: 'x'.repeat(17000) }).expect(413);
    await request(api.app).post('/api/auth/login').set('Origin', config.APP_ORIGIN).send({ padding: 'x'.repeat(17000) }).expect(413);
    await request(api.app).post('/api/auth/logout').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({}).expect(204);
    await get(user).expect(401);
    expect(await api.db.personalRoadmap.count()).toBe(0);
  });

  it('uses exactly the existing catalog and rejects unknown Kanji instead of dropping or inventing data', async () => {
    const source = readFileSync(new URL('../../src/data/kanjiData.ts', import.meta.url), 'utf8');
    const catalog = [...source.matchAll(/id:\s*"([^"]+)"\s*,\s*kanji:\s*"([^"]+)"/g)].map(match => [match[1], match[2]]);
    expect(ROADMAP_KANJI).toEqual(catalog);
    const user = await register();
    for (const rawKanji of ['abc 123 かな、。', '', '  ']) {
      expect((await write(user, '', creation({ rawKanji })).expect(400)).body.error.code).toBe('EMPTY_KANJI');
    }
    for (const rawKanji of ['一猫', '猫', '一𠮷']) {
      const response = await write(user, '', creation({ rawKanji })).expect(400);
      expect(response.body.error.code).toBe('UNSUPPORTED_KANJI');
      expect(response.body.error.message).toContain(rawKanji.at(-1) === '猫' ? '猫' : '𠮷');
    }
    expect(await api.db.personalRoadmap.count()).toBe(0);
    const roadmap = await create(user, { rawKanji: ROADMAP_KANJI.map(([, character]) => character).join('') });
    expect(roadmap.kanjiList).toEqual(ROADMAP_KANJI.map(([, character]) => character));
  });

  it('validates strict envelopes, text limits, allowed goals and rejects client-owned progress fields', async () => {
    const user = await register(), body = creation();
    for (const invalid of [
      { id: 'bad' }, { name: '' }, { name: ' '.repeat(3) }, { name: 'a'.repeat(101) }, { rawKanji: '一'.repeat(2001) },
      { perDay: 0 }, { perDay: 6 }, { perDay: 5.5 }, { perDay: '5' }, { perDay: 31 }, { userId: user.id },
      { kanjiList: ['猫'] }, { totalDays: 0 }, { currentDay: 10 }, { version: 5 }, { startedAt: new Date().toISOString() },
    ]) await write(user, '', { ...body, ...invalid }).expect(400);
    const roadmap = await create(user);
    for (const invalid of [{ version: -1 }, { version: 0.5 }, { version: 2147483648 }, { rawKanji: '二' }, { startedAt: null }, { currentDay: 10 }]) {
      await write(user, '/update', edit(roadmap, invalid)).expect(400);
    }
    await write(user, '/delete', { id: roadmap.id, version: -1 }).expect(400);
    await write(user, '/delete', { id: roadmap.id, version: 0, force: true }).expect(400);
    await get(user).query({ userId: user.id }).expect(400);
    for (const perDay of ROADMAP_PER_DAY) await create(user, { perDay });
    await create(user, { rawKanji: '一'.repeat(2000) });
  });

  it('keeps first-occurrence order, raw input and derived totals across restart and another login', async () => {
    const user = await register();
    expect((await get(user).expect(200)).body).toEqual({ userId: user.id, roadmaps: [] });
    const body = creation({ name: '  Lộ trình đầu tiên  ', rawKanji: '六、一 二 三 四 五 六\n日!かな' });
    const response = await write(user, '', body).expect(201), first: Roadmap = response.body.roadmap;
    expect(response.headers['cache-control']).toBe('no-store');
    expect(first).toEqual({ id: body.id, name: body.name.trim(), rawKanji: body.rawKanji,
      kanjiList: ['六', '一', '二', '三', '四', '五', '日'], perDay: 5, totalDays: 2, currentDay: 1,
      version: 0, startedAt: null, createdAt: expect.any(String) });
    expect(Number.isFinite(Date.parse(first.createdAt))).toBe(true);
    const second = await create(user, { name: 'Lộ trình mới hơn' });
    await api.close();
    api = createApp(config);
    const login = await request(api.app).post('/api/auth/login').set('Origin', config.APP_ORIGIN)
      .send({ email: credentials.email, password: credentials.password }).expect(200);
    expect((await get({ ...user, sid: cookie(login) }).expect(200)).body).toEqual({ userId: user.id, roadmaps: [second, first] });
  });

  it('isolates accounts, forged owner fields and stale account requests on every write', async () => {
    const a = await register(), b = await register('other-roadmaps@example.com'), roadmap = await create(a);
    expect((await get(b).expect(200)).body).toEqual({ userId: b.id, roadmaps: [] });
    await write(b, '', creation({ id: roadmap.id })).expect(409);
    await write(b, '/update', edit(roadmap, { name: 'Stolen' })).expect(404);
    await write(b, '/delete', { id: roadmap.id, version: 0 }).expect(404);
    for (const [path, body] of [
      ['', creation()], ['/update', edit(roadmap)], ['/delete', { id: roadmap.id, version: 0 }],
    ] as const) {
      const response = await write(b, path, { ...body, expectedUserId: a.id }).expect(409);
      expect(response.body.error.code).toBe('ACCOUNT_CHANGED');
    }
    expect((await get(a).expect(200)).body.roadmaps).toEqual([roadmap]);
    await api.db.user.delete({ where: { id: b.id } });
    await get(b).expect(401);
  });

  it('retries one create UUID safely but rejects changed payloads and concurrent cross-account collisions', async () => {
    const user = await register(), body = creation();
    const repeated = await Promise.all([write(user, '', body), write(user, '', body)]);
    expect(repeated.map(response => response.status).sort()).toEqual([200, 201]);
    expect(repeated[0].body.roadmap).toEqual(repeated[1].body.roadmap);
    for (const change of [{ name: 'Khác' }, { rawKanji: `${body.rawKanji}一` }, { rawKanji: '二一' }, { perDay: 10 }]) {
      await write(user, '', { ...body, ...change }).expect(409);
    }
    const other = await register('collision-roadmaps@example.com'), crossId = randomUUID();
    const collisions = await Promise.all([write(user, '', creation({ id: crossId })), write(other, '', creation({ id: crossId }))]);
    expect(collisions.map(response => response.status).sort()).toEqual([201, 409]);
    expect(await api.db.personalRoadmap.count()).toBe(2);
  });

  it('updates name and goal before study, keeps the Kanji list and makes lost-response retries harmless', async () => {
    const user = await register(), roadmap = await create(user), body = edit(roadmap, { name: '  Đổi tên  ', perDay: 10 });
    const updated: Roadmap = (await write(user, '/update', body).expect(200)).body.roadmap;
    expect(updated).toEqual({ ...roadmap, name: 'Đổi tên', perDay: 10, totalDays: 1, version: 1 });
    expect((await write(user, '/update', body).expect(200)).body.roadmap).toEqual(updated);
    expect((await write(user, '/update', edit(updated)).expect(200)).body.roadmap).toEqual(updated);
    const stale = await write(user, '/update', edit(roadmap, { name: 'Bản cũ ghi đè' })).expect(409);
    expect(stale.body.error.code).toBe('ROADMAP_CHANGED');
    await write(user, '/update', edit(updated, { version: updated.version + 1 })).expect(409);
    expect((await get(user).expect(200)).body.roadmaps).toEqual([updated]);
  });

  it('serializes same-version edits so only one competing payload is saved', async () => {
    const user = await register(), roadmap = await create(user);
    const responses = await Promise.all([
      write(user, '/update', edit(roadmap, { name: 'Tên A' })),
      write(user, '/update', edit(roadmap, { name: 'Tên B', perDay: 10 })),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const winner = responses.find(response => response.status === 200)!.body.roadmap;
    expect(winner.version).toBe(1);
    expect((await get(user).expect(200)).body.roadmaps).toEqual([winner]);
    const identical = await Promise.all([
      write(user, '/update', edit(winner, { name: 'Cùng nội dung' })),
      write(user, '/update', edit(winner, { name: 'Cùng nội dung' })),
    ]);
    expect(identical.map(response => response.status)).toEqual([200, 200]);
    expect(identical[0].body.roadmap).toEqual(identical[1].body.roadmap);
    expect(identical[0].body.roadmap.version).toBe(2);
  });

  it('locks the daily goal once started while still allowing rename and retry', async () => {
    const user = await register(), roadmap = await create(user), startedAt = new Date('2026-09-14T02:00:00.000Z');
    await api.db.personalRoadmap.update({ where: { id: roadmap.id }, data: { startedAt } });
    const response = await write(user, '/update', edit(roadmap, { name: 'Không được lưu một phần', perDay: 10 })).expect(409);
    expect(response.body.error.code).toBe('ROADMAP_STARTED');
    const unchanged = await api.db.personalRoadmap.findUniqueOrThrow({ where: { id: roadmap.id } });
    expect(unchanged).toMatchObject({ name: roadmap.name, perDay: roadmap.perDay, version: 0, startedAt });
    const renamed = (await write(user, '/update', edit(roadmap, { name: 'Vẫn đổi tên được' })).expect(200)).body.roadmap;
    expect(renamed).toMatchObject({ name: 'Vẫn đổi tên được', perDay: 5, version: 1, startedAt: startedAt.toISOString() });
    expect((await write(user, '/update', edit(roadmap, { name: 'Vẫn đổi tên được' })).expect(200)).body.roadmap).toEqual(renamed);
  });

  it('checks startedAt in the atomic update even if study starts after the initial read', async () => {
    const user = await register(), roadmap = await create(user);
    const realTransaction = api.db.$transaction.bind(api.db);
    type Callback = (tx: Prisma.TransactionClient) => Promise<unknown>;
    vi.spyOn(api.db, '$transaction').mockImplementationOnce(((callback: Callback) => realTransaction(async tx => {
      const model = new Proxy(tx.personalRoadmap, { get(target, key, receiver) {
        if (key === 'updateMany') return async (args: Prisma.PersonalRoadmapUpdateManyArgs) => {
          await tx.personalRoadmap.update({ where: { id: roadmap.id }, data: { startedAt: new Date() } });
          return tx.personalRoadmap.updateMany(args);
        };
        return Reflect.get(target, key, receiver);
      } });
      const delegated = new Proxy(tx, { get(target, key, receiver) {
        return key === 'personalRoadmap' ? model : Reflect.get(target, key, receiver);
      } });
      return callback(delegated);
    })) as unknown as typeof api.db.$transaction);
    await write(user, '/update', edit(roadmap, { perDay: 10 })).expect(409);
    vi.restoreAllMocks();
    expect(await api.db.personalRoadmap.findUniqueOrThrow({ where: { id: roadmap.id } })).toMatchObject({ perDay: 5, version: 0 });
  });

  it('rejects deletion from a stale tab and safely repeats a completed deletion', async () => {
    const user = await register(), roadmap = await create(user);
    const updated = (await write(user, '/update', edit(roadmap, { name: 'Mới hơn' })).expect(200)).body.roadmap;
    expect((await write(user, '/delete', { id: roadmap.id, version: 0 }).expect(409)).body.error.code).toBe('ROADMAP_CHANGED');
    const responses = await Promise.all([
      write(user, '/delete', { id: updated.id, version: updated.version }),
      write(user, '/delete', { id: updated.id, version: updated.version }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ userId: user.id, id: roadmap.id });
    }
    expect((await get(user).expect(200)).body.roadmaps).toEqual([]);
    await write(user, '/update', edit(updated, { name: 'Đã xóa' })).expect(404);
  });

  it('enforces the account quota atomically without blocking a safe create retry', async () => {
    const user = await register();
    await api.db.personalRoadmap.createMany({ data: Array.from({ length: MAX_ROADMAPS - 1 }, () => ({
      id: randomUUID(), userId: user.id, name: 'Đã có', rawKanji: '一', kanjiList: ['一'], perDay: 5,
    })) });
    const a = creation(), b = creation();
    const responses = await Promise.all([write(user, '', a), write(user, '', b)]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 400]);
    const savedBody = responses[0].status === 201 ? a : b;
    expect(responses.find(response => response.status === 400)!.body.error.code).toBe('ROADMAP_LIMIT');
    await write(user, '', savedBody).expect(200);
    expect(await api.db.personalRoadmap.count({ where: { userId: user.id } })).toBe(MAX_ROADMAPS);
    const other = await register('quota-roadmaps@example.com');
    await create(other);
  });

  it('does not add stars or mutate Kanji progress, review schedules or history when editing/deleting', async () => {
    const user = await register(), roadmap = await create(user);
    expect(await api.db.reviewCard.count()).toBe(0);
    expect(await api.db.kanjiProgress.count()).toBe(0);
    const progress = await api.db.kanjiProgress.create({ data: { userId: user.id, kanjiId: 'k-1', memorized: true } });
    const card = await api.db.reviewCard.create({ data: { userId: user.id, category: 'kanji', sourceId: 'k-1',
      front: '一', back: 'Số một', active: true, intervalSeconds: 86400, reviewCount: 1, dueAt: new Date('2026-09-15T00:00:00.000Z') } });
    const event = await api.db.reviewEvent.create({ data: { id: randomUUID(), cardId: card.id, rating: 'good', dueAt: card.dueAt, elapsedMs: 1500 } });
    const updated = (await write(user, '/update', edit(roadmap, { name: 'Đổi tên', perDay: 10 })).expect(200)).body.roadmap;
    await write(user, '/delete', { id: updated.id, version: updated.version }).expect(200);
    expect(await api.db.kanjiProgress.findMany()).toEqual([progress]);
    expect(await api.db.reviewCard.findMany()).toEqual([card]);
    expect(await api.db.reviewEvent.findMany()).toEqual([event]);
    expect(await api.db.vocabProgress.count()).toBe(0);
    expect(await api.db.vocabStudyResult.count()).toBe(0);
  });

  it.each(['create', 'update', 'delete'] as const)('rolls back failed %s writes and supports a safe retry', async operation => {
    const user = await register(), roadmap = operation === 'create' ? null : await create(user);
    const path = operation === 'create' ? '' : `/${operation}`;
    const body = operation === 'create' ? creation() : operation === 'update'
      ? edit(roadmap!, { name: 'Tên mới' }) : { id: roadmap!.id, version: roadmap!.version };
    const before = await api.db.personalRoadmap.findMany();
    const realTransaction = api.db.$transaction.bind(api.db);
    type Callback = (tx: Prisma.TransactionClient) => Promise<unknown>;
    vi.spyOn(api.db, '$transaction').mockImplementationOnce(((callback: Callback) => realTransaction(async tx => {
      await callback(tx);
      throw new Error('private simulated roadmap transaction failure');
    })) as unknown as typeof api.db.$transaction);
    const response = await write(user, path, body).expect(503);
    expect(JSON.stringify(response.body)).not.toContain('private simulated');
    vi.restoreAllMocks();
    // Prisma's proxied transaction method needs a fresh client after the injected fault.
    // The persisted session also verifies retry across an API restart.
    await api.close();
    api = createApp(config);
    expect(await api.db.personalRoadmap.findMany()).toEqual(before);
    await write(user, path, body).expect(operation === 'create' ? 201 : 200);
    await write(user, path, body).expect(200);
    expect(await api.db.personalRoadmap.count()).toBe(operation === 'delete' ? 0 : 1);
  });
});
