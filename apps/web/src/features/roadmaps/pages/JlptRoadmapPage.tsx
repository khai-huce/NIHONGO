import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { JlptRoadmapSummary, JlptRoadmapView, JlptStudy, JlptAttemptView } from '@nihongo/shared/contracts/jlpt';
import { api } from '@nihongo/client/api';
import { JlptTest } from '../components/JlptTest';
import { RoughCard } from '../../../shared/ui/RoughCard';
import { useAccountResource } from '../../../shared/hooks/useAccountResource';
import { JlptRoadmapOverview } from '../components/JlptRoadmapOverview';
import { JlptRoadmapDetail } from '../components/JlptRoadmapDetail';
import { jlptLevelQuery, parseJlptLevel, parseJlptId } from '../utils/jlpt-catalog';

export function JlptRoadmapPage({ userId, authBusy, onLogin }: { userId: string | null; authBusy: boolean; onLogin: () => void }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate(), locked = useRef(false), live = useRef(true);
  const [busy, setBusy] = useState(false), [writeError, setWriteError] = useState('');
  const [historyId, setHistoryId] = useState<string | null>(null), [historyPage, setHistoryPage] = useState(1);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const selectedLevel = parseJlptLevel(params.get('level'));
  const routeKey = `${userId}:${params.toString()}`, routeContext = useRef(routeKey);
  routeContext.current = routeKey;
  useEffect(() => { setHistoryId(null); setWriteError(''); }, [selectedLevel]);
  const invalidLevel = params.has('level') && !selectedLevel;
  const overview = useAccountResource<{ items: JlptRoadmapSummary[] }>(invalidLevel ? null : '/jlpt/roadmaps', null);
  const exists = overview.data?.items.some(item => item.level === selectedLevel) ?? false;
  const detail = useAccountResource<{ roadmap: JlptRoadmapView }>(selectedLevel && exists ? `/jlpt/roadmaps/${selectedLevel}` : null, null);
  const overviewReady = !!overview.data && !overview.loading && !overview.error;
  const active = selectedLevel && overviewReady && exists ? detail : overview;
  const roadmap = detail.data?.roadmap.level === selectedLevel ? detail.data.roadmap : null;
  const study = useAccountResource<JlptStudy>(userId && selectedLevel && exists ? `/jlpt/study/roadmaps/${selectedLevel}` : null, userId, authBusy);
  const history = useAccountResource<{ userId: string; total: number; items: Array<{id: string; submittedAt: string; score: number; passed: boolean; passPercent: number}> }>(userId && historyId ? `/jlpt/study/sessions/${historyId}/attempts?page=${historyPage}` : null, userId, authBusy);
  const attemptId = parseJlptId(params.get('attempt')), validAttempt = !!attemptId;
  const reloadCatalog = () => { void overview.reload(); void detail.reload(); void study.reload(); };
  const back = () => { const next = new URLSearchParams(params); next.delete('attempt'); setParams(next); reloadCatalog(); };
  async function openSession(id: string, href?: string, test = false) {
    if (!userId) { onLogin(); return; }
    if (locked.current || authBusy || !roadmap) return;
    const requestContext = routeContext.current;
    locked.current = true; setBusy(true); setWriteError('');
    try {
      const base = `/jlpt/study/roadmaps/${roadmap.level}/sessions/${id}`;
      if (test) {
        const value = await api<{userId: string; attempt: JlptAttemptView}>(`${base}/attempts`, { expectedUserId: userId, publishedVersion: roadmap.publishedVersion, id: crypto.randomUUID() });
        if (!live.current || routeContext.current !== requestContext) return;
        if (value.userId !== userId) throw new Error('Tài khoản đã thay đổi.');
        setParams({ level: roadmap.level, session: id, attempt: value.attempt.id });
      } else {
        const value = await api<JlptStudy>(`${base}/open`, { expectedUserId: userId, publishedVersion: roadmap.publishedVersion });
        if (!live.current || routeContext.current !== requestContext) return;
        if (value.userId !== userId) throw new Error('Tài khoản đã thay đổi.');
        if (href) navigate(href); else setParams({ level: roadmap.level, session: id });
      }
    } catch (err) { if (live.current && routeContext.current === requestContext) setWriteError(err instanceof Error ? err.message : 'Chưa mở được buổi.'); }
    finally { locked.current = false; if (live.current) { setBusy(false); void study.reload(); } }
  }
  let content: ReactNode;
  if (invalidLevel) {
    content = <RoughCard className="p-6 text-sm text-stone-600">Cấp độ không hợp lệ. Hãy chọn một cấp độ từ N5 đến N1.</RoughCard>;
  } else if (!selectedLevel) {
    content = <JlptRoadmapOverview items={overview.data?.items ?? []} ready={overviewReady} loading={overview.loading} userId={userId} authBusy={authBusy} />;
  } else if (overviewReady && !exists) {
    content = <RoughCard className="p-6 text-sm text-stone-600">
      <h1 className="text-xl font-black font-sketch text-[#292524]">Lộ trình học {selectedLevel}</h1>
      <p className="mt-3">Chưa có lộ trình {selectedLevel} được xuất bản.</p>
      <p className="mt-2">Các buổi học sẽ xuất hiện khi nội dung đã được quản trị viên rà soát và xuất bản.</p>
      <button type="button" onClick={() => void overview.reload()} className="mt-3 text-blue-600 font-bold underline">Tải lại</button>
    </RoughCard>;
  } else if (validAttempt && attemptId && userId) {
    content = <JlptTest key={`${userId}:${attemptId}`} id={attemptId} userId={userId} authBusy={authBusy} onBack={back} onRetry={id => void openSession(id, undefined, true)} onSubmitted={() => void study.reload()} />;
  } else if (roadmap && !active.error) {
    content = <JlptRoadmapDetail key={`${roadmap.id}:${roadmap.publishedVersion}:${study.data?.resumeSessionId ?? ''}`} level={selectedLevel} roadmap={roadmap} study={study.data} busy={busy || authBusy || (!!userId && (study.loading || !!study.error))} selectedSession={params.get('session')} onOpen={(id, href) => void openSession(id, href)} onTest={id => void openSession(id, undefined, true)} onHistory={id => { setHistoryId(id); setHistoryPage(1); }} />;
  }

  return <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-6 max-w-5xl mx-auto overflow-y-auto select-none">
    {selectedLevel && !authBusy && !userId && <p className="text-sm">Đăng nhập để bắt đầu kiểm tra và lưu tiến độ. <button className="font-bold text-blue-600 underline" onClick={onLogin}>Đăng nhập</button></p>}
    {(writeError || study.error) && <div role="alert" className="rounded-lg bg-orange-50 p-3 text-sm">{writeError || study.error} <button className="underline" onClick={() => { setWriteError(''); reloadCatalog(); }}>Tải lại</button></div>}
    {historyId && <RoughCard className="p-5 space-y-3"><div className="flex justify-between"><h2 className="font-bold">Lịch sử kiểm tra</h2><button onClick={() => setHistoryId(null)}>Đóng</button></div>{history.error && <p>{history.error} <button onClick={() => void history.reload()}>Thử lại</button></p>}{history.loading && <p>Đang tải…</p>}{history.data?.items.map(item => <button key={item.id} className="block w-full rounded border p-3 text-left text-sm" onClick={() => { setHistoryId(null); setParams({ level: selectedLevel!, session: historyId, attempt: item.id }); }}>{new Date(item.submittedAt).toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'})} · {item.score.toFixed(1)}% · {item.passed ? 'Đạt' : 'Chưa đạt'} (mức {item.passPercent}%)</button>)}<div className="flex gap-3"><button disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>Trang trước</button><span>Trang {historyPage}</span><button disabled={!history.data || historyPage * 20 >= history.data.total} onClick={() => setHistoryPage(p => p + 1)}>Trang sau</button></div></RoughCard>}
    {(selectedLevel || invalidLevel) && !validAttempt && <button type="button" disabled={busy} onClick={() => setParams(jlptLevelQuery(params, null))} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">
      <ChevronLeft className="w-4 h-4" /><span>Tất cả cấp độ</span>
    </button>}
    {!invalidLevel && active.loading && <p role="status" className="text-sm text-stone-500">Đang tải lộ trình{selectedLevel ? ` ${selectedLevel}` : ''}…</p>}
    {!invalidLevel && active.error && <RoughCard fill="#fff7ed" className="p-4"><div role="alert" className="text-sm text-amber-800">
      {active.error} <button type="button" onClick={() => void active.reload()} className="font-bold underline">Thử lại</button>
    </div></RoughCard>}
    {content}
  </div>;
}
