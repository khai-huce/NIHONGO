import type { KanjiItem, RadicalItem } from '../types';

export type RoadmapDefinition = { id: string; level: string; perDay: number; kanjiIds: string[]; kanjiList: string[] };
export type ContentCatalog = { kanji: KanjiItem[]; archivedKanji: KanjiItem[]; radicals: RadicalItem[]; roadmaps: RoadmapDefinition[] };
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');

export function validateContentCatalog(value: unknown): ContentCatalog {
  const invalid = () => { throw new Error('Dữ liệu kho nội dung không hợp lệ. Vui lòng tải lại.'); };
  if (!value || typeof value !== 'object') return invalid();
  const data = value as ContentCatalog;
  if (!Array.isArray(data.kanji) || !Array.isArray(data.archivedKanji) || !Array.isArray(data.radicals) || !Array.isArray(data.roadmaps)) return invalid();
  const all = [...data.kanji, ...data.archivedKanji];
  const ids = new Set<string>(), characters = new Set<string>();
  for (const item of all) {
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.kanji !== 'string' || Array.from(item.kanji).length !== 1
      || ids.has(item.id) || characters.has(item.kanji) || typeof item.hanViet !== 'string' || typeof item.meaning !== 'string'
      || !['N5', 'N4', 'N3', 'N2', 'N1'].includes(item.level) || !strings(item.onyomi) || !strings(item.kunyomi)
      || !strings(item.radicals) || !Array.isArray(item.radicalParts) || !Array.isArray(item.examples)
      || typeof item.mnemonic !== 'string' || !Number.isSafeInteger(item.strokeCount) || item.strokeCount < 1) return invalid();
    ids.add(item.id); characters.add(item.kanji);
  }
  for (const item of data.radicals) {
    if (!item || !Number.isSafeInteger(item.number) || typeof item.radical !== 'string' || typeof item.hanViet !== 'string'
      || typeof item.meaning !== 'string' || !strings(item.examples) || !Number.isSafeInteger(item.strokes)) return invalid();
  }
  const byId = new Map(all.map(item => [item.id, item.kanji])), definitions = new Set<string>();
  for (const item of data.roadmaps) {
    if (!item || typeof item.id !== 'string' || !item.id || definitions.has(item.id) || typeof item.level !== 'string'
      || !Number.isSafeInteger(item.perDay) || item.perDay < 1 || !strings(item.kanjiIds) || !strings(item.kanjiList)
      || !item.kanjiIds.length || item.kanjiIds.length !== item.kanjiList.length || new Set(item.kanjiIds).size !== item.kanjiIds.length
      || item.kanjiIds.some((id, index) => byId.get(id) !== item.kanjiList[index])) return invalid();
    definitions.add(item.id);
  }
  return { kanji: data.kanji, archivedKanji: data.archivedKanji, radicals: data.radicals, roadmaps: data.roadmaps };
}
