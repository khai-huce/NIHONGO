import { z } from 'zod';
import { HttpError } from '../../common/errors.js';

const japanese = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const control = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;
const uuid = z.string().uuid().transform(value => value.toLowerCase());
const limits = { word: 500, reading: 500, hanViet: 200, meaning: 2000 } as const;
const fields = ['word', 'reading', 'hanViet', 'meaning'] as const;
const additions = ['reading', 'hanViet', 'meaning'] as const;
type Word = Record<typeof fields[number], string>;

export const vocabAiInput = z.object({ id: uuid, expectedUserId: uuid, lessonId: uuid,
  text: z.string().max(6000, 'AI Format nhận tối đa 6.000 ký tự mỗi lượt.').trim()
    .min(1, 'Hãy dán nội dung cần sắp xếp.').refine(value => japanese.test(value), 'Hãy nhập từ vựng tiếng Nhật.')
    .refine(value => !control.test(value), 'Nội dung chứa ký tự điều khiển không được hỗ trợ.'),
}).strict();

const field = (limit: number) => z.string().trim().max(limit).refine(value => !control.test(value));
export const vocabAiResultSchema = z.object({ rows: z.array(z.object({
  word: field(limits.word).min(1).refine(value => japanese.test(value)),
  reading: field(limits.reading), hanViet: field(limits.hanViet), meaning: field(limits.meaning),
  sourceText: z.string().min(1).max(6000), generatedFields: z.array(z.enum(additions)).max(3),
}).strict()).min(1).max(50), warnings: z.array(field(1000).min(1)).max(10) }).strict();
export type VocabAiResult = z.infer<typeof vocabAiResultSchema>;

const { $schema: _draft, ...schema } = z.toJSONSchema(vocabAiResultSchema);
// Keep constrained generation small; all bounds are enforced again on the server.
const localBounds = new Set(['minLength', 'maxLength', 'minItems', 'maxItems']);
export const vocabAiJsonSchema: object = JSON.parse(JSON.stringify(schema, (key, value) => localBounds.has(key) ? undefined : value));

const invalidInput = (message: string) => new HttpError(400, 'AI_INPUT_INVALID', message);
const invalidOutput = () => new HttpError(502, 'AI_INVALID_RESPONSE', 'Gemini trả nội dung chưa khớp bản nhập hoặc làm thay đổi thông tin đã có. Nội dung gốc vẫn được giữ; hãy thử lại hoặc nhập JSON/text trực tiếp.');

/** Small bounded extractor for the formats P03 documents, not a second importer.
 * It permits missing meaning so AI can fill it, but never guesses field positions.
 * Returning null means free text requires human review, not that it is verified.
 */
