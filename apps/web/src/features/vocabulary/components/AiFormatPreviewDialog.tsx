import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import type { VocabWord } from '@nihongo/shared/contracts/vocabulary';
import { RoughButton, RoughCard } from '../../../shared/ui/RoughCard';
import { prepareAiImport, type AiEditableRow } from '../lib/vocab-ai-format';
import type { ImportWord } from '../lib/vocab-import';

type Props = {
  lessonName: string;
  existingWords: VocabWord[];
  rows: AiEditableRow[];
  warnings: string[];
  saving: boolean;
  loading: boolean;
  canSave: boolean;
  error: string;
  onEdit: (id: string, field: keyof ImportWord, value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onReload: () => void;
};
const fields = [
  { key: 'word', label: 'Từ vựng' },
  { key: 'reading', label: 'Cách đọc' },
  { key: 'hanViet', label: 'Hán Việt' },
  { key: 'meaning', label: 'Nghĩa' },
] as const;

export function AiFormatPreviewDialog(props: Props) {
  const { rows, existingWords, saving, loading, onClose } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busy = saving || loading;
  const prepared = useMemo(() => prepareAiImport(rows, existingWords), [rows, existingWords]);
  const { preview } = prepared;
  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return <dialog ref={dialogRef} aria-labelledby="ai-format-preview-title" aria-describedby="ai-format-preview-summary"
    className="w-[calc(100%_-_2rem)] max-w-4xl max-h-[90dvh] p-0 border-0 bg-transparent text-[#292524] backdrop:bg-black/50"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <RoughCard fill="#fdfbf7" className="p-4 md:p-6 space-y-4 font-sketch">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="ai-format-preview-title" className="font-black text-lg">Xem trước AI Format</h2>
          <p className="text-sm break-words">Thêm vào bài: <strong>{props.lessonName}</strong></p>
        </div>
        <button autoFocus disabled={busy} onClick={onClose} aria-label="Đóng xem trước AI Format" className="p-1 rounded hover:bg-stone-200 disabled:opacity-40"><X className="w-5 h-5" /></button>
      </div>
      <p className="text-xs text-stone-700">Hãy rà soát và sửa trực tiếp trước khi nhập. Ô màu vàng có nội dung AI bổ sung, cần kiểm tra lại. Chưa có từ nào được lưu; nội dung gốc ở trang vẫn được giữ.</p>
      <p id="ai-format-preview-summary" className="text-sm font-bold" aria-live="polite">{preview.validCount} từ mới · {preview.duplicateCount} từ trùng · {preview.errorCount} dòng lỗi</p>
      <p className="text-xs text-stone-600">Chỉ thêm mới và bỏ qua từ trùng đủ bốn trường. Các từ hiện có được giữ nguyên.</p>
      {props.warnings.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs space-y-1" role="status">
        <p className="font-bold">Lưu ý từ AI</p>
        {props.warnings.map((message, index) => <p key={index}>{message}</p>)}
      </div>}
      {preview.errors.length > 0 && <div role="alert" className="text-sm text-rose-700 space-y-1">{preview.errors.map((message, index) => <p key={index}>{message}</p>)}</div>}
      <div className="max-h-[45dvh] overflow-y-auto space-y-3 pr-1 select-text">
        {rows.map((row, index) => {
          const result = preview.rows[index];
          return <fieldset key={row.id} disabled={busy} className="rounded-xl border border-stone-300 bg-white p-3 space-y-2 min-w-0">
            <legend className="px-1 text-xs font-black">Từ {index + 1}</legend>
            <p className="text-xs text-stone-600 whitespace-pre-wrap break-words"><strong>Nội dung gốc:</strong> {row.sourceText || 'Không xác định được đoạn gốc.'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.map(({ key, label }) => {
                const generated = key !== 'word' && row.generatedFields.includes(key);
                const className = `w-full min-w-0 rounded-lg border p-2 text-sm outline-none focus:border-blue-500 disabled:opacity-60 ${generated ? 'border-amber-400 bg-amber-50' : 'border-stone-300 bg-white'} ${key === 'word' || key === 'reading' ? 'font-kanji' : ''}`;
                return <label key={key} className="block text-xs font-bold space-y-1">
                  <span>{label}{(key === 'word' || key === 'meaning') && ' *'}{generated && <span className="ml-2 text-amber-800 text-[11px]">AI bổ sung · cần rà soát</span>}</span>
                  {key === 'meaning' ? <textarea aria-label={`${label} từ ${index + 1}`} rows={2} value={row[key]} onChange={event => props.onEdit(row.id, key, event.target.value)} className={`${className} resize-y`} />
                    : <input aria-label={`${label} từ ${index + 1}`} value={row[key]} onChange={event => props.onEdit(row.id, key, event.target.value)} className={className} />}
                </label>;
              })}
            </div>
            <p className={`text-xs font-bold ${result?.status === 'error' ? 'text-rose-700' : result?.status === 'duplicate' ? 'text-amber-700' : 'text-emerald-700'}`}>
              {result?.status === 'error' ? result.message : result?.status === 'duplicate' ? 'Trùng — sẽ bỏ qua' : 'Sẽ thêm'}
            </p>
          </fieldset>;
        })}
      </div>
      {props.error && <div role="alert" className="space-y-2 text-sm text-rose-700">
        <p>{props.error}</p>
        <button disabled={busy} onClick={props.onReload} className="underline font-bold disabled:opacity-40">Tải bài và xem lại</button>
        <p className="text-xs">Giữ các chỉnh sửa đang xem và kiểm tra từ trùng theo bài mới nhất.</p>
      </div>}
      <div className="flex flex-wrap justify-end gap-3">
        <RoughButton disabled={busy} onClick={onClose} className="px-4 py-2 text-sm font-bold disabled:opacity-40">Quay lại</RoughButton>
        <RoughButton disabled={!props.canSave || busy || !prepared.canSave} onClick={props.onConfirm} fill="#0094ff" className="px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {saving ? 'Đang lưu…' : loading ? 'Đang tải…' : `Xác nhận thêm ${preview.validCount} từ`}
        </RoughButton>
      </div>
    </RoughCard>
  </dialog>;
}
