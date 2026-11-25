import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '@nihongo/client/api';
import type { JlptAttemptView, JlptRoadmapView } from '@nihongo/shared/contracts/jlpt';
import { jlptResourceHref } from '../utils/jlpt-catalog';

export function guidedSessionState(roadmap: JlptRoadmapView, sessionId: string, href: string, userId: string) {
  const session = roadmap.sessions.find(item => item.id === sessionId);
  if (!session) return undefined;
  const steps = session.resources.flatMap(resource => {
    const path = jlptResourceHref(resource);
    return path ? [{ path, title: resource.title }] : [];
  });
  return { jlptFlow: { sessionId, userId, level: roadmap.level, version: roadmap.publishedVersion,
    title: session.title, exam: session.questionCount >= 5, steps, index: steps.findIndex(step => step.path === href) } };
}

export function JlptSessionNavigation({ userId, authBusy }: { userId: string | null; authBusy: boolean }) {
  const location = useLocation(), navigate = useNavigate();
  const flow = (location.state as ReturnType<typeof guidedSessionState>)?.jlptFlow;
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false), live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  if (!flow || authBusy || !userId || flow.userId !== userId || !flow.steps[flow.index]) return null;
  const { steps, index, sessionId, level } = flow;
  const back = '/tron-doi/jlpt?' + new URLSearchParams({ level, session: sessionId });
  const go = (i: number) => navigate(steps[i].path, { state: { jlptFlow: { ...flow, index: i } } });
  const finish = async () => {
    if (!flow.exam) { navigate(back); return; }
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const result = await api<{ userId: string; attempt: JlptAttemptView }>(
        `/jlpt/study/roadmaps/${level}/sessions/${sessionId}/attempts`,
        { expectedUserId: userId, publishedVersion: flow.version, id: crypto.randomUUID() });
      if (live.current && result.userId === userId) navigate(back + '&attempt=' + result.attempt.id);
    } catch (cause) { if (live.current) setError(cause instanceof Error ? cause.message : 'Chưa mở được bài kiểm tra.'); }
    finally { locked.current = false; if (live.current) setBusy(false); }
  };
  return <nav aria-label="Điều hướng buổi JLPT" className="sticky top-0 z-20 border-b bg-white px-4 py-2 text-sm shadow-sm">
    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
      <div><button onClick={() => navigate(back)} className="text-xs text-blue-700 underline">{flow.title}</button>
        <p className="font-bold">{index + 1}/{steps.length} · {steps[index].title}</p></div>
      <div className="flex gap-2">{index > 0 && <button disabled={busy} onClick={() => go(index - 1)}>Mục trước</button>}
        <button disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 font-bold text-white" onClick={() => index + 1 < steps.length ? go(index + 1) : void finish()}>
          {index + 1 < steps.length ? 'Nội dung tiếp theo →' : flow.exam ? 'Làm bài kiểm tra →' : 'Về buổi học'}</button></div>
    </div>{error && <p role="alert" className="text-red-700">{error}</p>}
  </nav>;
}
