import { z } from 'zod';

export const contentId = z.string().regex(/^k-[a-z0-9-]+$/).max(32);
const text = (max: number) => z.string().trim().max(max);
const glyph = text(8).min(1);
const level = z.enum(['N5', 'N4', 'N3', 'N2', 'N1']);
export const kanjiContentSchema = z.object({
  id: contentId, kanji: glyph.refine(value => /^\p{Script=Han}$/u.test(value), 'Mỗi mục cần đúng một chữ Kanji.'), hanViet: text(500).min(1), meaning: text(2000).min(1), level,
  strokeCount: z.number().int().min(1).max(64), radicals: z.array(glyph).max(20),
  radicalParts: z.array(z.object({ radical: glyph, hanViet: text(100), meaning: text(1000) }).strict()).max(20),
  mnemonic: text(2000), onyomi: z.array(text(100).min(1)).max(50), kunyomi: z.array(text(100).min(1)).max(50),
  examples: z.array(z.object({ word: text(200).min(1), reading: text(500), meaning: text(1000),
    furigana: text(1000).optional(), level: level.optional() }).strict()).max(100),
  strokePaths: z.array(z.string().max(10000).regex(/^[MmLlHhVvCcSsQqTtAaZzEe0-9.,+\-\s]+$/)).max(64).optional(),
  frequency: z.number().int().positive().optional(),
  dictionaryRadicalNumber: z.number().int().min(1).max(214).optional(),
}).strict();
export const radicalContentSchema = z.object({
  number: z.number().int().min(1).max(214), radical: glyph, variants: z.array(glyph).max(20).optional(),
  strokes: z.number().int().min(1).max(64), hanViet: text(500).min(1), meaning: text(2000).min(1),
  pinyin: text(100).optional(), examples: z.array(glyph).max(100),
}).strict();
export const contentSourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(64), name: text(200).min(1), url: z.string().url(),
  license: text(200).min(1), licenseUrl: z.string().url(), version: text(100).min(1),
  checksum: text(64), attribution: text(1000).min(1), notes: text(2000),
}).strict();
const importMeta = { sourceId: contentSourceSchema.shape.id, expectedVersion: z.number().int().nonnegative().nullable() };
export const contentImportSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('kanji'), entries: z.array(z.object({ ...importMeta, data: kanjiContentSchema }).strict()).min(1).max(200) }).strict(),
  z.object({ kind: z.literal('radicals'), entries: z.array(z.object({ ...importMeta, data: radicalContentSchema }).strict()).min(1).max(214) }).strict(),
]);
export type KanjiContentData = z.infer<typeof kanjiContentSchema>;
export type RadicalContentData = z.infer<typeof radicalContentSchema>;
export type ContentImport = z.infer<typeof contentImportSchema>;
