import { useEffect, useRef, useState } from 'react';
import type { JlptAttemptView } from '@nihongo/shared/contracts/jlpt';
import { api } from '@nihongo/client/api';
import { RoughCard } from '../../../shared/ui/RoughCard';
import { useAccountResource } from '../../../shared/hooks/useAccountResource';

export function JlptTest({ id, userId, authBusy, onBack, onRetry, onSubmitted }: { id: string; userId: string; authBusy: boolean; onBack: () => void; onRetry: (sessionId: string) => void; onSubmitted: () => void }) {
  const store = useAccountResource<{userId: string; attempt: JlptAttemptView}>(`/jlpt/study/attempts/${id}`, userId, authBusy);
  const [attempt, setAttempt] = useState<JlptAttemptView | null>(null), [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false), live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => { if (store.data) { setAttempt(store.data.attempt); setAnswers(store.data.attempt.answers); } }, [store.data]);
  const dirty = !!attempt && JSON.stringify(answers) !== JSON.stringify(attempt.answers);
  useEffect(() => { if (!dirty) return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  async function save(next: Record<string, number>, submit = false) {
    if (!attempt || locked.current || authBusy) return;
    locked.current = true; setBusy(true); setError(''); setAnswers(next);
    try {
      const response = await api<{userId: string; attempt: JlptAttemptView}>(`/jlpt/study/attempts/${id}/${submit ? 'submit' : 'save'}`, { expectedUserId: userId, version: attempt.version, answers: next });
      if (!live.current) return;
      if (response.userId !== userId) throw new Error('Tài khoản đã thay đổi.');
      setAttempt(response.attempt); setAnswers(response.attempt.answers); if (response.attempt.submittedAt) onSubmitted();
    } catch (err) { if (live.current) setError(err instanceof Error ? err.message : 'Chưa lưu được bài.'); }
    finally { locked.current = false; if (live.current) setBusy(false); }
  }
  if (!attempt) return <div><p>{store.error || 'Đang tải bài kiểm tra…'}</p>{store.error && <button onClick={() => void store.reload()}>Thử lại</button>}<button className="ml-3 underline" onClick={onBack}>Về lộ trình</button></div>;
  const submitted = !!attempt.submittedAt, complete = attempt.questions.every(q => answers[q.id] !== undefined);
  return <div className="space-y-5">
    <button className="text-sm text-blue-600" onClick={onBack} disabled={busy || dirty}>← Về buổi học</button>
    <h1 className="text-2xl font-black font-sketch">{attempt.sessionTitle} — Kiểm tra cuối buổi</h1>
    <p className="text-sm">{attempt.questions.length} câu · Đạt từ {attempt.passPercent}% · {Object.keys(answers).length}/{attempt.questions.length} câu đã trả lời</p>
    {submitted && <RoughCard className="p-5" fill={attempt.passed ? '#ecfdf5' : '#fff7ed'}><p className="text-xl font-bold">{attempt.passed ? 'Đã đạt' : 'Chưa đạt'} · {attempt.correctCount}/{attempt.questions.length} · {attempt.score?.toFixed(1)}%</p><p className="mt-2 text-sm">{attempt.passed ? 'Mốc hoàn thành được giữ khi học lại. Bạn có thể tiếp tục buổi kế tiếp.' : 'Bạn có thể xem giải thích và làm lượt mới. Điểm cao nhất được giữ.'}</p><button className="mt-3 rounded-lg border px-4 py-2" onClick={() => onRetry(attempt.sessionId)}>Làm lượt mới</button></RoughCard>}
    {error && <div role="alert" className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800">{error} <button className="underline" onClick={() => void save(answers)} disabled={busy}>Thử lưu lại</button> · <button className="underline" disabled={busy} onClick={() => void store.reload()}>Tải bản đã lưu</button></div>}
    <fieldset disabled={busy || authBusy || submitted} className="space-y-4">
      {attempt.questions.map((q, i) => <RoughCard key={q.id} className="p-5 space-y-3">
        {q.passage && <p className="whitespace-pre-wrap rounded-lg bg-stone-100 p-4 leading-8" lang="ja">{q.passage}</p>}
        <h2 className="font-bold">{i + 1}. {q.prompt}</h2>
        <div className="grid gap-2 sm:grid-cols-2">{q.options.map((option, oi) => <label key={oi} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${answers[q.id] === oi ? 'border-blue-500 bg-blue-50' : 'border-stone-300'}`}><input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => void save({ ...answers, [q.id]: oi })} />{option}</label>)}</div>
        {submitted && <div className={`text-sm ${answers[q.id] === q.correctIndex ? 'text-green-700' : 'text-red-700'}`}><strong>{answers[q.id] === q.correctIndex ? 'Đúng' : 'Chưa đúng'} · Đáp án: {q.options[q.correctIndex!]}</strong><p className="mt-2 text-stone-600">{q.explanation}</p></div>}
      </RoughCard>)}
    </fieldset>
    {!submitted && <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t bg-[#fdfaf2] p-4"><button className="rounded-lg bg-blue-500 px-5 py-2 font-bold text-white disabled:opacity-50" disabled={busy || authBusy || !complete} onClick={() => void save(answers, true)}>{busy ? 'Đang lưu…' : 'Nộp bài'}</button><span role="status" className="text-xs">{busy ? 'Đang lưu đáp án lên máy chủ' : dirty ? 'Có đáp án chưa lưu' : 'Đáp án đã lưu; F5 có thể tiếp tục.'}</span></div>}
  </div>;
}
