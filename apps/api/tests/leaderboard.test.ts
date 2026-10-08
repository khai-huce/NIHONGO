import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';
import { awardLearningXp, readLeaderboard, xpStudyDate, type XpGrant } from '../src/modules/leaderboard/leaderboard.service.js';
import { KANA_CATALOG_ID, makeKanaQuiz } from '@nihongo/shared/study/kana-quiz';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1))) throw Error('Refusing non-test database');
const config: Config = { NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: '' };
let api: ReturnType<typeof createApp>;
type Learner = { id: string; cookie: string };
const post = (user: Learner, path: string, body: object) => request(api.app).post(`/api${path}`).set('Origin', config.APP_ORIGIN).set('Cookie', user.cookie).send({ expectedUserId: user.id, ...body });
const xp = async (id: string) => (await api.db.xpEvent.aggregate({ where: { userId: id }, _sum: { points: true } }))._sum.points ?? 0;
const grants = (count: number, prefix = 'word'): XpGrant[] => Array.from({ length: count }, (_, index) => ({ kind: 'vocab', sourceKey: `${prefix}:${index}` }));
const award = (id: string, items: XpGrant[], at?: Date) => api.db.$transaction(tx => awardLearningXp(tx, id, items, at), { maxWait: 15000, timeout: 30000 });
async function register(): Promise<Learner> {
  const result = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN).send({ name: 'Xếp hạng test', email: `xp-${randomUUID()}@example.test`, password: 'test-password-for-ranking' }).expect(201);
  return { id: result.body.user.id, cookie: (result.headers['set-cookie'] as unknown as string[])[0].split(';')[0] };
}
beforeEach(async () => { api = createApp(config); await api.db.session.deleteMany(); await api.db.user.deleteMany(); });
afterEach(async () => { await api.close(); });

