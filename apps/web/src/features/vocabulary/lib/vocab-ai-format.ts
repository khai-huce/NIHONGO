import { parseVocabImport, type ImportWord } from './vocab-import.ts';

export const AI_FORMAT_MAX_CHARS = 6000;
export const AI_FORMAT_MAX_ROWS = 50;
export type AiGeneratedField = 'reading' | 'hanViet' | 'meaning';
export type AiFormatRow = ImportWord & { sourceText: string; generatedFields: AiGeneratedField[] };
export type AiEditableRow = AiFormatRow & { id: string };
export type AiFormatResult = { rows: AiFormatRow[]; warnings: string[] };
export type AiFormatResponse = { userId: string; id: string; cached: boolean; result: AiFormatResult };
export type AiFormatContext = { userId: string | null; lessonId: string | null; text: string; revision: number };

const fields = ['word', 'reading', 'hanViet', 'meaning'] as const;
const generatedFields = new Set(['reading', 'hanViet', 'meaning']);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function validateAiFormatResponse(value: unknown, userId: string, id: string): AiFormatResponse {
  if (!record(value) || value.userId !== userId || value.id !== id || typeof value.cached !== 'boolean' || !record(value.result)) {
    throw new Error('Phản hồi không khớp tài khoản hoặc lượt AI Format. Nội dung gốc vẫn được giữ.');
  }
  const result = value.result;
  if (!Array.isArray(result.rows) || !result.rows.length || result.rows.length > AI_FORMAT_MAX_ROWS ||
      !Array.isArray(result.warnings) || result.warnings.some(item => typeof item !== 'string') ||
      result.rows.some(row => !record(row) || fields.some(field => typeof row[field] !== 'string') ||
        typeof row.sourceText !== 'string' || !Array.isArray(row.generatedFields) ||
        row.generatedFields.some(field => typeof field !== 'string' || !generatedFields.has(field)))) {
    throw new Error('Kết quả AI Format không hợp lệ. Chưa nhập từ nào; nội dung gốc vẫn được giữ.');
  }
  return value as AiFormatResponse;
}

export function sameAiFormatContext(left: AiFormatContext, right: AiFormatContext) {
  return left.userId === right.userId && left.lessonId === right.lessonId && left.text === right.text && left.revision === right.revision;
}

export function makeAiEditableRows(rows: AiFormatRow[], uuid: () => string = () => crypto.randomUUID()): AiEditableRow[] {
  return rows.map(row => ({ ...row, generatedFields: [...row.generatedFields], id: uuid() }));
}

export function editAiRow(rows: AiEditableRow[], id: string, field: keyof ImportWord, value: string) {
  return rows.map(row => row.id === id ? { ...row, [field]: value } : row);
}

export function prepareAiImport(rows: AiEditableRow[], existing: ImportWord[]) {
  const preview = parseVocabImport(JSON.stringify(rows.map(({ word, reading, hanViet, meaning }) => ({ word, reading, hanViet, meaning }))), existing);
  if (rows.length > AI_FORMAT_MAX_ROWS) preview.errors.push(`Mỗi lượt AI Format tối đa ${AI_FORMAT_MAX_ROWS} từ.`);
  if (existing.length + preview.validCount > 500) preview.errors.push('Mỗi bài tối đa 500 từ. Bài hiện tại không còn đủ chỗ cho các từ mới.');
  // Keep IDs and duplicate candidates: the server rechecks the latest lesson atomically.
  const words = preview.rows.flatMap((row, index) => row.word && row.status !== 'error' ? [{ ...row.word, id: rows[index].id }] : []);
  if (new TextEncoder().encode(JSON.stringify(words)).length > 500 * 1024) preview.errors.push('Dữ liệu sau khi sửa quá lớn. Hãy rút gọn trước khi nhập.');
  return { preview, words, canSave: !preview.errors.length && !preview.errorCount && preview.validCount > 0 };
}
