import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJlptLevel, jlptLevelQuery, roadmapForLevel, formatJlptMinutes, jlptResourceHref, sourceWebUrl } from '../src/features/roadmaps/utils/jlpt-catalog.ts';

test('JLPT deep links accept only a supported level; an unknown level never falls back to N5', () => {
  for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) assert.equal(parseJlptLevel(level), level);
  for (const value of [null, '', 'N6', 'n5', 'N5/N4']) assert.equal(parseJlptLevel(value), null);
  const original = new URLSearchParams('level=N5&from=sidebar&session=old-session&attempt=old-attempt&view=test');
  assert.equal(jlptLevelQuery(original, 'N4').toString(), 'level=N4&from=sidebar');
  assert.equal(jlptLevelQuery(original, null).toString(), 'from=sidebar');
  assert.equal(original.get('level'), 'N5');
});

test('a level with no published catalog remains empty instead of borrowing another level', () => {
  const n5 = { level: 'N5', id: 'n5-course', sessionCount: 2 };
  const n3 = { level: 'N3', id: 'n3-course', sessionCount: 1 };
  assert.equal(roadmapForLevel([n5, n3], 'N5'), n5);
  assert.equal(roadmapForLevel([n5, n3], 'N3'), n3);
  assert.equal(roadmapForLevel([n5, n3], 'N4'), null);
  assert.equal(roadmapForLevel([], 'N5'), null);
});

test('study links keep the exact catalog target; unavailable targets do not get fallback links', () => {
  for (const href of ['/kanji/k-1', '/tu-vung/giao-trinh/n5/bai/lesson-1', '/ngu-phap/mau/pattern-1', '/tron-doi/doc-hieu/article-1', '/tron-doi/shadowing/video-1', '/tu-vung/bang-chu-cai?script=katakana']) {
    assert.equal(jlptResourceHref({ available: true, href }), href);
    assert.equal(jlptResourceHref({ available: false, href }), null);
  }
  for (const href of [null, '', '//example.com', 'https://example.com', 'javascript:alert(1)']) assert.equal(jlptResourceHref({ available: true, href }), null);
});

test('duration uses authored minutes and never invents a two-hour session estimate', () => {
  assert.equal(formatJlptMinutes(35), '35 phút');
  assert.equal(formatJlptMinutes(60), '1 giờ');
  assert.equal(formatJlptMinutes(125), '2 giờ 5 phút');
  for (const value of [0, -1, null, undefined, 2.5, NaN]) assert.equal(formatJlptMinutes(value), 'Chưa có thời lượng');
});

test('source identifiers may be shown as text but only web URLs become external links', () => {
  assert.equal(sourceWebUrl('https://example.org/license'), 'https://example.org/license');
  assert.equal(sourceWebUrl('urn:nihongo:jlpt'), null);
  assert.equal(sourceWebUrl('javascript:alert(1)'), null);
  assert.equal(sourceWebUrl(''), null);
});
