import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import type { ReadingAnalysisField, ReadingAnalysisRuby, ReadingAnalysisSentence } from '@nihongo/shared/contracts/reading-analysis';
import { RoughButton, RoughCard } from '../../../shared/ui/RoughCard';
import { validateReadingAnalysisDraft, type ReadingAnalysisSnapshot } from '../lib/reading-analysis';

type Props = {
  title: string; article: ReadingAnalysisSnapshot; rows: ReadingAnalysisSentence[]; warnings: string[];
  saving: boolean; uncertain: boolean; stale: boolean; error: string;
  onEdit: (sentenceId: string, field: ReadingAnalysisField, value: string | ReadingAnalysisRuby[]) => void;
  onClose: () => void; onApply: () => void; onReload: () => void;
};
const input = 'w-full min-w-0 rounded-lg border border-amber-400 bg-amber-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60';
const smallButton = 'rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold hover:bg-stone-100 disabled:opacity-40';

function RubyText({ parts }: { parts: ReadingAnalysisRuby[] }) {
  return <p className="whitespace-pre-wrap break-words font-kanji leading-10">{parts.map((part, index) => part.reading
    ? <ruby key={index}>{part.text}<rt>{part.reading}</rt></ruby> : <span key={index}>{part.text}</span>)}</p>;
}

