import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@nihongo/client/api';

type Progress = { kanjiId: string; memorized: boolean; reviewedAt: string };

// The flashcard view is keyed by account, so guest and account state never mix.
export function useKanjiProgress(userId: string | null) {
  const [memorizedIds, setMemorizedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(!!userId);
  const [loaded, setLoaded] = useState(!userId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);
  const pending = useRef(false);
  const revision = useRef(0);
  const reload = useCallback(async () => {
    if (!userId || pending.current) return;
    const version = ++revision.current;
    setLoading(true); setError('');
    try {
      const result = await api<{ userId: string; progress: Progress[] }>('/progress/kanji');
      if (!active.current || version !== revision.current) return;
      if (result.userId !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại trang.');
      setMemorizedIds(result.progress.filter(item => item.memorized).map(item => item.kanjiId));
      setLoaded(true);
    } catch (err) {
      if (active.current && version === revision.current) {
        setLoaded(false);
        setError(err instanceof Error ? err.message : 'Chưa tải được tiến độ.');
      }
    } finally { if (active.current && version === revision.current) setLoading(false); }
  }, [userId]);
  useEffect(() => {
    active.current = true;
    void reload();
    return () => { active.current = false; ++revision.current; };
  }, [reload]);
  async function save(kanjiId: string, memorized: boolean) {
    if (pending.current || !loaded || loading) return false;
    pending.current = true; setSaving(true); setError('');
    try {
      if (userId) {
        await api('/progress/kanji', { kanjiId, memorized, expectedUserId: userId });
      }
      if (!active.current) return false;
      setMemorizedIds(ids => memorized ? [...new Set([...ids, kanjiId])] : ids.filter(id => id !== kanjiId));
      return true;
    } catch (err) {
      if (active.current) setError(`${err instanceof Error ? err.message : 'Lưu thất bại.'} Thẻ này chưa được xác nhận lưu; hãy thử lại.`);
      return false;
    } finally {
      pending.current = false;
      if (active.current) setSaving(false);
    }
  }
  return { memorizedIds, loading, loaded, saving, error, reload, save };
}
