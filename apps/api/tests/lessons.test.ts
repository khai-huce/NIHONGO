import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';
import * as vocabReview from '../src/modules/vocabulary/vocab-review.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1))) throw new Error('Refusing to clean a non-test database.');
const config: Config = {
  NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
};
const userInput = { email: 'lesson-test@example.com', name: 'Học viên', password: 'a long test passphrase 123' };
let api: ReturnType<typeof createApp>;
type Learner = { id: string; sid: string };
const cookie = (response: request.Response) => (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
const word = () => ({ id: randomUUID(), word: '学校', reading: 'がっこう', hanViet: 'HỌC HIỆU', meaning: 'Trường học' });
const list = (user: Learner) => request(api.app).get('/api/vocab/lessons').set('Cookie', user.sid);
const mutate = (user: Learner, path: string, body: Record<string, unknown>) => request(api.app)
  .post(`/api/vocab/lessons${path}`).set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
  .send({ expectedUserId: user.id, ...body });
async function register(email = userInput.email): Promise<Learner> {
  const result = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN).send({ ...userInput, email }).expect(201);
  return { id: result.body.user.id, sid: cookie(result) };
}
async function create(user: Learner, name = 'Bài tự nhập') {
  return (await mutate(user, '', { id: randomUUID(), name }).expect(201)).body.lesson as { id: string; name: string; words: ReturnType<typeof word>[]; version: number };
}
const star = (user: Learner, item: ReturnType<typeof word>, overrides: Record<string, unknown> = {}) =>
  request(api.app).post('/api/review/star').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
    .send({ expectedUserId: user.id, category: 'vocab', sourceId: `custom:${item.id}`,
      front: item.word, back: item.meaning, reading: item.reading, active: true, ...overrides });
const rate = (user: Learner, card: { id: string; version: number }, rating = 'good') =>
  request(api.app).post('/api/review/rate').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
    .send({ expectedUserId: user.id, id: card.id, version: card.version, rating, elapsedMs: 2500 });
const cards = (user: Learner) => api.db.reviewCard.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } });

beforeEach(async () => {
  api = createApp(config);
  await api.db.session.deleteMany();
  await api.db.user.deleteMany();
});
afterEach(async () => { vi.restoreAllMocks(); await api.close(); });

