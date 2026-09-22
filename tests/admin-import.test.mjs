import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_IMPORT_BYTES, createKanjiImportTemplate, importErrorDetails, importFieldPath, parseKanjiImport,
} from '../src/admin/import-json.ts';

const entry = (changes = {}) => ({ sourceId: 'approved-source', expectedVersion: null, data: { id: 'k-new', kanji: '安' }, ...changes });
const text = (entries = [entry()]) => JSON.stringify({ kind: 'kanji', entries });

test('accepts Kanji envelopes and preserves content for authoritative server validation', () => {
  const payload = { kind: 'kanji', entries: [entry({ expectedVersion: 4, data: { id: 'k-an', kanji: '安', meaning: '  an toàn  ', unrecognized: true } })] };
  assert.deepEqual(parseKanjiImport('\uFEFF' + JSON.stringify(payload)), payload);
  assert.equal(parseKanjiImport(text(Array.from({ length: 200 }, () => entry()))).entries.length, 200);
});

test('rejects empty, malformed, non-object, different-kind and oversized batches', () => {
  for (const invalid of ['', ' ', '{', '[]', 'null', '{"kind":"radicals","entries":[]}', text([]), text(Array.from({ length: 201 }, () => entry()))]) {
    assert.throws(() => parseKanjiImport(invalid), { name: 'ImportInputError' });
  }
});

test('counts UTF-8 bytes for pasted JSON and accepts the exact byte limit', () => {
  const valid = text();
  assert.equal(new TextEncoder().encode(valid).byteLength, valid.length + 2);
  const padding = MAX_IMPORT_BYTES - new TextEncoder().encode(valid).byteLength;
  assert.equal(parseKanjiImport(valid + ' '.repeat(padding)).entries.length, 1);
  assert.throws(() => parseKanjiImport(valid + ' '.repeat(padding + 1)), /1,5 MiB/);
});

test('reports exact entry field paths without guessing a missing update version', () => {
  const invalid = [null, entry({ sourceId: '' }), entry({ expectedVersion: undefined }), entry({ expectedVersion: -1 }), entry({ expectedVersion: 1.5 }), entry({ data: [] })];
  let details;
  try { parseKanjiImport(text(invalid)); } catch (error) { details = importErrorDetails(error); }
  assert.deepEqual(details.issues.map(issue => importFieldPath(issue.path)), [
    'entries[0]', 'entries[1].sourceId', 'entries[2].expectedVersion', 'entries[3].expectedVersion', 'entries[4].expectedVersion', 'entries[5].data',
  ]);
});

test('retains backend field paths and handles network errors safely', () => {
  const issue = { path: ['input', 'entries', 2, 'data', 'meaning'], message: 'Nghĩa còn trống.' };
  const error = Object.assign(new Error('Dữ liệu chưa hợp lệ.'), { issues: [issue, null, { path: [{}], message: 'invalid' }] });
  assert.deepEqual(importErrorDetails(error), { message: error.message, issues: [issue] });
  assert.equal(importFieldPath(issue.path), 'input.entries[2].data.meaning');
  assert.equal(importFieldPath([]), 'JSON');
  assert.deepEqual(importErrorDetails(null).issues, []);
});

test('download template uses an existing source ID and leaves required content blank', () => {
  const template = JSON.parse(createKanjiImportTemplate('actual-db-source'));
  assert.equal(template.kind, 'kanji');
  assert.equal(template.entries[0].sourceId, 'actual-db-source');
  assert.equal(template.entries[0].expectedVersion, null);
  for (const key of ['id', 'kanji', 'hanViet', 'meaning', 'level']) assert.equal(template.entries[0].data[key], '');
  assert.equal(template.entries[0].data.strokeCount, null);
  assert.throws(() => createKanjiImportTemplate(''), /nguồn/);
});
