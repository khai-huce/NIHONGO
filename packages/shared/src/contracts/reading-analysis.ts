/** A04 proposals never change Japanese text or other article content. */
export const READING_ANALYSIS_MAX_CHARS = 3000;
export const READING_ANALYSIS_MAX_SENTENCES = 100;
export const READING_ANALYSIS_TIMEOUT_MS = 105000;
export const READING_ANALYSIS_MAX_APPLY_BYTES = 512 * 1024;

export type ReadingAnalysisField = 'translation' | 'ruby';
export type ReadingAnalysisRuby = { text: string; reading?: string };
export type ReadingAnalysisAnnotation = {
  sentenceId: string;
  japanese: string;
  translation: string;
  ruby: ReadingAnalysisRuby[];
};
export type ReadingAnalysisSentence = ReadingAnalysisAnnotation & {
  /** Derived by the server from missing fields in the saved article, never by AI. */
  generatedFields: ReadingAnalysisField[];
};
export type ReadingAnalysisResult = {
  sentences: ReadingAnalysisSentence[];
  warnings: string[];
};
export type ReadingAnalysisResponse = {
  userId: string;
  id: string;
  articleId: string;
  version: number;
  cached: boolean;
  result: ReadingAnalysisResult;
};
export type ReadingAnalysisInput = { id: string; expectedUserId: string; version: number };
export type ReadingAnalysisApplyInput = {
  requestId: string;
  expectedUserId: string;
  version: number;
  annotations: ReadingAnalysisAnnotation[];
};
export type ReadingAnalysisApplyResponse = {
  userId: string;
  articleId: string;
  requestId: string;
  version: number;
};
