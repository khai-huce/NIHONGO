export type ImportWord = {
  word: string;
  reading: string;
  hanViet: string;
  meaning: string;
};

export type ImportRow = {
  line: number;
  word?: ImportWord;
  status: 'valid' | 'duplicate' | 'error';
  message?: string;
};

export type ImportPreview = {
  rows: ImportRow[];
  errors: string[];
  validCount: number;
  duplicateCount: number;
  errorCount: number;
};

const MAX_WORDS = 500;
const MAX_INPUT_BYTES = 512 * 1024;
const fields = ['word', 'reading', 'hanViet', 'meaning'] as const;
const aliases = {
  word: ['word', 'kanji', 'term'],
  reading: ['reading', 'kana', 'furigana'],
  hanViet: ['hanViet'],
  meaning: ['meaning', 'definition'],
} as const;
const labels = { word: 'Từ vựng', reading: 'Cách đọc', hanViet: 'Hán Việt', meaning: 'Nghĩa' };
const limits = { word: 500, reading: 500, hanViet: 200, meaning: 2000 };

export function vocabImportKey(word: ImportWord): string {
  return JSON.stringify(fields.map((field) => word[field].trim()));
}

function normalizeWord(value: unknown): { word?: ImportWord; message?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { message: 'Mỗi mục JSON phải là một đối tượng từ vựng.' };
  }
  const source = value as Record<string, unknown>;
  const word: ImportWord = { word: '', reading: '', hanViet: '', meaning: '' };
  for (const field of fields) {
    const supplied = aliases[field].filter((alias) => Object.prototype.hasOwnProperty.call(source, alias));
    if (supplied.some((alias) => typeof source[alias] !== 'string')) {
      return { message: `${labels[field]} phải là chuỗi văn bản.` };
    }
    word[field] = supplied.length ? (source[supplied[0]] as string).trim() : '';
    if ((field === 'word' || field === 'meaning') && !word[field]) {
      return { message: `Thiếu ${labels[field].toLowerCase()}.` };
    }
    if (word[field].length > limits[field]) {
      return { message: `${labels[field]} không được vượt quá ${limits[field]} ký tự.` };
    }
  }
  return { word };
}

// JSON.parse validates the syntax first; this scan only locates array items for error messages.
function jsonItemLines(source: string, firstLine: number): number[] {
  const lines: number[] = [];
  let line = firstLine;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let expectingItem = false;
  for (const char of source) {
    if (char === '\n') line += 1;
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (depth === 1 && expectingItem && !/\s/.test(char) && char !== ']') {
      lines.push(line);
      expectingItem = false;
    }
    if (char === '"') quoted = true;
    else if (char === '[' || char === '{') {
      depth += 1;
      if (depth === 1) expectingItem = true;
    } else if (char === ']' || char === '}') depth -= 1;
    else if (char === ',' && depth === 1) expectingItem = true;
  }
  return lines;
}

function delimiterAt(line: string, index: number): string | undefined {
  const char = line[index];
  if (char === '\t' || char === '|' || char === ',') return char;
  if (line.startsWith(' - ', index)) return ' - ';
  return undefined;
}

function parseTextLine(line: string): { value?: ImportWord; message?: string } {
  let delimiter: string | undefined;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted) {
      delimiter = delimiterAt(line, index);
      if (delimiter) break;
    }
  }
  if (!delimiter) {
    return { message: quoted ? 'Dấu ngoặc kép chưa được đóng.' : 'Cần 2, 3 hoặc 4 cột, ngăn bằng tab, |, dấu phẩy hoặc " - ".' };
  }

  const columns: string[] = [];
  let value = '';
  let inQuotes = false;
  let afterQuote = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else value += char;
    } else if (line.startsWith(delimiter, index)) {
      columns.push(value.trim());
      value = '';
      afterQuote = false;
      index += delimiter.length - 1;
    } else if (afterQuote) {
      if (!/\s/.test(char)) return { message: 'Sau dấu ngoặc kép đóng chỉ được có khoảng trắng hoặc dấu ngăn cột.' };
    } else if (char === '"') {
      if (value.trim()) return { message: 'Ngoặc kép phải bao trọn một cột; dùng "" để viết dấu ngoặc kép bên trong.' };
      value = '';
      inQuotes = true;
    } else value += char;
  }
  if (inQuotes) return { message: 'Dấu ngoặc kép chưa được đóng; mỗi từ cần nằm trên một dòng.' };
  columns.push(value.trim());
  if (columns.length < 2 || columns.length > 4) {
    return { message: `Có ${columns.length} cột; cần 2, 3 hoặc 4 cột. Bao nội dung có dấu ngăn cột trong ngoặc kép.` };
  }
  return { value: {
    word: columns[0],
    reading: columns.length >= 3 ? columns[1] : '',
    hanViet: columns.length === 4 ? columns[2] : '',
    meaning: columns[columns.length - 1],
  } };
}