describe('account-owned Chủ động lessons', () => {
  it('requires a live session, same origin and JSON for mutations', async () => {
    await request(api.app).get('/api/vocab/lessons').expect(401);
    await request(api.app).post('/api/vocab/lessons').set('Origin', config.APP_ORIGIN).send({}).expect(401);
    const user = await register();
    await request(api.app).post('/api/vocab/lessons').set('Cookie', user.sid).send({}).expect(403);
    await request(api.app).post('/api/vocab/lessons').set('Cookie', user.sid).set('Origin', 'https://other.example').send({}).expect(403);
    await request(api.app).post('/api/vocab/lessons').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).type('form').send({}).expect(415);
    await request(api.app).post('/api/auth/logout').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({}).expect(204);
    await list(user).expect(401);
    expect(await api.db.vocabLesson.count()).toBe(0);
  });

  it('persists full lesson content across reload, server restart and another login', async () => {
    const user = await register();
    const lesson = await create(user);
    const words = [word(), { ...word(), word: '先生', meaning: 'Giáo viên' }];
    const saved = await mutate(user, '/update', { id: lesson.id, version: 0, words }).expect(200);
    const renamed = await mutate(user, '/update', { id: lesson.id, version: saved.body.lesson.version, name: '  Bài đã đổi tên  ' }).expect(200);
    expect(renamed.body.lesson).toEqual({ ...lesson, name: 'Bài đã đổi tên', words, version: 2 });
    const response = await list(user).expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ userId: user.id, lessons: [renamed.body.lesson] });
    await api.close();
    api = createApp(config);
    const login = await request(api.app).post('/api/auth/login').set('Origin', config.APP_ORIGIN)
      .send({ email: userInput.email, password: userInput.password }).expect(200);
    expect((await list({ ...user, sid: cookie(login) }).expect(200)).body.lessons).toEqual([renamed.body.lesson]);
  });

  it('creates exactly one lesson for concurrent requests and safe retries', async () => {
    const user = await register(), id = randomUUID();
    const responses = await Promise.all([mutate(user, '', { id, name: 'Bài 1' }), mutate(user, '', { id, name: 'Bài 1' })]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 201]);
    await mutate(user, '/update', { id, version: 0, words: [word()] }).expect(200);
    const retry = await mutate(user, '', { id, name: 'Bài 1' }).expect(200);
    expect(retry.body.lesson.words).toHaveLength(1);
    expect(await api.db.vocabLesson.count()).toBe(1);
  });

  it('isolates owners and rejects writes from a page belonging to the previous account', async () => {
    const a = await register(), b = await register('other-lessons@example.com');
    const lesson = await create(a);
    expect((await list(b).expect(200)).body.lessons).toEqual([]);
    await mutate(b, '', { id: randomUUID(), name: 'Stale page', expectedUserId: a.id }).expect(409);
    await mutate(b, '/update', { id: lesson.id, version: 0, name: 'Foreign edit' }).expect(404);
    await mutate(b, '/delete', { id: lesson.id, version: 0 }).expect(200);
    await mutate(b, '', { id: lesson.id, name: 'Foreign create' }).expect(409);
    expect((await list(a).expect(200)).body.lessons).toEqual([lesson]);
  });

  it('prevents lost edits between tabs and stale deletes; deletion can be retried', async () => {
    const user = await register(), lesson = await create(user);
    const results = await Promise.all([
      mutate(user, '/update', { id: lesson.id, version: 0, name: 'Tab A' }),
      mutate(user, '/update', { id: lesson.id, version: 0, name: 'Tab B' }),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const winner = results.find(r => r.status === 200)!.body.lesson;
    await mutate(user, '/delete', { id: lesson.id, version: 0 }).expect(409);
    expect((await list(user)).body.lessons).toEqual([winner]);
    await mutate(user, '/delete', { id: lesson.id, version: winner.version }).expect(200);
    await mutate(user, '/delete', { id: lesson.id, version: winner.version }).expect(200);
    expect((await list(user)).body.lessons).toEqual([]);
  });

  it('validates a whole word batch before saving, without accepting owner or version spoofing', async () => {
    const user = await register(), lesson = await create(user), original = word();
    for (const invalid of [
      { name: '' }, { name: 'x'.repeat(101) }, { version: -1, name: 'Test' },
      { userId: randomUUID(), name: 'Test' }, { words: [original, original] },
      { words: [original, { ...word(), meaning: '' }] }, { words: [{ ...original, id: 'w-0' }] },
      { words: [{ ...original, reading: 123 }] }, { words: Array.from({ length: 501 }, word) },
    ]) {
      await mutate(user, '/update', { id: lesson.id, version: 0, ...invalid }).expect(400);
    }
    expect((await list(user)).body.lessons).toEqual([lesson]);
    await mutate(user, '/update', { id: lesson.id, version: 0, words: [original] }).expect(200);
  });

  it('accepts lesson batches above 16KB, enforces 512KB and leaves auth limits unchanged', async () => {
    const user = await register(), lesson = await create(user);
    const words = Array.from({ length: 30 }, () => ({ ...word(), meaning: 'a'.repeat(1000) }));
    await mutate(user, '/update', { id: lesson.id, version: 0, words }).expect(200);
    await mutate(user, '/update', { id: lesson.id, version: 1, words, padding: 'x'.repeat(512 * 1024) }).expect(413);
    await request(api.app).post('/api/auth/login').set('Origin', config.APP_ORIGIN).send({ ...userInput, padding: 'x'.repeat(20000) }).expect(413);
    expect((await list(user)).body.lessons[0].words).toEqual(words);
  });

  it('keeps a failed save unchanged and permits retry after the database recovers', async () => {
    const user = await register(), lesson = await create(user);
    vi.spyOn(api.db, '$transaction').mockRejectedValueOnce(new Error('private database connection detail'));
    const failed = await mutate(user, '/update', { id: lesson.id, version: 0, words: [word()] }).expect(503);
    expect(JSON.stringify(failed.body)).not.toContain('private database');
    expect((await list(user)).body.lessons).toEqual([lesson]);
    // Recreate Prisma after the injected outage; preserve the real PostgreSQL session/data.
    vi.restoreAllMocks();
    await api.close();
    api = createApp(config);
    await mutate(user, '/update', { id: lesson.id, version: 0, words: [word()] }).expect(200);
    expect((await list(user)).body.lessons[0].words).toHaveLength(1);
  });

  it('syncs edits without auto-starring, and keeps the latest snapshot/history after lesson deletion', async () => {
    const user = await register(), lesson = await create(user), otherLesson = await create(user, 'Bài khác');
    const original = word();
    await mutate(user, '/update', { id: lesson.id, version: 0, words: [original] }).expect(200);
    expect(await api.db.reviewCard.count()).toBe(0);
    const card = (await request(api.app).post('/api/review/star').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
      .send({ expectedUserId: user.id, category: 'vocab', sourceId: `custom:${original.id}`, front: original.word, back: original.meaning, active: true }).expect(200)).body.card;
    await request(api.app).post('/api/review/rate').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
      .send({ expectedUserId: user.id, id: card.id, version: card.version, rating: 'good', elapsedMs: 2500 }).expect(200);
    const beforeCards = await api.db.reviewCard.findMany(), beforeEvents = await api.db.reviewEvent.findMany();
    await mutate(user, '/update', { id: lesson.id, version: 1, words: [{ ...original, meaning: 'Nghĩa đã sửa' }] }).expect(200);
    await mutate(user, '/delete', { id: lesson.id, version: 2 }).expect(200);
    expect((await list(user)).body.lessons).toEqual([otherLesson]);
    expect(await api.db.reviewCard.findMany()).toEqual(beforeCards.map(card => ({ ...card, back: 'Nghĩa đã sửa', version: card.version + 1 })));
    expect(await api.db.reviewEvent.findMany()).toEqual(beforeEvents);
  });
});

