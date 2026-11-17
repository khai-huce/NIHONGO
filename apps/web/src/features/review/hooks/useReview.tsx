import { useToast, useToastFeedback } from '@nihongo/client/toast';
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@nihongo/client/api';

export type ReviewCategory = 'kanji' | 'vocab' | 'grammar';
export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type ReviewSource = { category: ReviewCategory; sourceId: string; front: string; back: string; reading?: string; hint?: string };
export type ReviewCard = ReviewSource & { id: string; active: boolean; dueAt: string; intervalSeconds: number; reviewCount: number; version: number };
type Stats = { category: ReviewCategory; total: number; today: number; week: number; month: number; streak: number; averagePerDay: number; averageMs: number; distribution: Record<Rating, number>; daily: {day: string; count: number}[] };
type ReviewData = { userId: string; cards: ReviewCard[]; stats: Stats[]; serverNow: string };
type Store = { userId: string | null; cards: ReviewCard[]; stats: Stats[]; loading: boolean; loaded: boolean; busy: boolean; error: string; clockOffset: number;
  reload: () => Promise<void>; toggle: (source: ReviewSource) => Promise<boolean>; rate: (card: ReviewCard, rating: Rating, elapsedMs: number) => Promise<boolean>; reset: (category: ReviewCategory, expectedCount: number) => Promise<boolean>; onLogin: () => void };
const Context = createContext<Store | null>(null);
export function ReviewProvider({ userId, authBusy, onLogin, children }: { userId: string | null; authBusy: boolean; onLogin: () => void; children: ReactNode }) {
  const [cards, setCards] = useState<ReviewCard[]>([]), [stats, setStats] = useState<Stats[]>([]);
  const [loading, setLoading] = useState(!!userId), [loaded, setLoaded] = useState(!userId), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const toast = useToast();
  useToastFeedback({ error });
  const [clockOffset, setClockOffset] = useState(0);
  const active = useRef(false), pending = useRef(false), revision = useRef(0);
  const reload = useCallback(async () => {
    if (!userId || pending.current) return;
    const version = ++revision.current; setLoading(true); setError('');
    try {
      const data = await api<ReviewData>('/review');
      if (!active.current || version !== revision.current) return;
      if (data.userId !== userId) throw new Error('Tài khoản đã đổi. Vui lòng tải lại trang.');
      setCards(data.cards); setStats(data.stats); setClockOffset(Date.parse(data.serverNow) - Date.now()); setLoaded(true);
    } catch (err) { if (active.current && version === revision.current) { setError(err instanceof Error ? err.message : 'Chưa tải được danh sách ôn.'); setLoaded(false); } }
    finally { if (active.current && version === revision.current) setLoading(false); }
  }, [userId]);
  useEffect(() => { active.current = true; void reload(); return () => { active.current = false; ++revision.current; }; }, [reload]);
  async function mutate(path: string, body: unknown) {
    if (!userId) { onLogin(); return false; }
    if (pending.current || loading || !loaded || authBusy) return false;
    pending.current = true; ++revision.current; setSaving(true); setError('');
    try {
      const result = await api<{card?: ReviewCard}>(path, body);
      if (!active.current) return false;
      const card = result.card;
      if (card) setCards(previous => [...previous.filter(item => item.id !== card.id), card]);
      return true;
    } catch (err) { if (active.current) setError(err instanceof Error ? err.message : 'Chưa lưu được thao tác.'); return false; }
    finally { pending.current = false; if (active.current) setSaving(false); }
  }
  async function toggle(source: ReviewSource) {
    const existing = cards.find(card => card.category === source.category && card.sourceId === source.sourceId);
    const success = await mutate('/review/star', { ...source, active: !existing?.active, expectedUserId: userId });
    if (success) toast.success(existing?.active ? 'Đã bỏ sao. Lịch ôn và lịch sử vẫn được giữ.' : 'Đã thêm vào Ôn tập.');
    return success;
  }
  async function rate(card: ReviewCard, rating: Rating, elapsedMs: number) {
    const success = await mutate('/review/rate', { id: card.id, version: card.version, rating, elapsedMs: Math.min(3600000, Math.max(0, Math.round(elapsedMs))), expectedUserId: userId });
    if (success) void reload();
    return success;
  }
  async function reset(category: ReviewCategory, expectedCount: number) {
    const success = await mutate('/review/reset', { category, expectedCount, expectedUserId: userId });
    if (success) { toast.success('Đã đặt lại lịch ôn của các thẻ đang gắn sao.'); await reload(); }
    return success;
  }
  return <Context.Provider value={{ userId, cards, stats, loading, loaded, busy: authBusy || saving || loading || (!!userId && !loaded), error, clockOffset, reload, toggle, rate, reset, onLogin }}>
    {error && <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-[90%] p-3 rounded-xl bg-red-50 border border-red-300 text-red-900 text-sm shadow-lg">{error} <button className="underline font-bold" disabled={saving || loading} onClick={() => void reload()}>Tải lại danh sách ôn</button></div>}
    {children}
  </Context.Provider>;
}
export function useReview() { const value = useContext(Context); if (!value) throw new Error('ReviewProvider missing'); return value; }
