import { z } from 'zod';

const text = z.string().refine(value => Array.from(value).length <= 3000, 'Bài đọc tối đa 3000 ký tự.').refine(value => value.trim().length > 0, 'Vui lòng nhập bài đọc.');
const ruby = z.array(z.object({ text: z.string().min(1).max(3000), reading: z.string().min(1).max(300).optional() }).strict()).max(500);
const vocab = z.object({ word: z.string().min(1).max(200), reading: z.string().max(200), hanViet: z.string().max(200), meaning: z.string().max(1000) }).strict();
const grammar = z.object({ pattern: z.string().min(1).max(200), jlptLevel: z.string().max(16), meaning: z.string().max(1000), exampleJp: z.string().max(1000), exampleVi: z.string().max(1000) }).strict();
const quiz = z.object({ id: z.number().int().positive(), question: z.string().min(1).max(1000), options: z.array(z.string().min(1).max(500)).min(2).max(6), correctIndex: z.number().int().min(0), explanation: z.string().max(2000) }).strict()
  .refine(item => item.correctIndex < item.options.length, 'Đáp án bài tập không hợp lệ.');
export const readingInput = z.object({ title: z.string().trim().min(1).max(200), subtitle: z.string().trim().max(500).default(''), text }).strict();
export const editorialInput = readingInput.extend({
  annotations: z.array(z.object({ sentenceId: z.string().max(32), japanese: z.string().max(3000).optional(), ruby: ruby.optional(), translation: z.string().max(3000).optional() }).strict()).max(300).default([]),
  vocabList: z.array(vocab).max(100).default([]), grammarList: z.array(grammar).max(100).default([]), quizList: z.array(quiz).max(100).default([]),
}).strict();
export type ReadingSentence = { id: string; japanese: string; ruby?: z.infer<typeof ruby>; translation: string };
export type ReadingContent = z.infer<typeof readingInput> & {
  paragraphs: { id: string; sentences: ReadingSentence[] }[];
  vocabList: z.infer<typeof vocab>[]; grammarList: z.infer<typeof grammar>[]; quizList: z.infer<typeof quiz>[];
};

/** Deterministic IDs belong to this article version; no guessed translation, ruby or audio duration. */
export function makeReadingContent(raw: unknown, editorial = false): ReadingContent {
  const input = editorial ? editorialInput.parse(raw) : editorialInput.parse(readingInput.parse(raw));
  const segmenter = new Intl.Segmenter('ja', { granularity: 'sentence' });
  const paragraphs = input.text.split(/\r?\n/).filter(line => line.trim()).map((line, p) => ({
    id: `p${p + 1}`,
    sentences: [...segmenter.segment(line)].filter(segment => segment.segment.trim()).map((segment, s): ReadingSentence => ({
      id: `p${p + 1}-s${s + 1}`, japanese: segment.segment, translation: '',
    })),
  }));
  const additions = input;
  const seen = new Set<string>();
  for (const annotation of additions.annotations) {
    const sentence = paragraphs.flatMap(p => p.sentences).find(item => item.id === annotation.sentenceId);
    if (!sentence || seen.has(annotation.sentenceId) || (annotation.japanese !== undefined && annotation.japanese !== sentence.japanese)
      || (annotation.ruby && annotation.ruby.map(item => item.text).join('') !== sentence.japanese)) {
      throw new z.ZodError([{ code: 'custom', path: ['annotations'], message: 'Chú thích phải khớp chính xác câu trong bài và không lặp.' }]);
    }
    seen.add(annotation.sentenceId);
    if (annotation.ruby) sentence.ruby = annotation.ruby;
    sentence.translation = annotation.translation ?? '';
  }
  if (new Set(additions.quizList.map(item => item.id)).size !== additions.quizList.length) {
    throw new z.ZodError([{ code: 'custom', path: ['quizList'], message: 'ID câu hỏi bị trùng.' }]);
  }
  return { title: input.title, subtitle: input.subtitle, text: input.text, paragraphs,
    vocabList: additions.vocabList, grammarList: additions.grammarList, quizList: additions.quizList };
}

export const readingEditorialPatch = readingInput.extend({
  subtitle: readingInput.shape.subtitle.removeDefault().optional(),
  annotations: editorialInput.shape.annotations.removeDefault().optional(),
  vocabList: editorialInput.shape.vocabList.removeDefault().optional(),
  grammarList: editorialInput.shape.grammarList.removeDefault().optional(),
  quizList: editorialInput.shape.quizList.removeDefault().optional(),
  translationsReviewed: z.boolean().optional(),
}).strict();

/** Editing a title/translation must not discard other curated fields. Changed
 * Japanese text requires an explicit review and exact new sentence text. */
export function updateReadingEditorial(prior: ReadingContent, raw: unknown): ReadingContent {
  const input = readingEditorialPatch.parse(raw);
  const changedText = input.text !== prior.text;
  if (changedText && input.translationsReviewed !== true) throw new z.ZodError([
    { code: 'custom', path: ['translationsReviewed'], message: 'Văn bản tiếng Nhật đã thay đổi. Hãy rà soát bản dịch từng câu và xác nhận trước khi lưu.' },
  ]);
  if (changedText && input.annotations?.some(annotation => annotation.japanese === undefined)) throw new z.ZodError([
    { code: 'custom', path: ['annotations'], message: 'Bản dịch đã rà soát phải kèm nguyên văn câu tiếng Nhật tương ứng; không ghép theo số thứ tự cũ.' },
  ]);
  if (input.annotations && new Set(input.annotations.map(item => item.sentenceId)).size !== input.annotations.length) throw new z.ZodError([
    { code: 'custom', path: ['annotations'], message: 'Mỗi câu chỉ nhận một chú thích.' },
  ]);
  const priorAnnotations = prior.paragraphs.flatMap(paragraph => paragraph.sentences).map(sentence => ({
    sentenceId: sentence.id, japanese: sentence.japanese, translation: sentence.translation,
    ...(sentence.ruby ? { ruby: sentence.ruby } : {}),
  }));
  const annotations = changedText ? input.annotations ?? [] : input.annotations === undefined ? priorAnnotations
    : priorAnnotations.map(annotation => ({ ...annotation, ...input.annotations!.find(item => item.sentenceId === annotation.sentenceId) }))
      .concat(input.annotations.filter(item => !priorAnnotations.some(priorItem => priorItem.sentenceId === item.sentenceId)) as typeof priorAnnotations);
  // M02 edits text/translations, not richer analysis. Text changes deliberately
  // invalidate old ruby/vocab/grammar/quiz unless ruby is explicitly reviewed.
  return makeReadingContent({ title: input.title, subtitle: input.subtitle ?? prior.subtitle, text: input.text, annotations,
    vocabList: changedText ? [] : input.vocabList ?? prior.vocabList,
    grammarList: changedText ? [] : input.grammarList ?? prior.grammarList,
    quizList: changedText ? [] : input.quizList ?? prior.quizList,
  }, true);
}
