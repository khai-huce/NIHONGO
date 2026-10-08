import { ROADMAP_KANJI, roadmapDayKanji } from './roadmap.mjs';


// Progress belongs to this roadmap; global memorized flags never complete its days.
export function roadmapProgress(kanjiList, perDay, assessments, completedDays, catalog = ROADMAP_KANJI) {
  const idsByCharacter = new Map(catalog.map(([id, character]) => [character, id]));
  const totalDays = Math.ceil(kanjiList.length / perDay);
  roadmapDayKanji(kanjiList, perDay, 1);
  const memberIds = new Set(kanjiList.map(character => idsByCharacter.get(character)).filter(Boolean));
  const validAssessments = {};
  if (assessments && typeof assessments === 'object' && !Array.isArray(assessments)) {
    for (const [id, value] of Object.entries(assessments)) {
      if (memberIds.has(id) && typeof value === 'boolean') validAssessments[id] = value;
    }
  }
  const validDays = [...new Set((Array.isArray(completedDays) ? completedDays : [])
    .filter(day => Number.isSafeInteger(day) && day >= 1 && day <= totalDays))].sort((a, b) => a - b);
  let currentDay = 1;
  while (currentDay < totalDays && validDays.includes(currentDay)) currentDay += 1;
  return { assessments: validAssessments, completedDays: validDays, currentDay };
}

export function assessRoadmapKanji(kanjiList, perDay, assessments, completedDays, day, kanjiId, memorized, catalog = ROADMAP_KANJI) {
  const idsByCharacter = new Map(catalog.map(([id, character]) => [character, id]));
  const dayIds = roadmapDayKanji(kanjiList, perDay, day).map(character => idsByCharacter.get(character));
  if (typeof memorized !== 'boolean' || !dayIds.includes(kanjiId)) {
    throw new RangeError('Chữ Kanji không thuộc ngày học này.');
  }
  const progress = roadmapProgress(kanjiList, perDay, assessments, completedDays, catalog);
  progress.assessments[kanjiId] = memorized;
  if (dayIds.every(id => id && Object.hasOwn(progress.assessments, id)) && !progress.completedDays.includes(day)) {
    progress.completedDays.push(day);
  }
  return roadmapProgress(kanjiList, perDay, progress.assessments, progress.completedDays, catalog);
}
