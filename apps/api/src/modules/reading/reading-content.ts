import { z } from 'zod';

const text = z.string().refine(value => Array.from(value).length <= 3000, 'Bài đọc tối đa 3000 ký tự.').refine(value => value.trim().length > 0, 'Vui lòng nhập bài đọc.');
const requiredText = (maximum: number, label: string) => z.string().max(maximum, `${label} tối đa ${maximum} ký tự.`)
  .refine(value => value.trim().length > 0, `${label} không được để trống.`);
// Ruby text is an exact slice of the source sentence, including punctuation/spaces.
const ruby = z.array(z.object({ text: z.string().min(1).max(3000), reading: requiredText(300, 'Cách đọc furigana').optional() }).strict()).max(500);
const vocab = z.object({ word: requiredText(200, 'Từ vựng'), reading: z.string().max(200), hanViet: z.string().max(200), meaning: z.string().max(1000) }).strict();
const grammar = z.object({ pattern: requiredText(200, 'Mẫu ngữ pháp'), jlptLevel: z.string().max(16), meaning: z.string().max(1000), exampleJp: z.string().max(1000), exampleVi: z.string().max(1000) }).strict();
const optionKey = (value: string) => value.normalize('NFC').trim().replace(/\s+/gu, ' ');
const quiz = z.object({ id: z.number().int('ID câu hỏi phải là số nguyên an toàn.').positive('ID câu hỏi phải lớn hơn 0.'),
  question: requiredText(1000, 'Câu hỏi'), options: z.array(requiredText(500, 'Lựa chọn')).min(2, 'Câu hỏi cần ít nhất 2 lựa chọn.').max(6, 'Câu hỏi có tối đa 6 lựa chọn.'),
  correctIndex: z.number().int('Vị trí đáp án phải là số nguyên.').min(0, 'Hãy chọn một đáp án đúng.'), explanation: z.string().max(2000) }).strict()
  .refine(item => item.correctIndex < item.options.length, { path: ['correctIndex'], message: 'Đáp án bài tập không hợp lệ.' })
  .refine(item => new Set(item.options.map(optionKey)).size === item.options.length, { path: ['options'], message: 'Các lựa chọn trong cùng câu hỏi không được trùng nhau.' });
export const readingInput = z.object({ title: z.string().trim().min(1).max(200), subtitle: z.string().trim().max(500).default(''), text }).strict();
export const editorialInput = readingInput.extend({
  editorialText: text.optional(),
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
  if (input.editorialText !== undefined && input.editorialText !== input.text) throw new z.ZodError([
    { code: 'custom', path: ['editorialText'], message: 'Nội dung bổ trợ không khớp văn bản Nhật hiện tại. Hãy tách câu và kiểm tra lại.' },
  ]);
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
      || (annotation.ruby?.length && annotation.ruby.map(item => item.text).join('') !== sentence.japanese)) {
      throw new z.ZodError([{ code: 'custom', path: ['annotations'], message: 'Chú thích phải khớp chính xác câu trong bài và không lặp.' }]);
    }
    seen.add(annotation.sentenceId);
    if (annotation.ruby?.length) sentence.ruby = annotation.ruby;
    sentence.translation = annotation.translation ?? '';
  }
  if (new Set(additions.quizList.map(item => item.id)).size !== additions.quizList.length) {
    throw new z.ZodError([{ code: 'custom', path: ['quizList'], message: 'ID câu hỏi bị trùng.' }]);
  }
  return { title: input.title, subtitle: input.subtitle, text: input.text, paragraphs,
    vocabList: additions.vocabList, grammarList: additions.grammarList, quizList: additions.quizList };
}

export const readingEditorialPatch = readingInput.extend({
  editorialText: text.optional(),
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
  if (input.editorialText !== undefined && input.editorialText !== input.text) throw new z.ZodError([
    { code: 'custom', path: ['editorialText'], message: 'Nội dung bổ trợ không khớp văn bản Nhật hiện tại. Hãy tách câu và kiểm tra lại.' },
  ]);
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
  // A text edit invalidates old rich content. M03 sends newly reviewed arrays
  // bound to the exact new text; older clients retain the clear-on-text-edit rule.
  const reviewedRich = input.editorialText === input.text;
  return makeReadingContent({ title: input.title, subtitle: input.subtitle ?? prior.subtitle, text: input.text, annotations,
    vocabList: changedText ? reviewedRich ? input.vocabList ?? [] : [] : input.vocabList ?? prior.vocabList,
    grammarList: changedText ? reviewedRich ? input.grammarList ?? [] : [] : input.grammarList ?? prior.grammarList,
    quizList: changedText ? reviewedRich ? input.quizList ?? [] : [] : input.quizList ?? prior.quizList,
  }, true);
}

/** Recheck persisted/imported editorial content before publishing, not only its title/text. */
export function validateStoredReadingContent(raw: unknown): void {
  const sentence = z.object({ id: z.string(), japanese: z.string(), translation: z.string().optional(), ruby: ruby.optional() }).strict();
  const stored = readingInput.extend({
    paragraphs: z.array(z.object({ id: z.string(), sentences: z.array(sentence) }).strict()),
    vocabList: editorialInput.shape.vocabList.removeDefault(), grammarList: editorialInput.shape.grammarList.removeDefault(), quizList: editorialInput.shape.quizList.removeDefault(),
  }).strict().parse(raw);
  const checked = makeReadingContent({ title: stored.title, subtitle: stored.subtitle, text: stored.text,
    annotations: stored.paragraphs.flatMap(paragraph => paragraph.sentences).map(item => ({ sentenceId: item.id,
      japanese: item.japanese, translation: item.translation ?? '', ...(item.ruby ? { ruby: item.ruby } : {}) })),
    vocabList: stored.vocabList, grammarList: stored.grammarList, quizList: stored.quizList,
  }, true);
  const structure = (paragraphs: typeof stored.paragraphs) => paragraphs.map(paragraph => ({ id: paragraph.id,
    sentences: paragraph.sentences.map(item => ({ id: item.id, japanese: item.japanese })) }));
  if (JSON.stringify(structure(stored.paragraphs)) !== JSON.stringify(structure(checked.paragraphs))) throw new z.ZodError([
    { code: 'custom', path: ['paragraphs'], message: 'Danh sách câu không khớp văn bản Nhật. Hãy tách lại câu trước khi xuất bản.' },
  ]);
}
