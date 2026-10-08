import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShadowingGrade, ShadowingMode, ShadowingStudy, ShadowingVideo } from '@nihongo/shared/contracts/shadowing';
import { shadowingApi } from '../lib/shadowing-api';
import { createShadowingQueue } from '../lib/shadowing-study';

export const emptyStudy = (): ShadowingStudy => ({ version: 0, currentSentenceId: null, positionMs: 0, bookmarks: [], replayCounts: {}, grades: [] });
type StudyResponse = { userId: string | null; study: ShadowingStudy | null };
export function useShadowingStudy(video: ShadowingVideo, userId: string | null, initial: ShadowingStudy | null) {
  const [study, setStudy] = useState(initial ?? emptyStudy);
  const [error, setError] = useState('');
  const live = useRef(true), current = useRef(study), queue = useRef(createShadowingQueue());
  useEffect(() => { live.current = true; queue.current.mount(); return () => { live.current = false; queue.current.unmount(); }; }, []);
  const apply = (next: ShadowingStudy) => { current.current = next; if (live.current) setStudy(next); };
  const enqueue = useCallback(<T,>(work: (isCurrent: () => boolean) => Promise<T>): Promise<T> => {
    return queue.current.enqueue(async isCurrent => {
      try { const result = await work(isCurrent); if (isCurrent()) setError(''); return result; }
      catch (cause) { if (isCurrent()) setError(cause instanceof Error ? cause.message : 'Chưa lưu được tiến độ.'); throw cause; }
    });
  }, []);
  const update = useCallback((change: { currentSentenceId?: string; positionMs?: number; bookmark?: { sentenceId: string; active: boolean }; replay?: { sentenceId: string; requestId: string } }) => enqueue(async isCurrent => {
    if (!userId) {
      const next = { ...current.current, bookmarks: [...current.current.bookmarks], replayCounts: { ...current.current.replayCounts } };
      if (change.currentSentenceId) next.currentSentenceId = change.currentSentenceId;
      if (change.positionMs !== undefined) next.positionMs = change.positionMs;
      if (change.bookmark) next.bookmarks = change.bookmark.active ? [...new Set([...next.bookmarks, change.bookmark.sentenceId])] : next.bookmarks.filter(id => id !== change.bookmark!.sentenceId);
      if (change.replay) next.replayCounts[change.replay.sentenceId] = (next.replayCounts[change.replay.sentenceId] ?? 0) + 1;
      apply(next); return;
    }
    const result = await shadowingApi<StudyResponse>(`/videos/${video.id}/study`, { expectedUserId: userId, videoVersion: video.version, version: current.current.version, ...change });
    if (result.userId !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại.');
    if (result.study && isCurrent()) apply(result.study);
  }), [enqueue, userId, video.id, video.version]);
  const check = useCallback((sentenceId: string, mode: ShadowingMode, answer: string | number[], hintsUsed: boolean, requestId: string) => enqueue(async isCurrent => {
    const result = await shadowingApi<StudyResponse & { grade: ShadowingGrade; firstGrade: boolean }>(`/videos/${video.id}/check`, {
      ...(userId ? { expectedUserId: userId } : {}), videoVersion: video.version, sentenceId, mode, answer, hintsUsed, requestId,
    });
    if (result.userId !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại.');
    if (!isCurrent()) throw new Error('Màn học đã thay đổi.');
    if (result.study) apply(result.study);
    else if (!current.current.grades.some(grade => grade.sentenceId === sentenceId && grade.mode === mode)) apply({ ...current.current, grades: [...current.current.grades, result.grade] });
    return result.grade;
  }), [enqueue, userId, video.id, video.version]);
  return { study, error, update, check };
}
