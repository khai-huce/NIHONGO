import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';
import { parseVocabAiInput, validateVocabAiResult } from '../src/modules/vocabulary/vocab-ai.js';
import { assertGeminiQuota, lockGeminiQuota } from '../src/integrations/gemini-quota.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw new Error('Refusing non-test database');
const config: Config = { NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', ADMIN_ORIGIN: 'http://localhost:3002', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: '', GEMINI_API_KEY: 'a02-fake-key', GEMINI_MODEL: 'gemini-test' };
const endpoint = '/api/vocab/ai-format';
const text = '学校 | trường học\n犬 | chó';
const rows = [
  { word: '学校', reading: 'がっこう', hanViet: 'HỌC HIỆU', meaning: 'trường học', sourceText: '学校 | trường học', generatedFields: ['reading', 'hanViet'] },
  { word: '犬', reading: 'いぬ', hanViet: 'KHUYỂN', meaning: 'chó', sourceText: '犬 | chó', generatedFields: ['reading', 'hanViet'] },
];
const output = () => ({ rows: structuredClone(rows), warnings: [] });
const payload = (value = text) => ({ id: randomUUID(), expectedUserId: randomUUID(), lessonId: randomUUID(), text: value });
const response = (value: unknown) => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] }), { status: 200 });

describe('A02 validates source and generated fields', () => {
  it('rejects over 6000 characters, over 50 listed words, invalid JSON and conflicting aliases before a provider call', () => {
    for (const value of ['語'.repeat(6001), Array.from({ length: 51 }, () => '学校').join('\n'), '[{"word":"学校"', '[{"word":"学校","term":"犬"}]', 'English only']) {
      expect(() => parseVocabAiInput(payload(value))).toThrow();
    }
    expect(parseVocabAiInput(payload(' 学校 ')).text).toBe('学校');
  });
  it('keeps supplied fields verbatim and derives addition flags on the server', () => {
    const result = output(); result.rows[0].generatedFields = [];
    expect(validateVocabAiResult(result, text).rows[0].generatedFields).toEqual(['reading', 'hanViet']);
    result.rows[0].meaning = 'nhà trường';
    expect(() => validateVocabAiResult(result, text)).toThrow();
  });
  it('preserves JSON aliases, incorrect supplied readings, order and duplicate entries', () => {
    const input = '[{"kanji":"学校","kana":"さかな","definition":"giữ nghĩa này"},{"word":"学校"}]';
    const result = { rows: [
      { ...rows[0], reading: 'さかな', meaning: 'giữ nghĩa này', sourceText: input },
      { ...rows[0], sourceText: input },
    ], warnings: [] };
    const checked = validateVocabAiResult(result, input);
    expect(checked.rows[0].generatedFields).toEqual(['hanViet']);
    expect(checked.rows[1].generatedFields).toEqual(['reading', 'hanViet', 'meaning']);
    result.rows.reverse(); expect(() => validateVocabAiResult(result, input)).toThrow();
  });
  it('rejects invented terms, fabricated evidence, omitted rows, excessive output and silent changes', () => {
    for (const result of [
      { rows: [{ ...rows[0], word: '先生' }, rows[1]], warnings: [] },
      { rows: [{ ...rows[0], sourceText: '学校 trường học' }, rows[1]], warnings: [] },
      { rows: [rows[0]], warnings: [] },
      { rows: Array.from({ length: 51 }, () => rows[0]), warnings: [] },
      { rows: [{ ...rows[0], generatedFields: ['word'] }, rows[1]], warnings: [] },
    ]) expect(() => validateVocabAiResult(result, text)).toThrow();
  });
  it('free text requires original evidence or a generated mark and an explicit review warning', () => {
    const input = 'Từ cần học: 学校 (trường học).';
    const result = { rows: [{ ...rows[0], sourceText: input }], warnings: [] };
    expect(validateVocabAiResult(result, input).warnings[0]).toContain('Bản nhập tự do');
    result.rows[0].generatedFields = [];
    expect(() => validateVocabAiResult(result, input)).toThrow();
  });
  it('allows an uncertain meaning to remain blank for human correction instead of forcing invention', () => {
    const result = { rows: [{ word: '新語', reading: '', hanViet: '', meaning: '', sourceText: '新語', generatedFields: [] }], warnings: ['Chưa xác định nghĩa.'] };
    expect(validateVocabAiResult(result, '新語').rows[0].meaning).toBe('');
  });
});

