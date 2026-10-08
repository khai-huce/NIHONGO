import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { KANA_CATALOG_ID, KANA_COUNT, KANA_LIST } from '@nihongo/shared/study/kana-quiz';
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
const credentials = { email: 'kana-results@example.com', name: 'Học viên bảng chữ cái', password: 'a long kana test passphrase 123' };
let api: ReturnType<typeof createApp>;
type Learner = { id: string; sid: string };
type Mode = 'hiragana' | 'katakana' | 'both';
type Answer = { kanaId: string; script: 'hiragana' | 'katakana'; answerId: string };
const cookie = (response: request.Response) => (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
const latest = (user: Learner) => request(api.app).get('/api/kana/results').set('Cookie', user.sid);
const save = (user: Learner, body: Record<string, unknown>) => request(api.app).post('/api/kana/results')
  .set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({ expectedUserId: user.id, ...body });
const submission = (mode: Mode = 'hiragana') => ({
  id: randomUUID(), catalogId: KANA_CATALOG_ID, mode,
  answers: KANA_LIST.map((item, index): Answer => ({
    kanaId: item.id, script: mode === 'both' ? index < KANA_COUNT / 2 ? 'hiragana' : 'katakana' : mode, answerId: item.id,
  })),
});
async function register(email = credentials.email): Promise<Learner> {
  const response = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN)
    .send({ ...credentials, email }).expect(201);
  return { id: response.body.user.id, sid: cookie(response) };
}

beforeEach(async () => {
  api = createApp(config);
  await api.db.session.deleteMany();
  await api.db.user.deleteMany();
});
afterEach(async () => { vi.restoreAllMocks(); await api.close(); });

