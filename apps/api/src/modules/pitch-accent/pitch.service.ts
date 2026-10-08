import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { PitchEntry, PitchSearchResponse } from '@nihongo/shared/contracts/pitch-accent';
import { getPitchContour, normalizePitchReading } from '@nihongo/shared/study/pitch-accent';
import { HttpError } from '../../common/errors.js';

const variantSchema = z.object({ accent: z.number().int().nonnegative(), labels: z.array(z.string()) }).strict();
const variantsSchema = z.array(variantSchema).min(1);
const conjugationsSchema = z.array(z.object({
  formName: z.string().min(1), word: z.string().min(1), reading: z.string().min(1), variants: variantsSchema,
  sourceUrl: z.url().refine(value => /^https?:\/\//i.test(value)), sourceLine: z.number().int().positive(),
}).strict());
const sourceSelect = { id: true, name: true, url: true, license: true, licenseUrl: true, version: true, attribution: true } as const;
type StoredEntry = Prisma.PitchAccentEntryGetPayload<{ include: { source: { select: typeof sourceSelect } } }>;

function publicEntry(row: StoredEntry): PitchEntry {
  // Malformed stored content is an unavailable catalog response, never a client input error or a guessed accent.
  try {
    const variants = variantsSchema.parse(row.variants);
    const conjugations = conjugationsSchema.parse(row.conjugations);
    for (const variant of variants) getPitchContour(row.reading, variant.accent);
    for (const form of conjugations) {
      for (const variant of form.variants) getPitchContour(form.reading, variant.accent);
    }
    if (row.sourceLine < 1) throw new Error('Missing source line');
    return { id: row.id, word: row.word, reading: row.reading, variants, conjugations, source: row.source, sourceLine: row.sourceLine };
  } catch {
    throw new HttpError(503, 'PITCH_DATA_INVALID', 'Dữ liệu trọng âm này chưa hợp lệ. Vui lòng thử từ khác hoặc thử lại sau.');
  }
}

function literalPrefix(value: string) {
  return `${value.replace(/[\\%_]/g, character => `\\${character}`)}%`;
}

export async function searchPitchAccent(db: PrismaClient, query: string, offset: number, limit: number): Promise<PitchSearchResponse> {
  if (!query) {
    const catalogReady = await db.pitchAccentEntry.findFirst({ where: { published: true }, select: { id: true } }) !== null;
    return { query, items: [], total: 0, offset, limit, hasMore: false, catalogReady };
  }
  const wordKey = query.toLowerCase();
  const readingKey = normalizePitchReading(wordKey);
  const wordPrefix = literalPrefix(wordKey), readingPrefix = literalPrefix(readingKey);
  // All user values are bound parameters. LIKE metacharacters remain literal search characters.
  const where = Prisma.sql`published = true AND (word_key LIKE ${wordPrefix} OR reading_key LIKE ${readingPrefix} OR romaji LIKE ${wordPrefix})`;
  return db.$transaction(async tx => {
    const totals = await tx.$queryRaw<{ total: number; catalogReady: boolean }[]>(Prisma.sql`
      SELECT (SELECT COUNT(*)::integer FROM pitch_accent_entries WHERE ${where}) AS total,
        EXISTS (SELECT 1 FROM pitch_accent_entries WHERE published = true) AS "catalogReady"
    `);
    const { total, catalogReady } = totals[0];
    const selected = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM pitch_accent_entries WHERE ${where}
      ORDER BY CASE WHEN word_key = ${wordKey} OR reading_key = ${readingKey} OR romaji = ${wordKey} THEN 0 ELSE 1 END,
        word COLLATE "C", reading COLLATE "C", id COLLATE "C"
      OFFSET ${offset} LIMIT ${limit}
    `);
    const rows = selected.length ? await tx.pitchAccentEntry.findMany({
      where: { id: { in: selected.map(row => row.id) }, published: true }, include: { source: { select: sourceSelect } },
    }) : [];
    const byId = new Map(rows.map(row => [row.id, row]));
    const items = selected.map(({ id }) => publicEntry(byId.get(id)!));
    return { query, items, total, offset, limit, hasMore: offset + items.length < total, catalogReady };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
