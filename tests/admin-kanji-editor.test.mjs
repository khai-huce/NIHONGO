import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/admin/kanji-editor-data.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { kanjiEditorForm, kanjiEditorData } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const fixture = JSON.parse(readFileSync(new URL('../server/content/catalog-initial.json', import.meta.url), 'utf8'));

test('editor preserves the complete existing catalog and stable IDs during a meaning edit', () => {
  for (const { data } of fixture.kanji) {
    const form = kanjiEditorForm(data);
    form.data.meaning = 'Nghĩa đã biên tập';
    assert.deepEqual(kanjiEditorData(form, data.id), { ...data, meaning: 'Nghĩa đã biên tập' });
    assert.notEqual(data.meaning, form.data.meaning);
  }
});

test('editor keeps optional example data and multiline stroke path boundaries', () => {
  const data = { ...fixture.kanji[0].data, examples: [{ word: '一人', reading: 'ひとり', meaning: 'một người', furigana: '一人[ひとり]', level: 'N5' }],
    strokePaths: ['M 10 10\nL 20 20', 'M1 2 L3 4'], dictionaryRadicalNumber: 1, frequency: 2 };
  assert.deepEqual(kanjiEditorData(kanjiEditorForm(data), data.id), data);
  const form = kanjiEditorForm(data);
  form.frequency = ''; form.dictionaryRadicalNumber = ''; form.strokePaths = '[]';
  const result = kanjiEditorData(form, data.id);
  assert.equal('frequency' in result, false);
  assert.equal('dictionaryRadicalNumber' in result, false);
  assert.deepEqual(result.strokePaths, []);
  assert.deepEqual(result.examples, data.examples);
});

test('new Kanji identity follows its Unicode scalar and malformed text cannot be saved', () => {
  const form = kanjiEditorForm();
  form.data.kanji = '𠮷'; form.data.hanViet = 'CÁT'; form.data.meaning = 'May mắn';
  assert.equal(kanjiEditorData(form).id, 'k-u20bb7');
  for (const value of ['日本', 'あ', '', 'A']) {
    form.data.kanji = value;
    assert.throws(() => kanjiEditorData(form), /đúng một chữ Kanji/);
  }
});

test('editor rejects fractional counts and non-path SVG rather than dropping fields', () => {
  const form = kanjiEditorForm(fixture.kanji[0].data);
  form.strokeCount = '1.5';
  assert.throws(() => kanjiEditorData(form), /Số nét/);
  form.strokeCount = '1'; form.strokePaths = '["<svg onload=alert(1)>"]';
  assert.throws(() => kanjiEditorData(form), /SVG không hợp lệ/);
  form.strokePaths = '{}';
  assert.throws(() => kanjiEditorData(form), /mảng JSON/);
});
