import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingSupplementGroups, supplementEligibility, validateSupplementDraft, supplementListsPayload, validateSupplementResponse } from '../src/features/reading/lib/reading-supplements.ts';

const id = '52fdad7b-4c60-460c-a92a-7e8a27ae1780';
const article = () => ({ id, version: 2, visibility: 'private', text: '学校で勉強しました。', paragraphs: [{ id: 'p1', sentences: [{ id: 'p1-s1', japanese: '学校で勉強しました。' }] }], vocabList: [], grammarList: [], quizList: [] });
const evidence = () => [{ sentenceId: 'p1-s1', quote: '学校で勉強しました。' }];
const lists = () => ({ vocabList: [{ word: '学校', reading: 'がっこう', hanViet: 'HỌC HIỆU', meaning: 'Trường học', evidence: evidence() }], grammarList: [{ pattern: 'Nで', meaning: 'Địa điểm', exampleJp: '学校で勉強しました。', exampleVi: 'Đã học ở trường.', evidence: evidence() }], quizList: [] });
const quiz = () => ({ vocabList: [], grammarList: [], quizList: [{ id: 7, question: 'どこで勉強しましたか。', options: ['学校', '家', '店', '駅'], correctIndex: 0, explanation: 'Học ở trường.', evidence: evidence() }] });
const response = () => ({ userId: 'u', id: 'r', articleId: id, version: 2, kind: 'study', cached: false, result: { ...lists(), groups: ['vocab', 'grammar'], warnings: ['Rà soát.'] }, catalog: { vocab: [null], grammar: [null] } });

