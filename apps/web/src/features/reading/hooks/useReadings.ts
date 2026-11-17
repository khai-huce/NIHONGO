import { useToast, useToastFeedback } from '@nihongo/client/toast';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@nihongo/client/api';
import { GUEST_READINGS_KEY, guestReading, readGuestReadings, type ReadingArticle } from '@nihongo/client/reading';

export async function readingRequest<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal; timeout?: number } = {}): Promise<T> {
  let response: Response;
  try {
    const timeout = AbortSignal.timeout(options.timeout ?? 15000);
    response = await fetch(`/api/reading/articles${path}`, {
      method: options.method ?? 'GET', credentials: 'same-origin',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ. Văn bản vẫn được giữ để bạn thử lại.');
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.error?.code ?? 'SERVER_ERROR', data?.error?.message ?? 'Máy chủ chưa sẵn sàng. Vui lòng thử lại.');
  if (!data) throw new Error('Phản hồi bài đọc không hợp lệ.');
  return data as T;
}

type State = { owner: string | null; target: string | undefined; articles: ReadingArticle[]; article: ReadingArticle | null; loading: boolean; saving: boolean; error: string };
export function useReadings(userId: string | null, authBusy: boolean, articleId?: string) {
  const [state, setState] = useState<State>({ owner: userId, target: articleId, articles: [], article: null, loading: true, saving: false, error: '' });
  const toast = useToast();
  useToastFeedback({ error: state.owner === userId && state.target === articleId ? state.error : null });
  const [reload, setReload] = useState(0);
  const revision = useRef(0), busy = useRef(false), abort = useRef<AbortController | null>(null);
  const retryCreate = useRef<{ text: string; id: string } | null>(null);
  const context = useRef({ userId, articleId, authBusy });
  if (context.current.userId !== userId || context.current.articleId !== articleId) revision.current++;
  context.current = { userId, articleId, authBusy };
  const ownerIsCurrent = (data: { userId: string | null }) => {
    if (data.userId !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại trang.');
  };

  useEffect(() => {
    if (authBusy) return;
    const request = ++revision.current, controller = new AbortController();
    abort.current?.abort(); abort.current = controller; busy.current = false;
    setState({ owner: userId, target: articleId, articles: [], article: null, loading: true, saving: false, error: '' });
    void (async () => {
      try {
        let guests: ReadingArticle[] = [];
        if (!userId) guests = readGuestReadings(localStorage.getItem(GUEST_READINGS_KEY));
        const guest = guests.find(article => article.id === articleId);
        const [list, detail] = await Promise.all([
          readingRequest<{ userId: string | null; articles: ReadingArticle[] }>('', { signal: controller.signal }),
          articleId && !guest ? readingRequest<{ userId: string | null; article: ReadingArticle }>(`/${encodeURIComponent(articleId)}`, { signal: controller.signal }) : null,
        ]);
        ownerIsCurrent(list); if (detail) ownerIsCurrent(detail);
        if (request !== revision.current || controller.signal.aborted) return;
        setState({ owner: userId, target: articleId, articles: [...list.articles, ...guests],
          article: guest ?? detail?.article ?? null, loading: false, saving: false, error: '' });
      } catch (error) {
        if (request === revision.current && !controller.signal.aborted) setState(s => ({ ...s, loading: false,
          error: error instanceof Error ? error.message : 'Không tải được bài đọc.' }));
      }
    })();
    return () => { controller.abort(); abort.current?.abort(); revision.current++; };
  }, [userId, authBusy, articleId, reload]);

  const create = async (text: string): Promise<string | null> => {
    if (busy.current || authBusy || state.owner !== userId || state.loading) return null;
    const clean = text.trim();
    busy.current = true;
    const request = revision.current, controller = new AbortController(); abort.current = controller;
    setState(s => ({ ...s, saving: true, error: '' }));
    try {
      if (!retryCreate.current || retryCreate.current.text !== clean) retryCreate.current = { text: clean, id: crypto.randomUUID() };
      const { id } = retryCreate.current;
      const guest = guestReading(clean, `guest-${id}`);
      let result: ReadingArticle;
      if (userId) {
        const response = await readingRequest<{ userId: string; article: ReadingArticle }>('', { method: 'POST',
          body: { id, expectedUserId: userId, title: guest.title, text: clean }, signal: controller.signal });
        ownerIsCurrent(response); result = response.article;
      } else {
        const existing = readGuestReadings(localStorage.getItem(GUEST_READINGS_KEY));
        localStorage.setItem(GUEST_READINGS_KEY, JSON.stringify([guest, ...existing.filter(a => a.id !== guest.id)]));
        result = guest;
      }
      if (request !== revision.current || controller.signal.aborted) return null;
      retryCreate.current = null;
      toast.success(userId ? 'Đã lưu bài đọc vào tài khoản.' : 'Đã lưu bài đọc trên thiết bị này.');
      return result.id;
    } catch (error) {
      if (request === revision.current && !controller.signal.aborted) setState(s => ({ ...s,
        error: error instanceof Error ? error.message : 'Chưa lưu được bài đọc.' }));
      return null;
    } finally {
      if (request === revision.current) { busy.current = false; setState(s => ({ ...s, saving: false })); }
    }
  };
  const remove = async (article: ReadingArticle): Promise<boolean> => {
    if (busy.current || authBusy || article.visibility === 'public' || state.owner !== userId) return false;
    const request = revision.current, controller = new AbortController(); abort.current = controller; busy.current = true;
    setState(s => ({ ...s, saving: true, error: '' }));
    try {
      if (userId) await readingRequest(`/${encodeURIComponent(article.id)}`, { method: 'DELETE',
        body: { expectedUserId: userId, version: article.version }, signal: controller.signal });
      else localStorage.setItem(GUEST_READINGS_KEY, JSON.stringify(readGuestReadings(localStorage.getItem(GUEST_READINGS_KEY)).filter(a => a.id !== article.id)));
      if (request !== revision.current || controller.signal.aborted) return false;
      setState(s => ({ ...s, articles: s.articles.filter(a => a.id !== article.id) })); toast.success('Đã xóa bài đọc.'); return true;
    } catch (error) {
      if (request === revision.current && !controller.signal.aborted) setState(s => ({ ...s,
        error: error instanceof Error ? error.message : 'Chưa xóa được bài đọc.' }));
      return false;
    } finally {
      if (request === revision.current) { busy.current = false; setState(s => ({ ...s, saving: false })); }
    }
  };
  const refresh = useCallback(() => { if (!busy.current) setReload(value => value + 1); }, []);
  const sameContext = state.owner === userId && state.target === articleId;
  return { ...state, articles: sameContext ? state.articles : [], article: sameContext ? state.article : null,
    loading: authBusy || !sameContext || state.loading, create, remove, refresh };
}
