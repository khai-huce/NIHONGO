import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { makeReadingContent } from '../src/reading-content.js';
import * as tts from '../src/reading-tts.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const database = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(database.pathname.slice(1))) throw new Error('Refusing a non-test database');
const baseConfig: Config = { NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: '' };
type Learner = { id: string; sid: string };
let api: ReturnType<typeof createApp>, storage: string;
let synthesize: ReturnType<typeof vi.fn<tts.ReadingTts>>;
const body = (user: Learner, extra = {}) => ({ expectedUserId: user.id, ...extra });
const mutation = (user: Learner, method: 'post' | 'patch' | 'delete', path: string, data = {}) => request(api.app)[method](path).set('Cookie', user.sid).set('Origin', baseConfig.APP_ORIGIN).send(body(user, data));
const get = (path: string, user?: Learner) => user ? request(api.app).get(path).set('Cookie', user.sid) : request(api.app).get(path);
const articlePath = '/api/reading/articles';
const adminPath = '/api/admin/reading/articles';
const sourceId = 'reading-test-editorial-v1';
async function register(admin = false): Promise<Learner> {
  const response = await request(api.app).post('/api/auth/register').set('Origin', baseConfig.APP_ORIGIN)
    .send({ name: 'Reading QA', email: `reading-${randomUUID()}@example.com`, password: 'test-only reading password 123' }).expect(201);
  const user = { id: response.body.user.id, sid: (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0] };
  if (admin) await api.db.user.update({ where: { id: user.id }, data: { role: 'admin' } });
  return user;
}
async function create(user: Learner, extra: Record<string, unknown> = {}, library = false) {
  const response = await mutation(user, 'post', library ? adminPath : articlePath, { id: randomUUID(), title: '日本の学校', text: '学校に行きます。\n日本語を勉強します。',
    ...(library ? { sourceId } : {}), ...extra }).expect(201);
  return response.body.article;
}
async function fakeMedia(input: Parameters<tts.ReadingTts>[0]) {
  const segments = [];
  for (let index = 0; index < input.sentences.length; index++) {
    await writeFile(join(input.directory, `${index}.mp3`), Buffer.from('ID3-readable-test-fixture-0123456789'));
    segments.push({ sentenceId: input.sentences[index].id, fileName: `${index}.mp3`, durationSec: 2.5, offsetSec: index * 2.5 });
  }
  return { segments, totalSeconds: input.sentences.length * 2.5 };
}
beforeEach(async () => {
  storage = await mkdtemp(join(tmpdir(), 'nihongo-reading-test-'));
  synthesize = vi.fn<tts.ReadingTts>(fakeMedia);
  vi.spyOn(tts, 'edgeReadingTts').mockReturnValue(synthesize);
  api = createApp({ ...baseConfig, TTS_STORAGE_DIR: storage });
  await api.db.session.deleteMany();
  await api.db.user.deleteMany();
  await api.db.contentSource.createMany({ data: [{ id: sourceId, name: 'Reading test fixture', url: 'urn:nihongo:reading-test',
    license: 'Test fixture', licenseUrl: 'urn:nihongo:test-license', version: 'v1', checksum: '', attribution: 'Test suite', notes: 'Not learning content' }], skipDuplicates: true });
});
afterEach(async () => {
  await api.close();
  vi.restoreAllMocks();
  // mkdtemp supplied the complete absolute target; only this test's directory is removed.
  if (storage.startsWith(join(tmpdir(), 'nihongo-reading-test-'))) await rm(storage, { recursive: true, force: true });
});

