import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';
import { makeReadingContent, type ReadingContent } from '../src/modules/reading/reading-content.js';
import { validateSupplements, supplementWarning } from '../src/modules/reading/reading-supplements.schema.js';
import { readingSupplementCatalog } from '../src/modules/reading/reading-supplements.catalog.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
if (!['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname) || new URL(databaseUrl).pathname !== '/nihongo_test') throw new Error('Isolated database required');
const config: Config = { NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', ADMIN_ORIGIN: 'http://localhost:3002', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'a05-test-secret-longer-than-thirty-two-characters', GOOGLE_CLIENT_ID: '', GEMINI_API_KEY: 'fake-a05', GEMINI_MODEL: 'gemini-test', GEMINI_GLOBAL_DAILY_LIMIT: 10000 };
const base = () => makeReadingContent({ title: 'Private title', subtitle: 'Private subtitle', text: '学校で日本語を勉強しました。\n今日は休みです。',
  annotations: [{ sentenceId: 'p1-s1', translation: 'Tôi đã học tiếng Nhật ở trường.', ruby: [{ text: '学校', reading: 'がっこう' }, { text: 'で' }, { text: '日本語', reading: 'にほんご' }, { text: 'を' }, { text: '勉強', reading: 'べんきょう' }, { text: 'しました。' }] }] }, true);
const evidence = () => [{ sentenceId: 'p1-s1', quote: '学校で日本語を勉強しました。' }];
const empty = () => ({ vocabList: [], grammarList: [], quizList: [] });
const study = () => ({ vocabList: [{ word: '学校', reading: 'がっこう', hanViet: 'HỌC HIỆU', meaning: 'Trường học', evidence: evidence() }],
  grammarList: [{ pattern: 'Nで', meaning: 'Địa điểm diễn ra hành động', exampleJp: '学校で日本語を勉強しました。', exampleVi: 'Tôi đã học tiếng Nhật ở trường.', evidence: evidence() }], quizList: [], warnings: [] as string[] });
const quiz = () => ({ ...empty(), quizList: [{ id: 1, question: 'どこで日本語を勉強しましたか。', options: ['学校', '駅', '家', '店'], correctIndex: 0, explanation: 'Câu đầu nói học ở trường.', evidence: evidence() }], warnings: [] });
const providerResponse = (value: unknown) => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] }), { status: 200 });
const payload = <T extends { warnings: unknown }>(value: T) => { const { warnings: _, ...rest } = value; return rest; };