describe('P10 completed kana quiz results', () => {
  it('requires a live session, same origin and bounded JSON while retaining the auth body limit', async () => {
    await request(api.app).get('/api/kana/results').expect(401);
    await request(api.app).post('/api/kana/results').set('Origin', config.APP_ORIGIN).send({}).expect(401);
    const user = await register();
    await request(api.app).post('/api/kana/results').set('Cookie', user.sid).send({}).expect(403);
    await request(api.app).post('/api/kana/results').set('Cookie', user.sid).set('Origin', 'https://other.example').send({}).expect(403);
    await request(api.app).post('/api/kana/results').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).type('form').send({}).expect(415);
    await request(api.app).post('/api/kana/results').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
      .type('json').send('{"broken":').expect(400);
    await save(user, { ...submission(), padding: 'x'.repeat(32 * 1024) }).expect(413);
    await request(api.app).post('/api/auth/login').set('Origin', config.APP_ORIGIN).send({ padding: 'x'.repeat(17000) }).expect(413);
    await request(api.app).post('/api/auth/logout').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN).send({}).expect(204);
    await latest(user).expect(401);
    await save(user, submission()).expect(401);
    expect(await api.db.kanaQuizResult.count()).toBe(0);
  });

  it('validates strict envelopes and rejects incomplete answers and client-supplied scores', async () => {
    const user = await register(), body = submission();
    expect(KANA_COUNT).toBe(104);
    for (const invalid of [
      { id: 'bad' }, { catalogId: 'kana-v2' }, { mode: 'reading' },
      { score: 104 }, { correct: 104 }, { total: 104 }, { userId: user.id }, { completedAt: new Date().toISOString() },
      { answers: [] }, { answers: body.answers.slice(0, 103) }, { answers: [...body.answers, body.answers[0]] },
      { answers: body.answers.map((item, index) => index ? item : { ...item, correct: true }) },
      { answers: body.answers.map((item, index) => index ? item : { ...item, answerId: null }) },
      { answers: body.answers.map((item, index) => index ? item : { ...item, script: 'romaji' }) },
      { answers: body.answers.map((item, index) => index ? item : { ...item, kanaId: 'x'.repeat(33) }) },
      { answers: body.answers.map((item, index) => index ? item : { ...item, answerId: 'x'.repeat(33) }) },
    ]) await save(user, { ...body, ...invalid }).expect(400);
    await request(api.app).get('/api/kana/results').set('Cookie', user.sid).query({ userId: user.id }).expect(400);
    expect((await latest(user).expect(200)).body).toEqual({ userId: user.id, result: null });
    expect(await api.db.kanaQuizResult.count()).toBe(0);
  });

  it('requires all catalog IDs once, known answer IDs and the matching script distribution', async () => {
    const user = await register(), body = submission();
    for (const answers of [
      body.answers.map((item, index) => index ? item : body.answers[1]),
      body.answers.map((item, index) => index ? item : { ...item, kanaId: 'unknown-kana' }),
      body.answers.map((item, index) => index ? item : { ...item, answerId: 'unknown-answer' }),
      body.answers.map((item, index) => index ? item : { ...item, script: 'katakana' }),
    ]) {
      const response = await save(user, { ...body, answers }).expect(400);
      expect(response.body.error.code).toBe('INVALID_KANA_RESULT');
    }
    const both = submission('both');
    await save(user, { ...both, answers: both.answers.map((item, index) => index ? item : { ...item, script: 'katakana' }) }).expect(400);
    await save(user, { ...body, mode: 'katakana' }).expect(400);
    expect(await api.db.kanaQuizResult.count()).toBe(0);
  });

  it.each(['hiragana', 'katakana', 'both'] as const)('grades a completed %s round on the server', async mode => {
    const user = await register(), body = submission(mode);
    const incorrect = KANA_LIST.find(item => item.romaji !== KANA_LIST[0].romaji)!;
    body.answers[0] = { ...body.answers[0], answerId: incorrect.id };
    for (const [kanaId, answerId] of [['じ', 'ぢ'], ['ぢ', 'じ'], ['ず', 'づ'], ['づ', 'ず']]) {
      const index = body.answers.findIndex(item => item.kanaId === kanaId);
      body.answers[index] = { ...body.answers[index], answerId };
    }
    const saved = await save(user, body).expect(201);
    expect(saved.headers['cache-control']).toBe('no-store');
    expect(saved.body).toMatchObject({ userId: user.id, result: {
      id: body.id, catalogId: KANA_CATALOG_ID, mode, total: 104, correct: 103,
      answers: body.answers.map((item, index) => ({ ...item, correct: index !== 0 })),
    } });
    expect(saved.body.result).not.toHaveProperty('submissionHash');
    expect(saved.body.result).not.toHaveProperty('userId');
    expect(Number.isFinite(Date.parse(saved.body.result.completedAt))).toBe(true);
    expect((await latest(user).expect(200)).body.result).toEqual(saved.body.result);
  });

  it('isolates accounts and rejects a stale account page or a foreign saved UUID', async () => {
    const a = await register(), b = await register('other-kana@example.com'), body = submission();
    const result = (await save(a, body).expect(201)).body.result;
    expect((await latest(b).expect(200)).body).toEqual({ userId: b.id, result: null });
    const foreign = await save(b, body).expect(409);
    expect(foreign.body.error.code).toBe('RESULT_CONFLICT');
    const stale = await save(b, { ...body, expectedUserId: a.id }).expect(409);
    expect(stale.body.error.code).toBe('ACCOUNT_CHANGED');
    expect((await latest(a).expect(200)).body.result).toEqual(result);
    expect(await api.db.kanaQuizResult.count()).toBe(1);
  });

  it('loads the latest completed round across modes, restart and login without removing older results', async () => {
    const user = await register();
    expect((await latest(user).expect(200)).body.result).toBeNull();
    const first = (await save(user, submission()).expect(201)).body.result;
    await api.db.kanaQuizResult.update({ where: { id: first.id }, data: { completedAt: new Date('2026-01-01T00:00:00Z') } });
    const second = (await save(user, submission('katakana')).expect(201)).body.result;
    await api.close();
    api = createApp(config);
    const login = await request(api.app).post('/api/auth/login').set('Origin', config.APP_ORIGIN)
      .send({ email: credentials.email, password: credentials.password }).expect(200);
    expect((await latest({ ...user, sid: cookie(login) }).expect(200)).body.result).toEqual(second);
    expect(await api.db.kanaQuizResult.count({ where: { userId: user.id } })).toBe(2);
    expect(await api.db.kanaQuizResult.findUnique({ where: { id: first.id } })).not.toBeNull();
  });

  it('retries an identical completed round and rejects reordered or changed same-ID payloads', async () => {
    const user = await register(), body = submission();
    const original = (await save(user, body).expect(201)).body.result;
    expect((await save(user, body).expect(200)).body.result).toEqual(original);
    const changedAnswer = body.answers.map((item, index) => index ? item : { ...item, answerId: body.answers[1].kanaId });
    for (const change of [
      { answers: [...body.answers].reverse() }, { answers: changedAnswer },
      { mode: 'katakana', answers: body.answers.map(item => ({ ...item, script: 'katakana' })) },
    ]) {
      const response = await save(user, { ...body, ...change }).expect(409);
      expect(response.body.error.code).toBe('RESULT_CONFLICT');
    }
    expect((await latest(user)).body.result).toEqual(original);
    expect(await api.db.kanaQuizResult.count()).toBe(1);
  });

  it('handles concurrent identical, conflicting and cross-account submissions exactly once', async () => {
    const user = await register(), body = submission();
    const repeated = await Promise.all([save(user, body), save(user, body)]);
    expect(repeated.map(item => item.status).sort()).toEqual([200, 201]);
    expect(repeated[0].body.result).toEqual(repeated[1].body.result);
    const next = submission();
    const competing = await Promise.all([save(user, next), save(user, { ...next, answers: [...next.answers].reverse() })]);
    expect(competing.map(item => item.status).sort()).toEqual([201, 409]);
    const other = await register('concurrent-kana@example.com'), sameId = submission('both');
    const crossOwner = await Promise.all([save(user, sameId), save(other, sameId)]);
    expect(crossOwner.map(item => item.status).sort()).toEqual([201, 409]);
    expect(await api.db.kanaQuizResult.count()).toBe(3);
  });

  it('does not create or change stars, review history, Kanji progress or roadmaps', async () => {
    const user = await register();
    const card = await api.db.reviewCard.create({ data: { userId: user.id, category: 'kanji', sourceId: 'kana-test-preserved', front: '日', back: 'Ngày' } });
    await request(api.app).post('/api/review/rate').set('Cookie', user.sid).set('Origin', config.APP_ORIGIN)
      .send({ expectedUserId: user.id, id: card.id, version: card.version, rating: 'good', elapsedMs: 2000 }).expect(200);
    const progress = await api.db.kanjiProgress.create({ data: { userId: user.id, kanjiId: 'kana-test', memorized: true } });
    const cards = await api.db.reviewCard.findMany(), events = await api.db.reviewEvent.findMany();
    await save(user, submission()).expect(201);
    expect(await api.db.reviewCard.findMany()).toEqual(cards);
    expect(await api.db.reviewEvent.findMany()).toEqual(events);
    expect(await api.db.kanjiProgress.findMany()).toEqual([progress]);
    expect(await api.db.personalRoadmap.count()).toBe(0);
    expect(await api.db.defaultRoadmapProgress.count()).toBe(0);
    expect(await api.db.vocabProgress.count()).toBe(0);
  });

  it('rolls back failed writes and retries the same round after recovery', async () => {
    const user = await register(), body = submission();
    const realTransaction = api.db.$transaction.bind(api.db);
    type Callback = (tx: Prisma.TransactionClient) => Promise<unknown>;
    vi.spyOn(api.db, '$transaction').mockImplementationOnce(((callback: Callback) => realTransaction(async tx => {
      await callback(tx);
      throw new Error('private simulated kana write failure');
    })) as unknown as typeof api.db.$transaction);
    const failure = await save(user, body).expect(503);
    expect(JSON.stringify(failure.body)).not.toContain('private simulated');
    vi.restoreAllMocks();
    await api.close();
    api = createApp(config);
    expect(await api.db.kanaQuizResult.count()).toBe(0);
    expect((await latest(user).expect(200)).body.result).toBeNull();
    const saved = (await save(user, body).expect(201)).body.result;
    expect(saved.correct).toBe(104);
    expect((await save(user, body).expect(200)).body.result).toEqual(saved);
    expect(await api.db.kanaQuizResult.count()).toBe(1);
  });
});
