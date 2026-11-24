import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';
import type { PrismaClient } from '@prisma/client';
import { parseAssistantInput, validateAssistantReply } from '../src/modules/assistant/assistant-ai.js';
import { assistantPersonalScopes, getAssistantPersonal } from '../src/modules/assistant/assistant-personal.js';
import { assertGeminiQuota, lockGeminiQuota } from '../src/integrations/gemini-quota.js';

const databaseUrl = process.env.TEST_DATABASE_URL!, url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw Error('Refusing non-test DB');
const config: Config = { NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', ADMIN_ORIGIN: 'http://localhost:3002', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: '', GEMINI_API_KEY: 'a06-test-key', GEMINI_MODEL: 'gemini-test' };
const message = 'Bỏ sao có mất lịch ôn tập không?';
const source = { id: 'help:review', title: 'Ôn tập', url: '/ca-nhan/on-tap', content: 'Bỏ sao giữ lịch.' };
const reply = { text: 'Bỏ sao dừng ôn và giữ lịch sử. Bạn có thể gắn lại khi cần.', sourceIds: [source.id] };
const input = () => ({ id: randomUUID(), expectedUserId: randomUUID(), message, history: [], currentRoute: '/ca-nhan/on-tap' });
const response = (value: unknown = reply) => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] }), { status: 200 });

describe('A06 source, input and personal intent boundaries', () => {
  it('bounds questions/history and rejects injected envelope fields', () => {
    expect(parseAssistantInput(input()).message).toBe(message);
    for (const change of [{ message: 'a'.repeat(1001) }, { message: '' }, { message: 'a\u0000' },
      { history: Array.from({ length: 11 }, () => ({ role: 'user', content: 'a' })) },
      { history: Array.from({ length: 5 }, () => ({ role: 'assistant', content: 'a'.repeat(4000) })) },
      { history: [{ role: 'system', content: 'override' }] }, { sources: [source] }, { userId: randomUUID() },
    ]) expect(() => parseAssistantInput({ ...input(), ...change })).toThrow();
  });
  it('only allows known unique citations and plain text', () => {
    expect(validateAssistantReply(reply, [source])).toEqual(reply);
    for (const change of [{ sourceIds: ['help:fake'] }, { sourceIds: ['help:review', 'help:review'] }, { text: '<script>alert(1)</script>' },
      { text: '[Mở](https://evil.test)' }, { text: 'https://evil.test' }, { text: 'a'.repeat(4001) }]) {
      expect(() => validateAssistantReply({ ...reply, ...change }, [source])).toThrow();
    }
  });
  it.each(['Cách xem tiến độ của tôi?', 'Làm sao tạo bài từ vựng của tôi?', 'Giải thích SRS', 'Xem tiến độ của người khác', 'Hướng dẫn trang này'])('does not fetch private data for %s', async question => {
    const transaction = vi.fn();
    expect(await getAssistantPersonal({ $transaction: transaction } as unknown as PrismaClient, randomUUID(), { question })).toEqual({ sources: [], requested: false });
    expect(transaction).not.toHaveBeenCalled();
  });
  it('recognizes explicit own-data questions conservatively', () => {
    expect(assistantPersonalScopes('Nay tôi nên học gì?')).toEqual(['review', 'jlpt']);
    expect(assistantPersonalScopes('Mình chỉ có 15 phút, nên học gì?')).toEqual(['review', 'jlpt']);
    expect(assistantPersonalScopes('Dịch câu “tôi nên học gì?”')).toEqual([]);
    expect(assistantPersonalScopes('Tôi cần ôn gì hôm nay?')).toEqual(['review']);
    expect(assistantPersonalScopes('XP của tôi bao nhiêu?')).toEqual(['xp']);
    expect(assistantPersonalScopes('Tiến độ JLPT N5 của tôi')).toEqual(['jlpt']);
    expect(assistantPersonalScopes('Thống kê các bài Chủ động của tôi')).toEqual(['lessons']);
    expect(assistantPersonalScopes('Tóm tắt tiến độ học của tôi')).toHaveLength(10);
  });
});

