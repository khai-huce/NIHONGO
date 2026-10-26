import { z } from 'zod';
import type { JlptDraft } from '@nihongo/shared/contracts/jlpt';

export const jlptId = z.string().uuid().transform(value => value.toLowerCase());
export const jlptLevel = z.enum(['N5', 'N4', 'N3', 'N2', 'N1']);
export const jlptKind = z.enum(['kanji', 'vocabulary', 'grammar', 'reading', 'shadowing', 'kana']);
const text = (max: number) => z.string().trim().max(max);
export const jlptQuestion = z.object({ id: jlptId, prompt: text(1500), passage: text(3000).default(''),
  options: z.array(text(500)).length(4), correctIndex: z.number().int().min(0).max(3), explanation: text(2000).default('') }).strict();
const resource = z.object({ id: jlptId, kind: jlptKind, targetId: z.string().trim().min(1).max(64) }).strict()
  .superRefine((item, ctx) => {
    const valid = item.kind === 'kana' ? ['hiragana', 'katakana'].includes(item.targetId)
      : item.kind === 'kanji' ? /^[a-zA-Z0-9_-]{1,32}$/.test(item.targetId) : z.string().uuid().safeParse(item.targetId).success;
    if (!valid) ctx.addIssue({ code: 'custom', path: ['targetId'], message: 'ID nội dung không phù hợp với loại được chọn.' });
  }).transform(item => ({ ...item, targetId: ['kanji', 'kana'].includes(item.kind) ? item.targetId : item.targetId.toLowerCase() }));
export const jlptDraftSchema = z.object({
  title: text(150).min(1), description: text(2000).default(''),
  sourceId: z.string().regex(/^[a-z0-9-]+$/).max(64).nullable().default(null),
  passPercent: z.number().int().min(1).max(100).default(80),
  sessions: z.array(z.object({ id: jlptId, title: text(150).min(1), description: text(2000).default(''),
    estimatedMinutes: z.number().int().min(0).max(1440).default(0), resources: z.array(resource).max(200), questions: z.array(jlptQuestion).max(100).default([]) }).strict()).max(200),
}).strict().superRefine((draft, ctx) => {
  const ids = new Set<string>(); let total = 0;
  draft.sessions.forEach((session, si) => {
    if (ids.has(session.id)) ctx.addIssue({ code: 'custom', path: ['sessions', si, 'id'], message: 'ID bị lặp trong lộ trình.' });
    ids.add(session.id);
    for (const [qi, question] of (session.questions ?? []).entries()) {
      if (ids.has(question.id)) ctx.addIssue({ code: 'custom', path: ['sessions', si, 'questions', qi, 'id'], message: 'ID câu hỏi bị lặp.' });
      ids.add(question.id);
    }
    const targets = new Set<string>();
    session.resources.forEach((item, ri) => {
      if (ids.has(item.id)) ctx.addIssue({ code: 'custom', path: ['sessions', si, 'resources', ri, 'id'], message: 'ID bị lặp trong lộ trình.' });
      ids.add(item.id);
      const key = `${item.kind}:${item.targetId}`;
      if (targets.has(key)) ctx.addIssue({ code: 'custom', path: ['sessions', si, 'resources', ri, 'targetId'], message: 'Nội dung đã có trong buổi học này.' });
      targets.add(key); total++;
    });
  });
  if (total > 2000) ctx.addIssue({ code: 'custom', path: ['sessions'], message: 'Mỗi lộ trình tối đa 2.000 liên kết nội dung.' });
});
export const parseJlptDraft = (value: unknown): JlptDraft => jlptDraftSchema.parse(value);
