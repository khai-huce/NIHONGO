import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../types';
import { api, ApiError } from '../utils/api';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [checking, setChecking] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const logoutPending = useRef(false);
  const refresh = useCallback(async () => {
    if (logoutPending.current) return;
    const request = ++revision.current;
    setChecking(true);
    try {
      const { user } = await api<{ user: UserProfile }>('/auth/me');
      if (request !== revision.current) return;
      setCurrentUser(user);
      setError('');
    } catch (err) {
      if (request !== revision.current) return;
      if (err instanceof ApiError && err.status === 401) { setCurrentUser(null); setError(''); }
      else setError(err instanceof Error ? err.message : 'Chưa tải được tài khoản.');
    } finally { if (request === revision.current) setChecking(false); }
  }, []);
  useEffect(() => {
    try { localStorage.removeItem('nhai_kanji_user'); } catch { /* Storage may be disabled. */ }
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { ++revision.current; document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);
  const acceptUser = useCallback((user: UserProfile) => {
    ++revision.current; setCurrentUser(user); setChecking(false); setError('');
  }, []);
  const logout = useCallback(async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    ++revision.current;
    setChecking(false); setLoggingOut(true); setError('');
    try { await api<void>('/auth/logout', {}); setCurrentUser(null); }
    catch { setError('Chưa xác nhận được đăng xuất. Vui lòng thử lại khi kết nối hoạt động.'); }
    finally { logoutPending.current = false; setLoggingOut(false); }
  }, []);
  return { currentUser, checking, loggingOut, error, refresh, acceptUser, logout };
}
