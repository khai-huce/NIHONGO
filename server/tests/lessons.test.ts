import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';

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

  it('does not auto-star content or remove independent review cards/history when lessons are edited/deleted', async () => {
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
    expect(await api.db.reviewCard.findMany()).toEqual(beforeCards);
    expect(await api.db.reviewEvent.findMany()).toEqual(beforeEvents);
  });
});
