import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROADMAP_KANJI, analyzeRoadmapKanji, extractRoadmapKanji, roadmapDayKanji } from '../src/study/roadmap.mjs';

test('roadmap supported characters and IDs match the learning catalog', () => {
  const source = readFileSync(new URL('../fixtures/legacy-kanji.ts', import.meta.url), 'utf8');
  const catalog = [...source.matchAll(/\bid:\s*"([^"]+)"\s*,\s*kanji:\s*"([^"]+)"/g)].map(match => [match[1], match[2]]);
  assert.ok(catalog.length > 0);
  assert.deepEqual(ROADMAP_KANJI, catalog);
  assert.equal(new Set(ROADMAP_KANJI.map(([id]) => id)).size, catalog.length);
  assert.equal(new Set(ROADMAP_KANJI.map(([, character]) => character)).size, catalog.length);
});

test('paste extracts Han in first-occurrence order while ignoring prose separators and kana', () => {
  assert.deepEqual(extractRoadmapKanji('二、一 / 二\n三 こんにちは 2026 日'), ['二', '一', '三', '日']);
  assert.deepEqual(extractRoadmapKanji('abc 123 あア\n !'), []);
});

test('unknown and supplementary Han are reported without silently removing input', () => {
  assert.deepEqual(analyzeRoadmapKanji('一猫𠮷二猫'), { kanjiList: ['一', '猫', '𠮷', '二'], unsupported: ['猫', '𠮷'] });
  assert.deepEqual(analyzeRoadmapKanji('一二三'), {kanjiList:['一','二','三'], unsupported:[]});
});

test('daily groups preserve input order and include the final short day without repeating cards', () => {
  const kanji = ['二', '一', '三', '四', '五', '六'];
  const first = roadmapDayKanji(kanji, 5, 1);
  const last = roadmapDayKanji(kanji, 5, 2);
  assert.deepEqual(first, ['二', '一', '三', '四', '五']);
  assert.deepEqual(last, ['六']);
  assert.deepEqual([...first, ...last], kanji);
  first.reverse();
  assert.deepEqual(roadmapDayKanji(kanji, 5, 1), ['二', '一', '三', '四', '五']);
  assert.deepEqual(roadmapDayKanji(kanji, 30, 1), kanji);
});

test('invalid days and daily goals cannot silently select another group', () => {
  for (const [perDay, day] of [[5, 0], [5, -1], [5, 2], [5, 1.5], [0, 1], [NaN, 1], [1.5, 1]]) {
    assert.throws(() => roadmapDayKanji(['一'], perDay, day), RangeError);
  }
  assert.throws(() => roadmapDayKanji([], 5, 1), RangeError);
});
