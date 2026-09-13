import test from 'node:test';
import assert from 'node:assert/strict';
import { keepVocabProgress, nextUnratedIndex, summarizeVocabProgress } from '../src/utils/vocab-progress.ts';

test('resume at the first unrated word; false is already rated', () => {
  const words = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(summarizeVocabProgress(words, { a: false, c: true }), {
    known: 1, unknown: 1, rated: 2, firstUnratedIndex: 1,
  });
});

test('ratings replace a word status without increasing the rated count', () => {
  const words = [{ id: 'a' }, { id: 'b' }];
  let progress = { a: false, b: true };
  progress = { ...progress, a: true };
  assert.deepEqual(summarizeVocabProgress(words, progress), {
    known: 2, unknown: 0, rated: 2, firstUnratedIndex: -1,
  });
});

test('same-ID edits retain progress, while deleted IDs are pruned and new IDs start unrated', () => {
  const words = [{ id: 'a', word: '編集' }, { id: 'new' }];
  const progress = keepVocabProgress(words, { a: false, deleted: true });
  assert.deepEqual(progress, { a: false });
  assert.deepEqual(summarizeVocabProgress(words, progress), {
    known: 0, unknown: 1, rated: 1, firstUnratedIndex: 1,
  });
});

test('empty and reset lessons have no saved ratings', () => {
  assert.deepEqual(summarizeVocabProgress([], { deleted: true }), {
    known: 0, unknown: 0, rated: 0, firstUnratedIndex: -1,
  });
  assert.deepEqual(summarizeVocabProgress([{ id: 'a' }], {}), {
    known: 0, unknown: 0, rated: 0, firstUnratedIndex: 0,
  });
});

test('matching words with different IDs have independent ratings; prototype keys are not ratings', () => {
  const words = [{ id: 'a', word: '学校' }, { id: 'b', word: '学校' }, { id: 'toString' }];
  const progress = { a: true };
  assert.deepEqual(keepVocabProgress(words, progress), { a: true });
  assert.deepEqual(summarizeVocabProgress(words, progress), {
    known: 1, unknown: 0, rated: 1, firstUnratedIndex: 1,
  });
});

test('next unrated skips both true and false ratings and wraps to earlier skipped cards', () => {
  const words = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const progress = { b: true, c: false };
  assert.equal(nextUnratedIndex(words, progress), 0);
  assert.equal(nextUnratedIndex(words, progress, 0), 3);
  assert.equal(nextUnratedIndex(words, { ...progress, d: true }, 3), 0);
  assert.equal(nextUnratedIndex(words, { ...progress, a: false, d: true }, 3), -1);
  assert.equal(nextUnratedIndex([], {}), -1);
});
