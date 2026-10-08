import test from 'node:test';
import assert from 'node:assert/strict';
import { createShadowingCheckpoint, createShadowingQueue, matchingGrade } from '../src/features/shadowing/lib/shadowing-study.ts';
const pending = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('a final pause checkpoint supersedes queued positions and is saved before leaving', async () => {
  const gate = pending(), saved = []; let left = false;
  const checkpoint = createShadowingCheckpoint(async value => { saved.push(value); if (value === 5000) await gate.promise; });
  const periodic = checkpoint(5000), intermediate = checkpoint(7000);
  const last = checkpoint(8200).then(() => { left = true; });
  assert.deepEqual(saved, [5000]); assert.equal(left, false);
  gate.resolve(); await Promise.all([periodic, intermediate, last]);
  assert.deepEqual(saved, [5000, 8200]); assert.equal(left, true);
});

test('checkpoint failure keeps navigation blocked and requires an explicit retry', async () => {
  const gate = pending(); let fail = true, calls = 0;
  const checkpoint = createShadowingCheckpoint(async () => { calls++; await gate.promise; if (fail) throw Error('network'); });
  const first = assert.rejects(checkpoint(100), /network/), last = assert.rejects(checkpoint(200), /network/);
  gate.resolve(); await Promise.all([first, last]); assert.equal(calls, 1);
  fail = false; await checkpoint(200); assert.equal(calls, 2);
});

test('a position submitted immediately after a checkpoint resolves is not dropped', async () => {
  const saved = [], checkpoint = createShadowingCheckpoint(async value => { saved.push(value); });
  await checkpoint(1).then(() => checkpoint(2)); assert.deepEqual(saved, [1, 2]);
});
test('check and bookmark wait for the saved revision of the preceding cursor mutation', async () => {
  const queue = createShadowingQueue(); queue.mount(); const gate = pending(); let version = 0; const sent = [];
  const first = queue.enqueue(async () => { sent.push(version); await gate.promise; version++; });
  const second = queue.enqueue(async () => { sent.push(version); version++; });
  await Promise.resolve(); await Promise.resolve(); assert.deepEqual(sent, [0]);
  gate.resolve(); await Promise.all([first, second]); assert.deepEqual(sent, [0, 1]);
});
test('an account/video unmount cancels queued writes and ignores an in-flight response after remount', async () => {
  const queue = createShadowingQueue(); queue.mount(); const gate = pending(); let applied = false, sent = false;
  const running = queue.enqueue(async current => { await gate.promise; if (current()) applied = true; });
  await Promise.resolve(); await Promise.resolve();
  const waiting = queue.enqueue(async () => { sent = true; }); const rejected = assert.rejects(waiting, /Màn học/);
  queue.unmount(); queue.mount(); gate.resolve(); await running; await rejected;
  assert.equal(applied, false); assert.equal(sent, false); assert.equal(await queue.enqueue(async () => 'new'), 'new');
});
test('a failed write does not prevent an explicit retry with the same current revision', async () => {
  const queue = createShadowingQueue(); queue.mount(); let version = 4;
  await assert.rejects(queue.enqueue(async () => { throw new Error('network'); }), /network/);
  assert.equal(await queue.enqueue(async () => version), 4);
});
test('saved first grades follow sentence text and token occurrences, not translation/timing edits', () => {
  const sentence = { id: 's1', text: '私も私も。', tokens: [{ text: '私', reading: 'わたし' }, { text: 'も' }, { text: '私' }, { text: 'も' }, { text: '。' }], translationVi: '', startMs: 0, endMs: 1000 };
  const grade = { sentenceId: 's1', mode: 'puzzle', sentence, correct: false };
  assert.equal(matchingGrade([grade], { ...sentence, translationVi: 'Tôi cũng vậy', startMs: 500 }, 'puzzle'), grade);
  assert.equal(matchingGrade([grade], sentence, 'typing'), undefined);
  assert.equal(matchingGrade([grade], { ...sentence, text: '私も。' }, 'puzzle'), undefined);
  assert.equal(matchingGrade([grade], { ...sentence, tokens: [{ text: sentence.text }] }, 'puzzle'), undefined);
  assert.equal(matchingGrade([grade], { ...sentence, id: 's2' }, 'puzzle'), undefined);
});
