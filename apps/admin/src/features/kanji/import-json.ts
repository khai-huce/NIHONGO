import type { KanjiImport } from '../../shared/types';

export const MAX_IMPORT_BYTES = 1.5 * 1024 * 1024;
export const MAX_IMPORT_ENTRIES = 200;

export interface ImportIssue {
  path: (string | number)[];
  message: string;
}

export class ImportInputError extends Error {
  issues: ImportIssue[];

  constructor(message: string, issues: ImportIssue[] = []) {
    super(message);
    this.name = 'ImportInputError';
    this.issues = issues;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function importFieldPath(path: (string | number)[]): string {
  return path.reduce<string>((result, part) => typeof part === 'number'
    ? `${result}[${part}]`
    : result ? `${result}.${part}` : part, '') || 'JSON';
}

// This is a small input guard. The server validates all content and current versions.
export function parseKanjiImport(text: string): KanjiImport {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    throw new ImportInputError('JSON vượt giới hạn 1,5 MiB. Hãy chia thành tệp nhỏ hơn.');
  }
  const content = text.replace(/^\uFEFF/, '').trim();
  if (!content) throw new ImportInputError('Hãy dán JSON hoặc chọn một tệp JSON.');

  let input: unknown;
  try {
    input = JSON.parse(content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : '';
    throw new ImportInputError(`JSON không đúng cú pháp. Kiểm tra dấu ngoặc, dấu phẩy và dấu nháy kép.${detail ? ` ${detail}` : ''}`);
  }
  if (!isObject(input)) throw new ImportInputError('JSON cần là một đối tượng có kind và entries.');
  if (input.kind !== 'kanji') {
    throw new ImportInputError('Màn này chỉ nhập Kanji.', [{ path: ['kind'], message: 'Giá trị phải là "kanji".' }]);
  }
  if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > MAX_IMPORT_ENTRIES) {
    throw new ImportInputError('Mỗi lần nhập cần từ 1 đến 200 mục.', [{ path: ['entries'], message: 'Cần một mảng gồm 1–200 mục Kanji.' }]);
  }
  const issues: ImportIssue[] = [];
  input.entries.forEach((entry: unknown, index: number) => {
    const path = ['entries', index];
    if (!isObject(entry)) {
      issues.push({ path, message: 'Mục nhập phải là một đối tượng.' });
      return;
    }
    if (typeof entry.sourceId !== 'string' || !entry.sourceId.trim()) {
      issues.push({ path: [...path, 'sourceId'], message: 'Điền ID của một nguồn nội dung đã có.' });
    }
    if (entry.expectedVersion !== null && !(typeof entry.expectedVersion === 'number' && Number.isSafeInteger(entry.expectedVersion) && entry.expectedVersion >= 0)) {
      issues.push({ path: [...path, 'expectedVersion'], message: 'Dùng null cho mục mới hoặc số phiên bản hiện tại cho mục đã có.' });
    }
    if (!isObject(entry.data)) {
      issues.push({ path: [...path, 'data'], message: 'Nội dung Kanji phải là một đối tượng.' });
    }
  });
  if (issues.length) throw new ImportInputError('Một số mục nhập chưa đúng cấu trúc.', issues);
  return input as unknown as KanjiImport;
}

export function importErrorDetails(error: unknown): { message: string; issues: ImportIssue[] } {
  const details = isObject(error) ? error : {};
  const issues = Array.isArray(details.issues) ? details.issues.filter((issue): issue is ImportIssue =>
    isObject(issue) && typeof issue.message === 'string' && Array.isArray(issue.path)
      && issue.path.every(part => typeof part === 'string' || typeof part === 'number')) : [];
  return {
    message: typeof details.message === 'string' ? details.message : 'Không thể xử lý dữ liệu. Vui lòng thử lại.',
    issues,
  };
}

export function createKanjiImportTemplate(sourceId: string): string {
  if (!sourceId.trim()) throw new ImportInputError('Cần có nguồn nội dung trước khi tải JSON mẫu.');
  return JSON.stringify({
    kind: 'kanji',
    entries: [{
      sourceId,
      expectedVersion: null,
      data: {
        id: '', kanji: '', hanViet: '', meaning: '', level: '', strokeCount: null,
        radicals: [], radicalParts: [], mnemonic: '', onyomi: [], kunyomi: [], examples: [],
      },
    }],
  }, null, 2);
}
