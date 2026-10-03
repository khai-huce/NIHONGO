import { z } from 'zod';
import { contentSourceSchema } from './content.schema.js';

export const curriculumId = z.string().uuid().transform(value => value.toLowerCase());
export const curriculumSlug = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Đường dẫn chỉ gồm chữ thường, số và dấu gạch nối.');
const text = (max: number) => z.string().trim().max(max);
export const curriculumWordSchema = z.object({
  id: curriculumId,
  word: text(500).min(1, 'Từ vựng không được để trống.'),
  reading: text(500).default(''),
  hanViet: text(200).default(''),
  meaning: text(2000).min(1, 'Nghĩa của từ không được để trống.'),
  romaji: text(500).default(''),
  partOfSpeech: z.array(text(50).min(1)).max(20).default([]),
  exampleJp: text(2000).default(''),
  exampleVi: text(2000).default(''),
  ruby: z.array(z.object({ text: text(500).min(1), reading: text(500).min(1).optional() }).strict()).max(500).default([]),
}).strict().superRefine((word, ctx) => {
  if (word.ruby.length && word.ruby.map(part => part.text).join('') !== word.word) {
    ctx.addIssue({ code: 'custom', path: ['ruby'], message: 'Furigana phải ghép lại đúng từ vựng gốc.' });
  }
});
export const curriculumDraftSchema = z.object({
  title: text(100).min(1, 'Vui lòng nhập tên giáo trình.'),
  subtitle: text(200).default(''), description: text(2000).default(''),
  level: z.enum(['N5', 'N4', 'N3', 'N2', 'N1', 'SE']),
  style: z.enum(['tango', 'minna', 'mimikara', 'tettei', 'it', 'custom']).default('custom'),
  sourceId: contentSourceSchema.shape.id.nullable().default(null),
  topics: z.array(z.object({
    id: curriculumId, title: text(100).min(1), japanese: text(200).default(''),
    lessons: z.array(z.object({
      id: curriculumId, title: text(100).min(1),
      words: z.array(curriculumWordSchema).max(500, 'Mỗi bài tối đa 500 từ.'),
    }).strict()).max(500),
  }).strict()).max(100),
}).strict().superRefine((draft, ctx) => {
  const topics = new Set<string>(), lessons = new Set<string>(), words = new Set<string>();
  let lessonCount = 0, wordCount = 0;
  for (const [ti, topic] of draft.topics.entries()) {
    if (topics.has(topic.id)) ctx.addIssue({ code: 'custom', path: ['topics', ti, 'id'], message: 'ID chủ đề bị trùng.' });
    topics.add(topic.id);
    for (const [li, lesson] of topic.lessons.entries()) {
      lessonCount++;
      if (lessons.has(lesson.id)) ctx.addIssue({ code: 'custom', path: ['topics', ti, 'lessons', li, 'id'], message: 'ID bài học bị trùng.' });
      lessons.add(lesson.id);
      for (const [wi, word] of lesson.words.entries()) {
        wordCount++;
        if (words.has(word.id)) ctx.addIssue({ code: 'custom', path: ['topics', ti, 'lessons', li, 'words', wi, 'id'], message: 'ID từ bị trùng giữa các bài.' });
        words.add(word.id);
      }
    }
  }
  if (lessonCount > 500) ctx.addIssue({ code: 'custom', path: ['topics'], message: 'Một giáo trình tối đa 500 bài.' });
  if (wordCount > 5000) ctx.addIssue({ code: 'custom', path: ['topics'], message: 'Một giáo trình tối đa 5.000 từ.' });
});

export type CurriculumWord = z.infer<typeof curriculumWordSchema>;
export type CurriculumDraft = z.infer<typeof curriculumDraftSchema>;
export function curriculumCounts(draft: CurriculumDraft) {
  return {
    topicCount: draft.topics.length,
    lessonCount: draft.topics.reduce((sum, topic) => sum + topic.lessons.length, 0),
    wordCount: draft.topics.reduce((sum, topic) => sum + topic.lessons.reduce((total, lesson) => total + lesson.words.length, 0), 0),
  };
}
