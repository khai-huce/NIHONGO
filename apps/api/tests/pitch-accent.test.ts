import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { toKatakana, toRomaji } from 'wanakana';
import { normalizePitchReading } from '@nihongo/shared/study/pitch-accent';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';
import type { Prisma } from '@prisma/client';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1))) {
  throw new Error('Refusing non-test database');
}
const config: Config = {
  NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: '',
};
const endpoint = '/api/pitch-accent';
let api: ReturnType<typeof createApp>;
let sourceId: string, prefix: string, kana: string;

async function seed(overrides: Partial<Prisma.PitchAccentEntryUncheckedCreateInput> = {}) {
  const word = overrides.word ?? `${prefix}語`, reading = overrides.reading ?? kana;
  return api.db.pitchAccentEntry.create({ data: {
    id: randomUUID(), word, reading, wordKey: word.normalize('NFKC').toLowerCase(),
    readingKey: normalizePitchReading(reading), romaji: toRomaji(reading), variants: [{ accent: 0, labels: [] }],
    conjugations: [], sourceId, sourceLine: 42, sourceNotation: '0', published: true, ...overrides,
  } });
}
const search = (q: string, options: { offset?: number; limit?: number } = {}) => request(api.app).get(endpoint).query({ q, ...options });
beforeEach(async () => {
  api = createApp(config);
  const unique = randomUUID().replaceAll('-', '');
  prefix = `pitch${unique}`;
  kana = `てすと${Array.from(unique.slice(0, 12), value => 'あいうえおかきくけこさしすせそた'[parseInt(value, 16)]).join('')}`;
  sourceId = `pitch-test-${unique}`;
  await api.db.contentSource.create({ data: {
    id: sourceId, name: 'Pitch test source', url: 'https://example.test/pitch.txt', license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', version: 'test-1', checksum: 'a'.repeat(64),
    attribution: 'Disposable fixture attribution', notes: 'Fixture only; not real dictionary data.',
  } });
});
afterEach(async () => {
  await api.db.pitchAccentEntry.deleteMany({ where: { sourceId } });
  await api.db.contentSource.deleteMany({ where: { id: sourceId } });
  await api.close();
});

