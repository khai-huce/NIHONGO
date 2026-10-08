import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRoadmapKanji, roadmapProgress } from '../src/study/roadmap-study.mjs';

const characters = ['六', '一', '二', '三', '四', '五'];

test('day completion needs an explicit assessment for every character, including false', () => {
  let progress = roadmapProgress(characters, 5, {}, []);
  for (const id of ['k-6', 'k-1', 'k-2', 'k-3']) {
    progress = assessRoadmapKanji(characters, 5, progress.assessments, progress.completedDays, 1, id, false);
    assert.deepEqual(progress.completedDays, []);
    assert.equal(progress.currentDay, 1);
  }
  progress = assessRoadmapKanji(characters, 5, progress.assessments, progress.completedDays, 1, 'k-4', false);
  assert.deepEqual(progress.completedDays, [1]);
  assert.equal(progress.currentDay, 2);
  assert.equal(Object.keys(progress.assessments).length, 5);
});

test('the short final day completes independently and continuation finds the first unfinished day', () => {
  const progress = assessRoadmapKanji(characters, 5, {}, [], 2, 'k-5', true);
  assert.deepEqual(progress.completedDays, [2]);
  assert.equal(progress.currentDay, 1);
  let completed = progress;
  for (const id of ['k-6', 'k-1', 'k-2', 'k-3', 'k-4']) {
    completed = assessRoadmapKanji(characters, 5, completed.assessments, completed.completedDays, 1, id, true);
  }
  assert.deepEqual(completed.completedDays, [1, 2]);
  assert.equal(completed.currentDay, 2);
  const replayed = assessRoadmapKanji(characters, 5, completed.assessments, completed.completedDays, 2, 'k-5', false);
  assert.deepEqual(replayed.completedDays, [1, 2]);
  assert.equal(replayed.assessments['k-5'], false);
  assert.equal(completed.assessments['k-5'], true);
});

test('normalization bounds progress to this plan and never treats a viewed day as completion', () => {
  assert.deepEqual(roadmapProgress(characters, 5, { 'k-1': false, 'k-401': true, 'k-2': 'true' }, [3, 0, 2, 2, 1.5, -1]), {
    assessments: { 'k-1': false }, completedDays: [2], currentDay: 1,
  });
  assert.deepEqual(roadmapProgress(characters, 5, null, null), { assessments: {}, completedDays: [], currentDay: 1 });
  assert.deepEqual(roadmapProgress(characters, 5, { 'k-5': true }, []), { assessments: { 'k-5': true }, completedDays: [], currentDay: 1 });
});

test('a rating cannot cross day boundaries or mutate malformed input', () => {
  for (const [day, id] of [[0, 'k-1'], [3, 'k-1'], [1, 'k-5'], [2, 'k-6'], [2, 'unknown']]) {
    assert.throws(() => assessRoadmapKanji(characters, 5, {}, [], day, id, true), RangeError);
  }
  assert.throws(() => roadmapProgress([], 5, {}, []), RangeError);
  assert.throws(() => assessRoadmapKanji(characters, 5, {}, [], 1, 'k-1', 'true'), RangeError);
});