export function parseVocabImport(input: string, existingWords: ImportWord[]): ImportPreview {
  const preview: ImportPreview = { rows: [], errors: [], validCount: 0, duplicateCount: 0, errorCount: 0 };
  if (new TextEncoder().encode(input).byteLength > MAX_INPUT_BYTES) {
    preview.errors.push('Dữ liệu nhập không được vượt quá 512 KiB.');
    return preview;
  }
  const source = input.replace(/\r\n?/g, '\n');
  if (!source.trim()) {
    preview.errors.push('Chưa có dữ liệu để nhập.');
    return preview;
  }
  const seen = new Set(existingWords.map(vocabImportKey));
  function addRow(line: number, value: unknown, parseError?: string) {
    const { word, message } = parseError ? { message: parseError, word: undefined } : normalizeWord(value);
    if (!word) {
      preview.rows.push({ line, status: 'error', message });
      preview.errorCount += 1;
      return;
    }
    const key = vocabImportKey(word);
    if (seen.has(key)) {
      preview.rows.push({ line, word, status: 'duplicate', message: 'Trùng hoàn toàn với từ trong bài hoặc dòng phía trên; sẽ bỏ qua.' });
      preview.duplicateCount += 1;
    } else {
      seen.add(key);
      preview.rows.push({ line, word, status: 'valid' });
      preview.validCount += 1;
    }
  }

  const trimmed = source.trimStart();
  if (/^[\[{]/.test(trimmed) || trimmed.startsWith('```')) {
    let json = source;
    let firstLine = 1;
    if (trimmed.startsWith('```')) {
      const fence = /^(\s*)```(?:json)?[^\S\n]*\n([\s\S]*?)\n[^\S\n]*```\s*$/i.exec(source);
      if (!fence) {
        preview.errors.push('Khối JSON phải nằm trọn trong ```json và ``` ở hai dòng riêng.');
        return preview;
      }
      firstLine += (fence[1].match(/\n/g) ?? []).length + 1;
      json = fence[2];
    }
    let values: unknown;
    try { values = JSON.parse(json); } catch {
      preview.errors.push('JSON không hợp lệ. Kiểm tra dấu ngoặc, dấu phẩy và ngoặc kép; dữ liệu chưa được nhập.');
      return preview;
    }
    if (!Array.isArray(values)) {
      preview.errors.push('JSON cần là một danh sách từ vựng, bắt đầu bằng [ và kết thúc bằng ].');
      return preview;
    }
    if (values.length > MAX_WORDS) {
      preview.errors.push('Mỗi lần nhập tối đa 500 dòng từ vựng.');
      return preview;
    }
    const lines = jsonItemLines(json, firstLine);
    values.forEach((value, index) => addRow(lines[index] ?? firstLine, value));
  } else {
    const lines = source.split('\n').map((value, index) => ({ value, line: index + 1 })).filter(({ value }) => value.trim());
    if (lines.length > MAX_WORDS) {
      preview.errors.push('Mỗi lần nhập tối đa 500 dòng từ vựng.');
      return preview;
    }
    for (const { value, line } of lines) {
      const parsed = parseTextLine(value);
      addRow(line, parsed.value, parsed.message);
    }
  }
  if (!preview.rows.length) preview.errors.push('Danh sách nhập chưa có từ vựng.');
  if (existingWords.length + preview.validCount > MAX_WORDS) {
    preview.errors.push(`Bài hiện có ${existingWords.length} từ; thêm ${preview.validCount} từ sẽ vượt giới hạn 500 từ mỗi bài.`);
  }
  return preview;
}
