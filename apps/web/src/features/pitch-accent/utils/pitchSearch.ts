import type { PitchSearchResponse } from '@nihongo/shared/contracts/pitch-accent';

export type PitchSearchState = {
  query: string; response: PitchSearchResponse | null; loading: boolean; error: string;
};
export type PitchFetcher = (query: string, offset: number, signal: AbortSignal) => Promise<PitchSearchResponse>;

export const emptyPitchSearch: PitchSearchState = { query: '', response: null, loading: false, error: '' };

/** An input revision, rather than its text alone, owns every delayed response. */
export function createPitchSearch(fetcher: PitchFetcher, onChange: (state: PitchSearchState) => void, delay = 300) {
  let state = { ...emptyPitchSearch };
  let revision = 0, offset = 0, composing = false, mounted = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | undefined;
  const emit = (next: PitchSearchState) => { state = next; if (mounted) onChange(next); };
  const cancel = () => {
    revision += 1;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    request?.abort(); request = undefined;
  };
  const load = async (currentRevision: number) => {
    timer = undefined;
    const query = state.query.trim();
    if (!mounted || composing || !query || revision !== currentRevision) return;
    const controller = new AbortController(); request = controller;
    try {
      const response = await fetcher(query, offset, controller.signal);
      if (!mounted || revision !== currentRevision) return;
      if (response.total > 0 && response.offset > 0 && response.items.length === 0) {
        offset = 0;
        throw new Error('Kết quả đã thay đổi. Bấm Thử lại để quay về trang đầu.');
      }
      emit({ ...state, response, loading: false, error: '' });
    } catch (error) {
      if (mounted && revision === currentRevision) emit({ ...state, response: null, loading: false,
        error: error instanceof Error ? error.message : 'Chưa tra cứu được trọng âm. Vui lòng thử lại.' });
    } finally { if (request === controller) request = undefined; }
  };
  const search = (query: string, isComposing = false) => {
    if (!mounted || (query === state.query && composing === isComposing)) return;
    cancel(); composing = isComposing; offset = 0;
    const ready = Boolean(query.trim()) && !composing;
    emit({ query, response: null, loading: ready, error: '' });
    if (ready) { const nextRevision = revision; timer = setTimeout(() => { void load(nextRevision); }, delay); }
  };
  const page = (nextOffset: number) => {
    if (!mounted || composing || state.loading || !state.query.trim() || !Number.isInteger(nextOffset) || nextOffset < 0) return;
    cancel(); offset = nextOffset;
    emit({ ...state, response: null, loading: true, error: '' });
    void load(revision);
  };
  return {
    search, page,
    retry: () => page(offset),
    mount: () => { mounted = true; },
    dispose: () => { mounted = false; cancel(); },
  };
}

export async function fetchPitchSearch(query: string, offset: number, signal: AbortSignal): Promise<PitchSearchResponse> {
  const params = new URLSearchParams({ q: query, offset: String(offset), limit: '20' });
  let response: Response;
  try {
    response = await fetch(`/api/pitch-accent?${params}`, {
      credentials: 'same-origin', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new Error('Không kết nối được máy chủ. Vui lòng kiểm tra kết nối và thử lại.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'Máy chủ chưa sẵn sàng. Vui lòng thử lại.');
  if (!data || !Array.isArray(data.items) || !Number.isInteger(data.total) || data.total < 0
    || data.offset !== offset || data.limit !== 20 || data.items.length > data.limit
    || typeof data.catalogReady !== 'boolean' || typeof data.hasMore !== 'boolean') {
    throw new Error('Phản hồi máy chủ không hợp lệ. Vui lòng thử lại.');
  }
  return data as PitchSearchResponse;
}
