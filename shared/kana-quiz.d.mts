export type Kana = { id: string; hira: string; kata: string; romaji: string };
export type KanaScript = 'hiragana' | 'katakana';
export type KanaMode = KanaScript | 'both';
export type KanaAnswer = { kanaId: string; script: KanaScript; answerId: string };
export type KanaQuestion = { kanaId: string; script: KanaScript; options: string[] };
export type GradedKanaAnswer = KanaAnswer & { correct: boolean };
export const KANA_CATALOG_ID: 'kana-v1';
export const KANA_COUNT: 104;
export const SEION_ROWS: readonly (readonly (Kana | null)[])[];
export const DAKUON_ROWS: readonly (readonly (Kana | null)[])[];
export const YOON_ROWS: readonly (readonly (Kana | null)[])[];
export const KANA_LIST: readonly Kana[];
export function makeKanaQuiz(mode: KanaMode, random?: () => number): KanaQuestion[];
export function gradeKanaAnswers(mode: KanaMode, answers: readonly KanaAnswer[]): {
  answers: GradedKanaAnswer[];
  total: number;
  correct: number;
};
