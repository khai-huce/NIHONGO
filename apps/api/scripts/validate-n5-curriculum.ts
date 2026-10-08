import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { curriculumDraftSchema, curriculumCounts } from '../src/modules/curriculum/curriculum.schema.ts';
import { contentSourceSchema } from '../src/modules/content/content.schema.ts';
import { parseCurriculumJson } from '@nihongo/shared/curriculum/editor-data';
import { eligibleWords, isStudyAnswerCorrect } from '@nihongo/shared/study/vocab-study';

// Read-only content validation: never connects to the database.
const root = new URL('../../../docs/data/tu-vung-n5/', import.meta.url);
const read = (file: string) => fs.readFileSync(new URL(file, root), 'utf8').replace(/^\uFEFF/, '');
const raw = read('tu-vung-n5.json');
const draft = curriculumDraftSchema.parse(parseCurriculumJson(raw));
const source = contentSourceSchema.parse(JSON.parse(read('source.json')));
const provenance = JSON.parse(read('review.json'));
const report = JSON.parse(read('validation.json'));
assert.equal(draft.title, 'Từ vựng N5');
assert.equal(draft.style, 'custom');
assert.equal(draft.sourceId, null);
assert(Buffer.byteLength(raw, 'utf8') < 4 * 1024 * 1024);
const counts = curriculumCounts(draft);
assert.deepEqual(counts, { topicCount: 10, lessonCount: 31, wordCount: 662 });
const all = draft.topics.flatMap(t => t.lessons.flatMap(l => l.words));
const ids = [...draft.topics.map(t => t.id), ...draft.topics.flatMap(t => t.lessons.map(l => l.id)), ...all.map(w => w.id)];
assert.equal(new Set(ids).size, ids.length);
assert.equal(provenance.entries.length, all.length);
assert.equal(new Set(provenance.entries.map((e: { id: string }) => e.id)).size, all.length);
const byId = new Map(all.map(w => [w.id, w]));
for (const entry of provenance.entries) {
  const word = byId.get(entry.id);
  assert(word && word.word === entry.word && word.reading === entry.reading && word.meaning === entry.meaningVi);
  assert.equal(entry.translationStatus, 'draft-needs-human-review');
}
for (const topic of draft.topics) for (const lesson of topic.lessons) {
  assert(lesson.words.length >= 4 && lesson.words.length <= 25);
  for (const mode of ['reading', 'kanji', 'meaning']) {
    assert.equal(eligibleWords(lesson.words, 'quiz', mode).length, lesson.words.length);
    for (const word of lesson.words) assert(isStudyAnswerCorrect(word, 'quiz', mode, mode === 'reading' ? word.reading : word.word));
  }
  assert.equal(eligibleWords(lesson.words, 'cram', 'reading').length, lesson.words.length);
  for (const word of lesson.words) assert(isStudyAnswerCorrect(word, 'cram', 'reading', word.reading));
  assert.equal(eligibleWords(lesson.words, 'cram', 'hanViet').length, 0);
}
assert.equal(all.find(w => w.word === 'せっけん')?.meaning, 'Xà phòng');
assert.equal(all.find(w => w.word === '半分')?.meaning, 'Một nửa');
assert.equal(all.find(w => w.word === 'おじいさん')?.reading, 'おじいさん');
assert.equal(all.filter(w => w.word === 'キログラム' || w.word === 'キロメートル').length, 2);
assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), report.outputSha256);
report.validation = {
  frontendImportParser: 'pass', backendCurriculumSchema: 'pass', contentSourceSchema: 'pass',
  uniqueIds: ids.length, sourceMapping: '662/662',
  quizReading: '662/662', quizKanji: '662/662', quizMeaning: '662/662', cramReading: '662/662',
  hanViet: 'not provided', examples: 'not provided',
  lessonWordRange: [Math.min(...draft.topics.flatMap(t => t.lessons.map(l => l.words.length))), Math.max(...draft.topics.flatMap(t => t.lessons.map(l => l.words.length)))],
  bytes: Buffer.byteLength(raw, 'utf8'), databaseWrites: 0,
};
fs.writeFileSync(new URL('validation.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ counts, source: source.id, ...report.validation }, null, 2));