export function suppliedVocabRows(text: string): Word[] | null {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  const body = fence ? fence[1].trim() : trimmed;
  const check = (rows: Word[]) => {
    if (!rows.length) throw invalidInput('Chưa có từ vựng để sắp xếp.');
    if (rows.length > 50) throw invalidInput('AI Format nhận tối đa 50 từ mỗi lượt; hãy rút gọn bản nhập.');
    for (const row of rows) {
      if (!row.word || !japanese.test(row.word) || !text.includes(row.word)) throw invalidInput('Mỗi mục cần có từ tiếng Nhật viết nguyên văn trong bản nhập.');
      if (fields.some(key => row[key].length > limits[key] || control.test(row[key]))) throw invalidInput('Một trường trong bản nhập vượt giới hạn hoặc có ký tự không được hỗ trợ.');
    }
    return rows;
  };
  if (/^[\[{]/.test(body) || fence) {
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { throw invalidInput('JSON chưa hợp lệ. Hãy sửa cú pháp trước khi dùng AI Format.'); }
    if (!Array.isArray(parsed)) throw invalidInput('JSON cần là một danh sách từ vựng.');
    const aliases = { word: ['word', 'kanji', 'term'], reading: ['reading', 'kana', 'furigana'], hanViet: ['hanViet'], meaning: ['meaning', 'definition'] } as const;
    return check(parsed.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalidInput('Mỗi mục JSON phải là một đối tượng từ vựng.');
      const raw = item as Record<string, unknown>;
      const row = {} as Word;
      for (const key of fields) {
        const present = aliases[key].filter(alias => Object.hasOwn(raw, alias));
        if (present.some(alias => typeof raw[alias] !== 'string')) throw invalidInput('Các trường từ, cách đọc, Hán Việt và nghĩa phải là chuỗi.');
        // Conflicting aliases are ambiguous: do not let the model choose and lose information.
        const values = present.map(alias => (raw[alias] as string).trim());
        if (new Set(values.filter(Boolean)).size > 1) throw invalidInput('Một mục có nhiều trường cùng nghĩa nhưng khác nội dung. Hãy giữ một trường trước khi dùng AI Format.');
        row[key] = values.find(Boolean) ?? '';
      }
      return row;
    }));
  }
  const lines = body.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const rows: Word[] = [];
  for (const line of lines) {
    const delimiter = line.includes('\t') ? '\t' : line.includes('|') ? '|' : line.includes(' - ') ? ' - ' : line.includes(',') ? ',' : null;
    if (!delimiter) {
      // One bare Japanese word per line is also unambiguous.
      if (!/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆・]+$/u.test(line)) return null;
      rows.push({ word: line, reading: '', hanViet: '', meaning: '' });
      continue;
    }
    // Quoted CSV fields, escaped quotes and embedded delimiters, without multiline guessing.
    const parts: string[] = [];
    let value = '', quoted = false;
    for (let index = 0; index < line.length; index++) {
      if (line[index] === '"') {
        if (quoted && line[index + 1] === '"') { value += '"'; index++; }
        else quoted = !quoted;
      } else if (!quoted && line.startsWith(delimiter, index)) { parts.push(value.trim()); value = ''; index += delimiter.length - 1; }
      else value += line[index];
    }
    if (quoted) return null;
    parts.push(value.trim());
    if (parts.length < 2 || parts.length > 4 || !japanese.test(parts[0])) return null;
    rows.push({ word: parts[0], reading: parts.length > 2 ? parts[1] : '', hanViet: parts.length === 4 ? parts[2] : '', meaning: parts[parts.length - 1] });
  }
  return check(rows);
}

export function parseVocabAiInput(value: unknown) {
  const input = vocabAiInput.parse(value);
  suppliedVocabRows(input.text); // Reject oversized/invalid structured input before reserving quota.
  return input;
}

/** No words outside the pasted text, no replaced fields in known formats. */
export function validateVocabAiResult(value: unknown, text: string): VocabAiResult {
  const parsed = vocabAiResultSchema.safeParse(value);
  if (!parsed.success) throw invalidOutput();
  const supplied = suppliedVocabRows(text);
  const result = parsed.data;
  if (supplied && result.rows.length !== supplied.length) throw invalidOutput();
  result.rows.forEach((row, index) => {
    if (!text.includes(row.word) || !text.includes(row.sourceText) || !row.sourceText.includes(row.word)
      || new Set(row.generatedFields).size !== row.generatedFields.length) throw invalidOutput();
    if (supplied) {
      const original = supplied[index];
      if (row.word !== original.word || additions.some(key => original[key] && original[key] !== row[key])) throw invalidOutput();
      // Server derives flags; the model cannot hide a generated value or mark a supplied field as generated.
      row.generatedFields = additions.filter(key => !original[key] && !!row[key]);
    } else {
      for (const key of additions) {
        if (row[key] && !row.generatedFields.includes(key) && !row.sourceText.includes(row[key])) throw invalidOutput();
      }
    }
  });
  const reviewWarning = supplied
    ? 'Phần AI bổ sung cần được rà soát trước khi thêm vào bài.'
    : 'Bản nhập tự do: máy chủ chỉ kiểm tra từ và đoạn trích có trong bản gốc, không thể xác minh đầy đủ cách tách trường hay nghĩa. Hãy đối chiếu từng dòng; phần AI bổ sung cần được rà soát.';
  result.warnings = [...new Set([reviewWarning, ...result.warnings])].slice(0, 10);
  return result;
}
