import test from 'node:test';
import assert from 'node:assert/strict';
import { KANA_CATALOG_ID, KANA_COUNT, KANA_LIST, SEION_ROWS, DAKUON_ROWS, YOON_ROWS, makeKanaQuiz, gradeKanaAnswers } from '../shared/kana-quiz.mjs';

const byId = new Map(KANA_LIST.map(kana => [kana.id, kana]));
function seededRandom(seed = 20260916) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
const answersFor = mode => makeKanaQuiz(mode, seededRandom()).map(({ kanaId, script }) => ({ kanaId, script, answerId: kanaId }));

test('kana-v1 preserves 104 distinct stable IDs, table order, null gaps and homophones', () => {
  assert.equal(KANA_CATALOG_ID, 'kana-v1');
  assert.equal(KANA_COUNT, 104);
  assert.equal(KANA_LIST.length, 104);
  assert.equal(new Set(KANA_LIST.map(kana => kana.id)).size, 104);
  assert.ok(KANA_LIST.every(kana => kana.id === kana.hira && kana.kata && kana.romaji));
  assert.deepEqual(SEION_ROWS.map(row => row.length), Array(11).fill(5));
  assert.deepEqual(DAKUON_ROWS.map(row => row.length), Array(5).fill(5));
  assert.deepEqual(YOON_ROWS.map(row => row.length), Array(4).fill(9));
  assert.deepEqual(SEION_ROWS[7].map(kana => kana?.id ?? null), ['や', null, 'ゆ', null, 'よ']);
  assert.deepEqual(SEION_ROWS[9].map(kana => kana?.id ?? null), ['わ', null, null, null, 'を']);
  assert.deepEqual(SEION_ROWS[10].map(kana => kana?.id ?? null), ['ん', null, null, null, null]);
  assert.deepEqual(YOON_ROWS[3].slice(6), [null, null, null]);
  assert.deepEqual(KANA_LIST.slice(0, 5).map(kana => kana.id), ['あ', 'い', 'う', 'え', 'お']);
  assert.equal(KANA_LIST.at(-1).id, 'ぴょ');
  assert.deepEqual(KANA_LIST.filter(kana => kana.romaji === 'ji').map(kana => kana.id), ['じ', 'ぢ']);
  assert.deepEqual(KANA_LIST.filter(kana => kana.romaji === 'zu').map(kana => kana.id), ['ず', 'づ']);
});

test('every mode asks each kana once with four distinct, unambiguous valid choices', () => {
  for (const mode of ['hiragana', 'katakana', 'both']) {
    for (const seed of [1, 9, 450, 20260916]) {
      const quiz = makeKanaQuiz(mode, seededRandom(seed));
      assert.equal(quiz.length, KANA_COUNT);
      assert.deepEqual(quiz.map(question => question.kanaId).sort(), KANA_LIST.map(kana => kana.id).sort());
      for (const question of quiz) {
        assert.equal(question.options.length, 4);
        assert.equal(new Set(question.options).size, 4);
        assert.ok(question.options.every(id => byId.has(id)));
        assert.ok(question.options.includes(question.kanaId));
        assert.equal(new Set(question.options.map(id => byId.get(id).romaji)).size, 4);
        assert.ok(['hiragana', 'katakana'].includes(question.script));
        if (mode !== 'both') assert.equal(question.script, mode);
      }
    }
  }
});

test('both assigns exactly 52 questions to each script and retains that script while grading', () => {
  const quiz = makeKanaQuiz('both', seededRandom());
  assert.equal(quiz.filter(question => question.script === 'hiragana').length, 52);
  assert.equal(quiz.filter(question => question.script === 'katakana').length, 52);
  assert.ok(quiz.some((question, index) => index && question.script !== quiz[index - 1].script));
  const answers = quiz.map(({ kanaId, script }) => ({ kanaId, script, answerId: kanaId }));
  const result = gradeKanaAnswers('both', answers);
  assert.deepEqual(result.answers.map(answer => answer.script), quiz.map(question => question.script));
  assert.equal(result.total, 104);
  assert.equal(result.correct, 104);
});