describe('A05 grounded validation', () => {
  it('accepts short output and even an empty result without forcing filler', async () => {
    expect((await validateSupplements(study(), base(), 'study')).vocabList).toHaveLength(1);
    expect((await validateSupplements({ ...empty(), warnings: ['Bài không đủ nội dung.'] }, base(), 'quiz')).quizList).toEqual([]);
  });
  it('requires exact quotes from the referenced sentence', async () => {
    for (const invalid of [{ sentenceId: 'p2-s1', quote: '学校' }, { sentenceId: 'p1-s1', quote: '昨日' }, { sentenceId: 'none', quote: '学校' }]) {
      const value = study(); value.vocabList[0].evidence = [invalid];
      await expect(validateSupplements(value, base(), 'study')).rejects.toThrow();
    }
  });
  it('accepts a dictionary lemma from cited conjugation but rejects a word outside the article', async () => {
    const content = makeReadingContent({ title: 'Lemma', text: 'パンを食べました。' });
    const value = { ...empty(), vocabList: [{ word: '食べる', reading: 'たべる', hanViet: '', meaning: 'Ăn', evidence: [{ sentenceId: 'p1-s1', quote: content.text }] }], warnings: [] };
    expect((await validateSupplements(value, content, 'study')).vocabList[0].word).toBe('食べる');
    value.vocabList[0].word = '走る'; await expect(validateSupplements(value, content, 'study')).rejects.toThrow();
    const compound = study(); compound.vocabList[0] = { ...compound.vocabList[0], word: '勉強する', reading: 'べんきょうする' };
    expect((await validateSupplements(compound, base(), 'study')).vocabList[0].word).toBe('勉強する');
  });
  it('rejects altered examples, duplicate items and malformed quiz answers', async () => {
    const a = study(); a.grammarList[0].exampleJp = '学校へ行きます。'; await expect(validateSupplements(a, base(), 'study')).rejects.toThrow();
    const b = study(); b.vocabList.push(b.vocabList[0]); await expect(validateSupplements(b, base(), 'study')).rejects.toThrow();
    for (const invalid of [3, 5]) { const q = quiz(); q.quizList[0].options = Array.from({ length: invalid }, (_, i) => String(i)); await expect(validateSupplements(q, base(), 'quiz')).rejects.toThrow(); }
    const q = quiz(); q.quizList[0].options[1] = ' 学校 '; await expect(validateSupplements(q, base(), 'quiz')).rejects.toThrow();
    q.quizList[0].options[1] = '駅'; q.quizList[0].correctIndex = 4; await expect(validateSupplements(q, base(), 'quiz')).rejects.toThrow();
  });
  it('protects populated and nonselected groups and rejects model supplied catalog metadata', async () => {
    const content = base(); content.vocabList = [{ word: '学校', reading: 'がっこう', hanViet: '', meaning: 'Old' }];
    await expect(validateSupplements(study(), content, 'study')).rejects.toThrow();
    await expect(validateSupplements(study(), base(), 'quiz')).rejects.toThrow();
    const a = study(); Object.assign(a.grammarList[0], { jlptLevel: 'N5', href: '/fake' }); await expect(validateSupplements(a, base(), 'study')).rejects.toThrow();
  });
  it('roundtrips cached warnings and source evidence through stored reading content', async () => {
    const value = study(); value.warnings = Array.from({ length: 10 }, (_, i) => `Rà soát ${i}.`);
    const result = await validateSupplements(value, base(), 'study');
    expect(result.warnings.filter(w => w === supplementWarning)).toHaveLength(1);
    expect(await validateSupplements(result, base(), 'study', true, true)).toEqual(result);
    const { evidence: _, ...word } = value.vocabList[0];
    const content = makeReadingContent({ title: 'Evidence', text: base().text, vocabList: [{ ...word, aiEvidence: evidence() }] }, true);
    expect(content.vocabList[0].aiEvidence).toEqual(evidence());
  });
});

type User = { id: string; cookie: string; articleId: string; content: ReadingContent };
let api: ReturnType<typeof createApp>, users: User[], sources: string[], courses: string[];
async function register(content = base()): Promise<User> {
  const res = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN).send({ name: 'A05 QA', email: `a05-${randomUUID()}@example.test`, password: 'A05-test-password-2026!' }).expect(201);
  const user = { id: res.body.user.id, cookie: (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0], articleId: randomUUID(), content };
  users.push(user); await api.db.readingArticle.create({ data: { id: user.articleId, userId: user.id, content } }); return user;
}
const post = (u: User | null, body: object = {}, articleId = u?.articleId ?? randomUUID(), origin = config.APP_ORIGIN) => request(api.app).post(`/api/reading/articles/${articleId}/supplements`).set('Origin', origin).set('Cookie', u?.cookie ?? '').send({ id: randomUUID(), expectedUserId: u?.id ?? randomUUID(), version: 0, kind: 'study', ...body });
const apply = (u: User, requestId: string, lists: object = payload(study()), body: object = {}) => request(api.app).post(`/api/reading/articles/${u.articleId}/supplements/apply`).set('Origin', config.APP_ORIGIN).set('Cookie', u.cookie).send({ requestId, expectedUserId: u.id, version: 0, kind: 'study', ...lists, ...body });
const get = (u: User) => request(api.app).get(`/api/reading/articles/${u.articleId}`).set('Cookie', u.cookie);
function provider(value: unknown = study()) { const fn = vi.fn(async () => providerResponse(value)); vi.stubGlobal('fetch', fn); return fn; }
function deferred() { let done!: (r: Response) => void, entered!: () => void; const started = new Promise<void>(r => { entered = r; }); vi.stubGlobal('fetch', vi.fn(() => { entered(); return new Promise<Response>(r => { done = r; }); })); return { started, finish: () => done(providerResponse(study())) }; }
beforeEach(() => { api = createApp(config); users = []; sources = []; courses = []; });
afterEach(async () => {
  vi.unstubAllGlobals(); vi.restoreAllMocks();
  await api.db.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  await api.db.grammarPattern.deleteMany({ where: { lesson: { courseId: { in: courses } } } });
  await api.db.grammarLesson.deleteMany({ where: { courseId: { in: courses } } });
  await api.db.grammarCourse.deleteMany({ where: { id: { in: courses } } });
  await api.db.kanjiContent.deleteMany({ where: { sourceId: { in: sources } } });
  await api.db.contentSource.deleteMany({ where: { id: { in: sources } } }); await api.close();
});

