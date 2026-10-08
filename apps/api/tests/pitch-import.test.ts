import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { commitPitchImport, parseKanjiumAccents, parseKanjiumConjugations, parseKanjiumContour, parsePitchNotation, preparePitchImport } from '../src/modules/pitch-accent/pitch-import.js';

const formUrl = 'https://example.test/conjugations.txt';
function formRow(word: string, reading: string, formReading: string, html: string, column = 69, readingColumn = 13) {
  const fields = Array<string>(81).fill('');
  fields[0] = '1'; fields[1] = word; fields[2] = 'v5'; fields[3] = reading;
  fields[column] = html; fields[readingColumn] = formReading;
  return fields.join('\t');
}
const form = formRow('書く', 'かく', 'かいて', '<span class="HL">か</span><span class="L">いて</span>');
const words = '書く\tかく\t1\n雨\tあめ\t1\n飴\tあめ\t0\n';

describe('Kanjium source parsing', () => {
  it('preserves source POS labels, their scope and distinct accent variants', () => {
    expect(parsePitchNotation('おてまえ', '(名)2,(代)2,0')).toEqual([
      { accent: 2, labels: ['名'] }, { accent: 2, labels: ['代'] }, { accent: 0, labels: ['代'] },
    ]);
    expect(parsePitchNotation('かちかち', '(形動)0,(副;名)1')).toEqual([
      { accent: 0, labels: ['形動'] }, { accent: 1, labels: ['副', '名'] },
    ]);
    expect(parsePitchNotation('てすと', '0,0,2')).toHaveLength(2);
  });
  it('uses kana words for blank readings, retains homophones, deduplicates only identical rows', () => {
    const result = parseKanjiumAccents(`${words}スーパー\t\t1\n雨\tあめ\t1\n`);
    expect(result.entries).toHaveLength(4);
    expect(result.duplicateRows).toBe(1);
    expect(result.issues).toEqual([]);
    expect(result.entries[3]).toMatchObject({ word: 'スーパー', reading: 'スーパー', sourceLine: 4 });
  });
  it('quarantines unsupported mora/notation and impossible accent positions without clamping', () => {
    const result = parseKanjiumAccents('言論機関\tげんろんきかん\t8,7\nボージョレ・ヌーボー\t\t5\n雨\tあめ\t-1\n雨\tあめ\t1');
    expect(result.entries).toHaveLength(1);
    expect(result.issues.map(issue => issue.line)).toEqual([1, 2, 3]);
    expect(result.entries[0].variants).toEqual([{ accent: 1, labels: [] }]);
  });
  it('does not arbitrarily keep the first assertion when duplicate rows disagree', () => {
    const result = parseKanjiumAccents('雨\tあめ\t1\n雨\tあめ\t0\n雨\tあめ\t1');
    expect(result.entries).toEqual([]);
    expect(result.issues).toHaveLength(2);
  });
  it('converts attested low/rise/drop HTML into structured data and rejects markup or impossible contours', () => {
    expect(parseKanjiumContour('<span class="LH">た</span><span class="HL">べ</span><span class="L">て</span>'))
      .toEqual({ reading: 'たべて', variants: [{ accent: 2, labels: [] }] });
    expect(parseKanjiumContour('<span class="LH">きょ</span><span class="H">う</span>').variants[0].accent).toBe(0);
    for (const html of ['<img src=x onerror=alert(1)>', '<span class="H">あめ</span>', '<span class="LH">あめ</span><span class="H">だ</span>', '<span class="HL">あ</span><span class="HL">め</span>']) {
      expect(() => parseKanjiumContour(html)).toThrow();
    }
  });
  it('keeps only the attested form alternative and requires a matching form reading', () => {
    const alternatives = formRow('存ずる', 'ぞんずる', 'ぞんじれば、ぞんずれば', '<span class="LH">ぞ</span><span class="HL">んず</span><span class="L">れば</span>', 73, 22);
    const invalid = formRow('有る', 'ある', '', '<span class="LH">あ</span><span class="HL">られ</span><span class="L">る</span>', 77, 34);
    const result = parseKanjiumConjugations(`${form}\n${alternatives}\n${invalid}`, formUrl);
    expect(result.entries.get('存ずる\0ぞんずる')?.map(item => item.reading)).toEqual(['ぞんずれば']);
    expect(result.entries.get('有る\0ある')).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.entries.get('書く\0かく')?.[0]).toMatchObject({ sourceLine: 1, sourceUrl: formUrl, reading: 'かいて' });
  });
});

const databaseUrl = process.env.TEST_DATABASE_URL!;
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1))) throw new Error('Refusing non-test database');
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const source = {
  id: `pitch-import-test-${randomUUID()}`, name: 'Disposable pitch source', url: 'https://example.test/pitch',
  license: 'Test fixture', licenseUrl: 'https://example.test/license', version: '1', checksum: '', attribution: 'Test only', notes: '',
};
beforeAll(async () => { await db.$connect(); });
afterAll(async () => {
  await db.pitchAccentEntry.deleteMany({ where: { sourceId: source.id } });
  await db.contentSource.deleteMany({ where: { id: source.id } });
  await db.$disconnect();
});
describe('Pitch import persistence', () => {
  it('joins forms only by exact base word and reading; IDs and preview hashes are repeatable', () => {
    const prepared = preparePitchImport(source, `${words}書く\tがく\t0`, form, formUrl);
    expect(prepared.summary.entriesWithConjugations).toBe(1);
    expect(prepared.entries.find(entry => entry.reading === 'がく')?.conjugations).toEqual([]);
    expect(preparePitchImport(source, `${words}書く\tがく\t0`, form, formUrl).previewHash).toBe(prepared.previewHash);
  });
  it('requires matching preview and imports atomically without duplicates on rerun', async () => {
    const prepared = preparePitchImport(source, words, form, formUrl);
    await expect(commitPitchImport(db, prepared, '0'.repeat(64))).rejects.toThrow('Preview changed');
    expect(await db.pitchAccentEntry.count({ where: { sourceId: source.id } })).toBe(0);
    expect(await commitPitchImport(db, prepared, prepared.previewHash)).toMatchObject({ created: 3, existing: 0 });
    expect(await commitPitchImport(db, prepared, prepared.previewHash)).toMatchObject({ created: 0, existing: 3 });
    const stored = await db.pitchAccentEntry.findMany({ where: { sourceId: source.id } });
    expect(stored.every(entry => entry.published)).toBe(true);
    expect(stored.find(entry => entry.word === '書く')?.conjugations).toEqual([
      { formName: 'Thể て', word: 'かいて', reading: 'かいて', variants: [{ accent: 1, labels: [] }], sourceUrl: formUrl, sourceLine: 1 },
    ]);
  });
  it('rejects relabeling an existing source and leaves its entries intact', async () => {
    const prepared = preparePitchImport({ ...source, license: 'Changed license' }, '橋\tはし\t2', '', formUrl);
    await expect(commitPitchImport(db, prepared, prepared.previewHash)).rejects.toThrow('ID nguồn đã tồn tại');
    expect(await db.pitchAccentEntry.count({ where: { sourceId: source.id } })).toBe(3);
  });
});
