import type { ReadingArticle, ReadingSentence } from '@nihongo/client/reading';
import {
  READING_ANALYSIS_MAX_CHARS, READING_ANALYSIS_MAX_SENTENCES, READING_ANALYSIS_MAX_APPLY_BYTES,
  type ReadingAnalysisAnnotation, type ReadingAnalysisApplyResponse, type ReadingAnalysisField,
  type ReadingAnalysisResponse, type ReadingAnalysisSentence,
} from '@nihongo/shared/contracts/reading-analysis';

export type ReadingAnalysisContext = {
  userId: string | null; articleId: string | null; version: number | null;
  text: string; authBusy: boolean; revision: number;
};
export type ReadingAnalysisSnapshot = Pick<ReadingArticle, 'id' | 'version' | 'text' | 'paragraphs' | 'visibility'>;

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const sourceSentences = (article: ReadingAnalysisSnapshot) => article.paragraphs.flatMap(paragraph => paragraph.sentences);
const sameRuby = (left: ReadingSentence['ruby'], right: ReadingSentence['ruby']) => (left?.length ?? 0) === (right?.length ?? 0)
  && (left ?? []).every((part, index) => part.text === right![index].text && part.reading === right![index].reading);
export function sameReadingAnalysisContext(left: ReadingAnalysisContext, right: ReadingAnalysisContext) {
  return left.userId === right.userId && left.articleId === right.articleId && left.version === right.version
    && left.text === right.text && left.authBusy === right.authBusy && left.revision === right.revision;
}
export function missingReadingAnalysisFields(sentence: ReadingSentence): ReadingAnalysisField[] {
  return [...(!sentence.translation?.trim() ? ['translation' as const] : []), ...(!sentence.ruby?.length ? ['ruby' as const] : [])];
}
export function readingAnalysisEligibility(article: ReadingAnalysisSnapshot | null, userId: string | null) {
  if (!userId || !article || article.visibility !== 'private' || article.id.startsWith('guest-') || article.id.startsWith('user-')) return 'Đăng nhập và mở bài đọc cá nhân trong tài khoản để phân tích.';
  if (!article.text.trim() || Array.from(article.text).length > READING_ANALYSIS_MAX_CHARS) return 'Phân tích hỗ trợ bài đọc từ 1 đến 3.000 ký tự.';
  const sentences = sourceSentences(article);
  if (!sentences.length || sentences.length > READING_ANALYSIS_MAX_SENTENCES) return 'Phân tích hỗ trợ tối đa 100 câu mỗi bài. Hãy chia thành các bài ngắn hơn.';
  return sentences.some(sentence => missingReadingAnalysisFields(sentence).length) ? '' : 'Bài đã có bản dịch và furigana cho mọi câu.';
}

/** Validate exact source binding before rendering provider-derived strings. */
export function validateReadingAnalysisResponse(value: unknown, userId: string, requestId: string, article: ReadingAnalysisSnapshot): ReadingAnalysisResponse {
  if (!record(value) || value.userId !== userId || value.id !== requestId || value.articleId !== article.id || value.version !== article.version
    || typeof value.cached !== 'boolean' || !record(value.result) || !Array.isArray(value.result.sentences)
    || !Array.isArray(value.result.warnings) || value.result.warnings.length > 20
    || value.result.warnings.some(warning => typeof warning !== 'string' || warning.length > 1000)) {
    throw new Error('Kết quả phân tích không khớp tài khoản hoặc phiên bản bài đọc. Chưa có nội dung nào được áp dụng.');
  }
  const rows = value.result.sentences;
  const sentences = sourceSentences(article);
  if (rows.length !== sentences.length || rows.length > READING_ANALYSIS_MAX_SENTENCES) throw new Error('Phân tích chưa trả đủ các câu trong bài. Chưa có nội dung nào được áp dụng.');
  rows.forEach((row, index) => {
    const source = sentences[index];
    const allowed = missingReadingAnalysisFields(source);
    if (!record(row) || row.sentenceId !== source.id || row.japanese !== source.japanese
      || typeof row.translation !== 'string' || !Array.isArray(row.ruby) || !Array.isArray(row.generatedFields)
      || row.generatedFields.length !== allowed.length || new Set(row.generatedFields).size !== allowed.length
      || row.generatedFields.some(field => !allowed.includes(field as ReadingAnalysisField))) {
      throw new Error('Phân tích có câu hoặc trường bổ sung không khớp bản gốc. Chưa áp dụng kết quả.');
    }
  });
  const typed = value as ReadingAnalysisResponse;
  const errors = validateReadingAnalysisDraft(typed.result.sentences, article);
  if (errors.length) throw new Error(errors[0]);
  return typed;
}

