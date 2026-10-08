import type { VocabWord } from './vocabulary';

export type CurriculumWord = VocabWord & {
  romaji: string; partOfSpeech: string[]; exampleJp: string; exampleVi: string;
  ruby: { text: string; reading?: string }[];
};
export type CurriculumLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'SE';
export type CurriculumStyle = 'tango' | 'minna' | 'mimikara' | 'tettei' | 'it' | 'custom';
export type CurriculumDraft = {
  title: string; subtitle: string; description: string; level: CurriculumLevel; style: CurriculumStyle; sourceId: string | null;
  topics: { id: string; title: string; japanese: string; lessons: { id: string; title: string; words: CurriculumWord[] }[] }[];
};
export type CurriculumSummary = {
  id: string; slug: string; title: string; subtitle: string; description: string;
  level: CurriculumLevel; style: CurriculumStyle; topicCount: number; lessonCount: number; wordCount: number;
};
export type CurriculumOutline = CurriculumSummary & {
  topics: { id: string; title: string; japanese: string; lessons: { id: string; title: string; wordCount: number }[] }[];
};
export type CurriculumLesson = { id: string; courseId: string; topicId: string; name: string; version: number; words: CurriculumWord[] };
export type CurriculumReviewSet = Omit<CurriculumLesson, 'topicId'> & { lessonIds: string[]; lessonCount: number };
export type CurriculumRecord = {
  id: string; slug: string; version: number; publishedVersion: number | null; archivedAt: string | null;
  draft: CurriculumDraft;
};
export const curriculumPath = (slug: string) => `/tu-vung/giao-trinh/${encodeURIComponent(slug)}`;
export const curriculumLessonPath = (slug: string, lessonId: string) => `${curriculumPath(slug)}/bai/${encodeURIComponent(lessonId)}`;
export const curriculumReviewPath = (slug: string, reviewId: string) => `${curriculumPath(slug)}/review/${encodeURIComponent(reviewId)}`;
export const curriculumSource = (word: VocabWord) => ({ category: 'vocab' as const, sourceId: `curriculum:${word.id}`, front: word.word, back: word.meaning, reading: word.reading });
export const emptyCurriculumWord = (): CurriculumWord => ({ id: crypto.randomUUID(), word: '', reading: '', hanViet: '', meaning: '', romaji: '', partOfSpeech: [], exampleJp: '', exampleVi: '', ruby: [] });