type User = { id: string; cookie: string; lessonId: string };
let api: ReturnType<typeof createApp>, users: User[];
const post = (user: User | null, body: object, origin = config.APP_ORIGIN) => request(api.app).post(endpoint).set('Origin', origin).set('Cookie', user?.cookie ?? '').send({ expectedUserId: user?.id, lessonId: user?.lessonId, id: randomUUID(), text, ...body });
async function register(): Promise<User> {
  const res = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN).send({ name: 'A02 test', email: `a02-${randomUUID()}@example.test`, password: 'A02-test-password-12345' }).expect(201);
  const user = { id: res.body.user.id as string, cookie: (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0], lessonId: randomUUID() };
  users.push(user);
  await api.db.vocabLesson.create({ data: { id: user.lessonId, userId: user.id, name: 'Private lesson not sent to Gemini', words: [] } });
  return user;
}
async function configured(overrides: Partial<Config>) { await api.close(); api = createApp({ ...config, ...overrides }); }
function provider(value: unknown = output()) { const fn = vi.fn().mockImplementation(async () => response(value)); vi.stubGlobal('fetch', fn); return fn; }

describe('A02 account API, quota, cache and confirmed import', () => {
  beforeEach(() => { api = createApp(config); users = []; });
  afterEach(async () => {
    vi.unstubAllGlobals(); vi.restoreAllMocks();
    await api.db.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await api.close();
  });
  it('requires session, matching account, owned lesson and valid Origin without calling Gemini', async () => {
    const a = await register(), b = await register(), fetcher = provider();
    await post(null, { expectedUserId: a.id, lessonId: a.lessonId }).expect(401);
    await post(a, { expectedUserId: b.id }).expect(409);
    await post(a, { lessonId: b.lessonId }).expect(404);
    await post(a, {}, 'https://evil.invalid').expect(403);
    await post(a, { text: '語'.repeat(6001) }).expect(400);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await api.db.vocabAiRequest.count({ where: { userId: a.id } })).toBe(0);
  });
  it('sends only pasted text; generates preview without study writes; edited confirmation uses P03 dedup', async () => {
    const a = await register(), fetcher = provider();
    const res = await post(a, {}).expect(200);
    expect(res.body.cached).toBe(false); expect(res.body.userId).toBe(a.id);
    const sent = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(JSON.parse(sent.contents[0].parts[0].text)).toEqual({ text });
    expect(JSON.stringify(sent)).not.toContain(a.id); expect(JSON.stringify(sent)).not.toContain(a.lessonId);
    expect((await api.db.vocabLesson.findUniqueOrThrow({ where: { id: a.lessonId } })).words).toEqual([]);
    const words = res.body.result.rows.map((row: typeof rows[number]) => ({ id: randomUUID(), word: row.word, reading: row.reading, hanViet: row.hanViet, meaning: row.meaning }));
    words[0].meaning = 'Nghĩa đã sửa';
    const body = { id: a.lessonId, expectedUserId: a.id, version: 0, words: [...words, { ...words[0], id: randomUUID() }] };
    const save = () => request(api.app).post('/api/vocab/lessons/import').set('Origin', config.APP_ORIGIN).set('Cookie', a.cookie).send(body);
    expect((await save().expect(200)).body.importedCount).toBe(2);
    expect((await save().expect(200)).body.importedCount).toBe(0);
    const lesson = (await request(api.app).get('/api/vocab/lessons').set('Cookie', a.cookie).expect(200)).body.lessons[0];
    expect(lesson.words[0].meaning).toBe('Nghĩa đã sửa'); expect(lesson.words).toHaveLength(2);
    expect(await api.db.reviewCard.count({ where: { userId: a.id } })).toBe(0);
    expect(await api.db.xpEvent.count({ where: { userId: a.id } })).toBe(0);
    expect(await api.db.vocabProgress.count({ where: { userId: a.id } })).toBe(0);
  });
  it('keeps retry/cache private and binds cache-hit IDs without consuming quota', async () => {
    const a = await register(), b = await register(), fetcher = provider(), id = randomUUID(), cacheId = randomUUID();
    await post(a, { id }).expect(200);
    expect((await post(a, { id }).expect(200)).body.cached).toBe(true);
    expect((await post(a, { id: cacheId }).expect(200)).body.cached).toBe(true);
    expect(await api.db.vocabAiRequest.count({ where: { userId: a.id, providerCalled: true } })).toBe(1);
    await post(a, { id: cacheId, text: '犬' }).expect(409);
    await post(b, { id }).expect(409);
    await post(b, {}).expect(200); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('serializes concurrent requests for the same input', async () => {
    const a = await register(); let release!: (value: Response) => void; let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const fetcher = vi.fn(() => { entered(); return new Promise<Response>(resolve => { release = resolve; }); }); vi.stubGlobal('fetch', fetcher);
    const id = randomUUID(), first = post(a, { id }).then(result => result);
    await started;
    try {
      expect((await post(a, { id }).expect(409)).body.error.code).toBe('AI_BUSY');
      expect((await post(a, {}).expect(409)).body.error.code).toBe('AI_BUSY');
    } finally { release(response(output())); }
    expect((await first).status).toBe(200); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['logout', 'delete lesson'])('does not return a preview after %s during the provider call', async action => {
    const a = await register(); let release!: (value: Response) => void; let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    vi.stubGlobal('fetch', vi.fn(() => { entered(); return new Promise<Response>(resolve => { release = resolve; }); }));
    const first = post(a, {}).then(result => result); await started;
    try {
      if (action === 'logout') await request(api.app).post('/api/auth/logout').set('Origin', config.APP_ORIGIN).set('Cookie', a.cookie).send({}).expect(204);
      else await api.db.vocabLesson.delete({ where: { id: a.lessonId } });
    } finally { release(response(output())); }
    expect((await first).status).toBe(action === 'logout' ? 401 : 404);
  });
  it('counts failed provider calls, never caches malformed output and permits a manual new request', async () => {
    const a = await register(), bad = output(); bad.rows[0].meaning = 'Changed'; const fetcher = provider(bad), id = randomUUID();
    expect((await post(a, { id }).expect(502)).body.error.code).toBe('AI_INVALID_RESPONSE');
    expect((await api.db.vocabAiRequest.findUniqueOrThrow({ where: { id } })).status).toBe('failed');
    expect((await post(a, { id }).expect(503)).body.error.code).toBe('AI_RETRY_NEW');
    fetcher.mockImplementation(async () => response(output()));
    await post(a, {}).expect(200); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('uses the shared rolling quota in both directions and allows free cache retrieval', async () => {
    const a = await register(), fetcher = provider(); await configured({ GEMINI_DAILY_LIMIT: 1, GEMINI_GLOBAL_DAILY_LIMIT: 10000 });
    await post(a, {}).expect(200);
    await expect(api.db.$transaction(async tx => { await lockGeminiQuota(tx); await assertGeminiQuota(tx, { ...config, GEMINI_DAILY_LIMIT: 1 }, a.id); })).rejects.toMatchObject({ code: 'AI_QUOTA' });
    expect((await post(a, {}).expect(200)).body.cached).toBe(true);
    await post(a, { text: '犬' }).expect(429);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const b = await register(); await api.db.sentenceAnalysisRequest.create({ data: { id: randomUUID(), userId: b.id, requestHash: 'a'.repeat(64), model: 'gemini-test', status: 'failed' } });
    await post(b, {}).expect(429); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reports missing config and provider 429/503 errors without fabricated output or key exposure', async () => {
    const a = await register(); await configured({ GEMINI_API_KEY: undefined });
    await post(a, {}).expect(503); expect(await api.db.vocabAiRequest.count({ where: { userId: a.id } })).toBe(0);
    await configured({});
    for (const status of [429, 503]) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('provider secret details', { status })));
      const res = await post(a, {}).expect(status); expect(JSON.stringify(res.body)).not.toContain('provider secret details');
      expect(res.body.result).toBeUndefined();
    }
  });
});