test('shuffle is deterministic with a supplied generator, varies by seed and never mutates the catalog', () => {
  const before = JSON.stringify([SEION_ROWS, DAKUON_ROWS, YOON_ROWS, KANA_LIST]);
  const first = makeKanaQuiz('both', seededRandom(3));
  assert.deepEqual(first, makeKanaQuiz('both', seededRandom(3)));
  assert.notDeepEqual(first, makeKanaQuiz('both', seededRandom(4)));
  assert.notDeepEqual(first.map(question => question.kanaId), KANA_LIST.map(kana => kana.id));
  first[0].options[0] = 'changed';
  first[0].script = 'katakana';
  assert.equal(JSON.stringify([SEION_ROWS, DAKUON_ROWS, YOON_ROWS, KANA_LIST]), before);
  // Degenerate valid generators still terminate with valid options and balanced questions.
  for (const random of [() => 0, () => 0.999999]) {
    const quiz = makeKanaQuiz('both', random);
    assert.equal(quiz.length, 104);
    assert.equal(quiz.filter(question => question.script === 'hiragana').length, 52);
    assert.ok(quiz.every(question => new Set(question.options).size === 4));
  }
});

test('grading derives the score from canonical pronunciations and ignores claimed correctness', () => {
  const answers = answersFor('hiragana').map(answer => ({ ...answer, correct: true }));
  const wrong = answers.find(answer => answer.kanaId === 'あ');
  wrong.answerId = 'い';
  const original = JSON.stringify(answers);
  const result = gradeKanaAnswers('hiragana', answers);
  assert.equal(result.total, 104);
  assert.equal(result.correct, 103);
  assert.equal(result.answers.find(answer => answer.kanaId === 'あ').correct, false);
  assert.ok(answers.every(answer => answer.correct));
  assert.equal(JSON.stringify(answers), original);
  result.answers[0].answerId = 'changed';
  assert.ok(answers.every(answer => answer.answerId !== 'changed'));
});

test('equivalent ji and zu answers are never marked wrong despite different stable IDs', () => {
  const answers = answersFor('katakana');
  const equivalents = { 'じ': 'ぢ', 'ぢ': 'じ', 'ず': 'づ', 'づ': 'ず' };
  for (const answer of answers) answer.answerId = equivalents[answer.kanaId] ?? answer.answerId;
  const result = gradeKanaAnswers('katakana', answers);
  assert.equal(result.correct, 104);
  assert.ok(result.answers.every(answer => answer.correct));
});

test('grading rejects unfinished, duplicate, unknown or malformed answers', () => {
  const answers = answersFor('hiragana');
  const replaceFirst = patch => [{ ...answers[0], ...patch }, ...answers.slice(1)];
  for (const invalid of [null, {}, answers.slice(1), [...answers, answers[0]], Array(104),
    [null, ...answers.slice(1)], [[], ...answers.slice(1)],
    replaceFirst({ kanaId: answers[1].kanaId }), replaceFirst({ kanaId: 'unknown' }),
    replaceFirst({ answerId: 'unknown' }), replaceFirst({ answerId: null }),
    replaceFirst({ script: 'both' }), replaceFirst({ script: 'katakana' })]) {
    assert.throws(() => gradeKanaAnswers('hiragana', invalid));
  }
});

test('grading rejects wrong mode/script balance and quiz creation validates the mode', () => {
  const hiragana = answersFor('hiragana');
  assert.throws(() => gradeKanaAnswers('katakana', hiragana));
  assert.throws(() => gradeKanaAnswers('both', hiragana));
  const both = answersFor('both');
  const hira = both.find(answer => answer.script === 'hiragana');
  hira.script = 'katakana';
  assert.throws(() => gradeKanaAnswers('both', both));
  for (const mode of [null, undefined, '', 'hira', 'invalid']) {
    assert.throws(() => gradeKanaAnswers(mode, hiragana));
    assert.throws(() => makeKanaQuiz(mode));
  }
  for (const value of [-1, 1, Infinity, NaN]) assert.throws(() => makeKanaQuiz('hiragana', () => value));
});
