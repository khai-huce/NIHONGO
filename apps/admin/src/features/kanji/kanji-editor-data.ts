import type { KanjiData } from '../../shared/types';

export interface KanjiEditorForm {
  data: KanjiData;
  strokeCount: string;
  frequency: string;
  dictionaryRadicalNumber: string;
  onyomi: string;
  kunyomi: string;
  radicals: string;
  strokePaths: string;
}

export function kanjiEditorForm(data?: KanjiData): KanjiEditorForm {
  const value: KanjiData = data ? structuredClone(data) : {
    id: '', kanji: '', hanViet: '', meaning: '', level: 'N5', strokeCount: 1,
    radicals: [], radicalParts: [], mnemonic: '', onyomi: [], kunyomi: [], examples: [],
  };
  return { data: value, strokeCount: String(value.strokeCount), frequency: String(value.frequency ?? ''),
    dictionaryRadicalNumber: String(value.dictionaryRadicalNumber ?? ''), onyomi: value.onyomi.join('\n'),
    kunyomi: value.kunyomi.join('\n'), radicals: value.radicals.join('\n'), strokePaths: value.strokePaths === undefined ? '' : JSON.stringify(value.strokePaths, null, 2) };
}

const lines = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
function integer(value: string, name: string, max: number) {
  if (!/^\d+$/.test(value.trim()) || Number(value) < 1 || Number(value) > max) {
    throw new Error(`${name} phải là số nguyên từ 1 đến ${max}.`);
  }
  return Number(value);
}
function text(value: string, name: string, max: number, required = false) {
  const result = value.trim();
  if (required && !result) throw new Error(`Vui lòng nhập ${name}.`);
  if (result.length > max) throw new Error(`${name} không được vượt quá ${max} ký tự.`);
  return result;
}

export function kanjiEditorData(form: KanjiEditorForm, existingId?: string): KanjiData {
  const kanji = form.data.kanji.trim();
  if (!/^\p{Script=Han}$/u.test(kanji)) throw new Error('Vui lòng nhập đúng một chữ Kanji.');
  const data: KanjiData = { ...form.data, id: existingId ?? `k-u${kanji.codePointAt(0)!.toString(16)}`, kanji,
    hanViet: text(form.data.hanViet, 'âm Hán Việt', 500, true), meaning: text(form.data.meaning, 'nghĩa', 2000, true),
    mnemonic: text(form.data.mnemonic, 'gợi nhớ', 2000), strokeCount: integer(form.strokeCount, 'Số nét', 64),
    onyomi: lines(form.onyomi), kunyomi: lines(form.kunyomi), radicals: lines(form.radicals),
    radicalParts: form.data.radicalParts.map((part, index) => ({
      radical: text(part.radical, `bộ thành phần ${index + 1}`, 8, true),
      hanViet: text(part.hanViet, `Hán Việt bộ ${index + 1}`, 100), meaning: text(part.meaning, `nghĩa bộ ${index + 1}`, 1000),
    })),
    examples: form.data.examples.map((example, index) => ({ ...example,
      word: text(example.word, `từ ví dụ ${index + 1}`, 200, true), reading: text(example.reading, `cách đọc ví dụ ${index + 1}`, 500),
      meaning: text(example.meaning, `nghĩa ví dụ ${index + 1}`, 1000),
      ...(example.furigana !== undefined ? { furigana: text(example.furigana, `furigana ví dụ ${index + 1}`, 1000) } : {}),
    })),
  };
  if (data.radicals.length > 20 || data.radicalParts.length > 20) throw new Error('Tối đa 20 bộ thủ hoặc bộ thành phần.');
  data.radicals.forEach(value => text(value, 'bộ thủ', 8, true));
  for (const [label, values] of [['On', data.onyomi], ['Kun', data.kunyomi]] as const) {
    if (values.length > 50 || values.some(value => value.length > 100)) throw new Error(`Âm ${label}: tối đa 50 dòng, mỗi dòng 100 ký tự.`);
  }
  if (data.examples.length > 100) throw new Error('Tối đa 100 ví dụ.');
  if (form.frequency.trim()) data.frequency = integer(form.frequency, 'Tần suất', 2147483647);
  else delete data.frequency;
  if (form.dictionaryRadicalNumber.trim()) data.dictionaryRadicalNumber = integer(form.dictionaryRadicalNumber, 'Số bộ thủ từ điển', 214);
  else delete data.dictionaryRadicalNumber;
  if (form.strokePaths.trim() || form.data.strokePaths !== undefined) {
    let paths: unknown;
    try { paths = form.strokePaths.trim() ? JSON.parse(form.strokePaths) : []; }
    catch { throw new Error('Đường nét SVG phải là một mảng JSON chứa các chuỗi path.'); }
    if (!Array.isArray(paths) || paths.some(path => typeof path !== 'string')) throw new Error('Đường nét SVG phải là một mảng JSON chứa các chuỗi path.');
    data.strokePaths = paths as string[];
    if (data.strokePaths.length > 64 || data.strokePaths.some(path => path.length > 10000 || !/^[MmLlHhVvCcSsQqTtAaZzEe0-9.,+\-\s]+$/.test(path))) {
      throw new Error('Đường nét SVG không hợp lệ: tối đa 64 đường, mỗi dòng chỉ chứa dữ liệu path.');
    }
  } else delete data.strokePaths;
  return data;
}
