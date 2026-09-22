import type { KanjiItem } from '../types';

export type KanjiData = KanjiItem & { dictionaryRadicalNumber?: number };
export interface ContentSource {
  id: string; name: string; url: string; license: string; licenseUrl: string;
  version: string; checksum: string; attribution: string; notes: string;
}
export interface KanjiRecord {
  id: string; character: string; status: 'draft' | 'published' | 'archived'; version: number;
  draft: KanjiData; published: KanjiData | null; sourceId: string; draftSourceId: string;
  createdAt: string; updatedAt: string; publishedAt: string | null;
}
export interface KanjiImport {
  kind: 'kanji';
  entries: { sourceId: string; expectedVersion: number | null; data: KanjiData }[];
}
export interface ImportPreview {
  previewHash: string; canCommit: boolean;
  rows: { id: string; version: number | null; action: 'source_missing' | 'identity_conflict' | 'unchanged' | 'version_conflict' | 'update_draft' | 'create_draft' }[];
}
export type AdminRequest = <T>(path: string, options?: { method?: 'GET' | 'POST' | 'PUT'; body?: Record<string, unknown>; signal?: AbortSignal }) => Promise<T>;