export function ReadingAnalysisDialog(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const errors = useMemo(() => validateReadingAnalysisDraft(props.rows, props.article), [props.rows, props.article]);
  const locked = props.saving || props.uncertain || props.stale;
  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return <dialog ref={dialogRef} aria-labelledby="reading-analysis-title" aria-describedby="reading-analysis-description"
    className="w-[calc(100%_-_2rem)] max-w-4xl max-h-[90dvh] p-0 border-0 bg-transparent text-[#292524] backdrop:bg-black/50"
    onCancel={event => { event.preventDefault(); if (!props.saving) props.onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !props.saving) props.onClose(); }}>
    <RoughCard fill="#fdfbf7" className="p-4 md:p-6 space-y-4 font-sketch">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 id="reading-analysis-title" className="text-lg font-black">Xem trước phân tích bài đọc</h2>
          <p className="text-sm break-words">Bài: <strong>{props.title}</strong></p></div>
        <button type="button" autoFocus disabled={props.saving} onClick={props.onClose} aria-label="Đóng xem trước phân tích bài đọc" className="p-1 rounded hover:bg-stone-200 disabled:opacity-40"><X className="w-5 h-5" /></button>
      </div>
      <p id="reading-analysis-description" className="text-xs leading-relaxed">Chưa áp dụng vào bài. Hãy rà soát phần màu vàng do AI bổ sung trước khi lưu. Nguyên văn tiếng Nhật và phần đã nhập được giữ nguyên.</p>
      {props.warnings.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs space-y-1" role="status">
        {props.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
      </div>}
      <div className="max-h-[45dvh] overflow-y-auto space-y-4 pr-1 select-text">
        {props.rows.map((row, index) => {
          const translationEditable = row.generatedFields.includes('translation');
          const rubyEditable = row.generatedFields.includes('ruby');
          const setRuby = (parts: ReadingAnalysisRuby[]) => props.onEdit(row.sentenceId, 'ruby', parts);
          const updatePart = (partIndex: number, patch: Partial<ReadingAnalysisRuby>) => setRuby(row.ruby.map((part, position) => position === partIndex ? { ...part, ...patch } : part));
          const rubyMatches = row.ruby.length > 0 && row.ruby.every(part => part.text.length > 0) && row.ruby.map(part => part.text).join('') === row.japanese;
          return <fieldset key={row.sentenceId} disabled={locked} className="min-w-0 rounded-xl border border-stone-300 bg-white p-3 space-y-3">
            <legend className="px-1 text-xs font-black">Câu {index + 1}</legend>
            <div><p className="mb-1 text-xs font-bold text-stone-600">Nguyên văn</p><p className="whitespace-pre-wrap break-words font-kanji leading-relaxed">{row.japanese}</p></div>
            <div className="space-y-1">
              <p className="text-xs font-bold">Bản dịch Việt <span className={`ml-1 text-[11px] ${translationEditable ? 'text-amber-800' : 'text-stone-500'}`}>{translationEditable ? 'AI bổ sung · cần rà soát' : 'Đã có · giữ nguyên'}</span></p>
              {translationEditable ? <textarea aria-label={`Bản dịch câu ${index + 1}`} rows={3} maxLength={3000} className={`${input} resize-y`} value={row.translation} onChange={event => props.onEdit(row.sentenceId, 'translation', event.target.value)} />
                : <p className="whitespace-pre-wrap break-words rounded-lg bg-stone-50 p-2 text-sm">{row.translation}</p>}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold">Furigana <span className={`ml-1 text-[11px] ${rubyEditable ? 'text-amber-800' : 'text-stone-500'}`}>{rubyEditable ? 'AI bổ sung · cần rà soát' : 'Đã có · giữ nguyên'}</span></p>
              {rubyEditable && <>
                <p className="text-xs text-stone-600">Sửa cách chia đoạn và cách đọc bằng kana. Ghép các đoạn phải đúng nguyên văn, kể cả dấu câu và khoảng trắng; đoạn có Kanji cần cách đọc.</p>
                {row.ruby.map((part, partIndex) => <div key={partIndex} className="rounded-lg border border-amber-200 bg-amber-50/40 p-2 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="block text-xs font-bold space-y-1"><span>Đoạn {partIndex + 1}</span><textarea aria-label={`Nguyên văn đoạn ${partIndex + 1}, câu ${index + 1}`} rows={2} maxLength={3000} value={part.text} className={`${input} font-kanji`} onChange={event => updatePart(partIndex, { text: event.target.value })} /></label>
                    <label className="block text-xs font-bold space-y-1"><span>Cách đọc</span><input aria-label={`Cách đọc đoạn ${partIndex + 1}, câu ${index + 1}`} maxLength={300} value={part.reading ?? ''} className={`${input} font-kanji`} onChange={event => updatePart(partIndex, { reading: event.target.value || undefined })} /></label>
                  </div>
                  <div className="flex justify-end"><button type="button" className={smallButton} aria-label={`Xóa đoạn ${partIndex + 1}, câu ${index + 1}`} onClick={() => setRuby(row.ruby.filter((_, position) => position !== partIndex))}>Xóa đoạn</button></div>
                </div>)}
                <button type="button" className={smallButton} disabled={locked || row.ruby.length >= 500} aria-label={`Thêm đoạn furigana câu ${index + 1}`} onClick={() => setRuby([...row.ruby, { text: '' }])}>Thêm đoạn</button>
              </>}
              {rubyMatches && <div className="rounded-lg bg-stone-50 p-2"><p className="text-[11px] text-stone-500">Xem cách đọc trong câu</p><RubyText parts={row.ruby} /></div>}
            </div>
          </fieldset>;
        })}
      </div>
      {errors.length > 0 && <div role="alert" className="max-h-24 overflow-y-auto text-xs text-red-700 space-y-1">{errors.map((message, index) => <p key={index}>{message}</p>)}</div>}
      {props.error && <div role="alert" className="text-sm text-red-700 space-y-2"><p>{props.error}</p>
        <button type="button" disabled={props.saving} className="underline font-bold disabled:opacity-40" onClick={props.onReload}>Tải lại bài để kiểm tra</button>
        <p className="text-xs">Tải lại sẽ đóng bản xem trước chưa được xác nhận.</p>
      </div>}
      <div className="flex flex-wrap justify-end gap-3">
        <RoughButton type="button" disabled={props.saving} onClick={props.onClose} className="px-4 py-2 text-sm font-bold disabled:opacity-40">Quay lại</RoughButton>
        <RoughButton type="button" disabled={props.saving || props.stale || errors.length > 0} onClick={props.onApply} fill="#0094ff" className="px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {props.saving ? 'Đang lưu…' : props.uncertain ? 'Thử lưu lại cùng nội dung' : 'Áp dụng vào bài'}
        </RoughButton>
      </div>
    </RoughCard>
  </dialog>;
}
