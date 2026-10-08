import type { KanjiRecord } from '../../shared/types.ts';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function hasUnpublishedDraft(item: KanjiRecord) {
  return !item.published || item.draftSourceId !== item.sourceId || canonical(item.draft) !== canonical(item.published);
}
export function filterKanji(items: KanjiRecord[], query: string, level: string, status: string) {
  const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('vi').replace(/đ/g, 'd').trim();
  const needle = normalize(query);
  return items.filter(item => {
    if (level && item.draft.level !== level) return false;
    if (status === 'changed' ? !hasUnpublishedDraft(item) || item.status === 'archived' : status && item.status !== status) return false;
    const fields = [item.id, item.draft.kanji, item.draft.hanViet, item.draft.meaning, ...item.draft.onyomi, ...item.draft.kunyomi];
    return !needle || fields.some(text => normalize(text).includes(needle));
  });
}
