export const DEFAULT_ROADMAP: Readonly<{
  id: 'n5-v1'; level: 'N5'; perDay: 10; kanjiList: readonly string[];
}>;
export function vietnamStudyDate(now?: Date): string;
/** Consecutive Vietnam study dates ending today or yesterday; repeated dates count once. */
export function studyStreak(activityDays: readonly string[], now?: Date): number;
