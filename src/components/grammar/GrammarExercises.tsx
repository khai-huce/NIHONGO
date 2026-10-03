import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Eye, Lightbulb, RotateCcw, Sparkles, Star, X } from 'lucide-react';
import { RoughButton, RoughCard } from '../RoughCard';
import { GrammarBack, GrammarNotice, GrammarText } from './GrammarContent';
import { useCurriculum } from '../../hooks/useCurriculum';
import { useLearningSettings } from '../../hooks/useLearningSettings';
import { useReview } from '../../hooks/useReview';
import { ApiError } from '../../utils/api';
import { grammarPatternPath, type GrammarAnswerResult, type GrammarExerciseKind, type GrammarProgress, type GrammarPublicExercise, type GrammarPublicPattern, type GrammarStudyResponse } from '../../utils/grammar';

const tabs: { kind: GrammarExerciseKind; label: string }[] = [{ kind: 'vi-ja', label: 'Việt → Nhật' }, { kind: 'ja-vi', label: 'Nhật → Việt' }, { kind: 'arrange', label: 'Sắp xếp ★' }];
const emptyProgress = (): GrammarProgress => ({ version: 0, completedAt: null, answers: {} });
async function studyRequest(path: string, body: unknown): Promise<GrammarStudyResponse> {
  let response: Response;
  try { response = await fetch(`/api${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) }); }
  catch { throw new ApiError(0, 'NETWORK_ERROR', 'Chưa nhận được xác nhận máy chủ. Bản dịch được giữ; hãy thử lại để lấy kết quả.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new ApiError(response.status, data?.error?.code ?? 'SERVER_ERROR', data?.error?.message ?? 'Chưa tải được kết quả.');
  return data;
}

export function GrammarExercises({ pattern, userId, authBusy }: { pattern: GrammarPublicPattern; userId: string | null; authBusy: boolean }) {
  const [tab, setTab] = useState<GrammarExerciseKind>('vi-ja');
  const store = useCurriculum<GrammarStudyResponse>(`/grammar/patterns/${pattern.id}/progress`, userId, authBusy);
  const [progress, setProgress] = useState<GrammarProgress>(emptyProgress), [results, setResults] = useState<Record<string, GrammarAnswerResult>>({});
  const [busy, setBusy] = useState(''), [errors, setErrors] = useState<Record<string, string>>({});
  const mounted = useRef(false), locked = useRef(false), current = useRef(progress), requests = useRef(new Map<string, string>());
  const settings = useLearningSettings(), review = useReview();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (store.data) { current.current = store.data.progress; setProgress(store.data.progress); setResults(store.data.progress.answers); } }, [store.data]);
  const answered = pattern.exercises.filter(exercise => !!progress.answers[exercise.id]);
  const correct = answered.filter(exercise => progress.answers[exercise.id]?.correct).length;
  async function submit(exercise: GrammarPublicExercise, action: 'check' | 'reveal' | 'ai', answer: string | number[]) {
    if (locked.current || authBusy || store.loading || !store.data || store.error) return false;
    if (action === 'ai' && !userId) { review.onLogin(); return false; }
    locked.current = true; setBusy(`${exercise.id}:${action}`); setErrors(old => ({ ...old, [exercise.id]: '' }));
    const key = JSON.stringify([exercise.id, action, answer, pattern.version, current.current.version]);
    const requestId = requests.current.get(key) ?? crypto.randomUUID(); requests.current.set(key, requestId);
    try {
      const result = await studyRequest(`/grammar/patterns/${pattern.id}/${action}`, { id: requestId, expectedUserId: userId, patternVersion: pattern.version, progressVersion: current.current.version, exerciseId: exercise.id, answer });
      if (!mounted.current) return false;
      if (result.userId !== userId || !result.result) throw new ApiError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
      const graded = result.result;
      const first = { ...current.current.answers, ...(!current.current.answers[exercise.id] ? { [exercise.id]: graded } : {}) };
      const next = userId ? result.progress : { ...current.current, answers: first, completedAt: current.current.completedAt ?? (pattern.exercises.every(item => first[item.id]) ? new Date().toISOString() : null) };
      current.current = next; setProgress(next); setResults(old => ({ ...old, [exercise.id]: graded })); requests.current.delete(key);
      return true;
    } catch (error) {
      if (mounted.current) {
        setErrors(old => ({ ...old, [exercise.id]: error instanceof Error ? error.message : 'Chưa lưu được câu trả lời.' }));
        if (error instanceof ApiError && !['NETWORK_ERROR', 'AI_BUSY'].includes(error.code)) requests.current.delete(key);
        if (error instanceof ApiError && error.code === 'GRAMMAR_CHANGED') void store.reload();
      }
      return false;
    } finally { locked.current = false; if (mounted.current) setBusy(''); }
  }
  return <div className="mx-auto min-h-full max-w-5xl space-y-5 p-4 md:p-8" data-furigana={settings.showFurigana}>
    <header><GrammarBack to={grammarPatternPath(pattern.id)}>Quay lại mẫu ngữ pháp</GrammarBack><p className="text-[11px] text-slate-500">{pattern.courseTitle} · {pattern.lessonTitle}</p><h1 className="mt-2 font-japanese text-3xl font-black">{pattern.pattern}</h1><p className="mt-2 text-sm text-slate-600">{pattern.meaning}</p><p className="mt-3 text-xs leading-6 text-slate-500">Bài tập gồm {pattern.exercises.filter(e => e.kind === 'vi-ja').length} câu Việt → Nhật, {pattern.exercises.filter(e => e.kind === 'ja-vi').length} câu Nhật → Việt và {pattern.exercises.filter(e => e.kind === 'arrange').length} câu sắp xếp ★ tập trung vào mẫu này.</p><span className="mt-2 inline-block rounded-full border-2 border-stone-500 px-3 py-1 text-[11px] font-bold">Đã trả lời {answered.length}/{pattern.exercises.length} câu · Đúng {correct} · Sai/đã xem {answered.length - correct}{progress.completedAt ? ' · Đã hoàn thành' : ''}</span></header>
    <GrammarNotice {...store} />
    {!userId && <p className="text-xs text-stone-500">Khách chỉ giữ kết quả trong lượt đang mở. Đăng nhập để lưu tiến độ và dùng Gemini.</p>}
    <div role="tablist" aria-label="Dạng bài tập" className="flex flex-wrap border-b border-slate-300">{tabs.map(item => <button key={item.kind} role="tab" type="button" aria-selected={tab === item.kind} className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs ${tab === item.kind ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`} onClick={() => setTab(item.kind)}>{item.kind === 'arrange' ? <Sparkles size={15} /> : <ArrowLeftRight size={15} />}{item.label}<span className="rounded-full border border-stone-400 px-1.5">{pattern.exercises.filter(e => e.kind === item.kind).length}</span></button>)}</div>
    {tab !== 'arrange' && <RoughCard className="px-4 py-3 text-xs leading-6 text-blue-700">Đọc câu {tab === 'vi-ja' ? 'tiếng Việt, gõ bản dịch tiếng Nhật' : 'tiếng Nhật, gõ bản dịch tiếng Việt'} vào ô bên dưới. Nhấn “Kiểm tra” để so với đáp án mẫu, hoặc “AI đánh giá” để Gemini chấm điểm + góp ý.</RoughCard>}
    <p className="text-[11px] text-slate-500">Lần chấm thành công đầu tiên quyết định điểm. Xem đáp án trước không tính đúng; thử lại chỉ luyện thêm.</p>
    {pattern.exercises.map((exercise, index) => <div key={exercise.id} hidden={exercise.kind !== tab}><ExerciseQuestion exercise={exercise} index={pattern.exercises.slice(0, index).filter(item => item.kind === exercise.kind).length} pattern={pattern.pattern} patternVersion={pattern.version} first={progress.answers[exercise.id]} result={results[exercise.id]} busy={busy} disabled={authBusy || !!busy || store.loading || !!store.error || !store.data} error={errors[exercise.id]} submit={submit} /></div>)}
    {!pattern.exercises.some(e => e.kind === tab) && <RoughCard className="p-6 text-sm text-stone-500">Chưa có câu hỏi cho dạng bài tập này.</RoughCard>}
  </div>;
}

