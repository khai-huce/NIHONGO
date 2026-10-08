import type { GrammarDraft, GrammarRecord } from '@nihongo/shared/contracts/grammar';

export const emptyGrammarDraft = (): GrammarDraft => ({ title: '', subtitle: '', description: '', level: 'N5', sourceId: null, lessons: [] });
export const grammarDraftCopy = (record?: GrammarRecord | null): GrammarDraft => record ? structuredClone(record.draft) : emptyGrammarDraft();
export function grammarCounts(draft: GrammarDraft) {
  const patterns = draft.lessons.flatMap(lesson => lesson.patterns);
  return { lessons: draft.lessons.length, patterns: patterns.length, examples: patterns.reduce((n, pattern) => n + pattern.examples.length, 0), exercises: patterns.reduce((n, pattern) => n + pattern.exercises.length, 0) };
}
export function grammarRemoved(before: GrammarDraft, after: GrammarDraft) {
  const oldPatterns = before.lessons.flatMap(lesson => lesson.patterns), newPatterns = after.lessons.flatMap(lesson => lesson.patterns);
  const lessons = new Set(after.lessons.map(item => item.id)), patterns = new Set(newPatterns.map(item => item.id));
  const examples = new Set(newPatterns.flatMap(item => item.examples.map(example => example.id)));
  const exercises = new Set(newPatterns.flatMap(item => item.exercises.map(exercise => exercise.id)));
  return { lessons: before.lessons.filter(item => !lessons.has(item.id)).length, patterns: oldPatterns.filter(item => !patterns.has(item.id)).length,
    examples: oldPatterns.flatMap(item => item.examples).filter(item => !examples.has(item.id)).length,
    exercises: oldPatterns.flatMap(item => item.exercises).filter(item => !exercises.has(item.id)).length };
}

/** Allocate identities once for each JSON revision; preserve malformed IDs for server validation. */
export function parseGrammarJson(text: string, uuid: () => string = () => crypto.randomUUID()): unknown {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON phải là bản nháp giáo trình ngữ pháp, gồm title, level, sourceId và lessons.');
  const draft = value as Record<string, unknown>;
  const assign = (item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const object = item as Record<string, unknown>;
    if (object.id === undefined) object.id = uuid();
    return object;
  };
  if (Array.isArray(draft.lessons)) for (const lessonValue of draft.lessons) {
    const lesson = assign(lessonValue);
    if (Array.isArray(lesson?.patterns)) for (const patternValue of lesson.patterns) {
      const pattern = assign(patternValue);
      if (Array.isArray(pattern?.examples)) pattern.examples.forEach(assign);
      if (Array.isArray(pattern?.exercises)) pattern.exercises.forEach(assign);
    }
  }
  return draft;
}
export const grammarStatus = (record: Pick<GrammarRecord, 'archivedAt' | 'version' | 'publishedVersion'>) => record.archivedAt ? 'Đã lưu trữ' : record.publishedVersion === null ? 'Bản nháp' : record.publishedVersion !== record.version ? 'Có thay đổi nháp' : 'Đã xuất bản';
export function moveGrammarItem<T>(items: T[], index: number, offset: number): T[] {
  const result = [...items], target = index + offset;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return result;
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}
