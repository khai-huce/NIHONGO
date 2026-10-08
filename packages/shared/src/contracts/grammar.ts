// Stable content contract shared by the grammar editor and learner pages.
export type GrammarRuby = { text: string; reading?: string }[];
export type GrammarExerciseKind = 'vi-ja' | 'ja-vi' | 'arrange';
export type GrammarExercise = {
  id: string; kind: GrammarExerciseKind; prompt: string; ruby: GrammarRuby;
  hint: string; explanation: string; answers: string[];
  prefix: string; suffix: string; tokens: string[]; correctOrder: number[];
  starIndex: number; translation: string;
};
export type GrammarPattern = {
  id: string; pattern: string; meaning: string; structure: string;
  explanation: string; usage: string; notes: string; relatedIds: string[];
  examples: { id: string; japanese: string; vietnamese: string; ruby: GrammarRuby }[];
  exercises: GrammarExercise[];
};
export type GrammarLesson = { id: string; title: string; japanese: string; patterns: GrammarPattern[] };
export type GrammarDraft = {
  title: string; subtitle: string; description: string; level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  sourceId: string | null; lessons: GrammarLesson[];
};
export type GrammarRecord = { id: string; slug: string; version: number; publishedVersion: number | null; archivedAt: string | null; draft: GrammarDraft };
export type GrammarSummary = { id: string; slug: string; title: string; subtitle: string; description: string; level: GrammarDraft['level']; lessonCount: number; patternCount: number };
export type GrammarOutline = GrammarSummary & { lessons: { id: string; title: string; japanese: string; patterns: { id: string; pattern: string; meaning: string; exerciseCount: number }[] }[] };
export type GrammarPublicExercise = Omit<GrammarExercise, 'answers' | 'correctOrder' | 'explanation' | 'translation'>;
export type GrammarPublicPattern = Omit<GrammarPattern, 'exercises'> & {
  version: number; courseId: string; courseSlug: string; courseTitle: string; lessonId: string; lessonTitle: string;
  exercises: GrammarPublicExercise[]; related: { id: string; pattern: string; meaning: string }[];
};
export const grammarCoursePath = (slug: string) => `/ngu-phap/giao-trinh/${encodeURIComponent(slug)}`;
export const grammarLessonPath = (slug: string, id: string) => `${grammarCoursePath(slug)}/bai/${encodeURIComponent(id)}`;
export const grammarPatternPath = (id: string) => `/ngu-phap/mau/${encodeURIComponent(id)}`;
export const grammarExercisePath = (id: string) => `${grammarPatternPath(id)}/bai-tap`;
export const grammarSource = (item: Pick<GrammarPattern, 'id' | 'pattern' | 'meaning'>) => ({ category: 'grammar' as const, sourceId: `grammar:${item.id}`, front: item.pattern, back: item.meaning });
export const emptyGrammarExercise = (kind: GrammarExerciseKind): GrammarExercise => ({ id: crypto.randomUUID(), kind, prompt: '', ruby: [], hint: '', explanation: '', answers: [], prefix: '', suffix: '', tokens: kind === 'arrange' ? ['', '', '', ''] : [], correctOrder: kind === 'arrange' ? [0, 1, 2, 3] : [], starIndex: 2, translation: '' });
export const emptyGrammarPattern = (): GrammarPattern => ({ id: crypto.randomUUID(), pattern: '', meaning: '', structure: '', explanation: '', usage: '', notes: '', relatedIds: [], examples: [], exercises: [] });

export type GrammarAnswerResult = {
  exerciseId: string; patternVersion: number; action: 'check' | 'reveal' | 'ai';
  answer: string | number[]; correct: boolean; modelAnswer: string;
  explanation: string; translation: string; correctOrder: number[];
  starAnswer: number | null; checkedAt: string;
  ai?: GrammarAiFeedback;
};
export type GrammarProgress = { version: number; completedAt: string | null; answers: Record<string, GrammarAnswerResult> };
export type GrammarStudyResponse = { userId: string | null; progress: GrammarProgress; result?: GrammarAnswerResult };
export type GrammarAiFeedback = { verdict: 'correct' | 'partly_correct' | 'incorrect'; feedback: string; suggestedAnswer: string };
