import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import { keepVocabProgress } from '../utils/vocab-progress';
import type { VocabWord } from './useVocabLessons';

export type ProgressSnapshot = {
  words: VocabWord[];
  progress: Record<string, boolean>;
  lessonVersion: number;
  progressVersion: number;
};

type ProgressResponse = Omit<ProgressSnapshot, 'progress'> & {
  userId: string;
  lessonId: string;
  progress: { wordId: string; memorized: boolean }[];
};

type ProgressState = {
  key: string;
  owner: string;
  snapshot: ProgressSnapshot;
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  error: string;
};

type Options = {
  lessonId: string;
  userId: string | null;
  authBusy: boolean;
  words: VocabWord[];
  lessonVersion: number;
};

function readSnapshot(data: ProgressResponse, userId: string, lessonId: string): ProgressSnapshot {
  if (data.userId !== userId || data.lessonId !== lessonId) {
    throw new Error('Tài khoản hoặc bài học đã thay đổi. Vui lòng tải lại trang.');
  }
  if (!Array.isArray(data.words) || !Array.isArray(data.progress) ||
    !Number.isInteger(data.lessonVersion) || data.lessonVersion < 0 ||
    !Number.isInteger(data.progressVersion) || data.progressVersion < 0) {
    throw new Error('Phản hồi tiến độ không hợp lệ. Vui lòng tải lại tiến độ.');
  }
  const wordIds = new Set(data.words.map(word => word.id));
  const ratedIds = new Set<string>();
  for (const item of data.progress) {
    if (!item || !wordIds.has(item.wordId) || ratedIds.has(item.wordId) || typeof item.memorized !== 'boolean') {
      throw new Error('Phản hồi tiến độ không hợp lệ. Vui lòng tải lại tiến độ.');
    }
    ratedIds.add(item.wordId);
  }
  return {
    words: data.words,
    progress: Object.fromEntries(data.progress.map(item => [item.wordId, item.memorized])),
    lessonVersion: data.lessonVersion,
    progressVersion: data.progressVersion,
  };
}

export function useVocabProgress({ lessonId, userId, authBusy, words, lessonVersion }: Options) {
  const owner = JSON.stringify([userId, lessonId]);
  // Invalidate immediately during render, before effects, including content edits with the same IDs.
  const key = JSON.stringify([owner, authBusy, lessonVersion, words]);
  const context = useRef({ key, owner, authBusy, words, lessonVersion });
  const mounted = useRef(false);
  const pending = useRef(false);
  const revision = useRef(0);
  if (context.current.key !== key) {
    revision.current += 1;
    pending.current = false;
  }
  context.current = { key, owner, authBusy, words, lessonVersion };

  const [state, setState] = useState<ProgressState>(() => ({
    key, owner, snapshot: { words, progress: {}, lessonVersion, progressVersion: 0 },
    loaded: false, loading: false, saving: false, error: '',
  }));
  const current = useRef(state);

  const apply = useCallback((next: ProgressState) => {
    current.current = next;
    setState(next);
  }, []);

  const isCurrent = useCallback((request: number) =>
    mounted.current && context.current.key === key && request === revision.current, [key]);

  const canActNow = useCallback(() => mounted.current && context.current.key === key &&
    !context.current.authBusy && !pending.current && current.current.key === key &&
    current.current.loaded && !current.current.loading && !current.current.saving, [key]);

  const reload = useCallback(async (): Promise<ProgressSnapshot | null> => {
    if (!mounted.current || context.current.key !== key || authBusy || pending.current) return null;
    const request = ++revision.current;
    pending.current = true;
    const previous = current.current;
    const sameSource = previous.key === key;
    const guestProgress = !userId && previous.owner === owner
      ? keepVocabProgress(context.current.words, previous.snapshot.progress) : {};
    apply({ key, owner,
      snapshot: sameSource ? previous.snapshot : {
        words: context.current.words, progress: guestProgress,
        lessonVersion: context.current.lessonVersion,
        progressVersion: !userId && previous.owner === owner ? previous.snapshot.progressVersion : 0,
      },
      loaded: sameSource && previous.loaded, loading: true, saving: false, error: '',
    });
    try {
      const next = userId
        ? readSnapshot(await api<ProgressResponse>(`/vocab/progress?lessonId=${encodeURIComponent(lessonId)}`), userId, lessonId)
        : { ...current.current.snapshot, words: context.current.words, progress: guestProgress,
          lessonVersion: context.current.lessonVersion };
      if (!isCurrent(request)) return null;
      apply({ ...current.current, snapshot: next, loaded: true });
      return next;
    } catch (err) {
      if (isCurrent(request)) apply({ ...current.current,
        error: err instanceof Error ? err.message : 'Chưa tải được tiến độ. Vui lòng thử lại.',
      });
      return null;
    } finally {
      if (isCurrent(request)) {
        pending.current = false;
        apply({ ...current.current, loading: false });
      }
    }
  }, [key, owner, userId, lessonId, authBusy, apply, isCurrent]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; revision.current += 1; pending.current = false; };
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const change = useCallback(async (rating?: { wordId: string; memorized: boolean }): Promise<ProgressSnapshot | null> => {
    if (!canActNow()) return null;
    const before = current.current.snapshot;
    if (rating && !before.words.some(word => word.id === rating.wordId)) return null;
    const request = ++revision.current;
    pending.current = true;
    apply({ ...current.current, saving: true, error: '' });
    try {
      let next: ProgressSnapshot;
      if (userId) {
        const body = {
          lessonId, expectedUserId: userId,
          lessonVersion: before.lessonVersion, progressVersion: before.progressVersion,
          ...(rating ?? { confirmedCount: Object.keys(before.progress).length }),
        };
        const data = await api<ProgressResponse>(`/vocab/progress/${rating ? 'rate' : 'reset'}`, body);
        next = readSnapshot(data, userId, lessonId);
      } else {
        next = { ...before,
          progress: rating ? { ...before.progress, [rating.wordId]: rating.memorized } : {},
          progressVersion: before.progressVersion + 1,
        };
      }
      if (!isCurrent(request)) return null;
      apply({ ...current.current, snapshot: next });
      return next;
    } catch (err) {
      if (isCurrent(request)) apply({ ...current.current,
        error: `${err instanceof Error ? err.message : 'Chưa xác nhận được kết quả lưu.'} Tải lại tiến độ để kiểm tra trước khi học tiếp.`,
      });
      return null;
    } finally {
      if (isCurrent(request)) {
        pending.current = false;
        apply({ ...current.current, saving: false });
      }
    }
  }, [userId, lessonId, canActNow, isCurrent, apply]);

  const rate = useCallback((wordId: string, memorized: boolean) => change({ wordId, memorized }), [change]);
  const reset = useCallback(() => change(), [change]);
  const sameSource = state.key === key;
  return {
    words: sameSource ? state.snapshot.words : words,
    progress: sameSource ? state.snapshot.progress : {},
    loaded: sameSource && state.loaded,
    loading: sameSource ? state.loading : !authBusy,
    saving: sameSource && state.saving,
    busy: authBusy || !sameSource || !state.loaded || state.loading || state.saving,
    error: sameSource ? state.error : '',
    reload, rate, reset, canActNow,
  };
}
