import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { initialCatalogSchema, seedContentCatalog, loadRoadmapDefinition, getKanji } from '../src/content.service.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1)))
  throw new Error('Refusing to clean a non-test database.');
const config: Config = { NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: '' };
const fixture = initialCatalogSchema.parse(JSON.parse(readFileSync(new URL('../content/catalog-initial.json', import.meta.url), 'utf8')));
const base = fixture.kanji[0];
let api: ReturnType<typeof createApp>;
type Actor = { id: string; cookie: string };
async function register(admin = false): Promise<Actor> {
  const response = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN)
    .send({ email: `${randomUUID()}@content.test`, name: 'Kiểm thử nội dung', password: 'test-only-password-123' }).expect(201);
  const actor = { id: response.body.user.id, cookie: (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0] };
  if (admin) await api.db.user.update({ where: { id: actor.id }, data: { role: 'admin' } });
  return actor;
}
const adminRead = (actor: Actor, path: string) => request(api.app).get(`/api/admin/content${path}`).set('Cookie', actor.cookie);
const adminPost = (actor: Actor, path: string, body: Record<string, unknown>) => request(api.app).post(`/api/admin/content${path}`)
  .set('Origin', config.APP_ORIGIN).set('Cookie', actor.cookie).send({ expectedUserId: actor.id, ...body });
const draft = (actor: Actor, data = base.data, expectedVersion: number | null = 0, sourceId = base.sourceId) => request(api.app)
  .put(`/api/admin/content/kanji/${data.id}`).set('Origin', config.APP_ORIGIN).set('Cookie', actor.cookie)
  .send({ expectedUserId: actor.id, data, sourceId, expectedVersion });
const star = (actor: Actor, sourceId: string, active = true) => request(api.app).post('/api/review/star')
  .set('Origin', config.APP_ORIGIN).set('Cookie', actor.cookie).send({ expectedUserId: actor.id, sourceId, category: 'kanji',
    front: 'Giả mạo từ client', back: 'Không được tin', reading: 'Sai', hint: 'Sai', active });
async function restoreCatalog() {
  await api.db.kanjiContent.deleteMany();
  await api.db.radicalContent.deleteMany();
  await api.db.contentSource.deleteMany();
  await seedContentCatalog(api.db, fixture);
}
beforeEach(async () => {
  api = createApp(config);
  await api.db.session.deleteMany();
  await api.db.user.deleteMany();
  await restoreCatalog();
});
afterEach(async () => { vi.restoreAllMocks(); await restoreCatalog(); await api.close(); });

