import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';
import { makeReadingContent, type ReadingContent } from '../src/modules/reading/reading-content.js';
import { readingAnalysisBase, validateReadingAnalysisResult, validateReadingAnalysisApply } from '../src/modules/reading/reading-analysis.schema.js';
import { assertGeminiQuota, lockGeminiQuota } from '../src/integrations/gemini-quota.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const dbUrl = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(dbUrl.hostname) || dbUrl.pathname !== '/nihongo_test') throw new Error('Refusing non-isolated database');
const config: Config = { NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', ADMIN_ORIGIN: 'http://localhost:3002', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'a04-test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: '', GEMINI_API_KEY: 'a04-fake-key', GEMINI_MODEL: 'gemini-test',
  GEMINI_GLOBAL_DAILY_LIMIT: 10000 };
const base = () => makeReadingContent({ title: 'Private title not sent', subtitle: 'Private subtitle not sent', text: '学校です。\n今日は休みです。',
  annotations: [{ sentenceId: 'p1-s1', translation: '  Bản dịch đã nhập.  ' }, { sentenceId: 'p2-s1',
    ruby: [{ text: '今日', reading: 'きょう' }, { text: 'は' }, { text: '休', reading: 'やす' }, { text: 'みです。' }] }],
  vocabList: [{ word: '学校', reading: 'がっこう', hanViet: 'HỌC HIỆU', meaning: 'Trường học' }],
  grammarList: [{ pattern: 'Nです', jlptLevel: 'N5', meaning: 'Là N', exampleJp: '学校です。', exampleVi: 'Là trường học.' }],
  quizList: [{ id: 1001, question: 'Đây là đâu?', options: ['Trường học', 'Nhà ga'], correctIndex: 0, explanation: '学校' }],
}, true);
const output = (content = base()) => ({ sentences: content.paragraphs.flatMap(p => p.sentences).map((sentence, index) => ({
  sentenceId: sentence.id, japanese: sentence.japanese, translation: sentence.translation?.trim() ? sentence.translation : 'Hôm nay được nghỉ.',
  ruby: sentence.ruby ?? (index === 0 ? [{ text: '学校', reading: 'がっこう' }, { text: 'です。' }] : [{ text: sentence.japanese }]),
})), warnings: [] as string[] });
const response = (value: unknown) => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] }), { status: 200 });

