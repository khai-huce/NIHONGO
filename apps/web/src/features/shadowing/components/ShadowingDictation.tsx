import { useRef, useState } from 'react';
import { AlertTriangle, ChevronRight, Puzzle, RotateCcw, Type, XCircle } from 'lucide-react';
import type { ShadowingGrade, ShadowingMode, ShadowingSentence } from '@nihongo/shared/contracts/shadowing';
import { RoughCard } from '../../../shared/ui/RoughCard';
import { shuffledIndices } from '../lib/shadowing-api';
import { matchingGrade } from '../lib/shadowing-study';
export function ShadowingDictation({ sentence, mode, onMode, grades, replays, check, onNext, isLast }: {
  sentence: ShadowingSentence; mode: ShadowingMode; onMode: (mode: ShadowingMode) => void;
  grades: ShadowingGrade[]; replays: number; check: (mode: ShadowingMode, answer: string | number[], hinted: boolean, requestId: string) => Promise<ShadowingGrade>;
  onNext: () => void; isLast: boolean;
}) {
  const saved = matchingGrade(grades, sentence, mode);
  const [answer, setAnswer] = useState(typeof saved?.answer === 'string' ? saved.answer : '');
  const [selected, setSelected] = useState<number[]>(Array.isArray(saved?.answer) ? saved.answer : []);
  const [order] = useState(() => shuffledIndices(sentence.tokens.length));
  const [feedback, setFeedback] = useState<ShadowingGrade | null>(saved ?? null);
  const [hints, setHints] = useState<number[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const submit = async () => {
    if (busy) return;
    const value = mode === 'typing' ? answer : selected;
    const payload = JSON.stringify([value, hints.length > 0]);
    if (!attempt.current || attempt.current.payload !== payload) attempt.current = { payload, id: crypto.randomUUID() };
    setBusy(true); setError('');
    try { setFeedback(await check(mode, value, hints.length > 0, attempt.current.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa kiểm tra được câu trả lời.'); }
    finally { setBusy(false); }
  };
  const retry = () => { setFeedback(null); setAnswer(''); setSelected([]); setHints([]); attempt.current = null; setError(''); };
  const errors = feedback?.errors ?? 0;
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-stone-700 bg-white p-1">
      {([['typing', 'Gõ chính tả', Type], ['puzzle', 'Ghép câu', Puzzle]] as const).map(([value, label, Icon]) => <button type="button" key={value} disabled={busy} onClick={() => onMode(value)} className={`py-2 text-xs font-black rounded-lg flex items-center justify-center gap-2 ${mode === value ? 'bg-blue-600 text-white' : 'text-stone-600'}`}><Icon size={15} />{label}</button>)}
    </div>
    <p className="text-[11px] font-bold text-stone-500 uppercase">{mode === 'typing' ? 'GÕ NHỮNG GÌ BẠN NGHE ĐƯỢC:' : 'CHẠM CÁC MẢNH ĐỂ GHÉP THÀNH CÂU BẠN NGHE ĐƯỢC:'}</p>
    {mode === 'typing' ? <>
      <textarea aria-label="Câu trả lời chính tả" rows={4} disabled={busy || !!feedback} value={answer} onChange={event => setAnswer(event.target.value)} placeholder="Gõ câu trả lời của bạn tại đây..." className="font-kanji w-full p-3 rounded-xl border-2 border-stone-700 bg-white" />
      {!feedback && <div className="flex flex-wrap gap-1.5">{sentence.tokens.map((token, index) => <button key={index} type="button" disabled={busy} onClick={() => setHints(old => old.includes(index) ? old : [...old, index])} className="rounded border border-stone-400 px-2 py-1 text-xs font-kanji">{hints.includes(index) ? token.text : `Gợi ý ${index + 1}`}</button>)}</div>}
    </> : <>
      <RoughCard className="p-3 min-h-[70px] shadow-xs" fill="#ffffff" borderRadius={10}><div className="flex flex-wrap gap-2">
        {sentence.tokens.map((_, index) => selected[index] === undefined ? <span key={index} className="w-12 h-9 rounded-lg border-2 border-stone-300 bg-stone-100" /> : <button key={index} type="button" disabled={busy || !!feedback} onClick={() => setSelected(old => old.filter((_, position) => position !== index))} className={`font-kanji px-3 py-1.5 rounded-lg border-2 text-sm font-bold ${feedback ? sentence.tokens[selected[index]].text === sentence.tokens[index].text ? 'border-emerald-600 text-emerald-700' : 'border-red-500 text-red-600' : 'border-stone-700 bg-white'}`}>{sentence.tokens[selected[index]].text.trim() || '␣'}</button>)}
      </div></RoughCard>
      <div className="flex flex-wrap gap-2">{order.filter(index => !selected.includes(index)).map(index => <button key={index} type="button" disabled={busy || !!feedback} onClick={() => setSelected(old => [...old, index])} className="font-kanji px-3 py-1.5 rounded-lg border border-stone-700 bg-white font-bold text-sm shadow-sketch">{sentence.tokens[index].text.trim() || '␣'}</button>)}</div>
    </>}
    {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
    {feedback && <RoughCard fill="#ffffff" borderRadius={8} className="p-3 text-sm"><p className={`font-bold ${feedback.correct ? 'text-emerald-700' : 'text-red-700'}`}>{feedback.correct ? 'Chính xác!' : 'Chưa khớp đáp án.'}</p><p className="mt-1">Đáp án đúng: <span className="font-kanji">{feedback.sentence.text}</span></p>{saved && <p className="text-xs text-stone-500 mt-2">Kết quả lần đầu: {saved.correct ? 'Đúng' : 'Chưa đúng'}. Thử lại chỉ để luyện thêm.</p>}</RoughCard>}
    {!feedback ? <button type="button" onClick={() => void submit()} disabled={busy || (mode === 'typing' ? !answer.trim() : selected.length !== sentence.tokens.length)} className="w-full py-2.5 rounded-xl bg-amber-400 font-black border-2 border-stone-700 shadow-sketch disabled:opacity-50">{busy ? 'ĐANG KIỂM TRA…' : 'KIỂM TRA ĐÁP ÁN'}</button>
      : <div className="flex gap-2"><button type="button" onClick={retry} className="rounded-xl border border-stone-700 bg-white px-3 py-2 text-sm font-bold">Luyện lại</button><button type="button" onClick={onNext} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-black border-2 border-stone-700 shadow-sketch flex justify-center items-center">{isLast ? 'KẾT THÚC' : 'TIẾP THEO'}<ChevronRight size={17} /></button></div>}
    <div className="grid grid-cols-2 gap-3 pt-2"><RoughCard fill="#ffffff" borderRadius={10} className="p-3"><p className="flex items-center gap-1 text-xs font-bold text-red-600"><XCircle size={13} />Lỗi sai</p><p className="text-2xl font-black mt-1">{errors}</p></RoughCard><RoughCard fill="#ffffff" borderRadius={10} className="p-3"><p className="flex items-center gap-1 text-xs font-bold text-stone-600"><RotateCcw size={13} />Lượt phát lại</p><p className="text-2xl font-black mt-1">{replays}</p></RoughCard></div>
    <RoughCard fill="#ffffff" borderRadius={10} className="p-3 text-xs"><p className="flex items-center gap-1 font-bold text-amber-700 mb-1"><AlertTriangle size={14} />Lý do</p><p>{!feedback ? 'Nghe câu rồi kiểm tra đáp án của bạn.' : errors ? `Bạn đã mắc ${errors} lỗi với câu này. Hãy phát lại và luyện thêm.` : 'Chưa phát hiện lỗi sai. Bạn có thể tiếp tục câu tiếp theo.'}</p></RoughCard>
  </div>;
}
