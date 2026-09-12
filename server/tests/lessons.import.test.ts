import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import * as vocabReview from '../src/vocab-review.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1))) throw new Error('Refusing to clean a non-test database.');
const config: Config = {
  NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
};
const credentials = { email: 'import-test@example.com', name: 'Học viên nhập từ', password: 'a long import test passphrase 123' };
let api: ReturnType<typeof createApp>;
type Learner = { id: string; sid: string };
const word = (meaning = 'Trường học') => ({ id: randomUUID(), word: '学校', reading: 'がっこう', hanViet: 'HỌC HIỆU', meaning });
type Word = ReturnType<typeof word>;
type Lesson = { id: string; name: string; words: Word[]; version: number };
const cookie = (response: request.Response) => (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
const mutate = (user: Learner, path: string, body: Record<string, unknown>) => request(api.app)
  .post(`/api/vocab/lessons${path}`).set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
  .send({ expectedUserId: user.id, ...body });
const list = (user: Learner) => request(api.app).get('/api/vocab/lessons').set('Cookie', user.sid);
const upload = (user: Learner, lesson: Lesson, words: Word[], overrides: Record<string, unknown> = {}) =>
  mutate(user, '/import', { id: lesson.id, version: lesson.version, words, ...overrides });
async function register(email = credentials.email): Promise<Learner> {
  const response = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN).send({ ...credentials, email }).expect(201);
  return { id: response.body.user.id, sid: cookie(response) };
}
async function create(user: Learner): Promise<Lesson> {
  return (await mutate(user, '', { id: randomUUID(), name: 'Bài nhập' }).expect(201)).body.lesson;
}
async function seed(user: Learner, lesson: Lesson, words: Word[]): Promise<Lesson> {
  return (await mutate(user, '/update', { id: lesson.id, version: lesson.version, words }).expect(200)).body.lesson;
}

beforeEach(async () => {
  api = createApp(config);
  await api.db.session.deleteMany();
  await api.db.user.deleteMany();
});
afterEach(async () => { vi.restoreAllMocks(); await api.close(); });

