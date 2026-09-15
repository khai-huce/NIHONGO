export type RoadmapProgress = {
  assessments: Record<string, boolean>;
  completedDays: number[];
  currentDay: number;
};
/** Removes invalid entries; preserves valid completed days without inferring completion from global progress. */
export function roadmapProgress(kanjiList: readonly string[], perDay: number, assessments: unknown, completedDays: unknown): RoadmapProgress;
export function assessRoadmapKanji(kanjiList: readonly string[], perDay: number, assessments: unknown, completedDays: unknown,
  day: number, kanjiId: string, memorized: boolean): RoadmapProgress;
