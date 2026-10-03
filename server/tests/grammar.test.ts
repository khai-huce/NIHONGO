import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { grammarDraftSchema, type GrammarDraft } from '../src/grammar.schema.js';
import { normalizeGrammarAnswer } from '../src/grammar-study.engine.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1))) throw new Error('Refusing non-test database');
const config: Config = { NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', ADMIN_ORIGIN: 'http://localhost:3002', DATABASE_URL: databaseUrl, SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: '', GEMINI_API_KEY: 'test-fake-key-never-send', GEMINI_MODEL: 'gemini-test', GEMINI_DAILY_LIMIT: 2 };
let api: ReturnType<typeof createApp>, userIds: string[], courseIds: string[], sourceId: string;
type User = { id: string; cookie: string };
type Course = { id: string; slug: string; version: number; draft: GrammarDraft };
const endpoint = '/api/admin/grammar/courses';
const write = (user: User | null, path: string, data: object, method: 'post' | 'patch' = 'post') => request(api.app)[method](path).set('Origin', config.APP_ORIGIN).set('Cookie', user?.cookie ?? '').send({ expectedUserId: user?.id ?? null, ...data });
const get = (path: string, user?: User) => request(api.app).get(path).set('Cookie', user?.cookie ?? '');
async function register(admin = false): Promise<User> {
  const response = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN).send({ name: 'C03 test', email: `c03-${randomUUID()}@example.test`, password: 'C03-test-password-12345' }).expect(201);
  userIds.push(response.body.user.id);
  if (admin) await api.db.user.update({ where: { id: response.body.user.id }, data: { role: 'admin' } });
  return { id: response.body.user.id, cookie: (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0] };
}
function draft(): GrammarDraft { return grammarDraftSchema.parse({ title: 'C03 test fixture', level: 'N5', sourceId, lessons: [{ id: randomUUID(), title: 'Bài kiểm thử', patterns: [{ id: randomUUID(), pattern: 'N も', meaning: 'N cũng', structure: 'N + も', explanation: 'Biểu thị tương đồng', usage: 'Nói thêm đối tượng', examples: [{ id: randomUUID(), japanese: '私も学生です。', vietnamese: 'Tôi cũng là học sinh.', ruby: [{ text: '私', reading: 'わたし' }, { text: 'も学生です。' }] }], exercises: [
    { id: randomUUID(), kind: 'vi-ja', prompt: 'Tôi cũng là học sinh.', answers: ['私も学生です。', 'わたしもがくせいです。'], explanation: 'Dùng も.' },
    { id: randomUUID(), kind: 'ja-vi', prompt: '私も学生です。', answers: ['Tôi cũng là học sinh.'] },
    { id: randomUUID(), kind: 'arrange', prompt: 'Sắp xếp rồi chọn vị trí ★.', prefix: '私', suffix: 'です。', tokens: ['の', '学生', '日本語', 'も'], correctOrder: [3, 2, 0, 1], starIndex: 2, translation: 'Tôi cũng là học sinh tiếng Nhật.' },
  ] }] }] }); }
async function create(admin: User, content = draft(), publish = true): Promise<Course> {
  const id = randomUUID(), slug = `c03-${id}`; courseIds.push(id);
  const response = await write(admin, endpoint, { id, slug, draft: content }).expect(201);
  return publish ? (await write(admin, `${endpoint}/${id}/publish`, { version: response.body.course.version }).expect(200)).body.course : response.body.course;
}
const pattern = (course: Course) => course.draft.lessons[0].patterns[0];
const study = (course: Course, action = 'check') => `/api/grammar/patterns/${pattern(course).id}/${action}`;
const input = (course: Course, index = 0, version = 0, answer: string | number[] = '私も学生です。') => ({ id: randomUUID(), patternVersion: 1, progressVersion: version, exerciseId: pattern(course).exercises[index].id, answer });
beforeEach(async () => {
  api = createApp(config); userIds = []; courseIds = []; sourceId = `c03-${randomUUID()}`;
  await api.db.contentSource.create({ data: { id: sourceId, name: 'C03 disposable test', url: 'urn:nihongo:c03-test', license: 'Test fixture only', licenseUrl: 'urn:nihongo:test', version: '1', checksum: '', attribution: 'C03 tests', notes: '' } });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await api.db.user.deleteMany({ where: { id: { in: userIds } } });
  await api.db.grammarPattern.deleteMany({ where: { lesson: { courseId: { in: courseIds } } } });
  await api.db.grammarLesson.deleteMany({ where: { courseId: { in: courseIds } } });
  await api.db.grammarCourse.deleteMany({ where: { id: { in: courseIds } } });
  await api.db.contentSource.delete({ where: { id: sourceId } });
  await api.close();
});
const aiResponse = (verdict = 'correct') => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ verdict, feedback: 'Bản dịch diễn đạt đúng nghĩa.', suggestedAnswer: 'Tôi cũng là học sinh.' }) }] } }] }), { status: 200 });

