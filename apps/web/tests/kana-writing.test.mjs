import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWritingPoint, writingCanvasSize } from '../src/features/kana/lib/kana-writing.ts';

test('drawing coordinates stay aligned at different CSS sizes and page positions', () => {
  assert.deepEqual(normalizeWritingPoint(175, 260, { left: 25, top: 60, width: 300, height: 400 }), { x: 0.5, y: 0.5 });
  assert.deepEqual(normalizeWritingPoint(350, 420, { left: 50, top: 20, width: 600, height: 800 }), { x: 0.5, y: 0.5 });
  assert.deepEqual(normalizeWritingPoint(100, 160, { left: 25, top: 60, width: 300, height: 400 }), { x: 0.25, y: 0.25 });
});

test('captured pointers leaving the canvas stay on its boundary', () => {
  const bounds = { left: 20, top: 30, width: 300, height: 300 };
  assert.deepEqual(normalizeWritingPoint(-50, 500, bounds), { x: 0, y: 1 });
  assert.deepEqual(normalizeWritingPoint(500, -50, bounds), { x: 1, y: 0 });
});

test('hidden canvases and invalid pointer values do not add corrupt stroke points', () => {
  const bounds = { left: 0, top: 0, width: 300, height: 300 };
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.equal(normalizeWritingPoint(invalid, 30, bounds), null);
    assert.equal(normalizeWritingPoint(30, invalid, bounds), null);
    assert.equal(normalizeWritingPoint(30, 30, { ...bounds, left: invalid }), null);
  }
  assert.equal(normalizeWritingPoint(0, 0, { ...bounds, width: 0 }), null);
  assert.equal(normalizeWritingPoint(0, 0, { ...bounds, height: -1 }), null);
});

test('backing sizes handle high density, fractional layouts and missing DPR', () => {
  assert.deepEqual(writingCanvasSize(320, 320, 2), { width: 320, height: 320, pixelWidth: 640, pixelHeight: 640 });
  assert.deepEqual(writingCanvasSize(300.5, 200.25, 1.25), { width: 300.5, height: 200.25, pixelWidth: 376, pixelHeight: 250 });
  for (const ratio of [0, -1, NaN, undefined]) {
    assert.deepEqual(writingCanvasSize(320, 240, ratio), { width: 320, height: 240, pixelWidth: 320, pixelHeight: 240 });
  }
  assert.equal(writingCanvasSize(0, 300, 2), null);
  assert.equal(writingCanvasSize(300, Infinity, 2), null);
});