describe('A04 source-preserving validation', () => {
  it('derives missing fields and preserves already entered text/ruby verbatim', () => {
    const result = validateReadingAnalysisResult(output(), base());
    expect(result.sentences.map(row => row.generatedFields)).toEqual([['ruby'], ['translation']]);
    expect(result.sentences[0].translation).toBe('  Bản dịch đã nhập.  ');
    const changed = output(); changed.sentences[0].translation = 'Bản dịch mới';
    expect(() => validateReadingAnalysisResult(changed, base())).toThrow();
    const rubyChanged = output(); rubyChanged.sentences[1].ruby[0].reading = 'こんにち';
    expect(() => validateReadingAnalysisResult(rubyChanged, base())).toThrow();
  });
  it('rejects omitted/extra/duplicate/reordered sentences and altered Japanese or ruby joins', () => {
    const variants = [output(), output(), output(), output(), output(), output()];
    variants[0].sentences.pop(); variants[1].sentences.push(variants[1].sentences[0]); variants[2].sentences[1] = variants[2].sentences[0];
    variants[3].sentences.reverse(); variants[4].sentences[0].japanese = '学校だ。'; variants[5].sentences[0].ruby[0].text = '学';
    for (const variant of variants) expect(() => validateReadingAnalysisResult(variant, base())).toThrow();
  });
  it('rejects incomplete translations, non-kana readings, missing Kanji readings and unrecognized fields', () => {
    const variants = [output(), output(), output(), { ...output(), html: '<ruby>fake</ruby>' }];
    variants[0].sentences[1].translation = ' ';
    variants[1].sentences[0].ruby[0].reading = '<b>がっこう</b>';
    delete variants[2].sentences[0].ruby[0].reading;
    for (const variant of variants) expect(() => validateReadingAnalysisResult(variant, base())).toThrow();
  });
  it('keeps repeated sentences, whitespace and emoji and handles 3000 Unicode characters', () => {
    const content = makeReadingContent({ title: 'Unicode', text: '学校です。 学校です。🙂' });
    const rows = content.paragraphs.flatMap(p => p.sentences).map(sentence => ({ sentenceId: sentence.id, japanese: sentence.japanese,
      translation: 'Bản dịch.', ruby: sentence.japanese.includes('学校')
        ? [{ text: '学校', reading: 'がっこう' }, { text: sentence.japanese.slice(2) }]
        : [{ text: sentence.japanese }] }));
    expect(validateReadingAnalysisResult({ sentences: rows, warnings: [] }, content).sentences.map(row => row.japanese)).toEqual(rows.map(row => row.japanese));
    const long = makeReadingContent({ title: 'Long', text: 'あ'.repeat(2999) + '🙂' });
    expect(Array.from(readingAnalysisBase(long).text)).toHaveLength(3000);
    expect(validateReadingAnalysisResult({ sentences: [{ sentenceId: 'p1-s1', japanese: long.text, translation: 'Chuỗi kana và emoji.',
      ruby: [{ text: 'あ'.repeat(2999) }, { text: '🙂' }] }], warnings: [] }, long).sentences[0].japanese).toBe(long.text);
    expect(() => readingAnalysisBase({ ...long, text: long.text + 'あ' })).toThrow();
    const tooMany = makeReadingContent({ title: 'Sentences', text: Array.from({ length: 101 }, () => 'あ。').join('\n') });
    expect(() => readingAnalysisBase(tooMany)).toThrow(/100 câu/);
  });
  it('rejects corrupted stored sentence order and existing ruby without modifying the input', () => {
    const first = base(); first.paragraphs.reverse();
    expect(() => readingAnalysisBase(first)).toThrow();
    const second = base(); second.paragraphs[1].sentences[0].ruby![0].text = '昨日';
    expect(() => readingAnalysisBase(second)).toThrow();
  });
  it('roundtrips all ten provider warnings through cache without adding duplicate mandatory notices', () => {
    const value = output(); value.warnings = Array.from({ length: 10 }, (_, i) => `Cần rà soát ${i + 1}.`);
    const result = validateReadingAnalysisResult(value, base());
    expect(result.warnings).toHaveLength(11);
    expect(validateReadingAnalysisResult(result, base(), true)).toEqual(result);
  });
  it('allows review edits only to generated fields and rejects removing a required annotation', () => {
    const rows = output().sentences; rows[0].ruby[0].reading = 'がくこう'; rows[1].translation = 'Bản dịch người dùng sửa.';
    expect(validateReadingAnalysisApply(rows, base())[1].translation).toBe('Bản dịch người dùng sửa.');
    rows[0].translation = 'Thay bản dịch cũ'; expect(() => validateReadingAnalysisApply(rows, base())).toThrow();
  });
});

type User = { id: string; cookie: string; articleId: string; content: ReadingContent };
let api: ReturnType<typeof createApp>, users: User[];
const post = (user: User | null, body: object = {}, id = user?.articleId ?? randomUUID(), origin = config.APP_ORIGIN) => request(api.app)
  .post(`/api/reading/articles/${id}/analysis`).set('Origin', origin).set('Cookie', user?.cookie ?? '')
  .send({ id: randomUUID(), expectedUserId: user?.id ?? randomUUID(), version: 0, ...body });
const apply = (user: User | null, requestId: string, annotations = output().sentences, body: object = {}, id = user?.articleId ?? randomUUID()) => request(api.app)
  .post(`/api/reading/articles/${id}/analysis/apply`).set('Origin', config.APP_ORIGIN).set('Cookie', user?.cookie ?? '')
  .send({ requestId, expectedUserId: user?.id ?? randomUUID(), version: 0, annotations, ...body });
async function register(content = base()): Promise<User> {
  const res = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN)
    .send({ name: 'A04 test', email: `a04-${randomUUID()}@example.test`, password: 'A04-test-password-12345' }).expect(201);
  const user = { id: res.body.user.id as string, cookie: (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0], articleId: randomUUID(), content };
  users.push(user);
  await api.db.readingArticle.create({ data: { id: user.articleId, userId: user.id, content } });
  return user;
}
async function configured(overrides: Partial<Config>) { await api.close(); api = createApp({ ...config, ...overrides }); }
function provider(value: unknown = output()) { const fn = vi.fn().mockImplementation(async () => response(value)); vi.stubGlobal('fetch', fn); return fn; }
function deferredProvider() {
  let release!: (value: Response) => void, entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const fetcher = vi.fn(() => { entered(); return new Promise<Response>(resolve => { release = resolve; }); });
  vi.stubGlobal('fetch', fetcher);
  return { started, fetcher, finish: () => release(response(output())) };
}