describe('P02 custom vocabulary and starred review snapshots', () => {
  it('updates active and paused snapshots, keeps schedules/events, and leaves unchanged cards and renames alone', async () => {
    const user = await register(), lesson = await create(user);
    const active = word(), paused = word(), unchanged = word(), unstarred = word();
    await mutate(user, '/update', { id: lesson.id, version: 0, words: [active, paused, unchanged, unstarred] }).expect(200);
    for (const item of [active, paused, unchanged]) {
      const card = (await star(user, item).expect(200)).body.card;
      await rate(user, card).expect(200);
    }
    await star(user, paused, { active: false }).expect(200);
    const before = await cards(user), events = await api.db.reviewEvent.findMany();
    const edits = [
      { ...active, word: '学園', reading: 'がくえん', meaning: 'Học viện' },
      { ...paused, meaning: 'Nghĩa mới của thẻ đã bỏ sao' }, unchanged, { ...unstarred, meaning: 'Chưa gắn sao' },
    ];
    await mutate(user, '/update', { id: lesson.id, version: 1, words: edits }).expect(200);
    const after = await cards(user);
    expect(after).toHaveLength(3);
    for (const old of before) {
      const item = edits.find(item => `custom:${item.id}` === old.sourceId)!;
      expect(after.find(card => card.id === old.id)).toEqual({ ...old, front: item.word, back: item.meaning,
        reading: item.reading, version: old.version + (item.id === unchanged.id ? 0 : 1) });
    }
    expect(await api.db.reviewEvent.findMany()).toEqual(events);
    await mutate(user, '/update', { id: lesson.id, version: 2, name: 'Tên bài mới' }).expect(200);
    await mutate(user, '/update', { id: lesson.id, version: 3, words: edits }).expect(200);
    expect(await cards(user)).toEqual(after);
  });

  it('uses saved content for old-tab stars, including first star, reactivation and deleted-source toggles', async () => {
    const user = await register(), lesson = await create(user), original = word();
    await mutate(user, '/update', { id: lesson.id, version: 0, words: [original] }).expect(200);
    const first = (await star(user, original, { front: 'Nội dung cũ', back: 'Nghĩa cũ', reading: 'Cách đọc cũ' }).expect(200)).body.card;
    expect(first).toMatchObject({ front: original.word, back: original.meaning, reading: original.reading });
    const rated = (await rate(user, first).expect(200)).body.card;
    const edited = { ...original, word: '先生', reading: 'せんせい', meaning: 'Giáo viên' };
    await mutate(user, '/update', { id: lesson.id, version: 1, words: [edited] }).expect(200);
    await star(user, original, { active: false }).expect(200);
    const restored = (await star(user, original).expect(200)).body.card;
    expect(restored).toMatchObject({ front: edited.word, back: edited.meaning, reading: edited.reading,
      dueAt: rated.dueAt, intervalSeconds: rated.intervalSeconds, reviewCount: 1, active: true });
    const beforeRemoval = await cards(user);
    await mutate(user, '/update', { id: lesson.id, version: 2, words: [] }).expect(200);
    expect(await cards(user)).toEqual(beforeRemoval);
    await star(user, original, { active: false }).expect(200);
    const orphan = (await star(user, original).expect(200)).body.card;
    expect(orphan).toMatchObject({ front: edited.word, back: edited.meaning, reading: edited.reading,
      dueAt: rated.dueAt, intervalSeconds: rated.intervalSeconds, reviewCount: 1, active: true });
    expect(await api.db.reviewEvent.count()).toBe(1);
  });

  it('limits syncing to the owning account, matching word ID and vocabulary category', async () => {
    const a = await register(), b = await register('second-p02@example.com');
    const firstLesson = await create(a), otherLesson = await create(a), foreignLesson = await create(b);
    const first = word(), other = word();
    await mutate(a, '/update', { id: firstLesson.id, version: 0, words: [first] }).expect(200);
    await mutate(a, '/update', { id: otherLesson.id, version: 0, words: [other] }).expect(200);
    // Reusing an ID in another account is isolated, even with a deliberately crafted request.
    await mutate(b, '/update', { id: foreignLesson.id, version: 0, words: [first] }).expect(200);
    await star(a, first).expect(200); await star(a, other).expect(200); await star(b, first).expect(200);
    await star(a, first, { category: 'grammar' }).expect(200);
    const ownBefore = await cards(a), foreignBefore = await cards(b);
    await mutate(a, '/update', { id: firstLesson.id, version: 1, words: [{ ...first, meaning: 'Nghĩa mới' }] }).expect(200);
    expect(await cards(b)).toEqual(foreignBefore);
    expect(await cards(a)).toEqual(ownBefore.map(card => card.category === 'vocab' && card.sourceId === `custom:${first.id}`
      ? { ...card, back: 'Nghĩa mới', version: card.version + 1 } : card));
  });

  it('prevents duplicate UUIDs between lessons and reusing a removed word ID with retained history', async () => {
    const user = await register(), a = await create(user), b = await create(user), original = word();
    const results = await Promise.all([
      mutate(user, '/update', { id: a.id, version: 0, words: [original] }),
      mutate(user, '/update', { id: b.id, version: 0, words: [original] }),
    ]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const owner = results.find(result => result.status === 200)!.body.lesson;
    const other = owner.id === a.id ? b : a;
    await star(user, original).expect(200);
    await mutate(user, '/delete', { id: owner.id, version: 1 }).expect(200);
    await mutate(user, '/update', { id: other.id, version: 0, words: [original] }).expect(409);
    await mutate(user, '/update', { id: other.id, version: 0, words: [{ ...original, id: randomUUID() }] }).expect(200);
    expect(await api.db.reviewCard.count()).toBe(1);
  });

  it('rolls back lesson and card changes together if syncing fails, then permits retry', async () => {
    const user = await register(), lesson = await create(user), original = word();
    await mutate(user, '/update', { id: lesson.id, version: 0, words: [original] }).expect(200);
    await star(user, original).expect(200);
    const before = await cards(user), beforeLesson = (await list(user)).body.lessons;
    const realSync = vocabReview.syncLessonReview;
    vi.spyOn(vocabReview, 'syncLessonReview').mockImplementationOnce(async (...args) => {
      await realSync(...args);
      throw new Error('simulated outage after both writes');
    });
    const input = { id: lesson.id, version: 1, words: [{ ...original, meaning: 'Đã sửa' }] };
    await mutate(user, '/update', input).expect(503);
    expect((await list(user)).body.lessons).toEqual(beforeLesson);
    expect(await cards(user)).toEqual(before);
    vi.restoreAllMocks();
    await mutate(user, '/update', input).expect(200);
    expect((await cards(user))[0].back).toBe('Đã sửa');
  });

  it('serializes a concurrent first star and source edit so old text cannot win', async () => {
    const user = await register(), lesson = await create(user), original = word();
    await mutate(user, '/update', { id: lesson.id, version: 0, words: [original] }).expect(200);
    const results = await Promise.all([
      star(user, original),
      mutate(user, '/update', { id: lesson.id, version: 1, words: [{ ...original, meaning: 'Mới nhất' }] }),
    ]);
    expect(results.map(result => result.status)).toEqual([200, 200]);
    const saved = await cards(user);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ back: 'Mới nhất', active: true, reviewCount: 0, intervalSeconds: 0 });
  });

  it('rejects old review versions after editing, and safely handles a concurrent rating', async () => {
    const user = await register(), lesson = await create(user), original = word();
    await mutate(user, '/update', { id: lesson.id, version: 0, words: [original] }).expect(200);
    const old = (await star(user, original).expect(200)).body.card;
    await mutate(user, '/update', { id: lesson.id, version: 1, words: [{ ...original, meaning: 'Nghĩa mới' }] }).expect(200);
    await rate(user, old).expect(409);
    expect(await api.db.reviewEvent.count()).toBe(0);
    const fresh = (await cards(user))[0];
    const [edit, rating] = await Promise.all([
      mutate(user, '/update', { id: lesson.id, version: 2, words: [{ ...original, meaning: 'Nghĩa mới nhất' }] }),
      rate(user, fresh),
    ]);
    expect(edit.status).toBe(200);
    expect([200, 409]).toContain(rating.status);
    const saved = (await cards(user))[0];
    expect(saved.back).toBe('Nghĩa mới nhất');
    expect(saved.reviewCount).toBe(rating.status === 200 ? 1 : 0);
    expect(await api.db.reviewEvent.count()).toBe(saved.reviewCount);
    if (rating.status === 409) await rate(user, saved).expect(200);
    expect(await api.db.reviewEvent.count()).toBe(1);
  });

  it('rejects new stars for missing/foreign sources but preserves legacy snapshots on toggles', async () => {
    const user = await register(), other = await register('foreign-p02@example.com'), lesson = await create(other), original = word();
    await mutate(other, '/update', { id: lesson.id, version: 0, words: [original] }).expect(200);
    await star(user, original).expect(404);
    await star(user, word()).expect(404);
    await star(other, original, { active: false }).expect(404);
    await mutate(other, '/delete', { id: lesson.id, version: 1 }).expect(200);
    await star(other, original).expect(404);
    const legacy = await api.db.reviewCard.create({ data: {
      userId: user.id, category: 'vocab', sourceId: 'custom:w-0', front: '古い', back: 'Bản lưu cũ', active: true,
    } });
    const paused = (await star(user, original, { sourceId: legacy.sourceId, active: false }).expect(200)).body.card;
    expect(paused).toMatchObject({ front: legacy.front, back: legacy.back, active: false });
    expect(await api.db.reviewCard.count()).toBe(1);
  });
});
