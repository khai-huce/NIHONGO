import type { AdminJlptRoadmap, JlptDraft, JlptPreview, JlptResourceInput, JlptResourceKind, JlptResourceOption, JlptSessionInput } from '@nihongo/shared/contracts/jlpt';

export const jlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export const resourceLabels: Record<JlptResourceKind, string> = {
  kanji: 'Kanji', vocabulary: 'Bài từ vựng', grammar: 'Mẫu ngữ pháp', reading: 'Bài đọc', shadowing: 'Video Shadowing', kana: 'Bảng chữ cái',
};
export const emptyJlptDraft = (): JlptDraft => ({ title: '', description: '', sourceId: null, passPercent: 80, sessions: [] });
export const copyJlptDraft = (record: AdminJlptRoadmap | null): JlptDraft => record ? structuredClone(record.draft) : emptyJlptDraft();
export const jlptStatus = (record: Pick<AdminJlptRoadmap, 'archivedAt' | 'version' | 'publishedVersion'>) => record.archivedAt ? 'Đã lưu trữ' : record.publishedVersion === null ? 'Bản nháp' : record.publishedVersion !== record.version ? 'Có thay đổi nháp' : 'Đã xuất bản';

export function moveJlptItem<T>(items: T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export const resourceKey = (resource: Pick<JlptResourceInput, 'kind' | 'targetId'>) => `${resource.kind}:${resource.targetId}`;

/** A new occurrence gets its identity once. Content remains a reference to the existing catalog. */
export function appendJlptResource(session: JlptSessionInput, option: JlptResourceOption, uuid: () => string = () => crypto.randomUUID()): JlptSessionInput {
  if (!option.available || session.resources.some(item => resourceKey(item) === resourceKey(option))) return session;
  return { ...session, resources: [...session.resources, { id: uuid(), kind: option.kind, targetId: option.targetId }] };
}

export function jlptDraftCounts(draft: JlptDraft) {
  return {
    sessions: draft.sessions.length,
    resources: draft.sessions.reduce((total, session) => total + session.resources.length, 0),
    minutes: draft.sessions.reduce((total, session) => total + session.estimatedMinutes, 0),
  };
}

/** Preview uses the server-validated draft. Match by identity so reordered sessions never show another answer key. */
export function jlptPreviewSections(preview: JlptPreview) {
  const byId = new Map(preview.draft.sessions.map(session => [session.id, session.questions ?? []]));
  return preview.sessions.map(session => ({ ...session, questions: byId.get(session.id) ?? [] }));
}
