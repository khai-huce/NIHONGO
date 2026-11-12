import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { ReadingAnalysisResult, ReadingAnalysisSentence } from '@nihongo/shared/contracts/reading-analysis';
import { HttpError } from '../../common/errors.js';
import { readingInput, editorialInput, makeReadingContent, type ReadingContent } from './reading-content.js';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const control = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;
const safeText = (max: number) => z.string().max(max).refine(value => !control.test(value));
const ruby = z.array(z.object({ text: safeText(3000).min(1), reading: safeText(300).refine(value => value.trim().length > 0).optional() }).strict()).max(500);
export const readingAnalysisAnnotation = z.object({ sentenceId: z.string().min(1).max(32), japanese: safeText(6000).min(1),
  translation: safeText(3000), ruby }).strict();
export const readingAnalysisInput = z.object({ id: uuid, expectedUserId: uuid, version: z.number().int().nonnegative() }).strict();
export const readingAnalysisApplyInput = z.object({ requestId: uuid, expectedUserId: uuid, version: z.number().int().nonnegative(),
  annotations: z.array(readingAnalysisAnnotation).min(1).max(100) }).strict();
const providerResult = z.object({ sentences: z.array(readingAnalysisAnnotation).min(1).max(100),
  warnings: z.array(safeText(1000).min(1)).max(10) }).strict();
// Small generation schema; exact source correspondence and all limits are checked locally.
const { $schema: _draft, ...jsonSchema } = z.toJSONSchema(providerResult);
const localBounds = new Set(['minLength', 'maxLength', 'minItems', 'maxItems']);
export const readingAnalysisJsonSchema: object = JSON.parse(JSON.stringify(jsonSchema, (key, value) => localBounds.has(key) ? undefined : value));
const reviewWarning = 'Furigana và bản dịch do AI bổ sung cần được rà soát trước khi lưu.';
const storedContent = readingInput.extend({ paragraphs: z.array(z.object({ id: z.string().max(32), sentences: z.array(z.object({
  id: z.string().max(32), japanese: safeText(6000), translation: safeText(3000).optional(), ruby: ruby.optional(),
}).strict()) }).strict()), vocabList: editorialInput.shape.vocabList.removeDefault(),
  grammarList: editorialInput.shape.grammarList.removeDefault(), quizList: editorialInput.shape.quizList.removeDefault() }).strict();

export function readingAnalysisBase(raw: unknown): ReadingContent {
  // Validate sentence structure without M03's older UTF-16 annotation limit:
  // the source itself is limited to 3,000 Unicode code points, including emoji.
  const parsed = storedContent.parse(raw);
  const content = raw as ReadingContent;
  const sentences = content.paragraphs.flatMap(paragraph => paragraph.sentences);
  if (Array.from(content.text).length > 3000 || control.test(content.text)) {
    throw new HttpError(400, 'AI_INPUT_INVALID', 'Phân tích nhận tối đa 3.000 ký tự và không hỗ trợ ký tự điều khiển trong bài đọc.');
  }
  if (!sentences.length || sentences.length > 100) throw new HttpError(400, 'AI_INPUT_INVALID', 'Phân tích nhận từ 1 đến 100 câu mỗi bài. Hãy rút gọn bài trước khi tiếp tục.');
  const canonical = makeReadingContent({ title: parsed.title, subtitle: parsed.subtitle, text: parsed.text });
  const structure = (paragraphs: ReadingContent['paragraphs']) => paragraphs.map(paragraph => [paragraph.id, paragraph.sentences.map(sentence => [sentence.id, sentence.japanese])]);
  if (!isDeepStrictEqual(structure(canonical.paragraphs), structure(content.paragraphs))
    || sentences.some(sentence => sentence.ruby?.length && sentence.ruby.map(part => part.text).join('') !== sentence.japanese)) {
    throw new HttpError(400, 'AI_INPUT_INVALID', 'Danh sách câu hoặc furigana hiện có không khớp văn bản Nhật. Hãy kiểm tra lại bài đọc.');
  }
  return content;
}

export function analysisSentenceInput(content: ReadingContent) {
  return content.paragraphs.flatMap(paragraph => paragraph.sentences).map(sentence => ({
    sentenceId: sentence.id, japanese: sentence.japanese, translation: sentence.translation ?? '', ruby: sentence.ruby ?? [],
  }));
}

export function generatedReadingFields(sentence: { translation?: string; ruby?: unknown[] }): ReadingAnalysisSentence['generatedFields'] {
  return [...(!sentence.translation?.trim() ? ['translation' as const] : []), ...(!sentence.ruby?.length ? ['ruby' as const] : [])];
}

function checkAnnotations(rows: z.infer<typeof readingAnalysisAnnotation>[], content: ReadingContent, status: 400 | 502) {
  const fail = () => { throw new HttpError(status, status === 502 ? 'AI_INVALID_RESPONSE' : 'ANALYSIS_INVALID',
    'Bản phân tích chưa khớp câu gốc hoặc thay đổi phần đã biên tập. Bài đọc vẫn được giữ nguyên; hãy kiểm tra lại.'); };
  const original = analysisSentenceInput(content);
  if (rows.length !== original.length) fail();
  return rows.map((row, index): ReadingAnalysisSentence => {
    const prior = original[index];
    if (row.sentenceId !== prior.sentenceId || row.japanese !== prior.japanese) fail();
    const generatedFields = generatedReadingFields(prior);
    if (!generatedFields.includes('translation') && row.translation !== prior.translation) fail();
    if (!generatedFields.includes('ruby') && !isDeepStrictEqual(row.ruby, prior.ruby)) fail();
    if (!row.translation.trim() || row.ruby.map(part => part.text).join('') !== prior.japanese) fail();
    if (generatedFields.includes('ruby')) {
      for (const part of row.ruby) {
        if (part.reading !== undefined && !/^[\p{Script=Hiragana}\p{Script=Katakana}ー・\s]+$/u.test(part.reading)) fail();
        // Never present an untouched Kanji fragment as successfully supplied furigana.
        if (/[\p{Script=Han}々〆]/u.test(part.text) && !part.reading?.trim()) fail();
      }
    }
    return { ...row, generatedFields };
  });
}

export function validateReadingAnalysisResult(raw: unknown, content: ReadingContent, cached = false): ReadingAnalysisResult {
  // Generated flags are server-owned; strip only this known field from cached results before revalidation.
  const value = cached && raw && typeof raw === 'object' && 'sentences' in raw && Array.isArray(raw.sentences)
    ? { ...raw, ...('warnings' in raw && Array.isArray(raw.warnings) ? { warnings: raw.warnings.filter(warning => warning !== reviewWarning) } : {}), sentences: raw.sentences.map(row => {
      if (!row || typeof row !== 'object') return row;
      const { generatedFields: _generated, ...annotation } = row;
      return annotation;
    }) } : raw;
  const parsed = providerResult.safeParse(value);
  if (!parsed.success) throw new HttpError(502, 'AI_INVALID_RESPONSE', 'Gemini trả kết quả chưa đầy đủ hoặc sai định dạng. Bài đọc vẫn được giữ nguyên.');
  const sentences = checkAnnotations(parsed.data.sentences, content, 502);
  return { sentences, warnings: [reviewWarning, ...parsed.data.warnings.filter(warning => warning !== reviewWarning)] };
}

export function validateReadingAnalysisApply(rows: z.infer<typeof readingAnalysisAnnotation>[], content: ReadingContent) {
  return checkAnnotations(rows, content, 400);
}
