import type { JlptQuestion } from '@nihongo/shared/contracts/jlpt';
import { button, input, OrderButtons } from './ui';
import { moveJlptItem } from './jlpt-editor-data';

export function JlptTestEditor({ questions, onChange }: { questions: JlptQuestion[]; onChange: (value: JlptQuestion[]) => void }) {
  const patch = (id: string, value: Partial<JlptQuestion>) => onChange(questions.map(q => q.id === id ? { ...q, ...value } : q));
  return <details className="mt-5 border-t border-slate-200 pt-4">
    <summary className="cursor-pointer font-semibold">Bài kiểm tra cuối buổi · {questions.length} câu</summary>
    <p className="my-3 text-xs text-slate-500">Ít nhất 5 câu khi xuất bản. Bốn lựa chọn khác nhau, một đáp án đúng. Giải thích chỉ hiện sau khi nộp bài.</p>
    <div className="space-y-4">{questions.map((q, i) => <section key={q.id} className="rounded-lg border border-slate-200 p-4" aria-label={`Câu kiểm tra ${i + 1}`}>
      <div className="flex items-center justify-between gap-2"><strong>Câu {i + 1}</strong><div className="flex gap-2"><OrderButtons index={i} length={questions.length} label={`câu ${i + 1}`} onMove={offset => onChange(moveJlptItem(questions, i, offset))} /><button className={button} onClick={() => onChange(questions.filter(item => item.id !== q.id))}>Bỏ câu</button></div></div>
      <label className="mt-3 block text-sm">Đoạn văn (nếu có)<textarea className={input} maxLength={3000} rows={2} value={q.passage} onChange={e => patch(q.id, { passage: e.target.value })} /></label>
      <label className="mt-3 block text-sm">Câu hỏi<textarea className={input} maxLength={1500} rows={2} value={q.prompt} onChange={e => patch(q.id, { prompt: e.target.value })} /></label>
      <div className="grid gap-3 sm:grid-cols-2">{q.options.map((option, oi) => <label key={oi} className="mt-3 text-sm">Lựa chọn {oi + 1}<input className={input} maxLength={500} value={option} onChange={e => patch(q.id, { options: q.options.map((old, index) => index === oi ? e.target.value : old) })} /></label>)}</div>
      <label className="mt-3 block text-sm">Đáp án đúng<select className={input} value={q.correctIndex} onChange={e => patch(q.id, { correctIndex: Number(e.target.value) })}>{q.options.map((_, oi) => <option key={oi} value={oi}>Lựa chọn {oi + 1}</option>)}</select></label>
      <label className="mt-3 block text-sm">Giải thích đáp án<textarea className={input} maxLength={2000} rows={2} value={q.explanation} onChange={e => patch(q.id, { explanation: e.target.value })} /></label>
    </section>)}</div>
    <button className={`${button} mt-3`} disabled={questions.length >= 100} onClick={() => onChange([...questions, { id: crypto.randomUUID(), prompt: '', passage: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' }])}>Thêm câu hỏi</button>
  </details>;
}
