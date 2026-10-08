import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePitchReading, splitMoras, getPitchContour } from '../src/study/pitch-accent.mjs';

test('pitch readings normalize width, decomposed dakuten and katakana without replacing kana', () => {
  assert.equal(normalizePitchReading('  ｶﾞｯｺｳ  '), 'がっこう');
  assert.equal(normalizePitchReading('ギュウニュウ'), 'ぎゅうにゅう');
  assert.equal(normalizePitchReading('ヴァイオリン'), 'ゔぁいおりん');
  assert.equal(normalizePitchReading(''), '');
  assert.throws(() => normalizePitchReading(null), TypeError);
  assert.throws(() => normalizePitchReading(123), TypeError);
});

test('mora splitting keeps contracted kana together and long vowels, nasal and sokuon separate', () => {
  assert.deepEqual(splitMoras('きょう'), ['きょ', 'う']);
  assert.deepEqual(splitMoras('シンブン'), ['し', 'ん', 'ぶ', 'ん']);
  assert.deepEqual(splitMoras('ｶﾞｯｺｳ'), ['が', 'っ', 'こ', 'う']);
  assert.deepEqual(splitMoras('スーパー'), ['す', 'ー', 'ぱ', 'ー']);
  assert.deepEqual(splitMoras('ティッシュ'), ['てぃ', 'っ', 'しゅ']);
  assert.deepEqual(splitMoras('ファックス'), ['ふぁ', 'っ', 'く', 'す']);
  assert.deepEqual(splitMoras('クヮルテット'), ['くゎ', 'る', 'て', 'っ', 'と']);
  assert.deepEqual(splitMoras('ヴォイス'), ['ゔぉ', 'い', 'す']);
});

test('invalid readings are rejected instead of silently drawing misleading mora counts', () => {
  for (const reading of ['', '   ', 'ーあ', 'ゃく', 'ぁ', 'あゃゅ', 'んゃ', 'っゅ', 'かーゃ', '学校', 'gakkou', 'あ い', 'あ・い', 'あ。', 'あ1', 'ゝ', 'ゕ', 'あ🙂']) {
    assert.throws(() => splitMoras(reading), RangeError, reading);
  }
});

test('unaccented and final-accented words differ at the particle and final drop', () => {
  const unaccented = getPitchContour('はし', 0);
  const finalAccented = getPitchContour('はし', 2);
  assert.deepEqual(unaccented, {
    moras: [{ text: 'は', high: false, drop: false }, { text: 'し', high: true, drop: false }],
    particleHigh: true,
    type: 'heiban',
  });
  assert.deepEqual(finalAccented, {
    moras: [{ text: 'は', high: false, drop: false }, { text: 'し', high: true, drop: true }],
    particleHigh: false,
    type: 'odaka',
  });
});

test('initial accent starts high and drops immediately', () => {
  assert.deepEqual(getPitchContour('あめ', 1), {
    moras: [{ text: 'あ', high: true, drop: true }, { text: 'め', high: false, drop: false }],
    particleHigh: false,
    type: 'atamadaka',
  });
});

test('internal accent positions use moras rather than individual kana characters', () => {
  assert.deepEqual(getPitchContour('きょうしつ', 2), {
    moras: [
      { text: 'きょ', high: false, drop: false },
      { text: 'う', high: true, drop: true },
      { text: 'し', high: false, drop: false },
      { text: 'つ', high: false, drop: false },
    ],
    particleHigh: false,
    type: 'nakadaka',
  });
});

test('a single mora distinguishes unaccented low-high from accented high-low including the particle', () => {
  assert.deepEqual(getPitchContour('ひ', 0), {
    moras: [{ text: 'ひ', high: false, drop: false }], particleHigh: true, type: 'heiban',
  });
  assert.deepEqual(getPitchContour('ひ', 1), {
    moras: [{ text: 'ひ', high: true, drop: true }], particleHigh: false, type: 'atamadaka',
  });
});

test('accent position validation rejects unsupported or out-of-range values', () => {
  for (const accent of [-1, 3, 1.5, NaN, Infinity, undefined, null, '1', true]) {
    assert.throws(() => getPitchContour('きょう', accent), RangeError);
  }
});

test('every supplied accent position has exactly its specified drop without mutating other variants', () => {
  const readings = ['ひ', 'あめ', 'きょうしつ', 'アイスクリーム', 'ティッシュ'];
  for (const reading of readings) {
    const count = splitMoras(reading).length;
    for (let accent = 0; accent <= count; accent += 1) {
      const contour = getPitchContour(reading, accent);
      assert.equal(contour.moras.length, count);
      assert.equal(contour.moras.filter(mora => mora.drop).length, accent ? 1 : 0);
      if (accent) assert.equal(contour.moras.findIndex(mora => mora.drop), accent - 1);
      assert.equal(contour.particleHigh, accent === 0);
    }
  }
});
