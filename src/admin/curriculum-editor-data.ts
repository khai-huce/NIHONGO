import type { CurriculumDraft, CurriculumRecord } from '../utils/curriculum';

export const emptyCurriculumDraft = (): CurriculumDraft => ({ title: '', subtitle: '', description: '', level: 'N5', style: 'custom', sourceId: null, topics: [] });
export const curriculumDraftCopy = (record?: CurriculumRecord | null): CurriculumDraft => record ? structuredClone(record.draft) : emptyCurriculumDraft();
export function curriculumCounts(draft: CurriculumDraft) {
  return { topics: draft.topics.length, lessons: draft.topics.reduce((sum, topic) => sum + topic.lessons.length, 0), words: draft.topics.reduce((sum, topic) => sum + topic.lessons.reduce((count, lesson) => count + lesson.words.length, 0), 0) };
}
export function curriculumRemoved(before: CurriculumDraft, after: CurriculumDraft) {
  const topics = new Set(after.topics.map(topic => topic.id));
  const lessons = new Set(after.topics.flatMap(topic => topic.lessons.map(lesson => lesson.id)));
  const words = new Set(after.topics.flatMap(topic => topic.lessons.flatMap(lesson => lesson.words.map(word => word.id))));
  return { topics: before.topics.filter(topic => !topics.has(topic.id)).length, lessons: before.topics.flatMap(topic => topic.lessons).filter(lesson => !lessons.has(lesson.id)).length, words: before.topics.flatMap(topic => topic.lessons.flatMap(lesson => lesson.words)).filter(word => !words.has(word.id)).length };
}

/** Assign missing IDs once per parsed text. Callers cache this object until text changes. */
export function parseCurriculumJson(text: string, uuid: () => string = () => crypto.randomUUID()): unknown {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON phải là một bản nháp giáo trình, gồm title, level, sourceId và topics.');
  const draft = parsed as Record<string, unknown>;
  const assign = (value: unknown) => { if (value && typeof value === 'object' && !Array.isArray(value)) { const item = value as Record<string, unknown>; if (item.id === undefined) item.id = uuid(); return item; } return null; };
  if (Array.isArray(draft.topics)) for (const topicValue of draft.topics) {
    const topic = assign(topicValue);
    if (Array.isArray(topic?.lessons)) for (const lessonValue of topic.lessons) {
      const lesson = assign(lessonValue);
      if (Array.isArray(lesson?.words)) for (const word of lesson.words) assign(word);
    }
  }
  return draft;
}

export function curriculumStatus(record: Pick<CurriculumRecord, 'archivedAt' | 'publishedVersion' | 'version'>) {
  return record.archivedAt ? 'Đã lưu trữ' : record.publishedVersion === null ? 'Bản nháp' : record.version !== record.publishedVersion ? 'Có thay đổi nháp' : 'Đã xuất bản';
}
