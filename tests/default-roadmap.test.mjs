import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_ROADMAP, studyStreak, vietnamStudyDate } from '../shared/default-roadmap.mjs';
import { roadmapDayKanji } from '../shared/roadmap.mjs';

test('the approved N5 catalog is exactly 28 current characters in catalog order, grouped 10/10/8', () => {
  const expected = [...'一二三四五六七八九十百千万日月火水木金土人休体何学校先生'];
  assert.equal(DEFAULT_ROADMAP.id, 'n5-v1');
  assert.equal(DEFAULT_ROADMAP.level, 'N5');
  assert.equal(DEFAULT_ROADMAP.perDay, 10);
  assert.deepEqual(DEFAULT_ROADMAP.kanjiList, expected);
  const groups = [1, 2, 3].map(day => roadmapDayKanji(DEFAULT_ROADMAP.kanjiList, DEFAULT_ROADMAP.perDay, day));
  assert.deepEqual(groups.map(group => group.length), [10, 10, 8]);
  assert.deepEqual(groups.flat(), expected);
  const source = readFileSync(new URL('../src/data/kanjiData.ts', import.meta.url), 'utf8');
  const entries = source.split(/\bid:\s*"/).slice(1);
  const n5 = entries.filter(entry => /\blevel:\s*"N5"/.test(entry)).map(entry => entry.match(/\bkanji:\s*"([^"]+)"/)[1]);
  assert.deepEqual(DEFAULT_ROADMAP.kanjiList, n5);
});

test('Vietnam study dates switch at 17:00 UTC including month/year and leap-day boundaries', () => {
  assert.equal(vietnamStudyDate(new Date('2026-09-14T16:59:59.999Z')), '2026-09-14');
  assert.equal(vietnamStudyDate(new Date('2026-09-14T17:00:00.000Z')), '2026-09-15');
  assert.equal(vietnamStudyDate(new Date('2026-12-31T17:00:00.000Z')), '2027-01-01');
  assert.equal(vietnamStudyDate(new Date('2024-02-28T17:00:00.000Z')), '2024-02-29');
});

test('streak ends today or yesterday, counts each date once and ignores gaps/future days', () => {
  const now = new Date('2026-09-15T04:00:00.000Z');
  assert.equal(studyStreak([], now), 0);
  assert.equal(studyStreak(['2026-09-13'], now), 0);
  assert.equal(studyStreak(['2026-09-14', '2026-09-13'], now), 2);
  assert.equal(studyStreak(['2026-09-14', '2026-09-15', '2026-09-15', '2026-09-13', '2026-09-11', '2026-09-16'], now), 3);
  assert.equal(studyStreak(['2026-09-13', '2026-09-15'], now), 1);
});

test('streak crosses month/year and leap days using consecutive calendar dates', () => {
  assert.equal(studyStreak(['2026-12-30', '2026-12-31', '2027-01-01'], new Date('2027-01-01T04:00:00Z')), 3);
  assert.equal(studyStreak(['2024-02-28', '2024-02-29', '2024-03-01'], new Date('2024-03-01T04:00:00Z')), 3);
  assert.equal(studyStreak(['2026-02-28', '2026-03-01'], new Date('2026-03-01T04:00:00Z')), 2);
  assert.equal(studyStreak(['2026-09-14'], new Date('2026-09-15T17:00:00Z')), 0);
});
