import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { toRomaji } from 'wanakana';
import { getPitchContour, normalizePitchReading, splitMoras } from '@nihongo/shared/study/pitch-accent';
import type { PitchConjugation, PitchVariant } from '@nihongo/shared/contracts/pitch-accent';
import { createContentSource } from '../content/content.service.js';
import { contentSourceSchema } from '../content/content.schema.js';

export const PITCH_IMPORT_VERSION = 'c05-v1';
export const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export type ImportIssue = { file: string; line: number; reason: string };
type Source = ReturnType<typeof contentSourceSchema.parse>;
type Entry = { word: string; reading: string; variants: PitchVariant[]; sourceLine: number; sourceNotation: string };
const linesOf = (text: string) => text.replace(/^\uFEFF/, '').split(/\r?\n/);
const keyOf = (word: string, reading: string) => `${word.normalize('NFKC')}\0${normalizePitchReading(reading)}`;
const reason = (error: unknown) => error instanceof Error ? error.message : 'Invalid source row';

export function parsePitchNotation(reading: string, notation: string): PitchVariant[] {
  let labels: string[] = [];
  const variants: PitchVariant[] = [];
  for (const part of notation.split(',')) {
    const match = /^(?:\(([^()]+)\))?(\d+)$/.exec(part);
    if (!match) throw new Error('Unsupported accent notation');
    if (match[1]) {
      labels = match[1].split(';');
      if (labels.some(label => !['名', '代', '副', '形動', '感'].includes(label))) throw new Error('Unsupported source label');
    }
    const accent = Number(match[2]);
    getPitchContour(reading, accent);
    if (!variants.some(item => item.accent === accent && item.labels.join(';') === labels.join(';'))) {
      variants.push({ accent, labels: [...labels] });
    }
  }
  return variants;
}

export function parseKanjiumAccents(text: string) {
  const entries = new Map<string, Entry>();
  const conflicts = new Set<string>();
  const issues: ImportIssue[] = [];
  let duplicateRows = 0;
  linesOf(text).forEach((line, index) => {
    if (!line) return;
    try {
      const fields = line.split('\t');
      if (fields.length !== 3) throw new Error('Expected exactly 3 tab-separated fields');
      const [word, rawReading, sourceNotation] = fields;
      const reading = rawReading || word;
      if (!word || word.length > 100 || reading.length > 100 || sourceNotation.length > 500) throw new Error('Invalid field length');
      const variants = parsePitchNotation(reading, sourceNotation);
      const key = `${word}\0${reading}`;
      if (conflicts.has(key)) throw new Error('Conflicting duplicate word and reading');
      const existing = entries.get(key);
      if (existing) {
        if (JSON.stringify(existing.variants) !== JSON.stringify(variants)) {
          entries.delete(key); conflicts.add(key);
          throw new Error('Conflicting duplicate word and reading');
        }
        duplicateRows++;
      } else entries.set(key, { word, reading, variants, sourceLine: index + 1, sourceNotation });
    } catch (error) { issues.push({ file: 'accents.txt', line: index + 1, reason: reason(error) }); }
  });
  return { entries: [...entries.values()], issues, duplicateRows };
}

// Column positions are from Kanjium's source_files/0_README.txt at the pinned revision.
const forms = [
  [68, 4, 'Lịch sự (ます／です)'], [69, 13, 'Thể て'], [70, 9, 'Quá khứ (た)'],
  [71, 5, 'Phủ định (ない)'], [72, 11, 'Phủ định quá khứ'], [73, 22, 'Điều kiện (ば)'],
  [74, 50, 'Sai khiến'], [75, 42, 'Bị động'], [76, 30, 'Mệnh lệnh'],
  [77, 34, 'Khả năng'], [78, 26, 'Ý chí'], [79, 66, 'Dạng trạng từ'],
] as const;