function ExerciseQuestion({ exercise, index, pattern, patternVersion, first, result, disabled, busy, error, submit }: { exercise: GrammarPublicExercise; index: number; pattern: string; patternVersion: number; first?: GrammarAnswerResult; result?: GrammarAnswerResult; disabled: boolean; busy: string; error?: string; submit: (exercise: GrammarPublicExercise, action: 'check' | 'reveal' | 'ai', answer: string | number[]) => Promise<boolean> }) {
  const [text, setText] = useState(''), [order, setOrder] = useState<number[]>([]), [hint, setHint] = useState(false), [editing, setEditing] = useState(false);
  const hydrated = useRef(false);
  useEffect(() => { if (first && !hydrated.current) { hydrated.current = true; if (!editing && first.patternVersion === patternVersion) { if (typeof first.answer === 'string') setText(first.answer); else setOrder(first.answer); } } }, [first, editing, patternVersion]);
  const arrangement = exercise.kind === 'arrange';
  const answer = arrangement ? order : text;
  const shown = editing ? undefined : result;
  const historical = shown !== undefined && shown.patternVersion !== patternVersion;
  const fire = async (action: 'check' | 'reveal' | 'ai') => { if (await submit(exercise, action, answer)) setEditing(false); };
  return <RoughCard fill="transparent" stroke="#57534e" borderRadius={10} className="p-4 md:p-5 [&>div]:space-y-4">
    <div className="flex items-start gap-3"><span className="rounded-md bg-slate-900 px-2 py-1 text-xs font-bold text-white">{index + 1}</span>{arrangement && <div><p className="font-japanese text-xs text-slate-500">{exercise.prompt}</p><p className="mt-1 text-[11px] text-slate-500">Mẫu: {pattern}</p></div>}</div>
    {arrangement ? <>
      <RoughCard className="p-4 font-japanese text-sm [&>div]:flex [&>div]:flex-wrap [&>div]:items-center [&>div]:gap-1.5"><span>{exercise.prefix}</span>{[0, 1, 2, 3].map(slot => <button key={slot} type="button" disabled={disabled || order[slot] === undefined} aria-label={`Ô ${slot + 1}${slot === exercise.starIndex ? ', vị trí ngôi sao' : ''}`} className={`relative min-h-10 min-w-14 rounded border-2 px-2 ${shown && !historical ? shown.correct ? 'text-green-700' : 'text-red-700' : ''}`} onClick={() => { setOrder(old => old.filter((_, i) => i !== slot)); setEditing(true); }}>{slot === exercise.starIndex && <Star size={13} className="absolute -left-1 -top-3 fill-orange-500 text-orange-500" />}{order[slot] === undefined ? '' : exercise.tokens[order[slot]]}</button>)}<span>{exercise.suffix}</span></RoughCard>
      <div className="grid gap-3 sm:grid-cols-2">{exercise.tokens.map((token, i) => <RoughButton key={i} disabled={disabled || order.includes(i)} onClick={() => { setOrder(old => old.length < 4 ? [...old, i] : old); setEditing(true); }} className="flex items-center gap-2 px-3 py-3 text-left font-japanese text-sm disabled:opacity-40"><span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px]">{i + 1}</span>{token}</RoughButton>)}</div>
    </> : <>
      <div><p className="mb-2 text-[10px] font-bold uppercase text-slate-500">{exercise.kind === 'vi-ja' ? 'Tiếng Việt' : '日本語'}</p><p className={`whitespace-pre-wrap text-sm leading-8 ${exercise.kind === 'ja-vi' ? 'font-japanese' : ''}`}><GrammarText text={exercise.prompt} ruby={exercise.ruby} /></p></div>
      {exercise.hint && <><button type="button" className="flex items-center gap-1 text-[11px] text-slate-500" onClick={() => setHint(old => !old)}><Lightbulb size={13} />{hint ? 'Ẩn gợi ý' : 'Hiện gợi ý'}</button>{hint && <p className="whitespace-pre-wrap text-xs text-amber-800">{exercise.hint}</p>}</>}
      <label className="block text-[10px] font-bold uppercase text-slate-500">Bản dịch của bạn ({exercise.kind === 'vi-ja' ? '日本語' : 'Tiếng Việt'})<textarea disabled={disabled} maxLength={2000} rows={3} value={text} onChange={event => { setText(event.target.value); setEditing(true); }} className={`mt-2 block w-full resize-y rounded-lg border-2 border-stone-500 bg-transparent p-3 text-sm font-normal normal-case text-stone-800 focus:outline-blue-400 ${exercise.kind === 'vi-ja' ? 'font-japanese' : ''}`} placeholder={`Gõ bản dịch ${exercise.kind === 'vi-ja' ? 'tiếng Nhật' : 'tiếng Việt'} ở đây…`} /></label>
    </>}
    <div className="flex flex-wrap items-center gap-3">{arrangement && <button type="button" disabled={disabled} className="mr-auto flex items-center gap-1 text-xs text-slate-500" onClick={() => { setOrder([]); setEditing(true); }}><RotateCcw size={13} />Reset</button>}<RoughButton fill="#7dc9f1" stroke="#78716c" disabled={disabled || (arrangement ? order.length !== 4 : !text.trim())} onClick={() => void fire('check')} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Check size={14} />{busy === `${exercise.id}:check` ? 'Đang kiểm tra…' : 'Kiểm tra'}</RoughButton>{!arrangement && <><RoughButton disabled={disabled || !text.trim()} onClick={() => void fire('ai')} className="flex items-center gap-2 px-3 py-2 text-xs text-stone-500 disabled:opacity-50"><Sparkles size={14} />{busy === `${exercise.id}:ai` ? 'Gemini đang chấm…' : 'AI đánh giá'}</RoughButton><button type="button" disabled={disabled} onClick={() => void fire('reveal')} className="flex items-center gap-1 text-xs text-slate-500 disabled:opacity-50"><Eye size={14} />Xem đáp án</button></>}</div>
    {error && <p role="alert" className="text-xs leading-6 text-red-700">{error}</p>}
    {shown && <RoughCard fill={shown.correct ? '#f0fdf4' : '#fffaf0'} stroke={shown.correct ? '#86a78f' : '#a8a29e'} className="p-3 text-xs leading-6 [&>div]:space-y-2"><p className={`flex items-center gap-1 font-bold ${shown.correct ? 'text-green-700' : 'text-red-700'}`}>{shown.correct ? <Check size={14} /> : <X size={14} />}{shown.action === 'reveal' ? 'Đã xem đáp án' : shown.correct ? 'Chính xác!' : arrangement ? 'Chưa đúng' : shown.action === 'ai' ? 'Gemini: cần sửa bản dịch' : 'Chưa khớp đáp án mẫu'}{shown.action === 'ai' && shown.correct ? ' · Gemini' : ''}</p>{historical && <p className="text-slate-500">Kết quả đã lưu ở phiên bản nội dung trước. Điểm được giữ; làm lại chỉ luyện thêm.</p>}{arrangement && !historical && <><p>Câu trả lời ★ của bạn: {Array.isArray(shown.answer) && shown.answer[exercise.starIndex] !== undefined ? `${shown.answer[exercise.starIndex] + 1} (${exercise.tokens[shown.answer[exercise.starIndex]]})` : 'Chưa chọn'}</p><p>Đáp án đúng tại ★: {shown.starAnswer} ({exercise.tokens[shown.correctOrder[exercise.starIndex]]})</p></>}<p className="whitespace-pre-wrap">{arrangement ? 'Câu hoàn chỉnh' : 'Đáp án mẫu'}: <span className={exercise.kind !== 'ja-vi' ? 'font-japanese' : ''}>{shown.modelAnswer}</span></p>{shown.translation && <p>{shown.translation}</p>}{shown.explanation && <p className="whitespace-pre-wrap border-t border-stone-200 pt-2">{shown.explanation}</p>}{shown.ai && <><p className="whitespace-pre-wrap">{shown.ai.feedback}</p><p>Gợi ý sửa: {shown.ai.suggestedAnswer}</p></>}{first && shown.checkedAt !== first.checkedAt && <p className="text-slate-500">Kết quả luyện thêm. Điểm lần đầu được giữ nguyên.</p>}</RoughCard>}
  </RoughCard>;
}
