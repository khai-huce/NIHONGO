import { ROADMAP_KANJI } from './roadmap.mjs';

// Versioned, intentionally small catalog approved for P08; this is not the full N5 syllabus.
const n5Ids = new Set(Array.from({ length: 28 }, (_, index) => `k-${index + 1}`));
export const DEFAULT_ROADMAP = Object.freeze({
  id: 'n5-v1', level: 'N5', perDay: 10,
  kanjiList: Object.freeze(ROADMAP_KANJI.filter(([id]) => n5Ids.has(id)).map(([, character]) => character)),
});

export function vietnamStudyDate(now = new Date()) {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function previousDay(day) {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) - 86400000).toISOString().slice(0, 10);
}

export function studyStreak(activityDays, now = new Date()) {
  const days = new Set(activityDays);
  let day = vietnamStudyDate(now);
  if (!days.has(day)) day = previousDay(day);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = previousDay(day);
  }
  return streak;
}
