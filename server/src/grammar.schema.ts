import { z } from 'zod';
import { contentSourceSchema } from './content.schema.js';

export const grammarId = z.string().uuid().transform(value => value.toLowerCase());
export const grammarSlug = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Đường dẫn chỉ gồm chữ thường, số và dấu gạch nối.');
const text = (max: number) => z.string().trim().max(max);
const ruby = z.array(z.object({ text: z.string().min(1).max(2000), reading: text(500).min(1).optional() }).strict()).max(500).default([]);

export const grammarExerciseSchema = z.object({
  id: grammarId, kind: z.enum(['vi-ja', 'ja-vi', 'arrange']),
  prompt: text(2000).min(1, 'Câu hỏi không được để trống.'), ruby,
  hint: text(2000).default(''), explanation: text(4000).default(''),
  answers: z.array(text(2000).min(1)).max(30).default([]),
  prefix: text(1000).default(''), suffix: text(1000).default(''),
  tokens: z.array(text(500).min(1)).max(4).default([]),
  correctOrder: z.array(z.number().int().min(0).max(3)).max(4).default([]),
  starIndex: z.number().int().min(0).max(3).default(2), translation: text(2000).default(''),
}).strict().superRefine((exercise, ctx) => {
  if (exercise.kind === 'arrange') {
    if (exercise.tokens.length !== 4 || exercise.correctOrder.length !== 4 || new Set(exercise.correctOrder).size !== 4) {
      ctx.addIssue({ code: 'custom', path: ['correctOrder'], message: 'Sắp xếp cần đúng 4 mảnh và thứ tự đáp án là hoán vị 0, 1, 2, 3.' });
    }
    if (exercise.answers.length || exercise.ruby.length) ctx.addIssue({ code: 'custom', message: 'Bài sắp xếp dùng mảnh câu và thứ tự đáp án, không dùng đáp án dịch/furigana câu hỏi.' });
  } else {
    if (!exercise.answers.length) ctx.addIssue({ code: 'custom', path: ['answers'], message: 'Bài dịch cần ít nhất một đáp án được chấp nhận.' });
    if (exercise.tokens.length || exercise.correctOrder.length) ctx.addIssue({ code: 'custom', message: 'Bài dịch không dùng mảnh câu hay thứ tự sắp xếp.' });
    if (exercise.ruby.length && (exercise.kind !== 'ja-vi' || exercise.ruby.map(part => part.text).join('') !== exercise.prompt)) {
      ctx.addIssue({ code: 'custom', path: ['ruby'], message: 'Furigana phải ghép lại đúng câu hỏi tiếng Nhật.' });
    }
  }
});

export const grammarPatternSchema = z.object({
  id: grammarId, pattern: text(500).min(1, 'Tên mẫu ngữ pháp không được để trống.'), meaning: text(2000).min(1),
  structure: text(4000).default(''), explanation: text(8000).default(''), usage: text(4000).default(''), notes: text(4000).default(''),
  relatedIds: z.array(grammarId).max(50).default([]),
  examples: z.array(z.object({ id: grammarId, japanese: text(2000).min(1), vietnamese: text(2000).default(''), ruby }).strict().superRefine((example, ctx) => {
    if (example.ruby.length && example.ruby.map(part => part.text).join('') !== example.japanese) {
      ctx.addIssue({ code: 'custom', path: ['ruby'], message: 'Furigana phải ghép lại đúng câu ví dụ tiếng Nhật.' });
    }
  })).max(100).default([]),
  exercises: z.array(grammarExerciseSchema).max(150).default([]),
}).strict();

export const grammarDraftSchema = z.object({
  title: text(100).min(1, 'Vui lòng nhập tên giáo trình.'), subtitle: text(200).default(''), description: text(2000).default(''),
  level: z.enum(['N5', 'N4', 'N3', 'N2', 'N1']), sourceId: contentSourceSchema.shape.id.nullable().default(null),
  lessons: z.array(z.object({ id: grammarId, title: text(100).min(1), japanese: text(200).default(''), patterns: z.array(grammarPatternSchema).max(100) }).strict()).max(200),
}).strict().superRefine((draft, ctx) => {
  const seen = new Set<string>();
  let patterns = 0, exercises = 0;
  const check = (id: string, path: (string | number)[]) => {
    if (seen.has(id)) ctx.addIssue({ code: 'custom', path, message: 'ID bài, mẫu, ví dụ hoặc bài tập bị trùng trong giáo trình.' });
    seen.add(id);
  };
  draft.lessons.forEach((lesson, li) => {
    check(lesson.id, ['lessons', li, 'id']);
    lesson.patterns.forEach((pattern, pi) => {
      patterns++;
      const path = ['lessons', li, 'patterns', pi];
      check(pattern.id, [...path, 'id']);
      if (pattern.relatedIds.includes(pattern.id) || new Set(pattern.relatedIds).size !== pattern.relatedIds.length) {
        ctx.addIssue({ code: 'custom', path: [...path, 'relatedIds'], message: 'Mẫu liên quan không được trùng hoặc trỏ đến chính mẫu này.' });
      }
      pattern.examples.forEach((example, i) => check(example.id, [...path, 'examples', i, 'id']));
      pattern.exercises.forEach((exercise, i) => { exercises++; check(exercise.id, [...path, 'exercises', i, 'id']); });
    });
  });
  if (patterns > 1000 || exercises > 5000) ctx.addIssue({ code: 'custom', path: ['lessons'], message: 'Mỗi giáo trình tối đa 1.000 mẫu ngữ pháp và 5.000 bài tập.' });
});
export type GrammarDraft = z.infer<typeof grammarDraftSchema>;
export type GrammarPatternContent = z.infer<typeof grammarPatternSchema>;
export type GrammarExerciseContent = z.infer<typeof grammarExerciseSchema>;
export function grammarCounts(draft: GrammarDraft) {
  return { lessonCount: draft.lessons.length, patternCount: draft.lessons.reduce((total, lesson) => total + lesson.patterns.length, 0),
    exerciseCount: draft.lessons.reduce((total, lesson) => total + lesson.patterns.reduce((sum, pattern) => sum + pattern.exercises.length, 0), 0) };
}
