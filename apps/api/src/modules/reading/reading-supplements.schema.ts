import { z } from 'zod';
import type { ReadingSupplementKind, ReadingSupplementGroup, ReadingSupplementResult, ReadingSupplementLists } from '@nihongo/shared/contracts/reading-supplements';
import { HttpError } from '../../common/errors.js';
import { readingEvidenceSchema, type ReadingContent } from './reading-content.js';
import { tokenizeSentence } from '../sentence-analysis/sentence-tokenizer.js';

const control = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const text = (max: number, required = true) => z.string().max(max).refine(s => !control.test(s) && (!required || !!s.trim()));
const vocab = z.object({ word: text(200), reading: text(200).refine(s => /^[\p{Script=Hiragana}\p{Script=Katakana}ー・\s]+$/u.test(s)),
  hanViet: text(200, false), meaning: text(1000), evidence: readingEvidenceSchema }).strict();
const grammar = z.object({ pattern: text(200), meaning: text(1000), exampleJp: text(1000), exampleVi: text(1000), evidence: readingEvidenceSchema }).strict();
const key = (s: string) => s.normalize('NFKC').trim().replace(/\s+/gu, ' ');
const quiz = z.object({ id: z.number().int().positive(), question: text(1000), options: z.array(text(500)).length(4),
  correctIndex: z.number().int().min(0).max(3), explanation: text(2000), evidence: readingEvidenceSchema }).strict()
  .refine(q => new Set(q.options.map(key)).size === 4, 'Các lựa chọn không được trùng nhau.');
export const supplementLists = z.object({ vocabList: z.array(vocab).max(15), grammarList: z.array(grammar).max(5), quizList: z.array(quiz).max(5) }).strict();
const uuid = z.string().uuid().transform(s => s.toLowerCase());
export const supplementInput = z.object({ id: uuid, expectedUserId: uuid, version: z.number().int().nonnegative(), kind: z.enum(['study', 'quiz']) }).strict();
export const supplementApplyInput = supplementLists.extend({ requestId: uuid, expectedUserId: uuid, version: z.number().int().nonnegative(), kind: z.enum(['study', 'quiz']) }).strict();
const providerResult = supplementLists.extend({ warnings: z.array(text(1000)).max(10) }).strict();
const { $schema: _draft, ...schema } = z.toJSONSchema(providerResult);
export const supplementJsonSchema: object = JSON.parse(JSON.stringify(schema, (k, v) => ['minLength', 'maxLength', 'minItems', 'maxItems'].includes(k) ? undefined : v));
export const supplementWarning = 'Nội dung do AI hỗ trợ, cần rà soát căn cứ và đáp án trước khi lưu; không phải đề JLPT chính thức.';
export function supplementGroups(content: Pick<ReadingContent, 'vocabList' | 'grammarList' | 'quizList'>, kind: ReadingSupplementKind): ReadingSupplementGroup[] {
  return kind === 'quiz' ? content.quizList.length ? [] : ['quiz']
    : [...(!content.vocabList.length ? ['vocab' as const] : []), ...(!content.grammarList.length ? ['grammar' as const] : [])];
}
export async function validateSupplements(raw: unknown, content: ReadingContent, kind: ReadingSupplementKind, provider = false, cached = false): Promise<ReadingSupplementResult> {
  const fail = (message: string): never => { throw new HttpError(provider ? 502 : 400, provider ? 'AI_INVALID_RESPONSE' : 'SUPPLEMENT_INVALID', message); };
  let input = raw;
  if (cached && raw && typeof raw === 'object' && 'groups' in raw) {
    const { groups: _groups, ...rest } = raw;
    input = { ...rest, ...('warnings' in rest && Array.isArray(rest.warnings) ? { warnings: rest.warnings.filter(w => w !== supplementWarning) } : {}) };
  }
  const parsed = providerResult.safeParse(input);
  if (!parsed.success) fail('Nội dung bổ trợ thiếu trường, quá dài hoặc có lựa chọn/đáp án không hợp lệ. Bài chưa bị thay đổi.');
  const result = parsed.data!;
  const groups = supplementGroups(content, kind);
  for (const group of ['vocab', 'grammar', 'quiz'] as const) {
    if (!groups.includes(group) && result[`${group}List`].length) fail('Chỉ được tạo nhóm đang trống đã chọn. Nội dung đã có phải giữ nguyên.');
  }
  const sentences = new Map(content.paragraphs.flatMap(p => p.sentences).map(s => [s.id, s.japanese]));
  for (const row of [...result.vocabList, ...result.grammarList, ...result.quizList]) {
    if (row.evidence.some(e => !sentences.get(e.sentenceId)?.includes(e.quote) || control.test(e.quote))) fail('Dẫn chứng phải trích nguyên văn từ đúng câu trong bài.');
    if (new Set(row.evidence.map(e => e.sentenceId + '\u0000' + e.quote)).size !== row.evidence.length) fail('Dẫn chứng không được lặp.');
  }
  // Lemmas are accepted only when the dictionary identifies them inside a cited span.
  for (const row of result.vocabList) {
    if (!row.evidence.some(e => e.quote.includes(row.word))) {
      let found = false;
      for (const e of row.evidence) {
        const tokens = (await tokenizeSentence(e.quote)).tokens;
        // Kuromoji splits compounds such as 勉強しました into 勉強 + し + まし + た.
        // Keep the contiguous source prefix and lemmatize only its last token.
        // This also accepts 持って行く without inventing words or skipping tokens.
        for (let start = 0; start < tokens.length && !found; start++) {
          let prefix = '';
          for (let end = start; end < Math.min(tokens.length, start + 8); end++) {
            const token = tokens[end];
            if (token.type === 'punct' || (end > start && tokens[end - 1].end !== token.start)) break;
            if (key(prefix + token.baseForm) === key(row.word)) { found = true; break; }
            prefix += token.text;
          }
        }
      }
      if (!found) fail('Từ vựng phải có trong dẫn chứng hoặc là dạng gốc được từ điển nhận diện.');
    }
  }
  if (result.grammarList.some(g => !g.evidence.some(e => e.quote.includes(g.exampleJp)))) fail('Ví dụ ngữ pháp phải trích từ dẫn chứng trong bài.');
  if (new Set(result.vocabList.map(v => key(v.word) + '\u0000' + key(v.reading))).size !== result.vocabList.length
    || new Set(result.grammarList.map(g => key(g.pattern))).size !== result.grammarList.length
    || new Set(result.quizList.map(q => q.id)).size !== result.quizList.length
    || new Set(result.quizList.map(q => key(q.question))).size !== result.quizList.length) fail('Danh sách có từ, mẫu hoặc câu hỏi trùng nhau.');
  return { ...result, groups, warnings: [supplementWarning, ...result.warnings.filter(w => w !== supplementWarning)] };
}
export function supplementPayload(value: ReadingSupplementLists): ReadingSupplementLists {
  return { vocabList: value.vocabList, grammarList: value.grammarList, quizList: value.quizList };
}