describe('XP ledger and public rankings', () => {
  it('starts empty without backfilling old progress; zero-XP account sees own real metrics', async () => {
    const user = await register();
    await api.db.reviewCard.create({ data: { userId: user.id, category: 'vocab', sourceId: 'old', front: '日', back: 'ngày' } });
    await api.db.personalRoadmap.create({ data: { id: randomUUID(), userId: user.id, name: 'Old', rawKanji: '一', kanjiList: ['一'], perDay: 5, completedDays: [1] } });
    const anonymous = await request(api.app).get('/api/leaderboard').expect(200);
    expect(anonymous.body).toMatchObject({ userId: null, entries: [], currentUser: null });
    const own = await request(api.app).get('/api/leaderboard').set('Cookie', user.cookie).expect(200);
    expect(own.body).toMatchObject({ userId: user.id, entries: [], currentUser: { rank: null, xp: 0, flashcards: 1, roadmapDays: 1 } });
    expect(own.headers['cache-control']).toBe('no-store');
    expect(await xp(user.id)).toBe(0);
    await request(api.app).get('/api/leaderboard?period=week').expect(400);
    await request(api.app).get(`/api/leaderboard?userId=${user.id}`).expect(400);
    await post(user, '/leaderboard', { xp: 9999 }).expect(404);
  });

  it('serializes duplicate and cross-module grants under one daily 200 XP cap', async () => {
    const user = await register(), at = new Date('2026-10-03T10:00:00Z');
    await Promise.all([award(user.id, grants(160), at), award(user.id, grants(160, 'other').map(item => ({ ...item, kind: 'grammar' })), at), award(user.id, grants(160), at)]);
    expect(await xp(user.id)).toBe(200);
    expect(await api.db.xpEvent.count({ where: { userId: user.id } })).toBe(320);
    await award(user.id, [{ kind: 'roadmap', sourceKey: 'personal:one:1' }], at);
    expect(await xp(user.id)).toBe(200);
    expect((await award(user.id, [{ kind: 'roadmap', sourceKey: 'personal:one:1' }], new Date('2026-10-04T10:00:00Z'))).awarded).toBe(0);
  });

  it('uses Vietnamese midnight/month and gives lifetime roadmap rewards only once', async () => {
    const user = await register(), before = new Date('2026-09-30T16:59:59Z'), after = new Date('2026-09-30T17:00:00Z');
    expect(xpStudyDate(before)).toBe('2026-09-30'); expect(xpStudyDate(after)).toBe('2026-10-01');
    const items: XpGrant[] = [{ kind: 'review', sourceKey: 'card' }, { kind: 'roadmap', sourceKey: 'default:n5-v1:1' }, ...grants(1)];
    expect((await award(user.id, items, before)).awarded).toBe(13);
    expect((await award(user.id, items, after)).awarded).toBe(3);
    expect((await readLeaderboard(api.db, 'month', user.id, after)).currentUser?.xp).toBe(3);
    expect((await readLeaderboard(api.db, 'all', user.id, after)).currentUser?.xp).toBe(16);
    expect(xpStudyDate(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01');
  });

  it('returns true ties, stable top ten and own rank outside top without private profile fields', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) {
      const user = await api.db.user.create({ data: { email: `rank-${i}@example.test`, name: `Learner ${i}`, googleSub: `test-rank-${i}`, createdAt: new Date(2026, 0, i + 1) } });
      ids.push(user.id); await award(user.id, grants(i === 11 ? 11 : i + 1));
    }
    const result = await readLeaderboard(api.db, 'all', ids[0]);
    expect(result.entries).toHaveLength(10);
    expect(result.entries.slice(0, 3).map(row => row.rank)).toEqual([1, 1, 3]);
    expect(result.entries[0].userId).toBe(ids[10]);
    expect(result.currentUser).toMatchObject({ userId: ids[0], rank: 12, xp: 1 });
    expect(JSON.stringify(result)).not.toMatch(/email|password|googleSub|sourceKey|dedupeKey/);
    expect((await readLeaderboard(api.db, 'all', null)).currentUser).toBeNull();
  });

  it('rolls back learning and reward together; removing content does not remove earned XP', async () => {
    const user = await register();
    await expect(api.db.$transaction(async tx => {
      await tx.reviewCard.create({ data: { userId: user.id, category: 'vocab', sourceId: 'rollback', front: 'x', back: 'y' } });
      await awardLearningXp(tx, user.id, grants(3));
      throw Error('rollback');
    })).rejects.toThrow('rollback');
    expect(await xp(user.id)).toBe(0); expect(await api.db.reviewCard.count()).toBe(0);
    const card = await api.db.reviewCard.create({ data: { userId: user.id, category: 'vocab', sourceId: 'retained', front: 'x', back: 'y' } });
    await award(user.id, [{ kind: 'review', sourceKey: card.id }]);
    await api.db.reviewCard.delete({ where: { id: card.id } });
    expect(await xp(user.id)).toBe(2);
    await api.db.user.delete({ where: { id: user.id } }); expect(await api.db.xpEvent.count()).toBe(0);
  });

  it('SRS only rewards saved due reviews, never stars, resets or repeated reviews on the same day', async () => {
    const user = await register();
    const star = { category: 'vocab', sourceId: 'xp-test', front: '日', back: 'ngày', active: true };
    let card = (await post(user, '/review/star', star).expect(200)).body.card;
    expect(await xp(user.id)).toBe(0);
    const rate = () => post(user, '/review/rate', { id: card.id, version: card.version, rating: 'again', elapsedMs: 1000 });
    await rate().expect(200); expect(await xp(user.id)).toBe(2);
    await rate().expect(409); expect(await xp(user.id)).toBe(2);
    await post(user, '/review/reset', { category: 'vocab', expectedCount: 1 }).expect(200);
    card = (await post(user, '/review/star', { ...star, active: false }).expect(200)).body.card;
    card = (await post(user, '/review/star', star).expect(200)).body.card;
    card.id = card.id.toUpperCase();
    await rate().expect(200); expect(await xp(user.id)).toBe(2);
    const other = await register(); expect((await readLeaderboard(api.db, 'all', other.id)).currentUser?.xp).toBe(0);
  });

  it('vocab quiz/cram share word claims; duplicate requests and changed accounts cannot add points', async () => {
    const user = await register(), lessonId = randomUUID();
    const words = [{ id: randomUUID(), word: '水', reading: 'みず', hanViet: '', meaning: 'Nước' }, { id: randomUUID(), word: '火', reading: 'ひ', hanViet: '', meaning: 'Lửa' }];
    await api.db.vocabLesson.create({ data: { id: lessonId, userId: user.id, name: 'XP test', words } });
    const body = { id: randomUUID(), lessonId, lessonVersion: 0, kind: 'quiz', mode: 'reading', answers: words.map(word => ({ wordId: word.id, answer: word.reading })) };
    await post(user, '/vocab/results', body).expect(201); expect(await xp(user.id)).toBe(2);
    await post(user, '/vocab/results', body).expect(200);
    await post(user, '/vocab/results', { ...body, id: randomUUID(), kind: 'cram' }).expect(201);
    expect(await xp(user.id)).toBe(2);
    await post(user, '/vocab/results', { ...body, id: randomUUID(), expectedUserId: randomUUID() }).expect(409);
    const uppercaseWords = words.map(word => ({ ...word, id: word.id.toUpperCase() }));
    await post(user, '/vocab/lessons/update', { id: lessonId, version: 0, words: uppercaseWords }).expect(200);
    await post(user, '/vocab/results', { ...body, id: randomUUID(), lessonVersion: 1,
      answers: uppercaseWords.map(word => ({ wordId: word.id, answer: word.reading })) }).expect(201);
    expect(await xp(user.id)).toBe(2);
    await api.db.vocabLesson.delete({ where: { id: lessonId } }); expect(await xp(user.id)).toBe(2);
  });

  it('kana claims follow character and script, not round IDs or selected quiz mode', async () => {
    const user = await register();
    const body = { id: randomUUID(), catalogId: KANA_CATALOG_ID, mode: 'hiragana', answers: makeKanaQuiz('hiragana').map(item => ({ kanaId: item.kanaId, script: item.script, answerId: item.kanaId })) };
    await post(user, '/kana/results', body).expect(201); expect(await xp(user.id)).toBe(104);
    await post(user, '/kana/results', body).expect(200);
    await post(user, '/kana/results', { ...body, id: randomUUID() }).expect(201); expect(await xp(user.id)).toBe(104);
    const both = makeKanaQuiz('both').map(item => ({ kanaId: item.kanaId, script: item.script, answerId: item.kanaId }));
    await post(user, '/kana/results', { ...body, id: randomUUID(), mode: 'both', answers: both }).expect(201);
    expect(await xp(user.id)).toBe(156);
  });
});
