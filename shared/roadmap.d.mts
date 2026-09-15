export const ROADMAP_KANJI: readonly (readonly [string, string])[];
export const ROADMAP_PER_DAY: readonly number[];
export const MAX_ROADMAP_TEXT: number;
export const MAX_ROADMAPS: number;
export function extractRoadmapKanji(raw: string): string[];
export function analyzeRoadmapKanji(raw: string): { kanjiList: string[]; unsupported: string[] };
export function roadmapDayKanji(kanjiList: readonly string[], perDay: number, day: number): string[];
