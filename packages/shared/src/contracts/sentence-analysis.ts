export const SENTENCE_MAX_LENGTH = 300;
export const SENTENCE_SAMPLES = [
  '今夜たくさんの宿題がある。',
  '雨が降りそうだったので、傘を持って行きました。',
  '先生に日本語を教えていただきました。',
] as const;

export type SentenceTokenType = 'noun' | 'verb' | 'adj' | 'adv' | 'particle' | 'aux' | 'punct' | 'other' | 'unknown';
export type SentenceToken = {
  index: number; text: string; start: number; end: number;
  reading: string | null; baseForm: string; type: SentenceTokenType; typeLabel: string;
  hanVietList: { kanji: string; hanViet: string; meaning: string }[];
  definitions: { meaning: string; reading: string; source: string }[];
  explanation: string; grammaticalTerms: string;
};
export type SentenceAnalysis = {
  sentence: string; engine: 'kuromoji-ipadic'; tokens: SentenceToken[];
};
export type SentenceAiContent = {
  sentence: string; translation: string;
  tokenNotes: { index: number; text: string; meaning: string; explanation: string }[];
  chunks: { role: string; text: string; meaning: string }[];
  steps: string[];
  structure: { mainClause: string; subject: string; predicate: string; adverbial: string; explanation: string };
  patterns: { pattern: string; meaning: string; evidence: string }[];
};
export type SentencePatternMatch = { id: string; pattern: string; meaning: string; level: string };
export type SentenceAiAnalysis = Omit<SentenceAiContent, 'patterns'> & {
  patterns: (SentenceAiContent['patterns'][number] & { match: SentencePatternMatch | null })[];
};
export type SentenceAnalysisResponse = { userId: string | null; analysis: SentenceAnalysis };
export type SentenceAiResponse = { userId: string; analysis: SentenceAiAnalysis; cached: boolean };