/** Read a strict, attested contour. Never execute or render the source HTML. */
export function parseKanjiumContour(html: string) {
  const spans = [...html.matchAll(/<span class="(LH|HL|H|L)">([^<>]+)<\/span>/g)];
  if (!spans.length || spans.map(span => span[0]).join('') !== html) throw new Error('Unsupported source contour markup');
  const reading = spans.map(span => span[2]).join('');
  const supplied: { text: string; high: boolean; drop: boolean }[] = [];
  let accent = 0;
  for (const span of spans) {
    const moras = splitMoras(span[2]);
    if (span[1] === 'LH' && moras.length !== 1) throw new Error('Ambiguous rising contour');
    moras.forEach((text, index) => supplied.push({ text, high: ['H', 'HL'].includes(span[1]), drop: span[1] === 'HL' && index === moras.length - 1 }));
    if (span[1] === 'HL') {
      if (accent) throw new Error('Multiple drops in one source contour');
      accent = supplied.length;
    }
  }
  if (JSON.stringify(getPitchContour(reading, accent).moras) !== JSON.stringify(supplied)) throw new Error('Source contour does not match a word accent');
  return { reading, variants: [{ accent, labels: [] }] satisfies PitchVariant[] };
}

export function parseKanjiumConjugations(text: string, sourceUrl: string) {
  const entries = new Map<string, PitchConjugation[]>();
  const issues: ImportIssue[] = [];
  linesOf(text).forEach((line, index) => {
    if (!line) return;
    const fields = line.split('\t');
    if (fields.length !== 81 || !fields[1] || !fields[3]) {
      issues.push({ file: 'conjugations.txt', line: index + 1, reason: 'Expected 81 fields and an exact base word/reading' }); return;
    }
    const key = keyOf(fields[1], fields[3]);
    if (entries.has(key)) {
      entries.set(key, []);
      issues.push({ file: 'conjugations.txt', line: index + 1, reason: 'Ambiguous duplicate base word/reading' }); return;
    }
    const result: PitchConjugation[] = [];
    for (const [accentColumn, readingColumn, formName] of forms) {
      if (!fields[accentColumn]) continue;
      try {
        const contour = parseKanjiumContour(fields[accentColumn]);
        const alternatives = fields[readingColumn].split('、').map(normalizePitchReading);
        if (!alternatives.includes(normalizePitchReading(contour.reading))) throw new Error(`${formName}: contour and form reading disagree`);
        result.push({ formName, word: contour.reading, ...contour, sourceUrl, sourceLine: index + 1 });
      } catch (error) { issues.push({ file: 'conjugations.txt', line: index + 1, reason: reason(error) }); }
    }
    entries.set(key, result);
  });
  return { entries, issues };
}

export function preparePitchImport(source: Source, accents: string, conjugations: string, conjugationUrl: string) {
  contentSourceSchema.parse(source);
  const words = parseKanjiumAccents(accents);
  const forms = parseKanjiumConjugations(conjugations, conjugationUrl);
  const entries: Prisma.PitchAccentEntryCreateManyInput[] = words.entries.map(entry => ({
    ...entry, id: sha256(`${source.id}\0${entry.word}\0${entry.reading}`), sourceId: source.id,
    wordKey: entry.word.normalize('NFKC').toLowerCase(), readingKey: normalizePitchReading(entry.reading),
    romaji: toRomaji(entry.reading.normalize('NFKC')).toLowerCase(),
    conjugations: forms.entries.get(keyOf(entry.word, entry.reading)) ?? [], published: true,
  }));
  const issues = [...words.issues, ...forms.issues];
  const summary = {
    parserVersion: PITCH_IMPORT_VERSION, entries: entries.length, duplicateRows: words.duplicateRows,
    variants: words.entries.reduce((sum, entry) => sum + entry.variants.length, 0),
    entriesWithConjugations: entries.filter(entry => (entry.conjugations as PitchConjugation[]).length).length,
    conjugations: entries.reduce((sum, entry) => sum + (entry.conjugations as PitchConjugation[]).length, 0), issues,
  };
  const previewHash = sha256(JSON.stringify({ source, accents: sha256(accents), conjugations: sha256(conjugations), summary }));
  return { source, entries, summary, previewHash };
}

export async function commitPitchImport(db: PrismaClient, prepared: ReturnType<typeof preparePitchImport>, expectedHash: string) {
  if (expectedHash !== prepared.previewHash) throw new Error('Preview changed. Run preview again before importing.');
  if (!prepared.entries.length) throw new Error('No valid pitch entries to import.');
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('nihongo-pitch-import'))`;
    await createContentSource(tx, prepared.source);
    let created = 0;
    for (let start = 0; start < prepared.entries.length; start += 500) {
      created += (await tx.pitchAccentEntry.createMany({ data: prepared.entries.slice(start, start + 500), skipDuplicates: true })).count;
    }
    return { created, existing: prepared.entries.length - created, sourceId: prepared.source.id };
  }, { timeout: 180000, maxWait: 10000 });
}
