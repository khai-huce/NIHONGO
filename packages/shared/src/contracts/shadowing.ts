export type ShadowingLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type ShadowingMode = 'puzzle' | 'typing';

export interface ShadowingToken { text: string; reading: string | null }
export interface ShadowingSentence {
  id: string; startMs: number; endMs: number; text: string; translationVi: string;
  tokens: ShadowingToken[];
}
export interface ShadowingContent {
  youtubeId: string; title: string; channel: string; durationMs: number;
  level: ShadowingLevel | null; description: string; sentences: ShadowingSentence[];
}
export interface ShadowingVideoSummary {
  id: string; title: string; channel: string; youtubeId: string; durationMs: number;
  level: ShadowingLevel | null; description: string; sentenceCount: number;
  scope: 'library' | 'personal'; status: 'draft' | 'published' | 'archived'; version: number;
}
export interface ShadowingVideo extends ShadowingVideoSummary {
  content: ShadowingContent; sourceId: string | null; publishedVersion: number | null;
}
export interface ShadowingGrade {
  sentenceId: string; mode: ShadowingMode; contentHash: string;
  answer: string | number[]; correct: boolean; errors: number; hintsUsed: boolean;
  checkedAt: string; sentence: ShadowingSentence;
}
export interface ShadowingStudy {
  version: number; currentSentenceId: string | null; positionMs: number;
  bookmarks: string[]; replayCounts: Record<string, number>; grades: ShadowingGrade[];
}
export interface ShadowingListResponse { userId: string | null; items: ShadowingVideoSummary[] }
export interface ShadowingDetailResponse { userId: string | null; video: ShadowingVideo; study: ShadowingStudy | null }
export interface ShadowingDraftInput {
  url: string; level: ShadowingLevel | null; description: string;
  sentences: Array<{ id?: string; startMs: number; endMs: number; text: string; translationVi?: string }>;
}
export interface ShadowingAiRequest {
  id: string; status: 'pending' | 'ready' | 'failed'; content: ShadowingContent | null;
  error: string | null;
}