describe('R01 reading articles', () => {
  it('separates anonymous reads and protected mutations, origin and strict input', async () => {
    expect((await get(articlePath).expect(200)).body).toEqual({ userId: null, articles: [] });
    await request(api.app).post(articlePath).set('Origin', baseConfig.APP_ORIGIN).send({}).expect(401);
    const user = await register();
    await request(api.app).post(articlePath).set('Cookie', user.sid).send({}).expect(403);
    await mutation(user, 'post', articlePath, { id: randomUUID(), title: 'A', text: 'a'.repeat(3001) }).expect(400);
    await mutation(user, 'post', articlePath, { id: randomUUID(), title: 'A', text: '本文', visibility: 'public' }).expect(400);
    await mutation(user, 'post', articlePath, { id: randomUUID(), title: 'A', text: ' '.repeat(20) }).expect(400);
    await mutation(user, 'post', articlePath, { id: randomUUID(), title: 'A', text: '本文', padding: 'x'.repeat(140_000) }).expect(413);
    await get(adminPath, user).expect(403);
    expect(await api.db.readingArticle.count()).toBe(0);
  });

  it('preserves original text, deterministically segments it, never fabricates analysis and supports exact create retry', async () => {
    const user = await register(), id = randomUUID(), text = '  日本語です。次の文です。\n\n<script>alert(1)</script>\n学校に行きます。';
    const payload = { id, title: '本文', text };
    const created = (await mutation(user, 'post', articlePath, payload).expect(201)).body.article;
    expect(created).toMatchObject({ id, title: '本文', text, version: 0, visibility: 'private', audio: null, vocabList: [], grammarList: [], quizList: [] });
    expect(created.paragraphs.map((p: { id: string }) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(created.paragraphs[0].sentences).toEqual([{ id: 'p1-s1', japanese: '  日本語です。', translation: '' }, { id: 'p1-s2', japanese: '次の文です。', translation: '' }]);
    expect((await mutation(user, 'post', articlePath, payload).expect(200)).body.article).toEqual(created);
    await mutation(user, 'post', articlePath, { ...payload, text: '別の記事' }).expect(409);
    expect((await get(`${articlePath}/${id}`, user).expect(200)).body.article).toEqual(created);
    expect((await get(articlePath, user).expect(200)).body.articles).toEqual([created]);
    expect(await api.db.readingArticle.count()).toBe(1);
    expect(await api.db.reviewCard.count()).toBe(0);
  });

  it('isolates accounts, guards stale pages and archives only the selected owned version', async () => {
    const a = await register(), b = await register(), article = await create(a);
    await get(`${articlePath}/${article.id}`).expect(404);
    await get(`${articlePath}/${article.id}`, b).expect(404);
    expect((await get(articlePath, b)).body.articles).toEqual([]);
    await mutation(b, 'delete', `${articlePath}/${article.id}`, { version: 0 }).expect(404);
    await mutation(a, 'delete', `${articlePath}/${article.id}`, { expectedUserId: b.id, version: 0 }).expect(409);
    await mutation(a, 'delete', `${articlePath}/${article.id}`, { version: 1 }).expect(409);
    await mutation(a, 'delete', `${articlePath}/${article.id}`, { version: 0 }).expect(204);
    await get(`${articlePath}/${article.id}`, a).expect(404);
    expect((await get(articlePath, a)).body.articles).toEqual([]);
    expect(await api.db.readingArticle.count()).toBe(1);
  });

  it('serializes edits by version and keeps the current original text', async () => {
    const user = await register(), article = await create(user);
    const attempts = await Promise.all(['記事一', '記事二'].map(text => mutation(user, 'patch', `${articlePath}/${article.id}`, { version: 0, title: '編集', text })));
    expect(attempts.map(item => item.status).sort()).toEqual([200, 409]);
    expect((await get(`${articlePath}/${article.id}`, user)).body.article).toMatchObject({ version: 1, text: attempts.find(item => item.status === 200)!.body.article.text });
  });

  it('publishes validated editorial content without exposing later drafts or allowing role escalation', async () => {
    const admin = await register(true), user = await register();
    const article = await create(admin, { text: '日本語。', annotations: [{ sentenceId: 'p1-s1', ruby: [{ text: '日本語', reading: 'にほんご' }, { text: '。' }], translation: 'Tiếng Nhật.' }] }, true);
    expect((await get(`${adminPath}/${article.id}`, admin).expect(200)).body.article).toEqual(article);
    await mutation(admin, 'post', adminPath, { id: article.id, title: article.title, sourceId, text: '日本語。', annotations: [{ sentenceId: 'p1-s1', ruby: [{ text: '日本語', reading: 'にほんご' }, { text: '。' }], translation: 'Tiếng Nhật.' }] }).expect(200);
    await mutation(admin, 'post', adminPath, { id: article.id, title: 'Khác', text: '日本語。' }).expect(409);
    await get(`${articlePath}/${article.id}`, admin).expect(404);
    expect((await get(articlePath)).body.articles).toEqual([]);
    await mutation(user, 'post', `${adminPath}/${article.id}/publish`, { version: 0 }).expect(403);
    await mutation(admin, 'post', `${adminPath}/${article.id}/audio`, { version: 0 }).expect(200);
    await mutation(admin, 'post', `${adminPath}/${article.id}/publish`, { version: 0 }).expect(200);
    const published = (await get(`${articlePath}/${article.id}`).expect(200)).body.article;
    expect(published).toMatchObject({ version: 1, visibility: 'public', text: '日本語。' });
    expect(published.paragraphs[0].sentences[0].ruby[0]).toEqual({ text: '日本語', reading: 'にほんご' });
    await mutation(admin, 'patch', `${adminPath}/${article.id}`, { version: 1, title: 'Draft', text: '学校。', translationsReviewed: true }).expect(200);
    expect((await get(`${articlePath}/${article.id}`)).body.article.text).toBe('日本語。');
    await mutation(admin, 'post', `${adminPath}/${article.id}/publish`, { version: 1 }).expect(409);
    await mutation(admin, 'post', `${adminPath}/${article.id}/audio`, { version: 2 }).expect(200);
    await mutation(admin, 'post', `${adminPath}/${article.id}/publish`, { version: 2 }).expect(200);
    expect((await get(`${articlePath}/${article.id}`)).body.article).toMatchObject({ text: '学校。', version: 3 });
    await api.db.user.update({ where: { id: admin.id }, data: { role: 'user' } });
    await mutation(admin, 'post', `${adminPath}/${article.id}/archive`, { version: 3 }).expect(403);
    await api.db.user.update({ where: { id: admin.id }, data: { role: 'admin' } });
    await mutation(admin, 'post', `${adminPath}/${article.id}/archive`, { version: 3 }).expect(200);
    await get(`${articlePath}/${article.id}`).expect(404);
  });

  it('rejects editorial HTML fields, ruby mismatches and invalid quiz answers', async () => {
    const admin = await register(true), fields = { id: randomUUID(), title: '本文', text: '学校。' };
    for (const extra of [
      { annotations: [{ sentenceId: 'p1-s1', ruby: [{ text: 'other', reading: 'がっこう' }] }] },
      { annotations: [{ sentenceId: 'unknown', translation: 'x' }] },
      { annotations: [{ sentenceId: 'p1-s1', furiganaHtml: '<ruby>fake</ruby>' }] },
      { quizList: [{ id: 1, question: '?', options: ['A', 'B'], correctIndex: 2, explanation: '' }] },
    ]) await mutation(admin, 'post', adminPath, { ...fields, ...extra }).expect(400);
    expect(await api.db.readingArticle.count()).toBe(0);
  });
});

describe('M02 library editorial and private draft audio', () => {
  it('requires a real source and complete matching files before publishing, without inventing translations', async () => {
    const admin = await register(true);
    const preview = await mutation(admin, 'post', `${adminPath}/preview`, { title: 'Nháp', text: '学校。\n日本語。' }).expect(200);
    expect(preview.body.content.paragraphs[0].sentences[0].translation).toBe('');
    expect(await api.db.readingArticle.count()).toBe(0);
    const article = await create(admin, { sourceId: null }, true);
    expect((await mutation(admin, 'post', `${adminPath}/${article.id}/publish`, { version: 0 }).expect(400)).body.error.code).toBe('SOURCE_REQUIRED');
    await mutation(admin, 'patch', `${adminPath}/${article.id}`, { version: 0, title: article.title, text: article.text, sourceId: 'source-does-not-exist' }).expect(400);
    await mutation(admin, 'patch', `${adminPath}/${article.id}`, { version: 0, title: article.title, text: article.text, sourceId }).expect(200);
    expect((await mutation(admin, 'post', `${adminPath}/${article.id}/publish`, { version: 1 }).expect(409)).body.error.code).toBe('AUDIO_REQUIRED');
    const manifest = (await mutation(admin, 'post', `${adminPath}/${article.id}/audio`, { version: 1 }).expect(200)).body.audio;
    await get(manifest.segments[0].url).expect(401);
    const ordinary = await register();
    await get(manifest.segments[0].url, ordinary).expect(403);
    await get(manifest.segments[0].url.replace('/admin/', '/')).expect(404);
    await get(manifest.segments[0].url, admin).set('Range', 'bytes=0-2').expect(206);
    const file = await api.db.readingAudio.findUniqueOrThrow({ where: { id: manifest.id } });
    // This path is one file inside the mkdtemp fixture created by this test.
    await rm(join(storage, file.id, file.claimToken, '0.mp3'));
    await mutation(admin, 'post', `${adminPath}/${article.id}/publish`, { version: 1 }).expect(409);
    await get(`${articlePath}/${article.id}`).expect(404);
  });

  it('keeps published source and audio alive while preparing a new draft; publishes a version only once', async () => {
    const admin = await register(true), article = await create(admin, {}, true);
    const oldAudio = (await mutation(admin, 'post', `${adminPath}/${article.id}/audio`, { version: 0 }).expect(200)).body.audio;
    await mutation(admin, 'post', `${adminPath}/${article.id}/publish`, { version: 0 }).expect(200);
    const oldPublic = (await get(`${articlePath}/${article.id}`).expect(200)).body.article;
    const newSource = `${sourceId}-new`;
    const originalSource = await api.db.contentSource.findUniqueOrThrow({ where: { id: sourceId } });
    await api.db.contentSource.upsert({ where: { id: newSource }, create: { ...originalSource, id: newSource }, update: {} });
    const titleOnly = (await mutation(admin, 'patch', `${adminPath}/${article.id}`, { version: 1, title: 'New title', text: article.text, sourceId: newSource }).expect(200)).body.article;
    expect(titleOnly.audio.id).toBe(oldAudio.id);
    expect(titleOnly.audio.version).toBe(2);
    expect(titleOnly.hasUnpublishedChanges).toBe(true);
    expect((await get(`${articlePath}/${article.id}`)).body.article.sourceId).toBe(sourceId);
    await get(oldPublic.audio.segments[0].url).expect(200);
    const changed = (await mutation(admin, 'patch', `${adminPath}/${article.id}`, { version: 2, title: 'New title', text: '今日は雨です。', translationsReviewed: true }).expect(200)).body.article;
    expect(changed.audio).toBeNull();
    await mutation(admin, 'post', `${adminPath}/${article.id}/audio`, { version: 3 }).expect(200);
    expect(synthesize).toHaveBeenCalledTimes(2);
    await get(oldPublic.audio.segments[0].url).expect(200);
    const attempts = await Promise.all([1, 2].map(() => mutation(admin, 'post', `${adminPath}/${article.id}/publish`, { version: 3 })));
    expect(attempts.map(value => value.status).sort()).toEqual([200, 409]);
    const published = (await get(`${articlePath}/${article.id}`)).body.article;
    expect(published).toMatchObject({ text: '今日は雨です。', sourceId: newSource, version: 4 });
    await get(published.audio.segments[0].url).expect(200);
    await get(oldPublic.audio.segments[0].url).expect(404);
    expect(await api.db.readingAudio.count()).toBe(2);
  });

  it('preserves existing editorial fields until Japanese text is explicitly reviewed and replaced', async () => {
    const admin = await register(true), article = await create(admin, { text: '学校。',
      annotations: [{ sentenceId: 'p1-s1', translation: 'Trường học.', ruby: [{ text: '学校', reading: 'がっこう' }, { text: '。' }] }],
      vocabList: [{ word: '学校', reading: 'がっこう', hanViet: 'HỌC HIỆU', meaning: 'Trường học' }] }, true);
    const edited = (await mutation(admin, 'patch', `${adminPath}/${article.id}`, { version: 0, title: 'Title only', text: article.text,
      annotations: [{ sentenceId: 'p1-s1', translation: 'Một ngôi trường.' }] }).expect(200)).body.article;
    expect(edited.vocabList).toEqual(article.vocabList);
    expect(edited.paragraphs[0].sentences[0].ruby).toEqual(article.paragraphs[0].sentences[0].ruby);
    const next = { version: 1, title: 'New Japanese', text: '図書館。', annotations: [{ sentenceId: 'p1-s1', translation: 'Thư viện.' }] };
    await mutation(admin, 'patch', `${adminPath}/${article.id}`, next).expect(400);
    await mutation(admin, 'patch', `${adminPath}/${article.id}`, { ...next, translationsReviewed: true }).expect(400);
    await mutation(admin, 'patch', `${adminPath}/${article.id}`, { ...next, translationsReviewed: true, annotations: [{ sentenceId: 'p1-s1', japanese: '学校。', translation: 'Thư viện.' }] }).expect(400);
    const saved = (await mutation(admin, 'patch', `${adminPath}/${article.id}`, { ...next, translationsReviewed: true,
      annotations: [{ sentenceId: 'p1-s1', japanese: '図書館。', translation: 'Thư viện.' }] }).expect(200)).body.article;
    expect(saved.vocabList).toEqual([]);
    expect(saved.paragraphs[0].sentences[0]).toEqual({ id: 'p1-s1', japanese: '図書館。', translation: 'Thư viện.' });
  });

  it('archives without deleting files and restores only a draft, leaving private learner articles separate', async () => {
    const admin = await register(true), article = await create(admin, {}, true), personal = await create(admin);
    await get(`${adminPath}/${personal.id}`, admin).expect(404);
    await mutation(admin, 'post', `${adminPath}/${personal.id}/audio`, { version: 0 }).expect(404);
    const audio = (await mutation(admin, 'post', `${adminPath}/${article.id}/audio`, { version: 0 }).expect(200)).body.audio;
    await mutation(admin, 'post', `${adminPath}/${article.id}/publish`, { version: 0 }).expect(200);
    await mutation(admin, 'post', `${adminPath}/${article.id}/archive`, { version: 1 }).expect(200);
    await get(audio.segments[0].url, admin).expect(404);
    const restored = (await mutation(admin, 'post', `${adminPath}/${article.id}/restore`, { version: 2 }).expect(200)).body.article;
    expect(restored).toMatchObject({ archived: false, publishedVersion: null, version: 3 });
    expect(restored.audio.id).toBe(audio.id);
    await get(`${articlePath}/${article.id}`).expect(404);
    await mutation(admin, 'post', `${adminPath}/${article.id}/publish`, { version: 3 }).expect(200);
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(await api.db.readingArticle.count()).toBe(2);
  });

  it('rechecks admin permission when a long draft audio request finishes', async () => {
    const admin = await register(true), article = await create(admin, {}, true);
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
    synthesize.mockImplementationOnce(async input => { entered(); await gate; return fakeMedia(input); });
    const pending = mutation(admin, 'post', `${adminPath}/${article.id}/audio`, { version: 0 }).then(result => result);
    await started;
    await api.db.user.update({ where: { id: admin.id }, data: { role: 'user' } });
    release(); expect((await pending).status).toBe(403);
    const audio = await api.db.readingAudio.findFirstOrThrow({ where: { articleId: article.id } });
    await get(`${adminPath}/${article.id}/audio/${audio.id}/0.mp3`, admin).expect(403);
    await get(`${articlePath}/${article.id}`).expect(404);
  });
});

describe('R02 server audio', () => {
  it('shares one generation for duplicate requests, persists measured metadata and reuses cached files', async () => {
    const user = await register(), article = await create(user), path = `${articlePath}/${article.id}/audio`;
    const responses = await Promise.all([mutation(user, 'post', path, { version: 0 }), mutation(user, 'post', path, { version: 0 })]);
    expect(responses.map(item => item.status)).toEqual([200, 200]);
    expect(synthesize).toHaveBeenCalledTimes(1);
    const audio = responses[0].body.audio;
    expect(audio).toMatchObject({ articleId: article.id, version: 0, voice: 'ja-JP-NanamiNeural', totalSeconds: 5 });
    expect(audio.segments.map((item: { offsetSec: number }) => item.offsetSec)).toEqual([0, 2.5]);
    expect(responses[1].body.audio).toEqual(audio);
    expect((await mutation(user, 'post', path, { version: 0 }).expect(200)).body.audio).toEqual(audio);
    expect((await get(`${articlePath}/${article.id}`, user)).body.article.audio).toEqual(audio);
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(await api.db.readingAudio.count()).toBe(1);
  });

  it('protects audio and supports real byte range responses; old-version/archive URLs stop working', async () => {
    const a = await register(), b = await register(), article = await create(a);
    await mutation(b, 'post', `${articlePath}/${article.id}/audio`, { version: 0 }).expect(404);
    const audio = (await mutation(a, 'post', `${articlePath}/${article.id}/audio`, { version: 0 }).expect(200)).body.audio;
    const url = audio.segments[0].url;
    await get(url).expect(404); await get(url, b).expect(404);
    const partial = await get(url, a).set('Range', 'bytes=0-2').expect(206);
    expect(partial.headers['content-range']).toMatch(/^bytes 0-2\//);
    expect(partial.headers['content-type']).toMatch(/audio\/mpeg/);
    expect(partial.headers['cache-control']).toBe('no-store');
    await get(url, a).set('Range', 'bytes=999999-').expect(416);
    await mutation(a, 'patch', `${articlePath}/${article.id}`, { version: 0, title: '変更', text: '別の文章。' }).expect(200);
    await get(url, a).expect(404);
    expect((await get(`${articlePath}/${article.id}`, a)).body.article.audio).toBeNull();
    await mutation(a, 'post', `${articlePath}/${article.id}/audio`, { version: 0 }).expect(409);
    const second = (await mutation(a, 'post', `${articlePath}/${article.id}/audio`, { version: 1 }).expect(200)).body.audio;
    await mutation(a, 'delete', `${articlePath}/${article.id}`, { version: 1 }).expect(204);
    await get(second.segments[0].url, a).expect(404);
    expect(synthesize).toHaveBeenCalledTimes(2);
  });

  it('reuses measured files after title-only edits instead of synthesizing identical text again', async () => {
    const user = await register(), article = await create(user);
    const first = (await mutation(user, 'post', `${articlePath}/${article.id}/audio`, { version: 0 }).expect(200)).body.audio;
    await mutation(user, 'patch', `${articlePath}/${article.id}`, { version: 0, title: 'Tên mới', text: article.text }).expect(200);
    const second = (await mutation(user, 'post', `${articlePath}/${article.id}/audio`, { version: 1 }).expect(200)).body.audio;
    expect(second).toEqual({ ...first, version: 1 });
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(await api.db.readingAudio.count()).toBe(1);
    await get(second.segments[0].url, user).expect(200);
  });

  it('keeps article text on provider failure and safely retries a failed claim', async () => {
    const user = await register(), article = await create(user), path = `${articlePath}/${article.id}/audio`;
    synthesize.mockRejectedValueOnce(new Error('private provider detail'));
    const failed = await mutation(user, 'post', path, { version: 0 }).expect(503);
    expect(failed.body.error.code).toBe('AUDIO_UNAVAILABLE');
    expect(JSON.stringify(failed.body)).not.toContain('private provider');
    expect((await get(`${articlePath}/${article.id}`, user)).body.article).toMatchObject({ text: article.text, audio: null });
    expect((await api.db.readingAudio.findFirstOrThrow()).status).toBe('failed');
    await mutation(user, 'post', path, { version: 0 }).expect(200);
    expect(await api.db.readingAudio.count()).toBe(1);
    expect(synthesize).toHaveBeenCalledTimes(2);
  });

  it('rejects incorrect provider mappings and never exposes partial audio', async () => {
    const user = await register(), article = await create(user);
    synthesize.mockImplementationOnce(async input => { const output = await fakeMedia(input); output.segments[0].sentenceId = 'wrong'; return output; });
    await mutation(user, 'post', `${articlePath}/${article.id}/audio`, { version: 0 }).expect(503);
    const audio = await api.db.readingAudio.findFirstOrThrow();
    expect(audio.status).toBe('failed');
    expect(await readdir(join(storage, audio.id))).toEqual([]);
    expect((await get(`${articlePath}/${article.id}`, user)).body.article.audio).toBeNull();
  });

  it('removes generated files even when the database cannot save either ready or failed status', async () => {
    const user = await register(), article = await create(user), path = `${articlePath}/${article.id}/audio`;
    const originalUpdate = api.db.readingAudio.updateMany;
    api.db.readingAudio.updateMany = (async () => { throw new Error('simulated database outage'); }) as typeof originalUpdate;
    try {
      const result = await mutation(user, 'post', path, { version: 0 }).expect(503);
      expect(result.body.error.code).toBe('AUDIO_UNAVAILABLE');
    } finally {
      api.db.readingAudio.updateMany = originalUpdate;
    }
    const audio = await api.db.readingAudio.findFirstOrThrow();
    expect(await readdir(join(storage, audio.id))).toEqual([]);
    expect((await get(`${articlePath}/${article.id}`, user)).body.article.audio).toBeNull();
    await api.db.readingAudio.update({ where: { id: audio.id }, data: { leaseUntil: new Date(0) } });
    await mutation(user, 'post', path, { version: 0 }).expect(200);
    expect(await api.db.readingAudio.count()).toBe(1);
    expect(synthesize).toHaveBeenCalledTimes(2);
  });

  it('uses database claims across processes and recovers an expired claim without duplicate rows', async () => {
    const user = await register(), article = await create(user);
    const claim = await api.db.readingAudio.create({ data: { id: randomUUID(), articleId: article.id, articleVersion: 0, contentHash: 'a'.repeat(64), voice: tts.READING_VOICE,
      status: 'generating', claimToken: randomUUID(), leaseUntil: new Date(Date.now() + 210_000), characterCount: article.text.length } });
    await mutation(user, 'post', `${articlePath}/${article.id}/audio`, { version: 0 }).expect(409);
    expect(synthesize).not.toHaveBeenCalled();
    await api.db.readingAudio.update({ where: { id: claim.id }, data: { leaseUntil: new Date(0) } });
    await mutation(user, 'post', `${articlePath}/${article.id}/audio`, { version: 0 }).expect(200);
    expect(await api.db.readingAudio.count()).toBe(1);
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it('does not publish audio when text changes or the session ends during synthesis', async () => {
    const user = await register(), article = await create(user);
    let release!: () => void, entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    synthesize.mockImplementationOnce(async input => { entered(); await gate; return fakeMedia(input); });
    const pending = mutation(user, 'post', `${articlePath}/${article.id}/audio`, { version: 0 }).then(response => response);
    await started;
    await mutation(user, 'patch', `${articlePath}/${article.id}`, { version: 0, title: '編集', text: '新しい文章。' }).expect(200);
    release();
    expect((await pending).status).toBe(409);
    expect((await api.db.readingAudio.findFirstOrThrow()).status).toBe('failed');
    let release2!: () => void, entered2!: () => void;
    const started2 = new Promise<void>(resolve => { entered2 = resolve; });
    const gate2 = new Promise<void>(resolve => { release2 = resolve; });
    synthesize.mockImplementationOnce(async input => { entered2(); await gate2; return fakeMedia(input); });
    const loggedOut = mutation(user, 'post', `${articlePath}/${article.id}/audio`, { version: 1 }).then(response => response);
    await started2;
    await mutation(user, 'post', '/api/auth/logout').expect(204);
    release2();
    expect((await loggedOut).status).toBe(401);
  });

  it('only lets admins generate public audio; published files are readable by guests until archive', async () => {
    const admin = await register(true), user = await register(), article = await create(admin, {}, true);
    await mutation(admin, 'post', `${adminPath}/${article.id}/audio`, { version: 0 }).expect(200);
    await mutation(admin, 'post', `${adminPath}/${article.id}/publish`, { version: 0 }).expect(200);
    await mutation(user, 'post', `${articlePath}/${article.id}/audio`, { version: 1 }).expect(403);
    const audio = (await mutation(admin, 'post', `${articlePath}/${article.id}/audio`, { version: 1 }).expect(200)).body.audio;
    await get(audio.segments[0].url).expect(200);
    await mutation(admin, 'patch', `${adminPath}/${article.id}`, { version: 1, title: 'Nháp mới', text: '新しい文章。', translationsReviewed: true }).expect(200);
    await get(audio.segments[0].url).expect(200);
    await mutation(admin, 'post', `${adminPath}/${article.id}/audio`, { version: 2 }).expect(200);
    await mutation(admin, 'post', `${adminPath}/${article.id}/publish`, { version: 2 }).expect(200);
    await get(audio.segments[0].url).expect(404);
  });

  it('applies a persisted rolling character limit before contacting Edge', async () => {
    const user = await register(), article = await create(user);
    const content = makeReadingContent({ title: 'Quota fixture', text: '字'.repeat(3000) });
    for (let index = 0; index < 10; index++) {
      const fixture = await api.db.readingArticle.create({ data: { id: randomUUID(), userId: user.id, content } });
      await api.db.readingAudio.create({ data: { id: randomUUID(), articleId: fixture.id, articleVersion: 0, contentHash: 'a'.repeat(64), voice: tts.READING_VOICE,
        status: 'failed', claimToken: randomUUID(), leaseUntil: new Date(0), characterCount: 3000 } });
    }
    const limited = await mutation(user, 'post', `${articlePath}/${article.id}/audio`, { version: 0 }).expect(429);
    expect(limited.body.error.code).toBe('AUDIO_LIMIT');
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('rejects an oversized sentence job before claiming quota or contacting Edge', async () => {
    const user = await register(), article = await create(user, { text: '日本。'.repeat(101) });
    const result = await mutation(user, 'post', `${articlePath}/${article.id}/audio`, { version: 0 }).expect(400);
    expect(result.body.error.code).toBe('AUDIO_SENTENCE_LIMIT');
    expect(synthesize).not.toHaveBeenCalled();
    expect(await api.db.readingAudio.count()).toBe(0);
  });

  it('keeps the library owner character budget when another admin generates its audio', async () => {
    const owner = await register(true), editor = await register(true), article = await create(owner, {}, true);
    const content = makeReadingContent({ title: 'Quota fixture', text: '字'.repeat(3000) });
    for (let index = 0; index < 10; index++) {
      const fixture = await api.db.readingArticle.create({ data: { id: randomUUID(), userId: owner.id, scope: 'library', content } });
      await api.db.readingAudio.create({ data: { id: randomUUID(), articleId: fixture.id, articleVersion: 0, contentHash: 'a'.repeat(64), voice: tts.READING_VOICE,
        status: 'failed', claimToken: randomUUID(), leaseUntil: new Date(0), characterCount: 3000 } });
    }
    const limited = await mutation(editor, 'post', `${adminPath}/${article.id}/audio`, { version: 0 }).expect(429);
    expect(limited.body.error.code).toBe('AUDIO_LIMIT');
    expect(synthesize).not.toHaveBeenCalled();
    const ownArticle = await create(editor);
    await mutation(editor, 'post', `${articlePath}/${ownArticle.id}/audio`, { version: 0 }).expect(200);
  });
});
