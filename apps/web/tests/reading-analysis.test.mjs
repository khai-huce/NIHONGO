import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  editReadingAnalysisSentence, missingReadingAnalysisFields, readingAnalysisAnnotations, readingAnalysisEligibility,
  retainReadingAnalysisRequest, sameReadingAnalysisContext, uncertainReadingAnalysisApply,
  validateReadingAnalysisApplyResponse, validateReadingAnalysisDraft, validateReadingAnalysisResponse,
} from '../src/features/reading/lib/reading-analysis.ts';

const article = () => ({ id: 'article-a', version: 3, visibility: 'private', text: '学校です。\n駅です。', paragraphs: [
  { id: 'p1', sentences: [{ id: 'p1-s1', japanese: '学校です。', translation: '', ruby: [] }] },
  { id: 'p2', sentences: [{ id: 'p2-s1', japanese: '駅です。', translation: 'Đây là nhà ga.', ruby: [{ text: '駅', reading: 'えき' }, { text: 'です。' }] }] },
] });
const rows = () => [
  { sentenceId: 'p1-s1', japanese: '学校です。', translation: 'Đây là trường học.', ruby: [{ text: '学校', reading: 'がっこう' }, { text: 'です。' }], generatedFields: ['translation', 'ruby'] },
  { sentenceId: 'p2-s1', japanese: '駅です。', translation: 'Đây là nhà ga.', ruby: [{ text: '駅', reading: 'えき' }, { text: 'です。' }], generatedFields: [] },
];
const response = (changes = {}) => ({ userId: 'account-a', id: 'request-a', articleId: 'article-a', version: 3, cached: false,
  result: { sentences: rows(), warnings: ['Cần rà soát trước khi lưu.'] }, ...changes });

test('analysis preview requires matching account, request, article and version', () => {
  assert.deepEqual(validateReadingAnalysisResponse(response(), 'account-a', 'request-a', article()), response());
  for (const changed of [null, response({ userId: 'account-b' }), response({ id: 'request-b' }), response({ articleId: 'article-b' }), response({ version: 4 }), response({ cached: null })]) {
    assert.throws(() => validateReadingAnalysisResponse(changed, 'account-a', 'request-a', article()));
  }
});

test('preview rejects missing, reordered or duplicated sentence identities and source modifications', () => {
  for (const proposed of [rows().slice(1), rows().reverse(), [rows()[0], rows()[0]], [{ ...rows()[0], japanese: '学校だ。' }, rows()[1]], [...rows(), rows()[0]]]) {
    assert.throws(() => validateReadingAnalysisResponse(response({ result: { sentences: proposed, warnings: [] } }), 'account-a', 'request-a', article()));
  }
});

test('server-generated field masks are verified from the saved fields and cannot unlock curated text', () => {
  assert.deepEqual(missingReadingAnalysisFields(article().paragraphs[0].sentences[0]), ['translation', 'ruby']);
  assert.deepEqual(missingReadingAnalysisFields(article().paragraphs[1].sentences[0]), []);
  for (const fields of [['translation'], ['translation', 'translation'], ['translation', 'ruby', 'text']]) {
    const proposed = rows(); proposed[0].generatedFields = fields;
    assert.throws(() => validateReadingAnalysisResponse(response({ result: { sentences: proposed, warnings: [] } }), 'account-a', 'request-a', article()));
  }
  const proposed = rows(); proposed[1].generatedFields = ['translation'];
  assert.throws(() => validateReadingAnalysisResponse(response({ result: { sentences: proposed, warnings: [] } }), 'account-a', 'request-a', article()));
});

test('editing only changes generated fields and payload never includes model provenance or unrelated content', () => {
  const original = rows();
  const changed = editReadingAnalysisSentence(original, 'p1-s1', 'translation', 'Đây là ngôi trường.');
  const ignored = editReadingAnalysisSentence(changed, 'p2-s1', 'translation', 'Bản dịch ghi đè');
  assert.equal(ignored[0].translation, 'Đây là ngôi trường.');
  assert.equal(ignored[1].translation, original[1].translation);
  assert.equal(original[0].translation, 'Đây là trường học.');
  assert.deepEqual(validateReadingAnalysisDraft(ignored, article()), []);
  const annotations = readingAnalysisAnnotations(ignored);
  assert.deepEqual(Object.keys(annotations[0]), ['sentenceId', 'japanese', 'translation', 'ruby']);
  annotations[0].ruby[0].text = '変';
  assert.equal(ignored[0].ruby[0].text, '学校', 'serialized payload does not mutate the draft');
});

test('ruby must cover the exact Japanese source with kana readings for Kanji; blank and malformed annotations cannot apply', () => {
  for (const ruby of [[], [{ text: '' }], [{ text: '学校です。' }], [{ text: '学校です。', reading: 'gakkoudesu' }],
    [{ text: '学校', reading: 'がっこう' }, { text: ' です。' }], [{ text: '学校です。', reading: ' ' }], [null]]) {
    const proposed = rows(); proposed[0].ruby = ruby;
    assert.ok(validateReadingAnalysisDraft(proposed, article()).length > 0);
  }
  const spaces = article(); spaces.paragraphs[0].sentences[0].japanese = '学校です。 '; spaces.text = '学校です。 \n駅です。';
  const proposed = rows(); proposed[0].japanese = '学校です。 '; proposed[0].ruby[1].text = 'です。 ';
  assert.deepEqual(validateReadingAnalysisDraft(proposed, spaces), []);
});

