import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1))) {
  throw new Error('Refusing to clean a non-test database.');
}
const config: Config = {
  NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
};
const credentials = { email: 'vocab-results@example.com', name: 'Học viên', password: 'a long test passphrase 123' };
let api: ReturnType<typeof createApp>;
type Learner = { id: string; sid: string };
type Kind = 'quiz' | 'cram';
type Mode = 'reading' | 'kanji' | 'meaning' | 'hanViet';
const word = () => ({ id: randomUUID(), word: '学校', reading: 'がっこう', hanViet: 'HỌC HIỆU', meaning: 'Trường học' });
type Word = ReturnType<typeof word>;
type Lesson = { id: string; name: string; version: number; words: Word[] };
type Submission = { id: string; lessonId: string; lessonVersion: number; kind: Kind; mode: Mode;
  answers: { wordId: string; answer: string | null }[] };
const cookie = (response: request.Response) => (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
const get = (user: Learner, lessonId: string, kind: Kind = 'quiz') => request(api.app).get('/api/vocab/results')
  .query({ lessonId, kind }).set('Cookie', user.sid);
const byId = (user: Learner, id: string) => request(api.app).get(`/api/vocab/results/${id}`).set('Cookie', user.sid);
const lessonWrite = (user: Learner, path: string, body: Record<string, unknown>) => request(api.app)
  .post(`/api/vocab/lessons${path}`).set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({ expectedUserId: user.id, ...body });
const save = (user: Learner, body: Record<string, unknown>) => request(api.app).post('/api/vocab/results')
  .set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({ expectedUserId: user.id, ...body });
const submission = (lesson: Lesson, changes: Partial<Submission> = {}): Submission => ({
  id: randomUUID(), lessonId: lesson.id, lessonVersion: lesson.version, kind: 'quiz', mode: 'reading',
  answers: lesson.words.map(item => ({ wordId: item.id, answer: item.reading })), ...changes,
});
async function register(email = credentials.email): Promise<Learner> {
  const response = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN)
    .send({ ...credentials, email }).expect(201);
  return { id: response.body.user.id, sid: cookie(response) };
}
async function create(user: Learner, words = [word(), word()]): Promise<Lesson> {
  const id = randomUUID();
  const created = await lessonWrite(user, '', { id, name: 'Bài tự nhập' }).expect(201);
  if (!words.length) return created.body.lesson;
  return (await lessonWrite(user, '/update', { id, version: 0, words }).expect(200)).body.lesson;
}

beforeEach(async () => {
  api = createApp(config);
  await api.db.session.deleteMany();
  await api.db.user.deleteMany();
});
afterEach(async () => { vi.restoreAllMocks(); await api.close(); });