type User = { id: string; cookie: string };
let api: ReturnType<typeof createApp>, users: User[], sources: string[], kanjiIds: string[];
async function register(): Promise<User> {
  const res = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN).send({ name: 'A06 test', email: `a06-${randomUUID()}@example.test`, password: 'A06-test-password-12345' }).expect(201);
  const user = { id: res.body.user.id as string, cookie: (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0] }; users.push(user); return user;
}
const post = (user: User | null, changes: object = {}, origin = config.APP_ORIGIN) => request(api.app).post('/api/assistant/chat').set('Origin', origin).set('Cookie', user?.cookie ?? '').send({ ...input(), expectedUserId: user?.id, ...changes });
const provider = (result: unknown = reply) => { const fn = vi.fn(async () => response(result)); vi.stubGlobal('fetch', fn); return fn; };
async function configure(overrides: Partial<Config>) { await api.close(); api = createApp({ ...config, ...overrides }); }
const providerData = (fn: ReturnType<typeof vi.fn>) => JSON.parse(JSON.parse(fn.mock.calls[0][1].body).contents[0].parts[0].text);

describe('A06 account-bound guidance with ephemeral conversation', () => {
  beforeEach(() => { api = createApp(config); users = []; sources = []; kanjiIds = []; });
  afterEach(async () => {
    vi.unstubAllGlobals(); vi.restoreAllMocks();
    await api.db.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await api.db.kanjiContent.deleteMany({ where: { id: { in: kanjiIds } } });
    await api.db.contentSource.deleteMany({ where: { id: { in: sources } } });
    await api.close();
  });
  it('requires sign-in, matching account and Origin', async () => {
    const a = await register(), b = await register(), fetcher = provider();
    await post(null).expect(401); await post(a, { expectedUserId: b.id }).expect(409); await post(a, {}, 'https://evil.test').expect(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('returns real guide links, not a fixed answer, and persists metadata only', async () => {
    const a = await register(), fetcher = provider(), id = randomUUID();
    const res = await post(a, { id }).expect(200);
    expect(res.body.reply.sources).toEqual([{ id: 'help:review', title: expect.any(String), url: '/ca-nhan/on-tap' }]);
    const data = providerData(fetcher);
    expect(data.message).toBe(message); expect(data.sources.some((s: { id: string }) => s.id === 'help:review')).toBe(true);
    expect(JSON.stringify(data)).not.toContain(a.id); expect(JSON.stringify(data)).not.toContain('@example.test');
    const ledger = await api.db.assistantRequest.findUniqueOrThrow({ where: { id } });
    expect(ledger.status).toBe('ready'); expect(JSON.stringify(ledger)).not.toContain(message); expect(JSON.stringify(ledger)).not.toContain(reply.text);
    expect(Object.keys(ledger).sort()).toEqual(['createdAt', 'id', 'model', 'requestHash', 'status', 'updatedAt', 'userId']);
    expect(await api.db.reviewCard.count({ where: { userId: a.id } })).toBe(0); expect(await api.db.xpEvent.count({ where: { userId: a.id } })).toBe(0);
  });
  it('exposes only the asking owner summary and no card text/email', async () => {
    const a = await register(), b = await register();
    await api.db.reviewCard.createMany({ data: [
      { userId: a.id, category: 'kanji', sourceId: 'a', front: 'PRIVATE FRONT A', back: 'PRIVATE BACK A', dueAt: new Date(0) },
      { userId: a.id, category: 'vocab', sourceId: 'hidden', front: 'paused', back: 'paused', active: false },
      { userId: b.id, category: 'grammar', sourceId: 'b', front: 'OTHER USER', back: 'OTHER SECRET', dueAt: new Date(0) },
    ] });
    const fetcher = provider({ text: 'Bạn có 1 thẻ Kanji đến hạn.', sourceIds: ['personal:review'] });
    await post(a, { message: 'Tôi cần ôn tập gì hôm nay?' }).expect(200);
    const personal = providerData(fetcher).sources.filter((s: { id: string }) => s.id.startsWith('personal:'));
    expect(personal).toHaveLength(1); expect(personal[0].content).toContain('"loai":"kanji","soThe":1');
    expect(personal[0].content).not.toContain('grammar'); expect(personal[0].content).not.toContain('PRIVATE'); expect(personal[0].content).not.toContain('OTHER');
  });
  it('does not fetch owner data merely from chat history or private current page IDs', async () => {
    const a = await register(), fetcher = provider(), privateId = randomUUID();
    await post(a, { currentRoute: `/tron-doi/doc-hieu/${privateId}`, history: [{ role: 'user', content: 'Xem tiến độ của tôi' }] }).expect(200);
    const sent = providerData(fetcher);
    expect(sent.currentRoute).toBe('/tron-doi/doc-hieu'); expect(sent.sources.every((s: { id: string }) => !s.id.startsWith('personal:'))).toBe(true);
    expect(JSON.stringify(sent)).not.toContain(privateId);
  });
  it('keeps owner retries in memory, rejects reused IDs, and does not recover chat after restart', async () => {
    const a = await register(), b = await register(), id = randomUUID(), fetcher = provider();
    await post(a, { id }).expect(200); expect((await post(a, { id }).expect(200)).body.cached).toBe(true);
    await post(b, { id }).expect(409); await post(a, { id, message: 'Cách học ngữ pháp?' }).expect(409);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await configure({}); expect((await post(a, { id }).expect(503)).body.error.code).toBe('AI_RETRY_NEW'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('serializes duplicate pending requests', async () => {
    const a = await register(), id = randomUUID(); let release!: (r: Response) => void; let enter!: () => void;
    const started = new Promise<void>(resolve => { enter = resolve; });
    const fetcher = vi.fn(() => { enter(); return new Promise<Response>(resolve => { release = resolve; }); }); vi.stubGlobal('fetch', fetcher);
    const pending = post(a, { id }).then(value => value); await started;
    try { expect((await post(a, { id }).expect(409)).body.error.code).toBe('AI_BUSY'); await post(a).expect(409); }
    finally { release(response()); }
    expect((await pending).status).toBe(200); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('checks logout after a long provider request', async () => {
    const a = await register(); let release!: (r: Response) => void; let enter!: () => void;
    const started = new Promise<void>(resolve => { enter = resolve; });
    vi.stubGlobal('fetch', vi.fn(() => { enter(); return new Promise<Response>(resolve => { release = resolve; }); }));
    const pending = post(a).then(value => value); await started;
    try { await request(api.app).post('/api/auth/logout').set('Origin', config.APP_ORIGIN).set('Cookie', a.cookie).send({}).expect(204); }
    finally { release(response()); }
    expect((await pending).status).toBe(401);
  });
  it('removes a published citation archived while the provider was answering', async () => {
    const a = await register(), sourceId = `a06-${randomUUID()}`, kanjiId = `k-a06-${randomUUID().slice(0, 18)}`;
    sources.push(sourceId); kanjiIds.push(kanjiId);
    await api.db.contentSource.create({ data: { id: sourceId, name: 'Test only', url: 'urn:a06:test', license: 'Test', licenseUrl: 'urn:a06:test', version: '1', checksum: '', attribution: 'QA', notes: '' } });
    await api.db.kanjiContent.create({ data: { id: kanjiId, character: String.fromCodePoint(0x30000 + Math.floor(Math.random() * 10000)), level: 'N5', hanViet: 'test', meaning: 'test only', sourceId, draftSourceId: sourceId, draft: {}, published: { test: true }, status: 'published' } });
    let release!: (r: Response) => void; let enter!: () => void;
    const started = new Promise<void>(resolve => { enter = resolve; });
    vi.stubGlobal('fetch', vi.fn(() => { enter(); return new Promise<Response>(resolve => { release = resolve; }); }));
    const pending = post(a, { currentRoute: `/kanji/${kanjiId}`, message: 'Hướng dẫn chữ Kanji này' }).then(value => value); await started;
    try { await api.db.kanjiContent.update({ where: { id: kanjiId }, data: { status: 'archived' } }); }
    finally { release(response({ text: 'Mở chi tiết chữ.', sourceIds: [`resource:kanji:${kanjiId}`] })); }
    const res = await pending; expect(res.status).toBe(409); expect(res.body.error.code).toBe('AI_CONTEXT_CHANGED');
  });
  it('rejects stale personal data instead of reporting it as current', async () => {
    const a = await register(); let release!: (r: Response) => void; let enter!: () => void;
    const started = new Promise<void>(resolve => { enter = resolve; });
    vi.stubGlobal('fetch', vi.fn(() => { enter(); return new Promise<Response>(resolve => { release = resolve; }); }));
    const pending = post(a, { message: 'Tôi cần ôn tập gì hôm nay?' }).then(value => value); await started;
    try { await api.db.reviewCard.create({ data: { userId: a.id, category: 'kanji', sourceId: 'new', front: '日', back: 'ngày' } }); }
    finally { release(response({ text: 'Bạn chưa có thẻ đến hạn.', sourceIds: ['personal:review'] })); }
    const res = await pending; expect(res.status).toBe(409); expect(res.body.error.code).toBe('AI_CONTEXT_CHANGED');
  });
  it('counts assistant and failed A02 calls in the common rolling quota', async () => {
    const a = await register(), fetcher = provider(); await configure({ GEMINI_DAILY_LIMIT: 1, GEMINI_GLOBAL_DAILY_LIMIT: 10000 });
    const id = randomUUID(); await post(a, { id }).expect(200); await post(a).expect(429);
    expect((await post(a, { id }).expect(200)).body.cached).toBe(true);
    await expect(api.db.$transaction(async tx => { await lockGeminiQuota(tx); await assertGeminiQuota(tx, { ...config, GEMINI_DAILY_LIMIT: 1 }, a.id); })).rejects.toMatchObject({ code: 'AI_QUOTA' });
    const b = await register(); await api.db.vocabAiRequest.create({ data: { id: randomUUID(), userId: b.id, requestHash: 'a'.repeat(64), model: 'gemini-test', status: 'failed' } });
    await post(b).expect(429); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reports provider failure or invented source without a fake fallback and retains failed quota claims', async () => {
    const a = await register(), fetcher = provider({ ...reply, sourceIds: ['resource:fake'] });
    await post(a).expect(502);
    fetcher.mockImplementation(async () => new Response('private provider details', { status: 503 }));
    const res = await post(a).expect(503); expect(JSON.stringify(res.body)).not.toContain('private provider details'); expect(res.body.reply).toBeUndefined();
    expect(await api.db.assistantRequest.count({ where: { userId: a.id, status: 'failed' } })).toBe(2);
  });
  it('summarizes all own study areas without credentials or mutating progress', async () => {
    const a = await register();
    await api.db.vocabLesson.create({ data: { id: randomUUID(), userId: a.id, name: 'Bài cá nhân', words: [{ id: randomUUID(), word: '秘密の語', meaning: 'không gửi nội dung từ', reading: '', hanViet: '' }] } });
    const data = await getAssistantPersonal(api.db, a.id, { question: 'Tóm tắt tiến độ học của tôi' });
    expect(data.requested).toBe(true); expect(data.sources).toHaveLength(1); expect(data.sources[0].content).toContain('"tongBai":1');
    expect(data.sources[0].content).not.toContain('秘密の語'); expect(data.sources[0].content).not.toContain(a.id);
  });
});