describe('C01 published content and future admin API', () => {
  it('normalizes legacy stars from the published revision on seed without resetting learning or repeating versions', async () => {
    const user = await register(), dueAt = new Date('2027-01-01T00:00:00Z');
    const card = await api.db.reviewCard.create({ data: { userId: user.id, category: 'kanji', sourceId: 'k-1',
      front: '一', back: 'Old source text', active: false, dueAt, intervalSeconds: 86400, reviewCount: 3, version: 4 } });
    await api.db.reviewEvent.create({ data: { cardId: card.id, rating: 'good', dueAt, elapsedMs: 1234 } });
    expect((await seedContentCatalog(api.db, fixture)).synchronizedCards).toBe(1);
    expect(await api.db.reviewCard.findUnique({ where: { id: card.id } })).toMatchObject({ back: base.data.meaning,
      active: false, dueAt, intervalSeconds: 86400, reviewCount: 3, version: 5 });
    expect(await api.db.reviewEvent.count({ where: { cardId: card.id } })).toBe(1);
    expect((await seedContentCatalog(api.db, fixture)).synchronizedCards).toBe(0);
  });

  it('serializes a first star against publication so a stale client cannot restore old content', async () => {
    const admin = await register(true), user = await register();
    const data = { ...base.data, meaning: 'Published during starring' };
    await draft(admin, data).expect(200);
    await Promise.all([star(user, data.id).expect(200), adminPost(admin, `/kanji/${data.id}/publish`, { expectedVersion: 1 }).expect(200)]);
    const saved = await api.db.reviewCard.findFirstOrThrow({ where: { userId: user.id, category: 'kanji', sourceId: data.id } });
    expect(saved.back).toBe(data.meaning);
    expect(saved.reviewCount).toBe(0);
    expect(await api.db.reviewEvent.count()).toBe(0);
  });

  it('serves approved data and sources from DB, preserving old IDs and immutable roadmap', async () => {
    const response = await request(api.app).get('/api/content/catalog').expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.kanji).toHaveLength(111);
    expect(response.body.kanji.filter((item: { level: string }) => item.level === 'N5')).toHaveLength(104);
    expect(response.body.radicals).toHaveLength(50);
    expect(response.body.sources.find((source: { id: string }) => source.id === 'kanjidic2-20260917')).toMatchObject({ license: 'CC BY-SA 4.0' });
    expect(response.body.roadmaps).toEqual(fixture.roadmaps);
    expect(response.body.kanji.find((item: { id: string }) => item.id === 'k-23').kanji).toBe('体');
    expect((await getKanji(api.db, 'k-u5b89'))?.mnemonic).toBe('');
    expect(await loadRoadmapDefinition(api.db, 'n5-v1')).toEqual(fixture.roadmaps[0]);
    await expect(api.db.catalogDefinition.update({ where: { id: 'n5-v1' }, data: { perDay: 5 } })).rejects.toThrow();
    await expect(api.db.catalogDefinition.delete({ where: { id: 'n5-v1' } })).rejects.toThrow();
  });

  it.each(['archive', 'publish'] as const)('keeps every Kanji exactly once when %s occurs during a catalog read', async action => {
    const beforeStatus = action === 'archive' ? 'published' : 'archived';
    const afterStatus = action === 'archive' ? 'archived' : 'published';
    await api.db.kanjiContent.update({ where: { id: base.data.id }, data: { status: beforeStatus } });
    const original = api.db.$transaction, real = original.bind(api.db);
    let changed = false;
    api.db.$transaction = ((callback: (tx: unknown) => unknown, options?: unknown) => real(async tx => {
      const findMany = tx.kanjiContent.findMany, read = findMany.bind(tx.kanjiContent);
      tx.kanjiContent.findMany = (async (args: Parameters<typeof findMany>[0]) => {
        const rows = await read(args);
        if (!changed) {
          changed = true;
          // Commit another writer immediately after the first SELECT has taken its snapshot.
          await api.db.kanjiContent.update({ where: { id: base.data.id }, data: { status: afterStatus, version: { increment: 1 } } });
        }
        return rows;
      }) as typeof findMany;
      try { return await callback(tx); } finally { tx.kanjiContent.findMany = findMany; }
    }, options as never)) as typeof api.db.$transaction;
    try {
      const catalog = (await request(api.app).get('/api/content/catalog').expect(200)).body;
      const ids = [...catalog.kanji, ...catalog.archivedKanji].map((item: { id: string }) => item.id);
      expect(changed).toBe(true);
      expect(ids).toHaveLength(fixture.kanji.length);
      expect(new Set(ids).size).toBe(ids.length);
      const originalList = beforeStatus === 'published' ? catalog.kanji : catalog.archivedKanji;
      expect(originalList.some((item: { id: string }) => item.id === base.data.id)).toBe(true);
      expect(catalog.roadmaps[0].kanjiIds.every((id: string) => ids.includes(id))).toBe(true);
    } finally { api.db.$transaction = original; }
    expect((await api.db.kanjiContent.findUniqueOrThrow({ where: { id: base.data.id } })).status).toBe(afterStatus);
  });

  it('does not grant admin through registration, premium, stale session or a client-supplied owner', async () => {
    await request(api.app).get('/api/admin/content/kanji').expect(401);
    const user = await register();
    await adminRead(user, '/kanji').expect(403);
    await api.db.user.update({ where: { id: user.id }, data: { isPremium: true } });
    await adminRead(user, '/kanji').expect(403);
    await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN)
      .send({ email: 'role@content.test', name: 'Admin?', password: 'test-only-password-123', role: 'admin' }).expect(400);
    const admin = await register(true);
    await adminRead(admin, '/kanji').expect(200);
    await adminPost(admin, '/kanji/k-1/publish', { expectedVersion: 0, expectedUserId: user.id }).expect(409);
    await api.db.user.update({ where: { id: admin.id }, data: { role: 'user' } });
    await adminRead(admin, '/kanji').expect(403);
    await api.db.user.delete({ where: { id: admin.id } });
    await adminRead(admin, '/kanji').expect(401);
  });

  it('keeps draft edits private until publish and blocks stale editors and identity changes', async () => {
    const admin = await register(true);
    const data = { ...base.data, meaning: 'Nghĩa biên tập đã kiểm thử' };
    const saved = await draft(admin, data).expect(200);
    expect(saved.body.item.version).toBe(1);
    expect((await request(api.app).get('/api/content/kanji/k-1').expect(200)).body.item.meaning).toBe(base.data.meaning);
    await draft(admin, { ...data, meaning: 'Ghi đè sai phiên bản' }, 0).expect(409);
    await draft(admin, { ...data, kanji: '𠮷' }, 1).expect(409);
    await adminPost(admin, '/kanji/k-1/publish', { expectedVersion: 0 }).expect(409);
    await adminPost(admin, '/kanji/k-1/publish', { expectedVersion: 1 }).expect(200);
    expect((await request(api.app).get('/api/content/kanji/k-1').expect(200)).body.item.meaning).toBe(data.meaning);
  });

  it('publishes snapshots for active and inactive cards while preserving schedules, assessments and history', async () => {
    const admin = await register(true), learner = await register();
    const dueAt = new Date('2026-10-01T00:00:00Z');
    for (const [userId, active] of [[admin.id, true], [learner.id, false]] as const) {
      const card = await api.db.reviewCard.create({ data: { userId, category: 'kanji', sourceId: 'k-1', front: '一', back: 'Old', active,
        dueAt, intervalSeconds: 86400, reviewCount: 7, version: 9 } });
      await api.db.reviewEvent.create({ data: { id: randomUUID(), cardId: card.id, rating: 'good', dueAt, elapsedMs: 1000 } });
      await api.db.kanjiProgress.create({ data: { userId, kanjiId: 'k-1', memorized: true } });
    }
    const data = { ...base.data, meaning: 'Một bản mới', mnemonic: 'Gợi nhớ đã biên tập' };
    await draft(admin, data).expect(200);
    await adminPost(admin, '/kanji/k-1/publish', { expectedVersion: 1 }).expect(200);
    const cards = await api.db.reviewCard.findMany({ include: { events: true } });
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card).toMatchObject({ back: data.meaning, hint: data.mnemonic, version: 10, intervalSeconds: 86400, reviewCount: 7, dueAt });
      expect(card.events).toHaveLength(1);
    }
    expect(cards.map(card => card.active).sort()).toEqual([false, true]);
    expect(await api.db.kanjiProgress.count({ where: { memorized: true } })).toBe(2);
  });

  it('rolls publishing back if updating SRS snapshots fails', async () => {
    const admin = await register(true);
    await draft(admin, { ...base.data, meaning: 'Not committed' }).expect(200);
    const original = api.db.$transaction, real = original.bind(api.db);
    api.db.$transaction = ((callback: (tx: unknown) => unknown, options?: unknown) => real(async tx => {
      const update = tx.reviewCard.updateMany;
      tx.reviewCard.updateMany = vi.fn().mockRejectedValue(new Error('simulated storage failure'));
      try { return await callback(tx); } finally { tx.reviewCard.updateMany = update; }
    }, options as never)) as typeof api.db.$transaction;
    try { await adminPost(admin, '/kanji/k-1/publish', { expectedVersion: 1 }).expect(503); }
    finally { api.db.$transaction = original; }
    const after = await api.db.kanjiContent.findUniqueOrThrow({ where: { id: 'k-1' } });
    expect(after.version).toBe(1);
    expect((after.published as { meaning: string }).meaning).toBe(base.data.meaning);
  });

  it('previews imports, rejects changed payloads, commits drafts atomically and treats exact retries as no-ops', async () => {
    const admin = await register(true);
    const input = { kind: 'kanji', entries: [
      { sourceId: base.sourceId, expectedVersion: 0, data: { ...base.data, meaning: 'Imported draft' } },
      { sourceId: base.sourceId, expectedVersion: null, data: { ...base.data, id: 'k-test-new', kanji: '𠮷' } },
    ] };
    const preview = await adminPost(admin, '/imports/preview', { input }).expect(200);
    expect(preview.body.canCommit).toBe(true);
    expect(preview.body.rows.map((row: { action: string }) => row.action)).toEqual(['update_draft', 'create_draft']);
    await adminPost(admin, '/imports/commit', { input: { ...input, entries: input.entries.slice(0, 1) }, previewHash: preview.body.previewHash }).expect(409);
    expect(await api.db.kanjiContent.count()).toBe(111);
    const commit = await adminPost(admin, '/imports/commit', { input, previewHash: preview.body.previewHash }).expect(200);
    expect(commit.body).toEqual({ changed: 2, unchanged: 0 });
    const retry = await adminPost(admin, '/imports/commit', { input, previewHash: preview.body.previewHash }).expect(200);
    expect(retry.body).toEqual({ changed: 0, unchanged: 2 });
    await request(api.app).get('/api/content/kanji/k-test-new').expect(404);
    expect((await request(api.app).get('/api/content/catalog')).body.kanji).toHaveLength(111);
  });

  it('rejects invalid or conflicting imports without changing another row', async () => {
    const admin = await register(true);
    const entry = { sourceId: base.sourceId, expectedVersion: 0, data: { ...base.data, meaning: 'Import pending' } };
    const input = { kind: 'kanji', entries: [entry, { ...entry, expectedVersion: null, data: { ...base.data, id: 'k-test-new', kanji: '𠮷' } }] };
    const preview = await adminPost(admin, '/imports/preview', { input }).expect(200);
    await draft(admin, { ...base.data, meaning: 'Other editor won' }).expect(200);
    await adminPost(admin, '/imports/commit', { input, previewHash: preview.body.previewHash }).expect(409);
    expect(await api.db.kanjiContent.findUnique({ where: { id: 'k-test-new' } })).toBeNull();
    await adminPost(admin, '/imports/preview', { input: { kind: 'kanji', entries: [entry, entry] } }).expect(400);
    await adminPost(admin, '/imports/preview', { input: { kind: 'kanji', entries: [{ ...entry, data: { ...entry.data, strokePaths: ['<svg onload=alert(1)>'] } }] } }).expect(400);
    const badSource = await adminPost(admin, '/imports/preview', { input: { kind: 'kanji', entries: [{ ...entry, sourceId: 'missing-source' }] } }).expect(200);
    expect(badSource.body.canCommit).toBe(false);
  });

  it('allows one simultaneous editor to win and never clobbers content on seed reruns', async () => {
    const admin = await register(true);
    const responses = await Promise.all([
      draft(admin, { ...base.data, meaning: 'Version A' }), draft(admin, { ...base.data, meaning: 'Version B' }),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const before = await api.db.kanjiContent.findUniqueOrThrow({ where: { id: 'k-1' } });
    expect(await seedContentCatalog(api.db, fixture)).toEqual({ sources: 0, kanji: 0, radicals: 0, roadmaps: 0, synchronizedCards: 0 });
    expect(await api.db.kanjiContent.findUniqueOrThrow({ where: { id: 'k-1' } })).toEqual(before);
    await expect(seedContentCatalog(api.db, { ...fixture, roadmaps: [{ ...fixture.roadmaps[0], perDay: 5 }] })).rejects.toThrow(/immutable/);
  });

  it('archives without deleting history and lets existing cards and roadmaps keep their original identity', async () => {
    const admin = await register(true), user = await register();
    const first = await star(user, 'k-1').expect(200);
    await adminPost(admin, '/kanji/k-1/archive', { expectedVersion: 0 }).expect(200);
    const catalog = (await request(api.app).get('/api/content/catalog').expect(200)).body;
    expect(catalog.kanji).toHaveLength(110);
    expect(catalog.archivedKanji).toHaveLength(1);
    await request(api.app).get('/api/content/kanji/k-1').expect(200);
    await star(user, 'k-1', false).expect(200);
    const restored = await star(user, 'k-1').expect(200);
    expect(restored.body.card.dueAt).toBe(first.body.card.dueAt);
    await star(admin, 'k-1').expect(400);
    expect((await loadRoadmapDefinition(api.db, 'n5-v1'))?.kanjiIds[0]).toBe('k-1');
    await request(api.app).post('/api/roadmaps/default/start').set('Cookie', user.cookie).set('Origin', config.APP_ORIGIN)
      .send({ expectedUserId: user.id, catalogId: 'n5-v1', day: 1 }).expect(200);
  });

  it('validates new published IDs through DB for stars, progress and personal roadmaps without hardcoded arrays', async () => {
    const admin = await register(true), user = await register();
    const data = { ...base.data, id: 'k-test-new', kanji: '𠮷', meaning: 'New catalog meaning' };
    await draft(admin, data, null).expect(200);
    await star(user, data.id).expect(400);
    await adminPost(admin, '/kanji/k-test-new/publish', { expectedVersion: 0 }).expect(200);
    const card = (await star(user, data.id).expect(200)).body.card;
    expect(card).toMatchObject({ front: data.kanji, back: data.meaning, reading: data.hanViet, hint: data.mnemonic });
    await request(api.app).post('/api/progress/kanji').set('Cookie', user.cookie).set('Origin', config.APP_ORIGIN)
      .send({ expectedUserId: user.id, kanjiId: data.id, memorized: false }).expect(200);
    const id = randomUUID();
    const created = await request(api.app).post('/api/roadmaps').set('Cookie', user.cookie).set('Origin', config.APP_ORIGIN)
      .send({ expectedUserId: user.id, id, name: 'Dynamic catalog', rawKanji: data.kanji, perDay: 5 }).expect(201);
    expect(created.body.roadmap.kanjiList).toEqual([data.kanji]);
    const started = await request(api.app).post('/api/roadmaps/start').set('Cookie', user.cookie).set('Origin', config.APP_ORIGIN)
      .send({ expectedUserId: user.id, id, version: 0, day: 1 }).expect(200);
    const rated = await request(api.app).post('/api/roadmaps/rate').set('Cookie', user.cookie).set('Origin', config.APP_ORIGIN)
      .send({ expectedUserId: user.id, id, progressVersion: started.body.roadmap.progressVersion, day: 1, kanjiId: data.id, memorized: false }).expect(200);
    expect(rated.body.roadmap.completedDays).toEqual([1]);
    expect(await api.db.reviewCard.count()).toBe(1);
  });

  it('publishes radical edits separately from dictionary-radical numbers and kanji decomposition', async () => {
    const admin = await register(true);
    const radical = fixture.radicals[0];
    const before = await getKanji(api.db, 'k-1');
    await request(api.app).put('/api/admin/content/radicals/1').set('Origin', config.APP_ORIGIN).set('Cookie', admin.cookie)
      .send({ expectedUserId: admin.id, expectedVersion: 0, sourceId: radical.sourceId, data: { ...radical.data, meaning: 'Bộ một mới' } }).expect(200);
    expect((await request(api.app).get('/api/content/catalog')).body.radicals[0].meaning).toBe(radical.data.meaning);
    await adminPost(admin, '/radicals/1/publish', { expectedVersion: 1 }).expect(200);
    expect((await request(api.app).get('/api/content/catalog')).body.radicals[0].meaning).toBe('Bộ một mới');
    expect(await getKanji(api.db, 'k-1')).toEqual(before);
  });

  it('requires same-origin JSON, explicit versions and valid known sources for admin mutations', async () => {
    const admin = await register(true);
    await request(api.app).put('/api/admin/content/kanji/k-1').set('Cookie', admin.cookie).send({}).expect(403);
    await request(api.app).put('/api/admin/content/kanji/k-1').set('Cookie', admin.cookie).set('Origin', config.APP_ORIGIN).type('form').send({}).expect(415);
    await adminPost(admin, '/kanji/k-1/publish', {}).expect(400);
    await draft(admin, { ...base.data, meaning: 'Changed' }, 0, 'unknown-source').expect(400);
    await draft(admin, { ...base.data, id: 'k-multi', kanji: '日本' }, null).expect(400);
    await request(api.app).get('/api/content/catalog').query({ status: 'draft' }).expect(400);
  });
});
