import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ShadowingContent, ShadowingGrade, ShadowingSentence } from '@nihongo/shared/contracts/shadowing';
import { validateShadowingCues } from '@nihongo/shared/study/shadowing-media';
import { HttpError } from '../../common/errors.js';
import { tokenizeSentence } from '../sentence-analysis/sentence-tokenizer.js';

export const uuid = z.string().uuid().transform(value => value.toLowerCase());
const plain = (max: number) => z.string().transform(value => value.normalize('NFC').trim()).refine(value => Array.from(value).length <= max, `Tối đa ${max} ký tự.`);
export const shadowingDraftSchema = z.object({
  url: z.string().trim().min(1).max(2048), level: z.enum(['N5', 'N4', 'N3', 'N2', 'N1']).nullable().default(null),
  description: plain(2000).default(''), sentences: z.array(z.object({ id: uuid.optional(),
    startMs: z.number().int().nonnegative(), endMs: z.number().int().positive(), text: plain(300).refine(value => value.length > 0, 'Câu không được để trống.'),
    translationVi: plain(2000).default(''),
  }).strict()).max(500).default([]),
});
export type Metadata = { youtubeId: string; title: string; channel: string; durationMs: number };
export const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function cueId(value: unknown) {
  const hex = hash(value);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export async function makeShadowingContent(input: z.infer<typeof shadowingDraftSchema>, metadata: Metadata): Promise<ShadowingContent> {
  if (!Number.isInteger(metadata.durationMs) || metadata.durationMs <= 0 || metadata.durationMs >= 1_800_000) throw new HttpError(400, 'SHADOWING_DURATION', 'Video phải ngắn hơn 30 phút.');
  const raw = input.sentences.map((cue, index) => ({ ...cue, id: cue.id ?? cueId([metadata.youtubeId, index, cue.startMs, cue.endMs, cue.text]) }));
  let cues;
  try { cues = raw.length ? validateShadowingCues(raw) : []; }
  catch (error) { throw new HttpError(400, 'SHADOWING_TRANSCRIPT', error instanceof Error ? error.message : 'Phụ đề không hợp lệ.'); }
  if (cues.some(cue => cue.endMs > metadata.durationMs)) throw new HttpError(400, 'SHADOWING_TRANSCRIPT', 'Thời gian phụ đề vượt quá thời lượng video.');
  const sentences: ShadowingSentence[] = [];
  // Tokenize sequentially to bound memory for long transcripts. Readings are dictionary-derived.
  for (const [index, cue] of cues.entries()) {
    const analysis = await tokenizeSentence(cue.text);
    const tokens = analysis.tokens.map(token => ({ text: token.text, reading: token.reading }));
    if (tokens.map(token => token.text).join('') !== cue.text) throw new HttpError(503, 'SHADOWING_TOKENIZER', 'Chưa tách được câu. Vui lòng thử lại.');
    sentences.push({ ...cue, translationVi: raw[index].translationVi, tokens });
  }
  return { youtubeId: metadata.youtubeId, title: metadata.title, channel: metadata.channel, durationMs: metadata.durationMs,
    level: input.level, description: input.description, sentences };
}

export const sentenceHash = (sentence: ShadowingSentence) => hash({ text: sentence.text, tokens: sentence.tokens.map(token => token.text) });
const normalizeAnswer = (answer: string) => answer.normalize('NFKC').toLocaleLowerCase('ja').replace(/[\s\p{P}]/gu, '');
function distance(a: string, b: string): number {
  const left = Array.from(a), right = Array.from(b);
  let previous = right.map((_, index) => index + 1); previous.unshift(0);
  for (let row = 1; row <= left.length; row++) {
    const next = [row];
    for (let column = 1; column <= right.length; column++) next[column] = Math.min(next[column - 1] + 1, previous[column] + 1, previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1));
    previous = next;
  }
  return previous[right.length];
}
export function gradeShadowing(sentence: ShadowingSentence, mode: 'puzzle' | 'typing', answer: string | number[], hintsUsed: boolean): ShadowingGrade {
  let errors: number;
  if (mode === 'puzzle') {
    if (!Array.isArray(answer) || answer.length !== sentence.tokens.length || new Set(answer).size !== answer.length || answer.some(index => !Number.isInteger(index) || index < 0 || index >= sentence.tokens.length)) {
      throw new HttpError(400, 'SHADOWING_ANSWER', 'Hãy sắp xếp đủ từng mảnh của câu trước khi kiểm tra.');
    }
    // Occurrence IDs distinguish duplicate pieces; swapping identical text remains linguistically correct.
    errors = distance(answer.map(index => sentence.tokens[index].text).join(''), sentence.text);
  } else {
    if (typeof answer !== 'string' || !answer.trim() || Array.from(answer).length > 1000) throw new HttpError(400, 'SHADOWING_ANSWER', 'Nhập câu trả lời từ 1 đến 1.000 ký tự.');
    errors = distance(normalizeAnswer(answer), normalizeAnswer(sentence.text));
  }
  return { sentenceId: sentence.id, mode, contentHash: sentenceHash(sentence), answer, correct: errors === 0, errors,
    hintsUsed, checkedAt: new Date().toISOString(), sentence };
}