describe('P05 completed vocabulary study results', () => {
  it('requires a live session, same origin and bounded JSON, without changing auth limits', async () => {
    await request(api.app).get('/api/vocab/results').expect(401);
    await request(api.app).post('/api/vocab/results').set('Origin', config.APP_ORIGIN).send({}).expect(401);
    const user = await register();
    await request(api.app).post('/api/vocab/results').set('Cookie', user.sid).send({}).expect(403);
    await request(api.app).post('/api/vocab/results').set('Cookie', user.sid).set('Origin', 'https://other.example').send({}).expect(403);
    await request(api.app).post('/api/vocab/results').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).type('form').send({}).expect(415);
    await save(user, { padding: 'x'.repeat(525000) }).expect(413);
    await request(api.app).post('/api/auth/login').set('Origin', config.APP_ORIGIN).send({ padding: 'x'.repeat(17000) }).expect(413);
    await request(api.app).post('/api/auth/logout').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({}).expect(204);
    await byId(user, randomUUID()).expect(401);
    expect(await api.db.vocabStudyResult.count()).toBe(0);
  });

  it('validates envelopes, IDs, modes, answer limits and rejects client-supplied scores', async () => {
    const user = await register(), lesson = await create(user), body = submission(lesson);
    for (const invalid of [
      { id: 'bad' }, { lessonId: 'bad' }, { lessonVersion: -1 }, { lessonVersion: 0.5 },
      { kind: 'other' }, { kind: 'quiz', mode: 'hanViet' }, { kind: 'cram', mode: 'meaning' },
      { score: 100 }, { correct: 2 }, { userId: user.id },
      { answers: [] }, { answers: Array.from({ length: 501 }, () => ({ wordId: randomUUID(), answer: 'a' })) },
      { answers: [{ wordId: lesson.words[0].id, answer: 'x'.repeat(501) }] },
      { answers: [{ wordId: lesson.words[0].id, answer: 1 }] },
      { answers: [{ wordId: lesson.words[0].id, answer: 'がっこう', correct: true }] },
      { answers: [{ wordId: 'bad', answer: null }] },
    ]) await save(user, { ...body, ...invalid }).expect(400);
    await request(api.app).get('/api/vocab/results').set('Cookie', user.sid).query({ lessonId: lesson.id }).expect(400);
    await request(api.app).get('/api/vocab/results').set('Cookie', user.sid).query({ lessonId: lesson.id, kind: 'quiz', userId: user.id }).expect(400);
    await byId(user, 'bad').expect(400);
    expect(await api.db.vocabStudyResult.count()).toBe(0);
  });

  it('isolates accounts, source lessons and saved IDs including stale-account retries', async () => {
    const a = await register(), b = await register('other-results@example.com'), lesson = await create(a);
    const body = submission(lesson);
    await get(b, lesson.id).expect(404);
    await save(b, body).expect(404);
    const result = (await save(a, body).expect(201)).body.result;
    await byId(b, result.id).expect(404);
    await save(b, body).expect(409);
    const changed = await save(b, { ...body, expectedUserId: a.id }).expect(409);
    expect(changed.body.error.code).toBe('ACCOUNT_CHANGED');
    await get(a, randomUUID()).expect(404);
    await byId(a, randomUUID()).expect(404);
    expect((await get(b, (await create(b)).id).expect(200)).body.result).toBeNull();
    expect(await api.db.vocabStudyResult.count()).toBe(1);
  });

  it.each([
    { kind: 'quiz', mode: 'reading', answer: 'がっこう' },
    { kind: 'quiz', mode: 'kanji', answer: '学校' },
    { kind: 'quiz', mode: 'meaning', answer: '学校' },
    { kind: 'cram', mode: 'reading', answer: 'gakkou' },
    { kind: 'cram', mode: 'hanViet', answer: 'hoc hieu' },
  ] as const)('grades $kind / $mode on the server and counts a null answer as wrong', async ({ kind, mode, answer }) => {
    const user = await register(), lesson = await create(user);
    const body = submission(lesson, { kind, mode, answers: [
      { wordId: lesson.words[0].id, answer }, { wordId: lesson.words[1].id, answer: null },
    ] });
    const saved = await save(user, body).expect(201);
    expect(saved.headers['cache-control']).toBe('no-store');
    expect(saved.body.userId).toBe(user.id);
    expect(saved.body.result).toMatchObject({ id: body.id, lessonId: lesson.id, lessonName: lesson.name,
      lessonVersion: lesson.version, kind, mode, total: 2, correct: 1,
      answers: [{ wordId: lesson.words[0].id, answer, correct: true }, { wordId: lesson.words[1].id, answer: null, correct: false }],
    });
    expect(saved.body.result).not.toHaveProperty('submissionHash');
    expect(saved.body.result).not.toHaveProperty('userId');
    expect(Number.isFinite(Date.parse(saved.body.result.completedAt))).toBe(true);
  });

  it('excludes missing mode fields, rejects empty eligibility and requires every eligible word exactly once', async () => {
    const user = await register(), complete = word(), missing = { ...word(), reading: '', hanViet: '' };
    const lesson = await create(user, [complete, missing]);
    for (const mode of ['reading', 'kanji'] as const) {
      const body = submission(lesson, { mode, answers: [{ wordId: complete.id, answer: mode === 'reading' ? complete.reading : complete.word }] });
      await save(user, { ...body, answers: [...body.answers, { wordId: missing.id, answer: missing.word }] }).expect(400);
      const saved = (await save(user, body).expect(201)).body.result;
      expect(saved.total).toBe(1);
      expect(saved.correct).toBe(1);
    }
    const body = submission(lesson, { mode: 'meaning', answers: [{ wordId: complete.id, answer: complete.word }] });
    await save(user, body).expect(400);
    await save(user, { ...body, answers: [body.answers[0], body.answers[0]] }).expect(400);
    await save(user, { ...body, answers: [...body.answers, { wordId: randomUUID(), answer: 'other' }] }).expect(400);
    const noTargets = await create(user, [{ ...missing, id: randomUUID() }]);
    const absent = await save(user, submission(noTargets, { kind: 'cram', mode: 'hanViet', answers: [{ wordId: noTargets.words[0].id, answer: '/' }] })).expect(400);
    expect(absent.body.error.code).toBe('NO_ELIGIBLE_WORDS');
    expect(await api.db.vocabStudyResult.count()).toBe(2);
  });

  it('loads only the latest completed round of the chosen lesson/kind across restart and login', async () => {
    const user = await register(), lesson = await create(user), other = await create(user);
    expect((await get(user, lesson.id).expect(200)).body).toEqual({ userId: user.id, lesson, result: null });
    expect(await api.db.vocabStudyResult.count()).toBe(0);
    const first = (await save(user, submission(lesson)).expect(201)).body.result;
    const second = (await save(user, submission(lesson, { answers: lesson.words.map(item => ({ wordId: item.id, answer: null })) })).expect(201)).body.result;
    const cram = (await save(user, submission(lesson, { kind: 'cram' })).expect(201)).body.result;
    await save(user, submission(other)).expect(201);
    await api.close();
    api = createApp(config);
    const login = await request(api.app).post('/api/auth/login').set('Origin', config.APP_ORIGIN)
      .send({ email: credentials.email, password: credentials.password }).expect(200);
    const again = { ...user, sid: cookie(login) };
    expect((await get(again, lesson.id).expect(200)).body.result).toEqual(second);
    expect((await get(again, lesson.id, 'cram').expect(200)).body.result).toEqual(cram);
    expect((await byId(again, first.id).expect(200)).body.result).toEqual(first);
    expect(await api.db.vocabStudyResult.count()).toBe(4);
  });

  it('rejects stale unsaved rounds but safely retries an already saved round after source edits and deletion', async () => {
    const user = await register(), lesson = await create(user), body = submission(lesson);
    const first = (await save(user, body).expect(201)).body.result;
    const edited = (await lessonWrite(user, '/update', { id: lesson.id, version: lesson.version,
      name: 'Bài đã sửa', words: lesson.words.map(item => ({ ...item, reading: 'だいがく', word: '大学' })) }).expect(200)).body.lesson;
    const stale = await save(user, { ...body, id: randomUUID() }).expect(409);
    expect(stale.body.error.code).toBe('LESSON_CHANGED');
    expect((await save(user, body).expect(200)).body.result).toEqual(first);
    await lessonWrite(user, '/delete', { id: edited.id, version: edited.version }).expect(200);
    expect((await save(user, body).expect(200)).body.result).toEqual(first);
    expect((await byId(user, body.id).expect(200)).body.result).toEqual(first);
    await get(user, lesson.id).expect(404);
    await save(user, { ...body, id: randomUUID() }).expect(404);
    expect(await api.db.vocabStudyResult.count()).toBe(1);
  });

  it('makes same-ID retries idempotent and rejects conflicting payloads without overwriting history', async () => {
    const user = await register(), lesson = await create(user), body = submission(lesson);
    const original = (await save(user, body).expect(201)).body.result;
    expect((await save(user, { ...body, answers: [...body.answers].reverse() }).expect(200)).body.result).toEqual(original);
    for (const change of [
      { mode: 'kanji' }, { lessonVersion: lesson.version + 1 }, { kind: 'cram' },
      { answers: body.answers.map(item => ({ ...item, answer: null })) },
    ]) {
      const response = await save(user, { ...body, ...change }).expect(409);
      expect(response.body.error.code).toBe('RESULT_CONFLICT');
    }
    expect((await byId(user, body.id).expect(200)).body.result).toEqual(original);
    expect(await api.db.vocabStudyResult.count()).toBe(1);
  });

  it('serializes repeated saves and competing payloads, including the same UUID across accounts', async () => {
    const user = await register(), lesson = await create(user), body = submission(lesson);
    const repeated = await Promise.all([save(user, body), save(user, body)]);
    expect(repeated.map(item => item.status).sort()).toEqual([200, 201]);
    expect(repeated[0].body.result).toEqual(repeated[1].body.result);
    const next = submission(lesson);
    const competing = await Promise.all([save(user, next), save(user, { ...next, answers: next.answers.map(item => ({ ...item, answer: null })) })]);
    expect(competing.map(item => item.status).sort()).toEqual([201, 409]);
    const other = await register('concurrent-results@example.com'), otherLesson = await create(other), id = randomUUID();
    const crossOwner = await Promise.all([save(user, submission(lesson, { id })), save(other, submission(otherLesson, { id }))]);
    expect(crossOwner.map(item => item.status).sort()).toEqual([201, 409]);
    expect(await api.db.vocabStudyResult.count()).toBe(3);
  });

  it('accepts completed payloads over16KB while preserving progress, SRS cards and history', async () => {
    const user = await register(), words = Array.from({ length: 40 }, () => word()), lesson = await create(user, words);
    const progress = await api.db.vocabProgress.create({ data: { userId: user.id, lessonId: lesson.id, wordId: words[0].id, memorized: true } });
    const star = await request(api.app).post('/api/review/star').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
      .send({ expectedUserId: user.id, category: 'vocab', sourceId: `custom:${words[0].id}`,
        front: words[0].word, back: words[0].meaning, reading: words[0].reading, active: true }).expect(200);
    await request(api.app).post('/api/review/rate').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
      .send({ expectedUserId: user.id, id: star.body.card.id, version: star.body.card.version, rating: 'good', elapsedMs: 1500 }).expect(200);
    const cards = await api.db.reviewCard.findMany(), events = await api.db.reviewEvent.findMany();
    const result = await save(user, submission(lesson, { answers: words.map(item => ({ wordId: item.id, answer: 'x'.repeat(500) })) })).expect(201);
    expect(result.body.result.total).toBe(40);
    expect(result.body.result.correct).toBe(0);
    expect(await api.db.vocabProgress.findMany()).toEqual([progress]);
    expect(await api.db.reviewCard.findMany()).toEqual(cards);
    expect(await api.db.reviewEvent.findMany()).toEqual(events);
    expect(await api.db.kanjiProgress.count()).toBe(0);
    expect((await get(user, lesson.id).expect(200)).body.lesson).toEqual(lesson);
  });

  it('rolls back failed writes and safely retries the same completed round', async () => {
    const user = await register(), lesson = await create(user), body = submission(lesson);
    const realTransaction = api.db.$transaction.bind(api.db);
    type Callback = (tx: Prisma.TransactionClient) => Promise<unknown>;
    vi.spyOn(api.db, '$transaction').mockImplementationOnce(((callback: Callback) => realTransaction(async tx => {
      await callback(tx);
      throw new Error('private simulated failure after result creation');
    })) as unknown as typeof api.db.$transaction);
    const failure = await save(user, body).expect(503);
    expect(JSON.stringify(failure.body)).not.toContain('private simulated');
    vi.restoreAllMocks();
    await api.close();
    api = createApp(config);
    expect(await api.db.vocabStudyResult.count()).toBe(0);
    const saved = (await save(user, body).expect(201)).body.result;
    expect(saved.correct).toBe(2);
    expect((await save(user, body).expect(200)).body.result).toEqual(saved);
    expect(await api.db.vocabStudyResult.count()).toBe(1);
  });
});