export function validateReadingAnalysisDraft(rows: ReadingAnalysisSentence[], article: ReadingAnalysisSnapshot): string[] {
  const sentences = sourceSentences(article);
  if (rows.length !== sentences.length) return ['Danh sách câu không khớp bài đọc. Hãy tải lại bài trước khi phân tích.'];
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const source = sentences[index], label = `Câu ${index + 1}`;
    if (row.sentenceId !== source.id || row.japanese !== source.japanese) { errors.push(`${label}: nguyên văn hoặc thứ tự câu đã thay đổi.`); return; }
    if (typeof row.translation !== 'string' || row.translation.length > 3000 || !row.translation.trim()) errors.push(`${label}: bản dịch cần có nội dung và tối đa 3.000 ký tự.`);
    if (source.translation?.trim() && row.translation !== source.translation) errors.push(`${label}: cần giữ nguyên bản dịch đã lưu.`);
    if (!Array.isArray(row.ruby) || row.ruby.length > 500 || row.ruby.some(part => !record(part) || typeof part.text !== 'string' || !part.text.length || part.text.length > 3000
      || (part.reading !== undefined && (typeof part.reading !== 'string' || !part.reading.trim() || part.reading.length > 300)))) {
      errors.push(`${label}: mỗi đoạn furigana cần có nguyên văn hợp lệ; cách đọc tối đa 300 ký tự.`);
    } else if (row.ruby.map(part => part.text).join('') !== source.japanese) errors.push(`${label}: ghép các đoạn furigana phải đúng nguyên văn, kể cả dấu câu và khoảng trắng.`);
    else if (!source.ruby?.length && row.ruby.some(part => (part.reading !== undefined && !/^[\p{Script=Hiragana}\p{Script=Katakana}ー・\s]+$/u.test(part.reading))
      || (/[\p{Script=Han}々〆]/u.test(part.text) && !part.reading?.trim()))) errors.push(`${label}: các đoạn có Kanji cần cách đọc bằng kana.`);
    if (source.ruby?.length && !sameRuby(source.ruby, row.ruby)) errors.push(`${label}: cần giữ nguyên furigana đã lưu.`);
  });
  // Reserve space for the account/request UUIDs and version outside annotations.
  if (!errors.length && new TextEncoder().encode(JSON.stringify(readingAnalysisAnnotations(rows))).byteLength > READING_ANALYSIS_MAX_APPLY_BYTES - 512) {
    errors.push('Bản phân tích vượt giới hạn lưu 512 KB. Hãy rút gọn bản dịch hoặc cách đọc trước khi áp dụng.');
  }
  return errors;
}

export function editReadingAnalysisSentence(rows: ReadingAnalysisSentence[], sentenceId: string, field: ReadingAnalysisField,
  value: string | ReadingSentence['ruby']): ReadingAnalysisSentence[] {
  return rows.map(row => row.sentenceId !== sentenceId || !row.generatedFields.includes(field) ? row
    : field === 'translation' && typeof value === 'string' ? { ...row, translation: value }
    : field === 'ruby' && Array.isArray(value) ? { ...row, ruby: value.map(part => ({ ...part })) } : row);
}

export function readingAnalysisAnnotations(rows: ReadingAnalysisSentence[]): ReadingAnalysisAnnotation[] {
  return rows.map(({ sentenceId, japanese, translation, ruby }) => ({ sentenceId, japanese, translation, ruby: ruby.map(part => ({ ...part })) }));
}
export function validateReadingAnalysisApplyResponse(value: unknown, userId: string, requestId: string, article: ReadingAnalysisSnapshot): ReadingAnalysisApplyResponse {
  if (!record(value) || value.userId !== userId || value.requestId !== requestId || value.articleId !== article.id
    || value.version !== article.version + 1) throw new Error('Phản hồi lưu không khớp bài đọc. Hãy tải lại bài để kiểm tra trước khi tiếp tục.');
  return value as ReadingAnalysisApplyResponse;
}
export const retainReadingAnalysisRequest = (status: number, code: string) => status === 0 || code === 'AI_BUSY';
export const uncertainReadingAnalysisApply = (status: number) => status === 0 || status >= 500;