describe('P03 atomic vocabulary import', () => {
  it('requires a live account, same origin and JSON before accepting a batch', async () => {
    await request(api.app).post('/api/vocab/lessons/import').set('Origin', config.APP_ORIGIN).send({}).expect(401);
    const user = await register(), lesson = await create(user);
    const body = { id: lesson.id, version: 0, expectedUserId: user.id, words: [word()] };
    await request(api.app).post('/api/vocab/lessons/import').set('Cookie', user.sid).send(body).expect(403);
    await request(api.app).post('/api/vocab/lessons/import').set('Cookie', user.sid).set('Origin', 'https://other.example').send(body).expect(403);
    await request(api.app).post('/api/vocab/lessons/import').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).type('form').send({}).expect(415);
    await request(api.app).post('/api/auth/logout').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({}).expect(204);
    await upload(user, lesson, [word()]).expect(401);
    expect((await api.db.vocabLesson.findUniqueOrThrow({ where: { id: lesson.id } })).words).toEqual([]);
  });

  it('appends a validated batch, trims all fields and persists it into another login without creating stars', async () => {
    const user = await register(), lesson = await create(user), original = word();
    const spaced = { ...original, word: ` ${original.word} `, reading: ` ${original.reading} `, hanViet: ` ${original.hanViet} `, meaning: ` ${original.meaning} ` };
    const response = await upload(user, lesson, [spaced]).expect(200);
    expect(response.body).toEqual({ userId: user.id, lesson: { ...lesson, words: [original], version: 1 }, importedCount: 1, duplicateCount: 0 });
    expect(response.headers['cache-control']).toBe('no-store');
    await api.close();
    api = createApp(config);
    const login = await request(api.app).post('/api/auth/login').set('Origin', config.APP_ORIGIN)
      .send({ email: credentials.email, password: credentials.password }).expect(200);
    expect((await list({ ...user, sid: cookie(login) }).expect(200)).body.lessons).toEqual([response.body.lesson]);
    expect(await api.db.reviewCard.count()).toBe(0);
    expect(await api.db.reviewEvent.count()).toBe(0);
  });

  it('deduplicates only exact four-field content against saved words and earlier batch rows', async () => {
    const user = await register(), empty = await create(user);
    const old = { ...word(), reading: ' がっこう ', hanViet: ' HỌC HIỆU ' };
    const lesson = await seed(user, empty, [old]);
    const otherMeaning = word('Nhà trường'), otherReading = { ...word(), reading: 'がくこう' };
    const otherHanViet = { ...word(), hanViet: 'Học hiệu' }, otherWord = { ...word(), word: '学園' };
    const response = await upload(user, lesson, [word(), otherMeaning, { ...otherMeaning, id: randomUUID() }, otherReading, otherHanViet, otherWord]).expect(200);
    expect(response.body).toMatchObject({ importedCount: 4, duplicateCount: 2 });
    expect(response.body.lesson.words).toEqual([old, otherMeaning, otherReading, otherHanViet, otherWord]);
    expect(response.body.lesson.version).toBe(2);
  });

  it('rejects an invalid row or envelope without saving any of the valid rows', async () => {
    const user = await register(), lesson = await create(user), valid = word();
    const invalidWords: unknown[] = [
      [], [valid, { ...word(), meaning: ' ' }], [valid, { ...word(), word: '' }], [valid, { ...word(), reading: 123 }],
      [valid, { ...word(), id: 'legacy-1' }], [valid, { ...word(), meaning: 'x'.repeat(2001) }],
      [valid, { ...word(), word: 'x'.repeat(501) }], [valid, { ...word(), reading: 'x'.repeat(501) }],
      [valid, { ...word(), hanViet: 'x'.repeat(201) }], [valid, { ...word(), starred: true }],
      [valid, valid], Array.from({ length: 501 }, () => word()),
    ];
    for (const words of invalidWords) await mutate(user, '/import', { id: lesson.id, version: 0, words }).expect(400);
    await upload(user, lesson, [valid], { version: -1 }).expect(400);
    await upload(user, lesson, [valid], { replace: true }).expect(400);
    await upload(user, lesson, [valid], { userId: user.id }).expect(400);
    expect((await list(user)).body.lessons).toEqual([lesson]);
  });

  it('isolates owners and rejects a request made by a previous account page', async () => {
    const a = await register(), b = await register('other-import@example.com'), lesson = await create(a);
    const response = await upload(b, lesson, [word()]).expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    await upload(b, lesson, [word()], { expectedUserId: a.id }).expect(409);
    await upload(a, lesson, [word()], { id: randomUUID() }).expect(404);
    expect((await list(a)).body.lessons).toEqual([lesson]);
    expect((await list(b)).body.lessons).toEqual([]);
  });

  it('serializes simultaneous identical imports and retries a lost response without duplication', async () => {
    const user = await register(), lesson = await create(user), words = [word(), word('Nhà trường')];
    const responses = await Promise.all([upload(user, lesson, words), upload(user, lesson, words)]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(responses.map(response => response.body.importedCount).sort()).toEqual([0, 2]);
    const retry = await upload(user, lesson, words).expect(200);
    expect(retry.body).toEqual({ userId: user.id, lesson: { ...lesson, words, version: 1 }, importedCount: 0, duplicateCount: 2 });
    const pastedAgain = await upload(user, lesson, words.map(item => ({ ...item, id: randomUUID() }))).expect(200);
    expect(pastedAgain.body.lesson).toEqual(retry.body.lesson);
    expect(pastedAgain.body.importedCount).toBe(0);
  });

  it('rejects competing different batches and stale mixed batches while allowing an all-duplicate read', async () => {
    const user = await register(), lesson = await create(user), a = word(), b = word('Nghĩa khác');
    const responses = await Promise.all([upload(user, lesson, [a]), upload(user, lesson, [b])]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const winner: Lesson = responses.find(response => response.status === 200)!.body.lesson;
    const stale = await upload(user, lesson, [...winner.words, word('Thêm mới')]).expect(409);
    expect(stale.body.error.code).toBe('LESSON_CHANGED');
    const renamed = (await mutate(user, '/update', { id: lesson.id, version: 1, name: 'Tên mới' }).expect(200)).body.lesson;
    const duplicate = await upload(user, lesson, winner.words).expect(200);
    expect(duplicate.body).toEqual({ userId: user.id, lesson: renamed, importedCount: 0, duplicateCount: 1 });
    expect((await list(user)).body.lessons).toEqual([renamed]);
  });

  it('enforces the final lesson capacity after deduplication without partial writes', async () => {
    const user = await register(), empty = await create(user);
    const words = Array.from({ length: 499 }, (_, i) => word(`Nghĩa ${i}`));
    const lesson = await seed(user, empty, words);
    const one = word('Nghĩa 499');
    const full: Lesson = (await upload(user, lesson, [{ ...words[0], id: randomUUID() }, one]).expect(200)).body.lesson;
    expect(full.words).toHaveLength(500);
    const response = await upload(user, full, [word('Nghĩa 500'), word('Nghĩa 501')]).expect(400);
    expect(response.body.error.code).toBe('LESSON_LIMIT');
    expect((await list(user)).body.lessons).toEqual([full]);
    await upload(user, full, [{ ...one, id: randomUUID() }]).expect(200);
  });

  it('rejects IDs occupied in this lesson, another lesson or a retained review card', async () => {
    const user = await register(), empty = await create(user), original = word();
    const lesson = await seed(user, empty, [original]), otherLesson = await create(user);
    const other = word('Nghĩa bài khác');
    await seed(user, otherLesson, [other]);
    const orphanId = randomUUID();
    await api.db.reviewCard.create({ data: { userId: user.id, category: 'vocab', sourceId: `custom:${orphanId}`, front: '昔', back: 'Ngày xưa' } });
    const before = (await list(user)).body.lessons, cards = await api.db.reviewCard.findMany();
    for (const occupied of [{ ...original, meaning: 'Đổi nghĩa trái phép' }, other, { ...word('Thẻ đã xóa nguồn'), id: orphanId }]) {
      const response = await upload(user, lesson, [word('Một từ hợp lệ'), occupied]).expect(409);
      expect(response.body.error.code).toBe('WORD_ID_EXISTS');
      expect((await list(user)).body.lessons).toEqual(before);
    }
    expect(await api.db.reviewCard.findMany()).toEqual(cards);
  });

  it('leaves existing review content, schedules and history untouched on import and rollback', async () => {
    const user = await register(), empty = await create(user), original = word();
    const lesson = await seed(user, empty, [original]);
    const starred = await request(api.app).post('/api/review/star').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
      .send({ expectedUserId: user.id, category: 'vocab', sourceId: `custom:${original.id}`, front: original.word, back: original.meaning, reading: original.reading, active: true }).expect(200);
    await request(api.app).post('/api/review/rate').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
      .send({ expectedUserId: user.id, id: starred.body.card.id, version: starred.body.card.version, rating: 'good', elapsedMs: 2000 }).expect(200);
    const cards = await api.db.reviewCard.findMany(), events = await api.db.reviewEvent.findMany();
    const addition = word('Từ được nhập');
    const realSync = vocabReview.syncLessonReview;
    vi.spyOn(vocabReview, 'syncLessonReview').mockImplementationOnce(async (...args) => {
      await realSync(...args);
      throw new Error('simulated failure after lesson write');
    });
    const failed = await upload(user, lesson, [addition]).expect(503);
    expect(JSON.stringify(failed.body)).not.toContain('simulated failure');
    expect((await list(user)).body.lessons).toEqual([lesson]);
    expect(await api.db.reviewCard.findMany()).toEqual(cards);
    expect(await api.db.reviewEvent.findMany()).toEqual(events);
    vi.restoreAllMocks();
    const saved = await upload(user, lesson, [addition]).expect(200);
    expect(saved.body.lesson.words).toEqual([original, addition]);
    expect(await api.db.reviewCard.findMany()).toEqual(cards);
    expect(await api.db.reviewEvent.findMany()).toEqual(events);
  });

  it('keeps the bounded request body limit for import', async () => {
    const user = await register(), lesson = await create(user);
    const words = Array.from({ length: 30 }, (_, i) => word(`${i}${'x'.repeat(1000)}`));
    const saved = await upload(user, lesson, words).expect(200);
    await upload(user, saved.body.lesson, [word()], { padding: 'x'.repeat(512 * 1024) }).expect(413);
    expect((await list(user)).body.lessons).toEqual([saved.body.lesson]);
  });
});
