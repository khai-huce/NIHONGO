import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editAiRow, makeAiEditableRows, prepareAiImport, sameAiFormatContext, validateAiFormatResponse } from '../src/features/vocabulary/lib/vocab-ai-format.ts';

const source = (changes = {}) => ({ word: '学校', reading: 'がっこう', hanViet: 'HỌC HIỆU', meaning: 'trường học', sourceText: '学校 trường học', generatedFields: ['reading', 'hanViet'], ...changes });
const response = (changes = {}) => ({ userId: 'account-a', id: 'request-a', cached: false, result: { rows: [source()], warnings: ['Cần rà soát cách đọc.'] }, ...changes });

test('AI response verifies account and request before creating an editable preview', () => {
  assert.deepEqual(validateAiFormatResponse(response(), 'account-a', 'request-a'), response());
  for (const payload of [response({ userId: 'account-b' }), response({ id: 'request-b' }), null, response({ cached: undefined })]) {
    assert.throws(() => validateAiFormatResponse(payload, 'account-a', 'request-a'));
  }
});

test('malformed or oversized AI output is rejected rather than silently trimmed or guessed', () => {
  for (const result of [
    { rows: [], warnings: [] },
    { rows: Array.from({ length: 51 }, () => source()), warnings: [] },
    { rows: [source({ meaning: null })], warnings: [] },
    { rows: [source({ sourceText: null })], warnings: [] },
    { rows: [source({ generatedFields: ['word'] })], warnings: [] },
    { rows: [source()], warnings: [null] },
  ]) assert.throws(() => validateAiFormatResponse(response({ result }), 'account-a', 'request-a'));
  assert.equal(validateAiFormatResponse(response({ result: { rows: [source({ meaning: '' })], warnings: [] } }), 'account-a', 'request-a').result.rows[0].meaning, '');
});

test('editing and retrying import preserve word IDs and source metadata', () => {
  let next = 0;
  const original = [source(), source({ word: '犬', reading: 'いぬ', hanViet: '', meaning: 'chó' })];
  const rows = makeAiEditableRows(original, () => `row-${++next}`);
  const edited = editAiRow(rows, 'row-1', 'meaning', ' nhà trường ');
  const first = prepareAiImport(edited, []);
  const retry = prepareAiImport(edited, []);
  assert.deepEqual(first.words, retry.words);
  assert.deepEqual(first.words.map(row => row.id), ['row-1', 'row-2']);
  assert.equal(first.words[0].meaning, 'nhà trường');
  assert.equal(edited[0].sourceText, original[0].sourceText);
  assert.deepEqual(edited[0].generatedFields, original[0].generatedFields);
  assert.equal(rows[0].meaning, 'trường học');
  assert.equal('sourceText' in first.words[0], false, 'AI annotations must not leak into import payloads');
  assert.equal('generatedFields' in first.words[0], false);
});

test('reload rechecks duplicates without losing edits or importing metadata', () => {
  const rows = makeAiEditableRows([source(), source({ meaning: 'nhà trường' }), source({ meaning: 'nhà trường' })], (() => { let id = 0; return () => `${++id}`; })());
  const before = prepareAiImport(rows, []);
  assert.equal(before.preview.validCount, 2);
  assert.equal(before.preview.duplicateCount, 1);
  const after = prepareAiImport(rows, [source()]);
  assert.equal(after.preview.validCount, 1);
  assert.equal(after.preview.duplicateCount, 2);
  assert.equal(after.words.length, 3, 'server must recheck duplicate candidates');
  assert.deepEqual(after.words.map(row => row.id), before.words.map(row => row.id));
  const allDuplicate = prepareAiImport(rows, [source(), source({ meaning: 'nhà trường' })]);
  assert.equal(allDuplicate.canSave, false);
});

test('missing or excessive fields block import, while optional fields may be blank', () => {
  for (const change of [{ word: '' }, { meaning: '' }, { reading: 'a'.repeat(501) }, { hanViet: 'a'.repeat(201) }, { meaning: 'a'.repeat(2001) }]) {
    const result = prepareAiImport(makeAiEditableRows([source(change)], () => 'stable'), []);
    assert.equal(result.canSave, false);
    assert.equal(result.preview.errorCount, 1);
  }
  assert.equal(prepareAiImport(makeAiEditableRows([source({ reading: '', hanViet: '' })], () => 'stable'), []).canSave, true);
});

test('lesson cap counts only new distinct words after an edited preview', () => {
  const existing = Array.from({ length: 500 }, (_, index) => source({ word: `語${index}` }));
  const rows = makeAiEditableRows([source()], () => 'stable');
  const full = prepareAiImport(rows, existing);
  assert.equal(full.canSave, false);
  assert.ok(full.preview.errors.some(error => error.includes('500')));
  assert.equal(prepareAiImport(rows, existing.slice(0, 499)).canSave, true);
});

test('old responses become stale after account, lesson, input, or revision changes', () => {
  const context = { userId: 'account-a', lessonId: 'lesson-a', text: '学校', revision: 1 };
  assert.equal(sameAiFormatContext(context, { ...context }), true);
  for (const change of [{ userId: 'account-b' }, { userId: null }, { lessonId: 'lesson-b' }, { text: '学校 犬' }, { revision: 2 }]) {
    assert.equal(sameAiFormatContext(context, { ...context, ...change }), false);
  }
});