describe('Public pitch accent catalog', () => {
  it('serves guests real published data and public provenance without creating a session or learning records', async () => {
    const entry = await seed();
    const before = await Promise.all([api.db.xpEvent.count(), api.db.reviewCard.count(), api.db.session.count()]);
    const result = await search(prefix).expect(200);
    expect(result.body).toMatchObject({ query: prefix, total: 1, offset: 0, limit: 20, hasMore: false, catalogReady: true,
      items: [{ id: entry.id, word: entry.word, reading: kana, sourceLine: 42, variants: [{ accent: 0, labels: [] }], conjugations: [],
        source: { id: sourceId, name: 'Pitch test source', license: 'CC BY-SA 4.0', version: 'test-1', attribution: 'Disposable fixture attribution' } }] });
    expect(result.headers['set-cookie']).toBeUndefined();
    expect(result.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(result.body)).not.toMatch(/checksum|notes|wordKey|readingKey|sourceNotation|createdAt|email/);
    expect(await Promise.all([api.db.xpEvent.count(), api.db.reviewCard.count(), api.db.session.count()])).toEqual(before);
  });

  it('keeps homophones and multiple attested accents with their source labels separate', async () => {
    const rain = await seed({ word: `${prefix}雨`, variants: [{ accent: 1, labels: ['名詞'] }] });
    const candy = await seed({ word: `${prefix}飴`, variants: [{ accent: 0, labels: [] }, { accent: 2, labels: ['別の用法', '地域'] }] });
    const result = await search(kana).expect(200);
    expect(result.body.total).toBe(2);
    expect(new Set(result.body.items.map((entry: { id: string }) => entry.id))).toEqual(new Set([rain.id, candy.id]));
    expect(result.body.items.find((entry: { id: string }) => entry.id === candy.id).variants).toEqual(candy.variants);
  });

  it('normalizes whitespace, katakana, half-width kana and romaji case without requiring a login', async () => {
    const entry = await seed({ reading: `しゃしん${kana}` });
    for (const query of [entry.reading, toKatakana(entry.reading), toKatakana(entry.reading).replace('シャシン', 'ｼｬｼﾝ'), ` ${entry.romaji.toUpperCase()} `]) {
      const result = await search(query).expect(200);
      expect(result.body.items.map((row: { id: string }) => row.id)).toContain(entry.id);
    }
    const fullWidth = Array.from(prefix, character => String.fromCharCode(character.charCodeAt(0) + 0xfee0)).join('');
    const result = await search(` ${fullWidth} `).expect(200);
    expect(result.body.query).toBe(prefix);
    expect(result.body.items[0].id).toBe(entry.id);
  });

  it('places exact matches before prefixes, reports actual totals, and paginates in a stable order', async () => {
    const exact = await seed({ word: prefix });
    const shortReading = await seed({ word: `${prefix}-0`, reading: kana.slice(0, -1), readingKey: kana.slice(0, -1), romaji: prefix });
    const later = await seed({ word: `${prefix}-c` });
    const middle = await seed({ word: `${prefix}-b` });
    const earlier = await seed({ word: `${prefix}-a` });
    const first = await search(prefix, { limit: 2 }).expect(200);
    const second = await search(prefix, { limit: 2, offset: 2 }).expect(200);
    const third = await search(prefix, { limit: 2, offset: 4 }).expect(200);
    expect(first.body).toMatchObject({ total: 5, offset: 0, limit: 2, hasMore: true });
    expect(first.body.items.map((row: { id: string }) => row.id)).toEqual([exact.id, shortReading.id]);
    expect(second.body.items.map((row: { id: string }) => row.id)).toEqual([earlier.id, middle.id]);
    expect(third.body).toMatchObject({ total: 5, hasMore: false });
    expect(third.body.items[0].id).toBe(later.id);
    expect((await search(prefix, { limit: 2, offset: 2 }).expect(200)).body.items).toEqual(second.body.items);
    expect((await search(prefix, { offset: 50 }).expect(200)).body).toMatchObject({ total: 5, items: [], hasMore: false });
  });

  it('treats percent, underscore, backslash and SQL-looking text as literal input', async () => {
    await seed({ word: `${prefix}normal` });
    for (const suffix of ['%', '_', '\\', "' OR 1=1 --"]) {
      const entry = await seed({ word: `${prefix}${suffix}literal` });
      const result = await search(`${prefix}${suffix}`).expect(200);
      expect(result.body.total).toBe(1);
      expect(result.body.items[0].id).toBe(entry.id);
    }
  });

  it('excludes unpublished entries even for exact matches and never returns invented results', async () => {
    await seed({ word: prefix, published: false });
    const entry = await seed({ word: `${prefix}-public` });
    const result = await search(prefix).expect(200);
    expect(result.body.total).toBe(1);
    expect(result.body.items.map((row: { id: string }) => row.id)).toEqual([entry.id]);
    const missing = await search(`${prefix}no-result`).expect(200);
    expect(missing.body).toMatchObject({ total: 0, items: [], hasMore: false, catalogReady: true });
  });

  it('does not dump the catalog for missing or blank search and uses explicit readiness', async () => {
    const readyBefore = await api.db.pitchAccentEntry.count({ where: { published: true } }) > 0;
    const initial = await request(api.app).get(endpoint).expect(200);
    expect(initial.body).toMatchObject({ query: '', total: 0, items: [], catalogReady: readyBefore });
    await seed();
    const result = await search('　 ').expect(200);
    expect(result.body).toMatchObject({ query: '', total: 0, items: [], hasMore: false, catalogReady: true });
  });

  it('returns only explicitly sourced conjugations instead of synthesizing verb forms', async () => {
    const conjugations = [{ formName: '丁寧形', word: '書きます', reading: 'かきます', variants: [{ accent: 3, labels: [] }],
      sourceUrl: 'https://example.test/attested-form', sourceLine: 8 }];
    await seed({ conjugations });
    const result = await search(prefix).expect(200);
    expect(result.body.items[0].conjugations).toEqual(conjugations);
    await api.db.pitchAccentEntry.updateMany({ where: { sourceId }, data: { conjugations: [] } });
    expect((await search(prefix).expect(200)).body.items[0].conjugations).toEqual([]);
  });

  it('rejects malformed input and pagination before querying the catalog', async () => {
    for (const query of [
      { q: 'a'.repeat(101) }, { q: ['a', 'b'] }, { q: 'a\0b' }, { offset: -1 }, { offset: 1.5 }, { offset: 1000001 },
      { limit: 0 }, { limit: 51 }, { limit: 'not-a-number' }, { limit: '' }, { offset: '1e2' }, { extra: 'value' },
    ]) {
      const result = await request(api.app).get(endpoint).query(query).expect(400);
      expect(result.body.error.code).toBe('VALIDATION_ERROR');
    }
    await search('a'.repeat(100), { limit: 50, offset: 1000000 }).expect(200);
  });

  it('reports invalid stored variants as a catalog error, never as valid pitch or an input error', async () => {
    const entry = await seed({ variants: [{ accent: 999, labels: [] }] });
    await expect(api.db.pitchAccentEntry.update({ where: { id: entry.id }, data: { variants: [] } })).rejects.toThrow('pitch_accent_entries_variants_check');
    for (const variants of [[{ accent: 999, labels: [] }], [{ accent: -1, labels: [] }], [{ accent: 0.5, labels: [] }], [{ accent: 0, labels: 'not-an-array' }]]) {
      await api.db.pitchAccentEntry.update({ where: { id: entry.id }, data: { variants } });
      expect((await search(prefix).expect(503)).body.error.code).toBe('PITCH_DATA_INVALID');
    }
  });

  it('rejects invalid kana and unsourced or invalid conjugations at the public boundary', async () => {
    const entry = await seed({ reading: 'not-kana' });
    expect((await search(prefix).expect(503)).body.error.code).toBe('PITCH_DATA_INVALID');
    await api.db.pitchAccentEntry.update({ where: { id: entry.id }, data: { reading: kana,
      conjugations: [{ formName: '丁寧形', word: '書きます', reading: 'かきます', variants: [{ accent: 3, labels: [] }], sourceUrl: '', sourceLine: 1 }] } });
    expect((await search(prefix).expect(503)).body.error.code).toBe('PITCH_DATA_INVALID');
    await api.db.pitchAccentEntry.update({ where: { id: entry.id }, data: {
      conjugations: [{ formName: '丁寧形', word: '書きます', reading: 'かきます', variants: [{ accent: 5, labels: [] }], sourceUrl: 'https://example.test/form', sourceLine: 1 }] } });
    expect((await search(prefix).expect(503)).body.error.code).toBe('PITCH_DATA_INVALID');
  });
});
