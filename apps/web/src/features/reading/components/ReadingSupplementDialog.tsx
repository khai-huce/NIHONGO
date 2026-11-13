import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { ReadingEvidence, ReadingSupplementLists } from '@nihongo/shared/contracts/reading-supplements';
import { RoughCard, RoughButton } from '../../../shared/ui/RoughCard';
import type { useReadingSupplements } from '../hooks/useReadingSupplements';
import { missingSupplementGroups, validateSupplementDraft } from '../lib/reading-supplements';

type Props = { state: ReturnType<typeof useReadingSupplements> };
const inputClass = 'w-full min-w-0 rounded-lg border border-amber-400 bg-amber-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60';
const fieldsetClass = 'min-w-0 rounded-xl border border-stone-300 bg-white p-3 space-y-3';
export function ReadingSupplementDialog({ state }: Props) {
  const ref = useRef<HTMLDialogElement>(null), draft = state.draft!;
  const locked = state.saving || state.uncertain || state.stale;
  const errors = validateSupplementDraft(draft.lists, draft.article, draft.kind);
  const groups = missingSupplementGroups(draft.article, draft.kind);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  const change = <K extends keyof ReadingSupplementLists>(group: K, index: number, patch: Partial<ReadingSupplementLists[K][number]>) => {
    state.edit({ ...draft.lists, [group]: draft.lists[group].map((row, i) => i === index ? { ...row, ...patch } : row) });
  };
  const remove = (group: keyof ReadingSupplementLists, index: number) => state.edit({ ...draft.lists, [group]: draft.lists[group].filter((_, i) => i !== index) });
  const field = (label: string, value: string, max: number, onChange: (value: string) => void, multiline = false) => <label className="block text-xs font-bold space-y-1"><span>{label}</span>{multiline
    ? <textarea aria-label={label} rows={3} maxLength={max} value={value} onChange={e => onChange(e.target.value)} className={inputClass} />
    : <input aria-label={label} maxLength={max} value={value} onChange={e => onChange(e.target.value)} className={inputClass} />}</label>;
  const evidence = (label: string, rows: ReadingEvidence[], onChange: (rows: ReadingEvidence[]) => void) => <div className="space-y-2 border-t border-stone-200 pt-2">
    <p className="text-xs font-bold">Căn cứ trong bài · trích nguyên văn</p>
    {rows.map((row, i) => <div key={i} className="space-y-1">
      <select aria-label={`${label} - câu dẫn chứng ${i + 1}`} className={inputClass} value={row.sentenceId} onChange={e => onChange(rows.map((r, j) => j === i ? { ...r, sentenceId: e.target.value } : r))}>
        {draft.article.paragraphs.flatMap(p => p.sentences).map(s => <option key={s.id} value={s.id}>{s.id} — {s.japanese}</option>)}
      </select>
      {field(`${label} - trích dẫn ${i + 1}`, row.quote, 1000, value => onChange(rows.map((r, j) => j === i ? { ...r, quote: value } : r)), true)}
    </div>)}
  </div>;
  const removeButton = (label: string, group: keyof ReadingSupplementLists, index: number) => <button type="button" className="text-xs text-red-700 underline" aria-label={`Bỏ ${label}`} onClick={() => remove(group, index)}>Bỏ mục này</button>;
  return <dialog ref={ref} aria-labelledby="reading-supplement-title" className="w-[calc(100%_-_2rem)] max-w-4xl max-h-[90dvh] p-0 border-0 bg-transparent text-[#292524] backdrop:bg-black/50"
    onCancel={e => { e.preventDefault(); if (!state.saving) state.close(); }} onClick={e => { if (e.target === e.currentTarget && !state.saving) state.close(); }}>
    <RoughCard fill="#fdfbf7" className="p-4 md:p-6 space-y-3 font-sketch">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 id="reading-supplement-title" className="text-lg font-black">{draft.kind === 'study' ? 'Xem trước từ vựng/ngữ pháp' : 'Xem trước câu hỏi đọc hiểu'}</h2><p className="text-sm break-words">Bài: <strong>{draft.article.title}</strong></p></div>
        <button type="button" autoFocus disabled={state.saving} aria-label="Đóng xem trước nội dung bổ trợ" onClick={state.close}><X className="w-5 h-5" /></button></div>
      <p className="text-xs">Chưa áp dụng vào bài. Sửa phần màu vàng hoặc bỏ mục chưa phù hợp rồi xác nhận lưu. Các nhóm đã có được giữ nguyên.</p>
      <div role="status" className="max-h-24 overflow-y-auto rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs space-y-1">{draft.warnings.map((w, i) => <p key={i}>{w}</p>)}</div>
      <div className="max-h-[45dvh] overflow-y-auto space-y-4 pr-1 select-text">
        <details className="text-xs"><summary className="font-bold cursor-pointer">Văn bản Nhật và các nhóm đã lưu</summary><p className="whitespace-pre-wrap font-kanji leading-7">{draft.article.text}</p>
          <p>Giữ nguyên: {draft.article.vocabList.length} từ · {draft.article.grammarList.length} mẫu · {draft.article.quizList.length} câu hỏi.</p></details>
        {groups.includes('vocab') && <h3 className="font-black">Từ vựng ({draft.lists.vocabList.length})</h3>}
        {draft.lists.vocabList.map((row, index) => {
          const label = `Từ ${index + 1}`, originalIndex = draft.original.vocabList.findIndex(v => v.word === row.word && v.reading === row.reading), match = draft.catalog.vocab[originalIndex];
          return <fieldset key={index} disabled={locked} className={fieldsetClass}><legend className="px-1 text-xs font-black">{label}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{field(`${label} - tiếng Nhật`, row.word, 200, word => change('vocabList', index, {word}))}{field(`${label} - cách đọc`, row.reading, 200, reading => change('vocabList', index, {reading}))}</div>
            {field(`${label} - Hán Việt`, row.hanViet, 200, hanViet => change('vocabList', index, {hanViet}))}{field(`${label} - nghĩa`, row.meaning, 1000, meaning => change('vocabList', index, {meaning}), true)}
            <p className="text-xs text-stone-600">{match ? 'Có trong kho đã xuất bản: ' + match.definitions.map(d => d.meaning + ' — ' + d.source).join('; ') : originalIndex < 0 ? 'Đã sửa từ/cách đọc; sẽ đối chiếu lại khi lưu.' : 'Chưa đối chiếu được từ và cách đọc với kho đã xuất bản.'}</p>
            {evidence(label, row.evidence, value => change('vocabList', index, {evidence: value}))}{removeButton(label, 'vocabList', index)}
          </fieldset>;
        })}
        {groups.includes('grammar') && <h3 className="font-black">Ngữ pháp ({draft.lists.grammarList.length})</h3>}
        {draft.lists.grammarList.map((row, index) => {
          const label = `Mẫu ${index + 1}`, originalIndex = draft.original.grammarList.findIndex(g => g.pattern === row.pattern), match = draft.catalog.grammar[originalIndex];
          return <fieldset key={index} disabled={locked} className={fieldsetClass}><legend className="px-1 text-xs font-black">{label}</legend>
            {field(`${label} - cấu trúc`, row.pattern, 200, pattern => change('grammarList', index, {pattern}))}{field(`${label} - ý nghĩa`, row.meaning, 1000, meaning => change('grammarList', index, {meaning}), true)}
            {field(`${label} - ví dụ Nhật`, row.exampleJp, 1000, exampleJp => change('grammarList', index, {exampleJp}), true)}{field(`${label} - dịch ví dụ`, row.exampleVi, 1000, exampleVi => change('grammarList', index, {exampleVi}), true)}
            <p className="text-xs text-stone-600">{match ? `Có mẫu trong kho đã xuất bản · ${match.level}` : originalIndex < 0 ? 'Đã sửa mẫu; sẽ đối chiếu lại khi lưu.' : 'Chưa có mẫu khớp duy nhất trong kho; chưa xác định cấp JLPT.'}</p>
            {evidence(label, row.evidence, value => change('grammarList', index, {evidence: value}))}{removeButton(label, 'grammarList', index)}
          </fieldset>;
        })}
        {groups.includes('quiz') && <h3 className="font-black">Câu hỏi ({draft.lists.quizList.length})</h3>}
        {draft.lists.quizList.map((row, index) => {
          const label = `Câu hỏi ${index + 1}`;
          return <fieldset key={row.id} disabled={locked} className={fieldsetClass}><legend className="px-1 text-xs font-black">{label}</legend>
            {field(`${label} - đề Nhật`, row.question, 1000, question => change('quizList', index, {question}), true)}
            {row.options.map((option, optionIndex) => <div key={optionIndex}>{field(`${label} - lựa chọn ${optionIndex + 1}`, option, 500, value => change('quizList', index, {options: row.options.map((o, i) => i === optionIndex ? value : o)}))}</div>)}
            <label className="block text-xs font-bold">Đáp án đúng<select aria-label={`${label} - đáp án đúng`} className={inputClass} value={row.correctIndex} onChange={e => change('quizList', index, {correctIndex: Number(e.target.value)})}>{row.options.map((_, i) => <option key={i} value={i}>Lựa chọn {i + 1}</option>)}</select></label>
            {field(`${label} - giải thích Việt`, row.explanation, 2000, explanation => change('quizList', index, {explanation}), true)}
            {evidence(label, row.evidence, value => change('quizList', index, {evidence: value}))}{removeButton(label, 'quizList', index)}
          </fieldset>;
        })}
        {![...draft.lists.vocabList, ...draft.lists.grammarList, ...draft.lists.quizList].length && <p className="text-sm">Chưa có mục phù hợp để áp dụng. Nội dung đã lưu vẫn được giữ nguyên.</p>}
      </div>
      {!!errors.length && <div role="alert" className="max-h-20 overflow-y-auto text-xs text-red-700">{errors.map((e, i) => <p key={i}>{e}</p>)}</div>}
      {state.error && <div role="alert" className="text-xs text-red-700"><p>{state.error}</p><button disabled={state.saving} className="underline" onClick={state.reload}>Tải lại bài để kiểm tra (đóng bản xem trước)</button></div>}
      <div className="flex flex-wrap justify-end gap-2"><RoughButton disabled={state.saving} onClick={state.close} className="px-4 py-2 text-sm">Quay lại</RoughButton>
        <RoughButton disabled={locked && !state.uncertain || state.saving || state.stale || !!errors.length} onClick={() => { void state.apply(); }} fill="#0094ff" className="px-4 py-2 text-sm text-white disabled:opacity-40">{state.saving ? 'Đang lưu…' : state.uncertain ? 'Thử lưu lại cùng nội dung' : 'Áp dụng vào bài'}</RoughButton></div>
    </RoughCard>
  </dialog>;
}
