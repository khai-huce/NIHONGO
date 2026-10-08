import { z } from 'zod';
import { SENTENCE_MAX_LENGTH, type SentenceAnalysis, type SentenceAiContent } from '@nihongo/shared/contracts/sentence-analysis';
import { HttpError } from '../../common/errors.js';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
export const sentenceText = z.string().transform(value => value.normalize('NFC').trim()).pipe(z.string()
  .min(1, 'Hãy nhập một câu tiếng Nhật.').max(SENTENCE_MAX_LENGTH, `Mỗi lần phân tích tối đa ${SENTENCE_MAX_LENGTH} ký tự.`)
  .refine(value => value.length <= SENTENCE_MAX_LENGTH, `Mỗi lần phân tích tối đa ${SENTENCE_MAX_LENGTH} ký tự.`)
  .refine(value => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value), 'Hãy nhập nội dung tiếng Nhật.')
  .refine(value => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(value), 'Câu chứa ký tự điều khiển không được hỗ trợ.'));
export const sentenceInput = z.object({ sentence: sentenceText, expectedUserId: uuid.nullable() }).strict();
export const sentenceAiInput = sentenceInput.extend({ id: uuid });

const text = (max: number) => z.string().trim().max(max);
export const sentenceAiSchema = z.object({
  sentence: z.string().min(1).max(SENTENCE_MAX_LENGTH),
  translation: text(3000).min(1),
  tokenNotes: z.array(z.object({ index: z.number().int().min(0).max(600), text: z.string().min(1).max(300),
    meaning: text(1000).min(1), explanation: text(2000).min(1) }).strict()).max(300),
  chunks: z.array(z.object({ role: text(100).min(1), text: text(300).min(1), meaning: text(2000).min(1) }).strict()).min(1).max(40),
  steps: z.array(text(2000).min(1)).min(1).max(12),
  structure: z.object({ mainClause: text(300).min(1), subject: text(1000), predicate: text(300), adverbial: text(1000), explanation: text(4000).min(1) }).strict(),
  patterns: z.array(z.object({ pattern: text(500).min(1), meaning: text(2000).min(1), evidence: text(300).min(1) }).strict()).max(20),
}).strict();
const { $schema: _draft, ...jsonSchema } = z.toJSONSchema(sentenceAiSchema);
// Keep the provider's constrained-generation schema small. Large nested bounds
// are rejected by Gemini; the complete limits above still validate every result.
const localBounds = new Set(['minLength', 'maxLength', 'minItems', 'maxItems', 'minimum', 'maximum']);
export const sentenceAiJsonSchema = JSON.parse(JSON.stringify(jsonSchema, (key, value) => localBounds.has(key) ? undefined : value));

/** Reject a structurally valid answer that describes another sentence or invents token IDs. */
export function validateSentenceAi(value: unknown, base: SentenceAnalysis): SentenceAiContent {
  const parsed = sentenceAiSchema.safeParse(value);
  const invalid = () => new HttpError(502, 'AI_INVALID_RESPONSE', 'Gemini trả phân tích chưa khớp câu hoặc còn thiếu nội dung. Vui lòng thử lại.');
  if (!parsed.success) throw invalid();
  const result = parsed.data;
  const words = base.tokens.filter(token => token.type !== 'punct' && token.text.trim());
  if (result.sentence !== base.sentence || result.tokenNotes.length !== words.length
    || new Set(result.tokenNotes.map(note => note.index)).size !== words.length) throw invalid();
  for (const word of words) {
    const note = result.tokenNotes.find(item => item.index === word.index);
    if (!note || note.text !== word.text) throw invalid();
  }
  const compact = (text: string) => text.replace(/[\p{P}\p{Z}\s]/gu, '');
  if (compact(result.chunks.map(chunk => chunk.text).join('')) !== compact(base.sentence)
    || !base.sentence.includes(result.structure.mainClause)
    || (result.structure.predicate && !base.sentence.includes(result.structure.predicate))
    || result.patterns.some(pattern => !base.sentence.includes(pattern.evidence))) throw invalid();
  return result;
}
