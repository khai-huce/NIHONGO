import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROADMAP_KANJI, analyzeRoadmapKanji, extractRoadmapKanji } from '../shared/roadmap.mjs';

test('roadmap supported characters and IDs match the learning catalog', () => {
  const source = readFileSync(new URL('../src/data/kanjiData.ts', import.meta.url), 'utf8');
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