describe('C03 catalog, exercises and account progress', () => {
  it('protects admin and account writes; preserves drafts until publish and hides answer keys', async () => {
    await get(endpoint).expect(401);
    const user = await register(), admin = await register(true);
    await get(endpoint, user).expect(403);
    const course = await create(admin, draft(), false);
    await get(`/api/grammar/courses/${course.slug}`).expect(404);
    await write(admin, `${endpoint}/${course.id}/publish`, { version: course.version, expectedUserId: user.id }).expect(409);
    await write(admin, `${endpoint}/${course.id}/publish`, { version: course.version }).expect(200);
    const published = (await get(`/api/grammar/patterns/${pattern(course).id}`).expect(200)).body.pattern;
    expect(published.exercises).toHaveLength(3);
    expect(published.exercises[0]).not.toHaveProperty('answers'); expect(published.exercises[2]).not.toHaveProperty('correctOrder');
    expect(published.exercises[0]).not.toHaveProperty('explanation');
    await write(user, study(course), { ...input(course), expectedUserId: admin.id }).expect(409);
    await request(api.app).post(study(course)).set('Origin', 'https://invalid.example').send(input(course)).expect(403);
  });
  it('validates examples, accepted answers and four unique arrangement indices', async () => {
    const admin = await register(true), content = draft();
    content.lessons[0].patterns[0].examples[0].ruby = [{ text: '違う', reading: 'ちがう' }];
    expect((await write(admin, `${endpoint}/preview`, { draft: content }).expect(400)).body.error.issues.length).toBeGreaterThan(0);
    const other = draft(); other.lessons[0].patterns[0].exercises[2].correctOrder = [0, 0, 2, 3];
    await write(admin, `${endpoint}/preview`, { draft: other }).expect(400);
    const noSource = draft(); noSource.sourceId = null;
    const course = await create(admin, noSource, false);
    await write(admin, `${endpoint}/${course.id}/publish`, { version: course.version }).expect(400);
  });
  it('saves first grades, restores after reload, completes all available kinds and never auto-stars', async () => {
    const admin = await register(true), user = await register(), course = await create(admin);
    const first = await write(user, study(course), input(course, 0, 0, 'わたし も がくせい です！')).expect(200); expect(first.body.result.correct).toBe(true);
    const wrong = await write(user, study(course), input(course, 1, 1, 'Sai nghĩa')).expect(200); expect(wrong.body.result.correct).toBe(false);
    const retry = await write(user, study(course), input(course, 1, 2, 'Tôi cũng là học sinh')).expect(200);
    expect(retry.body.result.correct).toBe(true); expect(retry.body.progress.answers[pattern(course).exercises[1].id].correct).toBe(false);
    const end = await write(user, study(course), input(course, 2, 3, [3, 2, 0, 1])).expect(200);
    expect(end.body.progress.completedAt).toBeTruthy(); expect(end.body.result.starAnswer).toBe(1);
    const reload = await get(study(course, 'progress'), user).expect(200); expect(reload.body.progress.version).toBe(4);
    expect((await get('/api/grammar/progress', user)).body.completedPatternIds).toContain(pattern(course).id);
    expect(await api.db.reviewCard.count({ where: { userId: user.id } })).toBe(0);
    expect((await get(study(course, 'progress'), admin)).body.progress.answers).toEqual({});
  });
  it('reveal records no correct point; guest practice creates no account records', async () => {
    const admin = await register(true), course = await create(admin);
    const revealed = await write(admin, study(course, 'reveal'), input(course, 0, 0, '')).expect(200); expect(revealed.body.result.correct).toBe(false);
    const retry = await write(admin, study(course), input(course, 0, 1)).expect(200);
    expect(retry.body.progress.answers[pattern(course).exercises[0].id].action).toBe('reveal');
    const guest = await write(null, study(course), input(course)).expect(200); expect(guest.body.result.correct).toBe(true); expect(guest.body.userId).toBeNull();
    expect(await api.db.grammarAttempt.count({ where: { patternId: pattern(course).id } })).toBe(2);
    await write(null, study(course, 'ai'), input(course)).expect(401);
  });
  it('deduplicates lost-response retries and prevents two stale tabs from saving', async () => {
    const admin = await register(true), course = await create(admin), body = input(course);
    await write(admin, study(course), body).expect(200); await write(admin, study(course), body).expect(200);
    expect(await api.db.grammarAttempt.count({ where: { patternId: pattern(course).id } })).toBe(1);
    await write(admin, study(course), { ...body, answer: 'different' }).expect(409);
    const results = await Promise.all([write(admin, study(course), input(course, 1, 1, 'Tôi cũng là học sinh.')), write(admin, study(course), input(course, 2, 1, [3, 2, 0, 1]))]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  });
  it('keeps public draft isolation, immutable identity and completed/history after edits/archive', async () => {
    const admin = await register(true), course = await create(admin), content = structuredClone(course.draft);
    await write(admin, study(course), input(course)).expect(200);
    content.lessons[0].patterns[0].meaning = 'N cũng vậy';
    const saved = (await write(admin, `${endpoint}/${course.id}`, { version: course.version, draft: content }, 'patch').expect(200)).body.course;
    expect((await get(`/api/grammar/patterns/${pattern(course).id}`)).body.pattern.meaning).toBe('N cũng');
    await write(admin, `${endpoint}/${course.id}`, { version: course.version, draft: content }, 'patch').expect(409);
    await write(admin, `${endpoint}/${course.id}/publish`, { version: saved.version }).expect(200);
    await write(admin, study(course), input(course, 1, 1, 'Tôi cũng là học sinh.')).expect(409);
    expect(await api.db.grammarAttempt.count({ where: { patternId: pattern(course).id } })).toBe(1);
    const stolen = draft(); stolen.lessons[0].patterns[0].exercises[0].id = pattern(course).exercises[0].id;
    const id = randomUUID(); courseIds.push(id);
    await write(admin, endpoint, { id, slug: `c03-${id}`, draft: stolen }).expect(409);
    expect(await api.db.grammarCourse.findUnique({ where: { id } })).toBeNull();
    const row = await api.db.grammarCourse.findUniqueOrThrow({ where: { id: course.id } });
    const archived = await write(admin, `${endpoint}/${course.id}/archive`, { version: row.version }).expect(200);
    await get(`/api/grammar/patterns/${pattern(course).id}`).expect(404);
    await write(admin, `${endpoint}/${course.id}/restore`, { version: archived.body.course.version }).expect(200);
    await get(`/api/grammar/courses/${course.slug}`).expect(404);
  });
  it('stars server content and refreshes snapshots without touching scheduling/history', async () => {
    const admin = await register(true), course = await create(admin), source = { category: 'grammar', sourceId: `grammar:${pattern(course).id}`, front: 'tampered', back: 'tampered', active: true };
    const starred = (await write(admin, '/api/review/star', source).expect(200)).body.card; expect(starred.front).toBe('N も');
    await write(admin, '/api/review/rate', { id: starred.id, version: starred.version, rating: 'good', elapsedMs: 500 }).expect(200);
    const prior = await api.db.reviewCard.findUniqueOrThrow({ where: { id: starred.id } });
    const content = structuredClone(course.draft); content.lessons[0].patterns[0].meaning = 'N cũng vậy';
    const saved = (await write(admin, `${endpoint}/${course.id}`, { version: course.version, draft: content }, 'patch')).body.course;
    await write(admin, `${endpoint}/${course.id}/publish`, { version: saved.version }).expect(200);
    await write(admin, '/api/review/star', { ...source, active: false }).expect(200);
    const again = (await write(admin, '/api/review/star', source).expect(200)).body.card;
    expect(again.back).toBe('N cũng vậy'); expect(again.intervalSeconds).toBe(prior.intervalSeconds); expect(again.dueAt).toBe(prior.dueAt.toISOString());
    expect(await api.db.reviewEvent.count({ where: { cardId: starred.id } })).toBe(1);
  });
  it('Gemini first assessment counts as a grade; retries reuse completed result and never send account data', async () => {
    const fetcher = vi.fn().mockResolvedValue(aiResponse()); vi.stubGlobal('fetch', fetcher);
    const admin = await register(true), course = await create(admin), body = input(course, 1, 0, 'Tôi cũng là một học sinh.');
    const response = await write(admin, study(course, 'ai'), body).expect(200);
    expect(response.body.result.action).toBe('ai'); expect(response.body.result.correct).toBe(true); expect(response.body.progress.answers[body.exerciseId].correct).toBe(true);
    await write(admin, study(course, 'ai'), body).expect(200); expect(fetcher).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetcher.mock.calls[0][1].body); expect(JSON.stringify(sent)).not.toContain(admin.id); expect(JSON.stringify(sent)).not.toContain('@example.test');
    expect(fetcher.mock.calls[0][1].headers['x-goog-api-key']).toBe(config.GEMINI_API_KEY);
  });
  it('Gemini invalid response and quota do not grade', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"verdict":"correct"}' }] } }] }))));
    const admin = await register(true), course = await create(admin);
    await write(admin, study(course, 'ai'), input(course)).expect(502);
    expect(await api.db.grammarAttempt.count({ where: { userId: admin.id } })).toBe(0);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    await write(admin, study(course, 'ai'), input(course)).expect(429);
    await write(admin, study(course, 'ai'), input(course)).expect(429);
    expect(await api.db.grammarAiRequest.count({ where: { userId: admin.id } })).toBe(2);
    expect((await get(study(course, 'progress'), admin)).body.progress.answers).toEqual({});
  });
  it('Gemini response cannot overwrite a grade saved by another tab during the request', async () => {
    const admin = await register(true), course = await create(admin);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { await write(admin, study(course), input(course, 0, 0, 'wrong')).expect(200); return aiResponse(); }));
    await write(admin, study(course, 'ai'), input(course)).expect(409);
    expect((await get(study(course, 'progress'), admin)).body.progress.answers[pattern(course).exercises[0].id].correct).toBe(false);
  });
  it('concurrent retries of the same AI request call Gemini only once', async () => {
    const admin = await register(true), course = await create(admin), body = input(course);
    const fetcher = vi.fn().mockImplementation(async () => {
      const duplicate = await write(admin, study(course, 'ai'), body).expect(409);
      expect(duplicate.body.error.code).toBe('AI_BUSY');
      return aiResponse();
    });
    vi.stubGlobal('fetch', fetcher);
    await write(admin, study(course, 'ai'), body).expect(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await api.db.grammarAttempt.count({ where: { userId: admin.id } })).toBe(1);
  });
  it('logout during an AI request prevents recording its result', async () => {
    const admin = await register(true), course = await create(admin);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      await write(admin, '/api/auth/logout', {}).expect(204);
      return aiResponse();
    }));
    await write(admin, study(course, 'ai'), input(course)).expect(401);
    expect(await api.db.grammarAttempt.count({ where: { userId: admin.id } })).toBe(0);
    expect(await api.db.grammarProgress.count({ where: { userId: admin.id } })).toBe(0);
  });
  it('normalization preserves Vietnamese accents and Japanese particles', () => {
    expect(normalizeGrammarAnswer('ＴÔＩ cũng！')).toBe(normalizeGrammarAnswer('tôi cũng.'));
    expect(normalizeGrammarAnswer('toi cung')).not.toBe(normalizeGrammarAnswer('tôi cũng'));
    expect(normalizeGrammarAnswer('私は')).not.toBe(normalizeGrammarAnswer('私も'));
  });
});