describe('A05 private preview and atomic apply', () => {
  it('requires owned private article, account, current version and allowed Origin', async () => {
    const a = await register(), b = await register(), fn = provider();
    await post(null, {}, a.articleId).expect(401); await post(a, { expectedUserId: b.id }).expect(409);
    await post(a, {}, b.articleId).expect(404); await post(a, { version: 1 }).expect(409);
    await post(a, {}, a.articleId, 'https://evil.invalid').expect(403);
    await api.db.readingArticle.update({ where: { id: a.articleId }, data: { scope: 'library' } }); await post(a).expect(404);
    expect(fn).not.toHaveBeenCalled();
  });
  it('sends only saved source and missing groups, preview does not write content, XP or SRS', async () => {
    const a = await register(), fn = provider(), res = await post(a).expect(200);
    expect(res.body.result.groups).toEqual(['vocab', 'grammar']);
    const sent = JSON.parse((fn.mock.calls as unknown as [string, { body: string }][]) [0][1].body), data = JSON.parse(sent.contents[0].parts[0].text);
    expect(Object.keys(data).sort()).toEqual(['groups', 'sentences', 'text']); expect(JSON.stringify(sent)).not.toContain(a.content.title); expect(JSON.stringify(sent)).not.toContain(a.id);
    expect((await api.db.readingArticle.findUniqueOrThrow({ where: { id: a.articleId } })).content).toEqual(a.content);
    expect(await api.db.reviewCard.count({ where: { userId: a.id } })).toBe(0); expect(await api.db.xpEvent.count({ where: { userId: a.id } })).toBe(0);
  });
  it('applies edits/deletions, preserves Japanese/annotations/audio and reloads via GET', async () => {
    const a = await register(), id = randomUUID(); provider();
    const audio = await api.db.readingAudio.create({ data: { id: randomUUID(), articleId: a.articleId, articleVersion: 0, contentHash: 'b'.repeat(64), voice: 'test', status: 'ready', claimToken: randomUUID(), leaseUntil: new Date(), segments: [], durationSec: 1, characterCount: 10 } });
    await post(a, { id }).expect(200); const lists = payload(study()); lists.vocabList[0].meaning = 'Nghĩa đã rà soát'; lists.grammarList = [];
    await apply(a, id, lists).expect(200); const article = (await get(a).expect(200)).body.article;
    expect(article.version).toBe(1); expect(article.text).toBe(a.content.text); expect(article.paragraphs).toEqual(a.content.paragraphs);
    expect(article.vocabList[0]).toMatchObject({ meaning: 'Nghĩa đã rà soát', aiEvidence: evidence() }); expect(article.grammarList).toEqual([]);
    expect(await api.db.readingAudio.findUnique({ where: { id: audio.id } })).toEqual(audio);
  });
  it('generates only empty study group and preserves existing vocabulary', async () => {
    const content = base(); content.vocabList = [{ word: '学校', reading: 'がっこう', hanViet: '', meaning: 'Manually entered' }];
    const a = await register(content), value = study(); value.vocabList = []; provider(value);
    const res = await post(a).expect(200); expect(res.body.result.groups).toEqual(['grammar']); await apply(a, res.body.id, payload(value)).expect(200);
    expect((await get(a)).body.article.vocabList).toEqual(content.vocabList); await post(a, { version: 1 }).expect(409);
  });
  it('stores quiz with stable IDs and all four choices separately after study', async () => {
    const a = await register(); provider(); const first = await post(a).expect(200); await apply(a, first.body.id).expect(200);
    provider(quiz()); const next = await post(a, { version: 1, kind: 'quiz' }).expect(200);
    await apply(a, next.body.id, payload(quiz()), { version: 1, kind: 'quiz' }).expect(200);
    const article = (await get(a)).body.article; expect(article.version).toBe(2); expect(article.quizList[0]).toMatchObject({ id: 1, options: quiz().quizList[0].options, aiEvidence: evidence() }); expect(article.vocabList).toHaveLength(1);
  });
  it('caches per account/purpose and counts only provider calls', async () => {
    const a = await register(), b = await register(), fn = provider(); const id = randomUUID();
    await post(a, { id }).expect(200); expect((await post(a, { id }).expect(200)).body.cached).toBe(true);
    expect((await post(a).expect(200)).body.cached).toBe(true); await post(b).expect(200); expect(fn).toHaveBeenCalledTimes(2);
    expect(await api.db.readingAnalysisRequest.count({ where: { userId: a.id, providerCalled: true } })).toBe(1);
    await post(a, { id, kind: 'quiz' }).expect(409); await post(b, { id }).expect(409);
  });
  it('uses the reading quiz model override only for quiz and keeps study sampling unchanged', async () => {
    const a = await register(); await api.close(); api = createApp({ ...config, READING_QUIZ_GEMINI_MODEL: 'gemini-3.5-flash-lite' });
    const quizProvider = provider(quiz()), preview = await post(a, { kind: 'quiz' }).expect(200);
    const quizCall = (quizProvider.mock.calls as unknown as [string, { body: string }][])[0];
    expect(quizCall[0]).toContain('/models/gemini-3.5-flash-lite:generateContent');
    expect(JSON.parse(quizCall[1].body).generationConfig).not.toHaveProperty('temperature');
    expect((await api.db.readingAnalysisRequest.findUniqueOrThrow({ where: { id: preview.body.id } })).model).toBe('gemini-3.5-flash-lite');
    expect((await post(a, { kind: 'quiz' }).expect(200)).body.cached).toBe(true); expect(quizProvider).toHaveBeenCalledTimes(1);
    const studyProvider = provider(), studyPreview = await post(a).expect(200);
    const studyCall = (studyProvider.mock.calls as unknown as [string, { body: string }][])[0];
    expect(studyCall[0]).toContain('/models/gemini-test:generateContent');
    expect(JSON.parse(studyCall[1].body).generationConfig.temperature).toBe(0);
    expect((await api.db.readingAnalysisRequest.findUniqueOrThrow({ where: { id: studyPreview.body.id } })).model).toBe('gemini-test');
  });
  it('separates quiz cache and request UUIDs when the reading quiz model changes', async () => {
    const a = await register(), fn = provider(quiz()), id = randomUUID(); await post(a, { id, kind: 'quiz' }).expect(200);
    await api.close(); api = createApp({ ...config, READING_QUIZ_GEMINI_MODEL: 'gemini-3.5-flash-lite' });
    await post(a, { id, kind: 'quiz' }).expect(409);
    expect((await post(a, { kind: 'quiz' }).expect(200)).body.cached).toBe(false);
    expect((await post(a, { kind: 'quiz' }).expect(200)).body.cached).toBe(true); expect(fn).toHaveBeenCalledTimes(2);
    const models = await api.db.readingAnalysisRequest.findMany({ where: { userId: a.id, providerCalled: true }, select: { model: true } });
    expect(models.map(r => r.model).sort()).toEqual(['gemini-3.5-flash-lite', 'gemini-test']);
  });
  it('never falls back from the quiz override and still charges the shared quota on failure', async () => {
    const a = await register(); await api.close(); api = createApp({ ...config, READING_QUIZ_GEMINI_MODEL: 'gemini-3.5-flash-lite', GEMINI_DAILY_LIMIT: 1 });
    const fn = vi.fn(async () => new Response('', { status: 503 })); vi.stubGlobal('fetch', fn);
    await post(a, { kind: 'quiz' }).expect(503); expect(fn).toHaveBeenCalledTimes(1);
    expect((fn.mock.calls as unknown as [string][])[0][0]).toContain('/models/gemini-3.5-flash-lite:generateContent');
    expect(await api.db.readingAnalysisRequest.count({ where: { userId: a.id, model: 'gemini-3.5-flash-lite', status: 'failed', providerCalled: true } })).toBe(1);
    await post(a).expect(429); expect(fn).toHaveBeenCalledTimes(1);
  });
  it('isolates request UUIDs from A04 in both directions', async () => {
    const a = await register(), id = randomUUID(); provider(); await post(a, { id }).expect(200);
    await request(api.app).post(`/api/reading/articles/${a.articleId}/analysis`).set('Origin', config.APP_ORIGIN).set('Cookie', a.cookie).send({ id, version: 0, expectedUserId: a.id }).expect(409);
    const row = await api.db.readingAnalysisRequest.findUniqueOrThrow({ where: { id } });
    await api.db.readingAnalysisRequest.update({ where: { id }, data: { purpose: 'annotations' } });
    await post(a, { id }).expect(409); await apply(a, id).expect(409);
    expect(row.purpose).toBe('study');
  });
  it('accepts identical retry but rejects changed retry and competing preview', async () => {
    const a = await register(); provider(); const first = await post(a).expect(200), second = await post(a).expect(200);
    const outcomes = await Promise.all([apply(a, first.body.id), apply(a, first.body.id)]); expect(outcomes.map(r => r.status)).toEqual([200, 200]);
    expect((await get(a)).body.article.version).toBe(1); const edit = payload(study()); edit.vocabList[0].meaning = 'Changed';
    await apply(a, first.body.id, edit).expect(409); await apply(a, second.body.id).expect(409);
  });
  it('rejects invalid/no-op/new quiz ID and oversized apply without partial writes', async () => {
    const a = await register(); provider(quiz()); const res = await post(a, { kind: 'quiz' }).expect(200);
    const q = quiz(); q.quizList[0].id = 999; await apply(a, res.body.id, payload(q), { kind: 'quiz' }).expect(400);
    await apply(a, res.body.id, empty(), { kind: 'quiz' }).expect(400);
    q.quizList[0].explanation = 'đ'.repeat(70000); await apply(a, res.body.id, payload(q), { kind: 'quiz' }).expect(413);
    expect((await get(a)).body.article.version).toBe(0);
  });
  it('validates empty results as previews but refuses empty apply', async () => {
    const a = await register(); provider({ ...empty(), warnings: ['Không đủ nội dung.'] }); const res = await post(a).expect(200);
    expect(res.body.result.vocabList).toEqual([]); await apply(a, res.body.id, empty()).expect(400);
  });
  it('does not record content after invalid provider output and charges shared quota', async () => {
    const a = await register(); provider({ bad: true }); await post(a).expect(502);
    expect((await get(a)).body.article.version).toBe(0); expect(await api.db.readingAnalysisRequest.count({ where: { userId: a.id, status: 'failed', providerCalled: true } })).toBe(1);
    await api.close(); api = createApp({ ...config, GEMINI_DAILY_LIMIT: 1 }); const fn = provider(); await post(a).expect(429); expect(fn).not.toHaveBeenCalled();
  });
  it('discards a provider response when article version changes in flight', async () => {
    const a = await register(), pending = deferred(), call = post(a).then(r => r); await pending.started;
    await api.db.readingArticle.update({ where: { id: a.articleId }, data: { version: 1 } }); pending.finish(); expect((await call).status).toBe(409);
    expect((await get(a)).body.article.vocabList).toEqual([]);
  });
  it('discards a provider response after logout', async () => {
    const a = await register(), pending = deferred(), call = post(a).then(r => r); await pending.started;
    await request(api.app).post('/api/auth/logout').set('Origin', config.APP_ORIGIN).set('Cookie', a.cookie).send({}).expect(204); pending.finish(); expect((await call).status).toBe(409);
    expect((await api.db.readingArticle.findUniqueOrThrow({ where: { id: a.articleId } })).version).toBe(0);
  });
  it('preserves supplements and source annotations on title-only update and later A04 apply', async () => {
    const a = await register(); provider(); const res = await post(a).expect(200); await apply(a, res.body.id).expect(200);
    const before = (await get(a)).body.article;
    await request(api.app).patch(`/api/reading/articles/${a.articleId}`).set('Origin', config.APP_ORIGIN).set('Cookie', a.cookie).send({ expectedUserId: a.id, version: 1, title: 'New title', subtitle: '', text: a.content.text }).expect(200);
    const current = (await get(a)).body.article; expect(current.vocabList).toEqual(before.vocabList); expect(current.paragraphs).toEqual(before.paragraphs);
    const annotations = a.content.paragraphs.flatMap(p => p.sentences).map(s => ({ sentenceId: s.id, japanese: s.japanese, translation: s.translation || 'Hôm nay nghỉ.', ruby: s.ruby || [{ text: '今日', reading: 'きょう' }, { text: 'は' }, { text: '休', reading: 'やす' }, { text: 'みです。' }] }));
    provider({ sentences: annotations, warnings: [] }); const id = randomUUID();
    await request(api.app).post(`/api/reading/articles/${a.articleId}/analysis`).set('Origin', config.APP_ORIGIN).set('Cookie', a.cookie).send({ id, version: current.version, expectedUserId: a.id }).expect(200);
    await request(api.app).post(`/api/reading/articles/${a.articleId}/analysis/apply`).set('Origin', config.APP_ORIGIN).set('Cookie', a.cookie).send({ requestId: id, version: current.version, expectedUserId: a.id, annotations }).expect(200);
    expect((await get(a)).body.article.vocabList).toEqual(before.vocabList);
  });
  it('resolves only unique published grammar and removes stale level/link after archive', async () => {
    const a = await register(), source = `a05-${randomUUID()}`, course = randomUUID(), lesson = randomUUID(), pattern = randomUUID(); sources.push(source); courses.push(course);
    await api.db.contentSource.create({ data: { id: source, name: 'QA', url: 'urn:qa', license: 'Test only', licenseUrl: 'urn:qa', version: '1', checksum: '', attribution: 'QA', notes: '' } });
    await api.db.grammarCourse.create({ data: { id: course, slug: `a05-${course}`, level: 'N5', draft: {}, publishedVersion: 1, sourceId: source, publishedSourceId: source } });
    await api.db.grammarLesson.create({ data: { id: lesson, courseId: course, title: 'QA', active: true } });
    await api.db.grammarPattern.create({ data: { id: pattern, lessonId: lesson, active: true, content: { pattern: 'Nで', meaning: 'Published meaning' } } });
    const matched = await readingSupplementCatalog(api.db, study()); expect(matched.grammar[0]?.id).toBe(pattern);
    const duplicate = randomUUID(); await api.db.grammarPattern.create({ data: { id: duplicate, lessonId: lesson, active: true, content: { pattern: 'N で', meaning: 'Other' } } });
    expect((await readingSupplementCatalog(api.db, study())).grammar).toEqual([null]);
    await api.db.grammarPattern.update({ where: { id: duplicate }, data: { active: false } });
    provider(); const preview = await post(a).expect(200); await apply(a, preview.body.id).expect(200); expect((await get(a)).body.article.grammarList[0].jlptLevel).toBe('N5');
    await api.db.grammarCourse.update({ where: { id: course }, data: { archivedAt: new Date() } });
    const current = (await get(a)).body.article; expect(current.grammarList[0].jlptLevel).toBe(''); expect(current.supplementCatalog.grammar).toEqual([null]);
  });
  it('matches vocabulary using both writing and kana reading, never draft/archived data', async () => {
    const source = `a05-${randomUUID()}`, kanji = `a05-${randomUUID().slice(0, 26)}`; sources.push(source);
    await api.db.contentSource.create({ data: { id: source, name: 'Vocabulary QA source', url: 'urn:qa', license: 'Test only', licenseUrl: 'urn:qa', version: '1', checksum: '', attribution: 'QA', notes: '' } });
    await api.db.kanjiContent.create({ data: { id: kanji, character: 'QA字', level: 'N5', hanViet: '', meaning: 'QA only', sourceId: source, draftSourceId: source, draft: { examples: [{ word: '学校', reading: 'がっこう', meaning: 'DRAFT' }] }, published: { examples: [{ word: '学校', reading: 'ガッコウ', meaning: 'Published meaning' }] }, status: 'published' } });
    const match = (await readingSupplementCatalog(api.db, study())).vocab[0]; expect(match?.definitions).toEqual([{ meaning: 'Published meaning', source: 'Vocabulary QA source' }]);
    const otherReading = study(); otherReading.vocabList[0].reading = 'がくこう'; expect((await readingSupplementCatalog(api.db, otherReading)).vocab).toEqual([null]);
    for (const status of ['draft', 'archived']) { await api.db.kanjiContent.update({ where: { id: kanji }, data: { status } }); expect((await readingSupplementCatalog(api.db, study())).vocab).toEqual([null]); }
  });
});
