import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVocabImport, vocabImportKey } from '../src/features/vocabulary/lib/vocab-import.ts';

const word = (changes = {}) => ({ word: '学校', reading: 'がっこう', hanViet: 'HỌC HIỆU', meaning: 'trường học', ...changes });
const parse = (input, existing = []) => parseVocabImport(input, existing);
const valid = (preview) => preview.rows.filter((row) => row.status === 'valid').map((row) => row.word);

test('JSON trims fields, accepts aliases and ignores supplied IDs without guessing reading', () => {
  const result = parse(JSON.stringify([
    { id: 'old-device-id', kanji: ' 学校 ', kana: ' がっこう ', hanViet: ' HỌC HIỆU ', definition: ' trường học ' },
    { term: '猫', meaning: 'mèo' },
    { word: '犬', furigana: 'いぬ', meaning: 'chó' },
  ]));
  assert.deepEqual(result.errors, []);
  assert.equal(result.errorCount, 0);
  assert.deepEqual(valid(result), [word(), word({ word: '猫', reading: '', hanViet: '', meaning: 'mèo' }), word({ word: '犬', reading: 'いぬ', hanViet: '', meaning: 'chó' })]);
});

test('JSON validates every supplied recognized field instead of masking null, false or zero', () => {
  const invalid = [null, [], '学校', { word: 0, kanji: '学校', meaning: 'trường' }, { word: '学校', reading: null, meaning: 'trường' }, { word: '学校', meaning: false }, { word: '学校', definition: 1, meaning: 'trường' }, { word: '', kanji: '学校', meaning: 'trường' }, { word: '学校' }, { word: '学校', hanViet: [] }];
  const result = parse(JSON.stringify(invalid));
  assert.equal(result.errorCount, invalid.length);
  assert.equal(result.validCount, 0);
  assert.ok(result.rows.every((row) => row.message && row.status === 'error'));
});

test('malformed JSON, objects and incomplete fences never fall back to text', () => {
  for (const input of ['[{"word":"学校","meaning":"trường"},]', '{"word":"学校","meaning":"trường"}', '[学校,がっこう,trường', '```json\n[{"word":"学校","meaning":"trường"}]', '```text\n学校,mèo\n```']) {
    const result = parse(input);
    assert.ok(result.errors.length > 0, input);
    assert.equal(result.validCount, 0, input);
  }
});

test('JSON error row numbers refer to the source including blank lines and code fences', () => {
  const result = parse('\n```json\n[\n  {"word":"学校","meaning":"trường"},\n\n  {"word":false,"meaning":"sai"}\n]\n```\n');
  assert.deepEqual(result.rows.map(({ line, status }) => ({ line, status })), [{ line: 4, status: 'valid' }, { line: 6, status: 'error' }]);
});

test('text accepts 2/3/4 columns and keeps blank-line numbering', () => {
  const result = parse('\n学校\ttrường học\r\n\r\n猫|ねこ|mèo\n犬 - いぬ - KHUYỂN - chó\n');
  assert.equal(result.errorCount, 0);
  assert.deepEqual(result.rows.map((row) => row.line), [2, 4, 5]);
  assert.deepEqual(valid(result), [word({ reading: '', hanViet: '' }), word({ word: '猫', reading: 'ねこ', hanViet: '', meaning: 'mèo' }), word({ word: '犬', reading: 'いぬ', hanViet: 'KHUYỂN', meaning: 'chó' })]);
});

test('CSV handles quoted commas, escaped quotes, hyphens and optional empty columns', () => {
  const result = parse('学校,がっこう,"HỌC HIỆU","trường học, trường - academy"\n"カード","","","thẻ ""A-B"""\nアルバイト,bán-thời-gian');
  assert.equal(result.errorCount, 0);
  assert.equal(result.validCount, 3);
  assert.equal(result.rows[0].word.meaning, 'trường học, trường - academy');
  assert.equal(result.rows[1].word.meaning, 'thẻ "A-B"');
  assert.equal(result.rows[1].word.reading, '');
  assert.equal(result.rows[2].word.meaning, 'bán-thời-gian');
});

test('text rejects missing required fields, wrong columns and broken quotes by physical row', () => {
  const result = parse('学校\n\n,nghĩa\n学校,\na,b,c,d,e\n学校,"trường\n学校,"trường"abc\n学校,trư"ờng\n学校|trường');
  assert.equal(result.errorCount, 7);
  assert.equal(result.validCount, 1);
  assert.deepEqual(result.rows.filter((row) => row.status === 'error').map((row) => row.line), [1, 3, 4, 5, 6, 7, 8]);
});

test('exact four-field duplicates are skipped within input and existing words, preserving distinct meanings', () => {
  const existing = [word()];
  const result = parse(JSON.stringify([word({ word: ' 学校 ' }), word({ meaning: 'nhà trường' }), word({ meaning: ' nhà trường ' }), word({ reading: '' }), word({ hanViet: 'học hiệu' })]), existing);
  assert.equal(result.duplicateCount, 2);
  assert.equal(result.validCount, 3);
  assert.equal(existing.length, 1);
  assert.equal(vocabImportKey(word()), vocabImportKey(word({ meaning: ' trường học ' })));
  assert.notEqual(vocabImportKey(word()), vocabImportKey(word({ hanViet: 'học hiệu' })));
});

test('field limits accept exact boundaries and reject overflow after trimming', () => {
  const boundary = word({ word: 'a'.repeat(500), reading: 'b'.repeat(500), hanViet: 'c'.repeat(200), meaning: 'd'.repeat(2000) });
  assert.equal(parse(JSON.stringify([boundary])).validCount, 1);
  const result = parse(JSON.stringify(Object.keys(boundary).map((key) => ({ ...boundary, [key]: boundary[key] + 'x' }))));
  assert.equal(result.errorCount, 4);
  assert.equal(result.validCount, 0);
});

test('empty inputs and oversized UTF-8 data return explicit batch errors', () => {
  for (const input of ['', '\n\t ', '[]', '界'.repeat(Math.floor(512 * 1024 / 3) + 1)]) {
    const result = parse(input);
    assert.ok(result.errors.length > 0);
    assert.equal(result.validCount, 0);
  }
});

test('source row limit and lesson capacity count duplicates correctly', () => {
  const many = Array.from({ length: 500 }, (_, index) => word({ word: String(index) }));
  assert.equal(parse(JSON.stringify(many)).validCount, 500);
  assert.ok(parse(JSON.stringify([...many, word()])).errors.length);
  assert.ok(parse(Array.from({ length: 501 }, () => '学校,trường').join('\n')).errors.length);
  assert.deepEqual(parse(JSON.stringify(many), many).errors, []);
  const full = parse(JSON.stringify([word()]), many);
  assert.equal(full.validCount, 1);
  assert.ok(full.errors.some((message) => message.includes('500')));
});
