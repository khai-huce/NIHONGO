import test from 'node:test';
import assert from 'node:assert/strict';
import { readingEditorBody, readingEditorForm } from '../src/features/reading/reading-editor-data.ts';
import { nextReadingQuizId, removeReadingQuizOption, moveReadingQuizOption, validateReadingSupplements } from '../src/features/reading/reading-supplement-data.ts';

const content = () => ({ title: '学校', subtitle: '', text: '学校です。', paragraphs: [{ id: 'p1', sentences: [{ id: 'p1-s1', japanese: '学校です。', translation: 'Đây là trường học.', ruby: [{ text: '学校', reading: 'がっこう' }, { text: 'です。' }] }] }],
  vocabList: [{ word: '学校', reading: 'がっこう', hanViet: 'HỌC HIỆU', meaning: 'Trường học' }], grammarList: [{ pattern: 'Nです', jlptLevel: 'N5', meaning: 'Là N', exampleJp: '学校です。', exampleVi: 'Đây là trường học.' }],
  quizList: [{ id: 7, question: 'Đây là đâu?', options: ['Trường học', 'Nhà ga', 'Bưu điện'], correctIndex: 0, explanation: '学校 nghĩa là trường học.' }] });

test('roundtrip serializes all supplements and explicit ruby deletion without mutating saved content', () => {
  const saved = { ...content(), sourceId: 'source' }, form = readingEditorForm(saved);
  form.content.paragraphs[0].sentences[0].ruby = [];
  const body = readingEditorBody(form, saved);
  assert.deepEqual(body.annotations[0].ruby, []);
  assert.equal(saved.paragraphs[0].sentences[0].ruby.length, 2);
  for (const key of ['vocabList', 'grammarList', 'quizList']) assert.deepEqual(body[key], saved[key]);
  assert.equal(body.editorialText, form.content.text);
});

test('new supplements after resegmentation bind to the reviewed new text', () => {
  const saved = { ...content(), text: '古い文。' }, form = readingEditorForm(saved);
  form.content = content(); form.text = form.content.text; form.translationsReviewed = true;
  assert.equal(readingEditorBody(form, saved).editorialText, '学校です。');
  form.text += '新しい文。';
  assert.throws(() => readingEditorBody(form, saved), /tách câu/);
});

test('ruby must preserve the whole Japanese sentence including whitespace', () => {
  const data = content(); data.paragraphs[0].sentences[0].ruby.pop();
  assert.throws(() => validateReadingSupplements(data), /nguyên văn/);
  data.paragraphs[0].sentences[0].ruby = [{ text: '学校です。', reading: ' ' }];
  assert.throws(() => validateReadingSupplements(data), /Cách đọc/);
});

test('question author must explicitly select a correct choice', () => {
  const data = content(); data.quizList[0].correctIndex = -1;
  assert.throws(() => validateReadingSupplements(data), /chọn một đáp án/);
  data.quizList[0].correctIndex = 3;
  assert.throws(() => validateReadingSupplements(data), /chọn một đáp án/);
});

test('empty and duplicate answer choices cannot be previewed or saved', () => {
  const data = content(); data.quizList[0].options = ['学校', ' 学校 '];
  assert.throws(() => validateReadingSupplements(data), /trùng/);
  data.quizList[0].options = ['学校', '   '];
  assert.throws(() => validateReadingSupplements(data), /cần nhập/);
});

test('question IDs must be unique and safe; new IDs are independent of order', () => {
  const data = content(); data.quizList.push({ ...data.quizList[0] });
  assert.throws(() => validateReadingSupplements(data), /ID/);
  const id = nextReadingQuizId(data.quizList);
  assert.ok(Number.isSafeInteger(id) && id > 0 && id !== 7);
  data.quizList[1].id = id;
  assert.doesNotThrow(() => validateReadingSupplements(data));
});

test('removing choices preserves the answer identity or requires a new choice if removed', () => {
  const quiz = { ...content().quizList[0], correctIndex: 1 };
  assert.equal(removeReadingQuizOption(quiz, 0).correctIndex, 0);
  assert.equal(removeReadingQuizOption(quiz, 1).correctIndex, -1);
  assert.equal(removeReadingQuizOption({ ...quiz, options: ['A', 'B'] }, 0).options.length, 2);
  assert.equal(quiz.options.length, 3);
});

test('moving choices follows the correct answer and leaves unchosen answer unchosen', () => {
  const quiz = content().quizList[0], moved = moveReadingQuizOption(quiz, 0, 1);
  assert.equal(moved.options[moved.correctIndex], quiz.options[quiz.correctIndex]);
  assert.equal(moved.id, quiz.id);
  assert.equal(moveReadingQuizOption({ ...quiz, correctIndex: -1 }, 0, 1).correctIndex, -1);
});

test('supplement limits and empty required fields fail before a request', () => {
  for (const key of ['vocabList', 'grammarList', 'quizList']) {
    const data = content(); data[key] = Array.from({ length: 101 }, () => data[key][0]);
    assert.throws(() => validateReadingSupplements(data), /100/);
  }
  const data = content(); data.vocabList[0].word = '  ';
  assert.throws(() => validateReadingSupplements(data), /Từ vựng/);
  data.vocabList = []; data.grammarList[0].pattern = '';
  assert.throws(() => validateReadingSupplements(data), /Ngữ pháp/);
});
