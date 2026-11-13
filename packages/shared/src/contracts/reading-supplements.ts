/** A05 adds reviewed content to a saved personal article; it does not grade study attempts. */
export const READING_SUPPLEMENT_MAX_CHARS = 3000;
export const READING_SUPPLEMENT_MAX_SENTENCES = 100;
export const READING_SUPPLEMENT_MAX_VOCAB = 15;
export const READING_SUPPLEMENT_MAX_GRAMMAR = 5;
export const READING_SUPPLEMENT_MAX_QUIZ = 5;
export const READING_SUPPLEMENT_MAX_APPLY_BYTES = 128 * 1024;
export const READING_SUPPLEMENT_TIMEOUT_MS = 105000;

export type ReadingSupplementKind = 'study' | 'quiz';
export type ReadingSupplementGroup = 'vocab' | 'grammar' | 'quiz';
export type ReadingEvidence = { sentenceId: string; quote: string };
export type ReadingSupplementVocab = {
  word: string; reading: string; hanViet: string; meaning: string; evidence: ReadingEvidence[];
};
export type ReadingSupplementGrammar = {
  pattern: string; meaning: string; exampleJp: string; exampleVi: string; evidence: ReadingEvidence[];
};
export type ReadingSupplementQuiz = {
  id: number; question: string; options: string[]; correctIndex: number; explanation: string; evidence: ReadingEvidence[];
};
export type ReadingSupplementCatalog = {
  vocab: ({ word: string; reading: string; definitions: { meaning: string; source: string }[] } | null)[];
  grammar: ({ id: string; pattern: string; meaning: string; level: string; href: string } | null)[];
};
export type ReadingSupplementLists = {
  vocabList: ReadingSupplementVocab[];
  grammarList: ReadingSupplementGrammar[];
  quizList: ReadingSupplementQuiz[];
};
export type ReadingSupplementResult = ReadingSupplementLists & { groups: ReadingSupplementGroup[]; warnings: string[] };
export type ReadingSupplementResponse = {
  userId: string; id: string; articleId: string; version: number; kind: ReadingSupplementKind; cached: boolean;
  result: ReadingSupplementResult; catalog: ReadingSupplementCatalog;
};
export type ReadingSupplementGenerateInput = { id: string; expectedUserId: string; version: number; kind: ReadingSupplementKind };
export type ReadingSupplementApplyInput = ReadingSupplementLists & {
  requestId: string; expectedUserId: string; version: number; kind: ReadingSupplementKind;
};
export type ReadingSupplementApplyResponse = { userId: string; articleId: string; requestId: string; version: number; kind: ReadingSupplementKind };