test('existing annotations are preserved exactly even when JSON object property order differs', () => {
  const proposed = rows(); proposed[1].ruby[0] = { reading: 'えき', text: '駅' };
  assert.deepEqual(validateReadingAnalysisDraft(proposed, article()), []);
  for (const patch of [{ translation: 'Đã bị đổi' }, { ruby: [{ text: '駅です。', reading: 'えきです' }] }]) {
    const changed = rows(); changed[1] = { ...changed[1], ...patch };
    assert.ok(validateReadingAnalysisDraft(changed, article()).length > 0);
  }
});

test('apply validation keeps field size boundaries and does not silently trim a broken draft', () => {
  for (const patch of [{ translation: '' }, { translation: '   ' }, { translation: 'a'.repeat(3001) },
    { ruby: [{ text: '学校です。', reading: 'あ'.repeat(301) }] }]) {
    const proposed = rows(); proposed[0] = { ...proposed[0], ...patch };
    assert.ok(validateReadingAnalysisDraft(proposed, article()).length > 0);
  }
});

test('eligibility limits analysis to signed-in personal articles and existing content needing supplementation', () => {
  assert.equal(readingAnalysisEligibility(article(), 'account-a'), '');
  for (const [source, user] of [[article(), null], [{ ...article(), visibility: 'public' }, 'account-a'],
    [{ ...article(), id: 'guest-abc' }, 'account-a'], [{ ...article(), text: 'あ'.repeat(3001) }, 'account-a'],
    [{ ...article(), paragraphs: [{ id: 'p', sentences: Array.from({ length: 101 }, () => ({ id: 's', japanese: 'あ。' })) }] }, 'account-a']]) {
    assert.notEqual(readingAnalysisEligibility(source, user), '');
  }
  const complete = article(); complete.paragraphs[0].sentences[0] = { id: 'p1-s1', ...rows()[0] };
  assert.notEqual(readingAnalysisEligibility(complete, 'account-a'), '');
  assert.equal(readingAnalysisEligibility({ ...article(), text: '𠮷'.repeat(3000) }, 'account-a'), '', 'character limit counts Unicode code points');
});

test('context revision rejects late output after route/account/version/text or auth state changes', () => {
  const context = { userId: 'a', articleId: 'r', version: 3, text: '学校です。', authBusy: false, revision: 7 };
  assert.equal(sameReadingAnalysisContext(context, { ...context }), true);
  for (const change of [{ userId: null }, { userId: 'b' }, { articleId: 'other' }, { version: 4 }, { text: '駅です。' }, { authBusy: true }, { revision: 8 }]) {
    assert.equal(sameReadingAnalysisContext(context, { ...context, ...change }), false);
  }
});

test('unknown generation outcomes retry the same ID; apply uncertainty freezes exact payload until resolved', () => {
  assert.equal(retainReadingAnalysisRequest(0, 'NETWORK_ERROR'), true);
  assert.equal(retainReadingAnalysisRequest(409, 'AI_BUSY'), true);
  assert.equal(retainReadingAnalysisRequest(503, 'AI_UNAVAILABLE'), false);
  assert.equal(retainReadingAnalysisRequest(409, 'ARTICLE_CHANGED'), false);
  assert.equal(uncertainReadingAnalysisApply(0), true);
  assert.equal(uncertainReadingAnalysisApply(500), true);
  assert.equal(uncertainReadingAnalysisApply(409), false);
});

test('apply receipt must bind to the same request and exactly one version increment before article refresh', () => {
  const receipt = { userId: 'account-a', requestId: 'request-a', articleId: 'article-a', version: 4 };
  assert.deepEqual(validateReadingAnalysisApplyResponse(receipt, 'account-a', 'request-a', article()), receipt);
  for (const change of [{ userId: 'b' }, { requestId: 'b' }, { articleId: 'b' }, { version: 3 }, { version: 5 }]) {
    assert.throws(() => validateReadingAnalysisApplyResponse({ ...receipt, ...change }, 'account-a', 'request-a', article()));
  }
});

test('apply size uses UTF-8 bytes and accepts a valid result beyond the old 128 KB limit', () => {
  const japanese = '魂'.repeat(29) + '。';
  const sentences = Array.from({ length: 100 }, (_, index) => ({ id: `p${index + 1}-s1`, japanese, translation: '' }));
  const source = { ...article(), text: japanese.repeat(100), paragraphs: [{ id: 'p1', sentences }] };
  const proposed = sentences.map(sentence => ({ sentenceId: sentence.id, japanese, translation: 'Tâm hồn.',
    ruby: [...Array.from({ length: 29 }, () => ({ text: '魂', reading: 'たましい' })), { text: '。' }], generatedFields: ['translation', 'ruby'] }));
  assert.ok(new TextEncoder().encode(JSON.stringify(readingAnalysisAnnotations(proposed))).byteLength > 128 * 1024);
  assert.deepEqual(validateReadingAnalysisDraft(proposed, source), []);
  proposed.forEach(sentence => { sentence.translation = 'ế'.repeat(3000); });
  assert.ok(validateReadingAnalysisDraft(proposed, source).some(error => error.includes('512 KB')));
});