test('supplements only enable saved personal articles and missing groups', () => {
  assert.equal(supplementEligibility(article(), 'u', 'study'), '');
  for (const value of [null, { ...article(), visibility: 'library' }, { ...article(), id: 'guest' }, { ...article(), text: 'あ'.repeat(3001) }]) assert.ok(supplementEligibility(value, 'u', 'study'));
  assert.ok(supplementEligibility(article(), null, 'study'));
  const a = article(); a.vocabList = lists().vocabList; assert.deepEqual(missingSupplementGroups(a, 'study'), ['grammar']);
  a.grammarList = lists().grammarList; assert.ok(supplementEligibility(a, 'u', 'study')); assert.deepEqual(missingSupplementGroups(a, 'quiz'), ['quiz']);
});
test('supplement response binds account, article, version, request and purpose', () => {
  assert.deepEqual(validateSupplementResponse(response(), 'u', 'r', article(), 'study'), response());
  for (const patch of [{ userId: 'other' }, { articleId: 'other' }, { version: 3 }, { id: 'other' }, { kind: 'quiz' }, { cached: null }]) assert.throws(() => validateSupplementResponse({ ...response(), ...patch }, 'u', 'r', article(), 'study'));
});
test('malformed and forged catalog references cannot create external links', () => {
  const grammar = { id, pattern: 'Nで', meaning: 'Nghĩa', level: 'N5', href: '/ngu-phap/mau/' + id };
  const good = response(); good.catalog.grammar = [grammar]; assert.doesNotThrow(() => validateSupplementResponse(good, 'u', 'r', article(), 'study'));
  for (const patch of [{ href: 'https://evil.invalid' }, { href: 'javascript:alert(1)' }, { level: 'N0' }, { id: 'fake' }]) { const bad = response(); bad.catalog.grammar = [{ ...grammar, ...patch }]; assert.throws(() => validateSupplementResponse(bad, 'u', 'r', article(), 'study')); }
  const bad = response(); bad.catalog.vocab = []; assert.throws(() => validateSupplementResponse(bad, 'u', 'r', article(), 'study'));
});
test('protected groups and source quote mismatch block applying without rewriting original lists', () => {
  const a = article(); a.vocabList = lists().vocabList; assert.ok(validateSupplementDraft(lists(), a, 'study').length);
  assert.ok(validateSupplementDraft(lists(), article(), 'quiz').length);
  for (const badEvidence of [[{ sentenceId: 'wrong', quote: '学校' }], [{ sentenceId: 'p1-s1', quote: '雨' }], []]) { const bad = lists(); bad.vocabList[0].evidence = badEvidence; assert.ok(validateSupplementDraft(bad, article(), 'study').length); }
  assert.deepEqual(a.vocabList, lists().vocabList);
});
test('preview permits empty generation, apply rejects empty selection', () => {
  const empty = { vocabList: [], grammarList: [], quizList: [] };
  assert.deepEqual(validateSupplementDraft(empty, article(), 'study', true), []); assert.ok(validateSupplementDraft(empty, article(), 'study').length);
});
test('edits and deleting items retain valid IDs and cannot include preview/catalog metadata in payload', () => {
  const original = lists(), edited = structuredClone(original); edited.grammarList = []; edited.vocabList[0].meaning = 'Nghĩa đã sửa'; edited.vocabList[0].catalog = { href: 'fake' }; edited.vocabList[0].evidence[0].extra = 'fake';
  assert.deepEqual(validateSupplementDraft(edited, article(), 'study'), []);
  const sent = supplementListsPayload(edited); assert.deepEqual(Object.keys(sent.vocabList[0]), ['word', 'reading', 'hanViet', 'meaning', 'evidence']); assert.equal(sent.vocabList[0].evidence[0].extra, undefined);
  sent.vocabList[0].evidence[0].quote = 'changed'; assert.equal(original.vocabList[0].meaning, 'Trường học'); assert.equal(edited.vocabList[0].evidence[0].quote, article().text);
  const q = quiz(); assert.equal(supplementListsPayload(q).quizList[0].id, 7);
});
test('quiz requires four distinct answers and a safe stable ID with exactly one selected answer', () => {
  assert.deepEqual(validateSupplementDraft(quiz(), article(), 'quiz'), []);
  for (const patch of [{ id: 0 }, { id: Infinity }, { id: 2 ** 53 }, { options: ['a', 'b'] }, { options: ['学校', ' 学校 ', '家', '店'] }, { correctIndex: 4 }, { correctIndex: 0.5 }]) { const bad = quiz(); Object.assign(bad.quizList[0], patch); assert.ok(validateSupplementDraft(bad, article(), 'quiz').length); }
  const bad = quiz(); bad.quizList.push(bad.quizList[0]); assert.ok(validateSupplementDraft(bad, article(), 'quiz').length);
});
test('grammar examples must be grounded, vocabulary needs kana readings and bounded strings', () => {
  for (const patch of [{ reading: 'gakkou' }, { meaning: '' }, { word: '学\u0000校' }, { hanViet: 'a'.repeat(201) }]) { const bad = lists(); Object.assign(bad.vocabList[0], patch); assert.ok(validateSupplementDraft(bad, article(), 'study').length); }
  const bad = lists(); bad.grammarList[0].exampleJp = '学校へ行きます。'; assert.ok(validateSupplementDraft(bad, article(), 'study').length);
});
test('oversized valid preview opens for shortening, while UTF-8 apply size remains enforced', () => {
  const a = article(), quote = '学'.repeat(999) + '校'; a.text = quote.repeat(3); a.paragraphs = [{ id: 'p1', sentences: [1, 2, 3].map(i => ({ id: `p1-s${i}`, japanese: quote })) }];
  const v = lists().vocabList[0]; v.evidence = [1, 2, 3].map(i => ({ sentenceId: `p1-s${i}`, quote })); v.meaning = 'đ'.repeat(1000);
  const large = { vocabList: Array.from({ length: 15 }, (_, i) => ({ ...v, word: '学校'.repeat(i + 1) })), grammarList: [], quizList: [] };
  assert.ok(validateSupplementDraft(large, a, 'study').some(e => e.includes('128 KB')));
  const res = { ...response(), result: { ...large, groups: ['vocab', 'grammar'], warnings: [] }, catalog: { vocab: Array(15).fill(null), grammar: [] } };
  assert.doesNotThrow(() => validateSupplementResponse(res, 'u', 'r', a, 'study'));
});