describe('A04 authenticated preview, quota and atomic confirmation', () => {
  beforeEach(() => { api = createApp(config); users = []; });
  afterEach(async () => {
    vi.unstubAllGlobals(); vi.restoreAllMocks();
    await api.db.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await api.close();
  });
  it('requires current account, owned personal article, exact version and allowed Origin before calling provider', async () => {
    const a = await register(), b = await register(), fetcher = provider();
    await post(null, { expectedUserId: a.id }, a.articleId).expect(401);
    await post(a, { expectedUserId: b.id }).expect(409);
    await post(a, {}, b.articleId).expect(404);
    await post(a, { version: 1 }).expect(409);
    await post(a, {}, a.articleId, 'https://evil.invalid').expect(403);
    await api.db.readingArticle.update({ where: { id: a.articleId }, data: { scope: 'library', publishedContent: a.content, publishedVersion: 0 } });
    await post(a).expect(404);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await api.db.readingAnalysisRequest.count({ where: { userId: a.id } })).toBe(0);
  });
  it('sends only saved text/sentences, creates a private preview and does not write learning content', async () => {
    const a = await register(), fetcher = provider(), prior = await api.db.readingArticle.findUniqueOrThrow({ where: { id: a.articleId } });
    const result = await post(a).expect(200);
    expect(result.body.result.sentences.map((row: { generatedFields: string[] }) => row.generatedFields)).toEqual([['ruby'], ['translation']]);
    const sent = JSON.parse(fetcher.mock.calls[0][1].body), data = JSON.parse(sent.contents[0].parts[0].text);
    expect(Object.keys(data).sort()).toEqual(['sentences', 'text']);
    expect(data.text).toBe(a.content.text); expect(data.sentences[0].translation).toBe('  Bản dịch đã nhập.  ');
    expect(JSON.stringify(sent)).not.toContain(a.id); expect(JSON.stringify(sent)).not.toContain(a.content.title);
    expect(await api.db.readingArticle.findUnique({ where: { id: a.articleId } })).toEqual(prior);
    expect(await api.db.xpEvent.count({ where: { userId: a.id } })).toBe(0);
    expect(await api.db.reviewCard.count({ where: { userId: a.id } })).toBe(0);
  });
  it('applies edited missing fields atomically, preserves other content/audio and survives canonical GET', async () => {
    const a = await register(), fetcher = provider(), id = randomUUID();
    const audio = await api.db.readingAudio.create({ data: { id: randomUUID(), articleId: a.articleId, articleVersion: 0, contentHash: 'a'.repeat(64),
      voice: 'test-voice', status: 'ready', claimToken: randomUUID(), leaseUntil: new Date(), segments: [], durationSec: 1, characterCount: 10 } });
    await post(a, { id }).expect(200);
    const rows = output().sentences; rows[1].translation = 'Bản dịch đã được rà soát.';
    const saved = await apply(a, id, rows).expect(200); expect(saved.body.version).toBe(1);
    const current = await api.db.readingArticle.findUniqueOrThrow({ where: { id: a.articleId } });
    const content = current.content as unknown as ReadingContent;
    expect({ ...content, paragraphs: a.content.paragraphs }).toEqual(a.content);
    expect(content.paragraphs[0].sentences[0].translation).toBe(a.content.paragraphs[0].sentences[0].translation);
    expect(content.paragraphs[1].sentences[0].ruby).toEqual(a.content.paragraphs[1].sentences[0].ruby);
    expect(content.paragraphs[1].sentences[0].translation).toBe(rows[1].translation);
    expect(await api.db.readingAudio.findUnique({ where: { id: audio.id } })).toEqual(audio);
    const get = await request(api.app).get(`/api/reading/articles/${a.articleId}`).set('Cookie', a.cookie).expect(200);
    expect(get.body.article.paragraphs).toEqual(content.paragraphs);
    expect(get.body.article.version).toBe(1); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await api.db.xpEvent.count({ where: { userId: a.id } })).toBe(0);
    expect(await api.db.reviewCard.count({ where: { userId: a.id } })).toBe(0);
  });
  it('rejects changes to existing fields and incomplete groups without partially writing any sentence', async () => {
    const a = await register(), id = randomUUID(); provider(); await post(a, { id }).expect(200);
    const rows = output().sentences; rows[1].translation = 'Đổi phần mới'; rows[0].translation = 'Đổi phần cũ';
    await apply(a, id, rows).expect(400);
    await apply(a, id, output().sentences.slice(0, 1)).expect(400);
    const current = await api.db.readingArticle.findUniqueOrThrow({ where: { id: a.articleId } });
    expect(current.version).toBe(0); expect(current.content).toEqual(a.content);
    expect((await api.db.readingAnalysisRequest.findUniqueOrThrow({ where: { id } })).appliedVersion).toBeNull();
  });
  it('accepts reviewed annotations above 128 KB within the feature 512 KB limit and rejects oversized input atomically', async () => {
    const content = makeReadingContent({ title: '100 sentences', text: Array.from({ length: 100 }, () => '語。').join('\n') });
    const a = await register(content), id = randomUUID();
    const rows = content.paragraphs.flatMap(p => p.sentences).map(sentence => ({ sentenceId: sentence.id, japanese: sentence.japanese,
      translation: 'Từ.', ruby: [{ text: '語', reading: 'ご' }, { text: '。' }] }));
    provider({ sentences: rows, warnings: [] }); await post(a, { id }).expect(200);
    const edited = rows.map(row => ({ ...row, translation: 'đ'.repeat(800) }));
    expect(Buffer.byteLength(JSON.stringify(edited), 'utf8')).toBeGreaterThan(128 * 1024);
    await apply(a, id, edited).expect(200);
    const before = await api.db.readingArticle.findUniqueOrThrow({ where: { id: a.articleId } });
    const huge = rows.map(row => ({ ...row, translation: '語'.repeat(2999) }));
    expect(Buffer.byteLength(JSON.stringify(huge), 'utf8')).toBeGreaterThan(512 * 1024);
    const rejected = await apply(a, id, huge).expect(413);
    expect(rejected.body.error.code).toBe('BODY_TOO_LARGE');
    expect(await api.db.readingArticle.findUnique({ where: { id: a.articleId } })).toEqual(before);
  });
  it('binds request IDs and cache hits to account/article/version and does not charge cache retrieval', async () => {
    const a = await register(), b = await register(), id = randomUUID(), cacheId = randomUUID(), fetcher = provider();
    await post(a, { id }).expect(200);
    expect((await post(a, { id: id.toUpperCase(), expectedUserId: a.id.toUpperCase() }, a.articleId.toUpperCase()).expect(200)).body.cached).toBe(true);
    expect((await post(a, { id: cacheId }).expect(200)).body.cached).toBe(true);
    await post(b, { id }).expect(409);
    await api.db.readingArticle.update({ where: { id: a.articleId }, data: { version: 1 } });
    await post(a, { id: cacheId, version: 1 }).expect(409);
    expect(await api.db.readingAnalysisRequest.count({ where: { userId: a.id, providerCalled: true } })).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('replays exact apply once, rejects changed replay payload, and serializes two tabs', async () => {
    const a = await register(), id = randomUUID(), secondId = randomUUID(); provider();
    await post(a, { id }).expect(200); await post(a, { id: secondId }).expect(200);
    const [first, retry] = await Promise.all([apply(a, id), apply(a, id)]);
    expect([first.status, retry.status]).toEqual([200, 200]);
    expect((await api.db.readingArticle.findUniqueOrThrow({ where: { id: a.articleId } })).version).toBe(1);
    await apply(a, secondId).expect(409);
    const changed = output().sentences; changed[1].translation = 'Khác'; await apply(a, id, changed).expect(409);
    await api.db.readingArticle.update({ where: { id: a.articleId }, data: { version: 2 } });
    await apply(a, id).expect(409);
  });
  it('blocks foreign requests, requestless apply, stale snapshots and archived articles', async () => {
    const a = await register(), b = await register(), id = randomUUID(); provider(); await post(a, { id }).expect(200);
    await apply(null, id, output().sentences, { expectedUserId: a.id }, a.articleId).expect(401);
    await apply(b, id, output().sentences, {}, a.articleId).expect(404);
    await apply(a, randomUUID()).expect(409);
    // Even an out-of-band content change that forgot the version must invalidate the proposal.
    await api.db.readingArticle.update({ where: { id: a.articleId }, data: { content: { ...a.content, title: 'Changed without version' } } });
    await apply(a, id).expect(409);
    await api.db.readingArticle.update({ where: { id: a.articleId }, data: { archivedAt: new Date() } });
    await apply(a, id).expect(404);
  });
  it('deduplicates simultaneous provider requests', async () => {
    const a = await register(), pending = deferredProvider(), id = randomUUID(), first = post(a, { id }).then(value => value);
    await pending.started;
    try { expect((await post(a, { id }).expect(409)).body.error.code).toBe('AI_BUSY'); await post(a).expect(409); }
    finally { pending.finish(); }
    expect((await first).status).toBe(200); expect(pending.fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['logout', 'account switch', 'edit', 'archive'])('does not return stale private preview after %s during Gemini', async action => {
    const a = await register(), b = await register(), pending = deferredProvider(), first = post(a).then(value => value);
    await pending.started;
    try {
      if (action === 'logout') await request(api.app).post('/api/auth/logout').set('Origin', config.APP_ORIGIN).set('Cookie', a.cookie).send({}).expect(204);
      else if (action === 'account switch') {
        await api.db.$executeRaw`UPDATE sessions SET sess=jsonb_set(sess::jsonb, '{userId}', to_jsonb(${b.id}::text))::json WHERE sess->>'userId'=${a.id}`;
      } else await api.db.readingArticle.update({ where: { id: a.articleId }, data: action === 'edit' ? { version: 1 } : { archivedAt: new Date() } });
    } finally { pending.finish(); }
    expect((await first).status).toBe(action === 'logout' ? 401 : action === 'archive' ? 404 : 409);
  });
  it('charges failed provider calls, never stores partial results, and requires a new UUID to retry known failure', async () => {
    const a = await register(), bad = output(), id = randomUUID(); bad.sentences.pop(); const fetcher = provider(bad);
    expect((await post(a, { id }).expect(502)).body.error.code).toBe('AI_INVALID_RESPONSE');
    const row = await api.db.readingAnalysisRequest.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('failed'); expect(row.providerCalled).toBe(true); expect(row.result).toBeNull();
    await post(a, { id }).expect(503);
    expect((await api.db.readingArticle.findUniqueOrThrow({ where: { id: a.articleId } })).content).toEqual(a.content);
    fetcher.mockImplementation(async () => response(output())); await post(a).expect(200); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('participates in shared rolling quota both ways while cache remains free', async () => {
    const a = await register(), fetcher = provider(); await configured({ GEMINI_DAILY_LIMIT: 1 });
    await post(a).expect(200);
    await expect(api.db.$transaction(async tx => { await lockGeminiQuota(tx); await assertGeminiQuota(tx, { ...config, GEMINI_DAILY_LIMIT: 1 }, a.id); })).rejects.toMatchObject({ code: 'AI_QUOTA' });
    expect((await post(a).expect(200)).body.cached).toBe(true);
    await api.db.readingArticle.update({ where: { id: a.articleId }, data: { version: 1 } });
    await post(a, { version: 1 }).expect(429);
    const b = await register(); await api.db.vocabAiRequest.create({ data: { id: randomUUID(), userId: b.id, requestHash: 'a'.repeat(64), model: 'gemini-test', status: 'failed' } });
    await post(b).expect(429); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reports provider errors or missing configuration without fabricated output, retries or leaked details', async () => {
    const a = await register(); await configured({ GEMINI_API_KEY: undefined });
    await post(a).expect(503); expect(await api.db.readingAnalysisRequest.count({ where: { userId: a.id } })).toBe(0);
    await configured({});
    for (const status of [429, 503]) {
      const fetcher = vi.fn(async () => new Response('provider secret body', { status })); vi.stubGlobal('fetch', fetcher);
      const result = await post(a).expect(status); expect(JSON.stringify(result.body)).not.toContain('provider secret body');
      expect(result.body.result).toBeUndefined(); expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('refuses oversized sentence sets and already completed articles before quota reservation', async () => {
    const many = makeReadingContent({ title: 'Many', text: Array.from({ length: 101 }, () => 'あ。').join('\n') });
    const a = await register(many), b = await register(makeReadingContent({ title: 'Complete', text: 'あ。',
      annotations: [{ sentenceId: 'p1-s1', translation: 'A.', ruby: [{ text: 'あ。' }] }] }, true)), fetcher = provider();
    await post(a).expect(400); expect((await post(b).expect(409)).body.error.code).toBe('ANALYSIS_COMPLETE');
    expect(fetcher).not.toHaveBeenCalled(); expect(await api.db.readingAnalysisRequest.count({ where: { userId: { in: [a.id, b.id] } } })).toBe(0);
  });
});
