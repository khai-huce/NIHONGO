import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@nihongo/client/api';

/** A route/account change invalidates the previous response before it can render. */
export function useAccountResource<T>(path: string | null, userId: string | null, authBusy = false, queryBody?: unknown) {
  // Read-only POST previews can carry a selection larger than a safe URL query.
  const bodyJson = queryBody === undefined ? undefined : JSON.stringify(queryBody);
  const key = JSON.stringify([path, userId, bodyJson]);
  const context = useRef(key), revision = useRef(0), mounted = useRef(false);
  if (context.current !== key) { context.current = key; revision.current++; }
  const [state, setState] = useState<{key: string; data: T | null; loading: boolean; error: string}>({key, data: null, loading: !!path, error: ''});
  const reload = useCallback(async () => {
    if (!path || authBusy || !mounted.current) return;
    const request = ++revision.current;
    setState(old => ({ key, data: old.key === key ? old.data : null, loading: true, error: '' }));
    try {
      const data = await api<T & { userId?: string | null }>(path, bodyJson === undefined ? undefined : JSON.parse(bodyJson));
      if (!mounted.current || context.current !== key || request !== revision.current) return;
      if (data.userId !== undefined && data.userId !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại trang.');
      setState({key, data, loading: false, error: ''});
    } catch (error) {
      if (mounted.current && context.current === key && request === revision.current) setState(old => ({...old, loading: false, error: error instanceof Error ? error.message : 'Chưa tải được giáo trình.'}));
    }
  }, [path, userId, key, authBusy, bodyJson]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; revision.current++; }; }, []);
  useEffect(() => { void reload(); }, [reload]);
  return {data: state.key === key ? state.data : null, loading: !!path && (authBusy || state.key !== key || state.loading), error: state.key === key ? state.error : '', reload};
}
