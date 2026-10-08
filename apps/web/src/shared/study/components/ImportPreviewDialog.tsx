import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { RoughButton, RoughCard } from '../../ui/RoughCard';
import type { ImportPreview } from '../../../features/vocabulary/lib/vocab-import';

type Props = {
  lessonName: string;
  preview: ImportPreview;
  saving: boolean;
  loading: boolean;
  canSave: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
  onReload: () => void;
};

export function ImportPreviewDialog({ lessonName, preview, saving, loading, canSave, error, onClose, onConfirm, onReload }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busy = saving || loading;
  const invalid = preview.errors.length > 0 || preview.errorCount > 0;
  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return <dialog ref={dialogRef} aria-labelledby="import-preview-title" aria-describedby="import-preview-summary"
    className="w-[calc(100%_-_2rem)] max-w-3xl max-h-[90dvh] p-0 border-0 bg-transparent text-[#292524] backdrop:bg-black/50"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <RoughCard fill="#fdfbf7" className="p-5 md:p-6 space-y-4 font-sketch">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="import-preview-title" className="font-black text-lg">Xem trước từ vựng</h2>
          <p className="text-sm break-words">Thêm vào bài: <strong>{lessonName}</strong></p>
        </div>
        <button autoFocus disabled={busy} onClick={onClose} aria-label="Đóng xem trước" className="p-1 rounded hover:bg-stone-200 disabled:opacity-40"><X className="w-5 h-5" /></button>
      </div>
      <p id="import-preview-summary" className="text-sm font-bold">
        {preview.validCount} từ mới · {preview.duplicateCount} từ trùng · {preview.errorCount} dòng lỗi
      </p>
      <p className="text-xs text-stone-600">Bản trùng cả từ, cách đọc, Hán Việt và nghĩa sẽ được bỏ qua. Các từ hiện có được giữ nguyên.</p>
      {preview.errors.length > 0 && <div role="alert" className="text-sm text-rose-700 space-y-1">{preview.errors.map((message, index) => <p key={index}>{message}</p>)}</div>}
      {preview.rows.length > 0 && <div className="max-h-[38dvh] overflow-auto border border-stone-300 rounded-lg bg-white select-text">
        <table className="w-full min-w-[540px] text-xs text-left">
          <thead className="sticky top-0 bg-stone-100"><tr>{['Dòng', 'Từ vựng', 'Cách đọc', 'Hán Việt', 'Nghĩa', 'Kết quả'].map(label => <th key={label} className="p-2 font-black">{label}</th>)}</tr></thead>
          <tbody>{preview.rows.map((row, index) => <tr key={index} className="border-t border-stone-200 align-top">
            <td className="p-2">{row.line}</td>
            {row.word ? <>
              <td className="p-2 break-words max-w-40 font-kanji">{row.word.word}</td>
              <td className="p-2 break-words max-w-40 font-kanji">{row.word.reading || '—'}</td>
              <td className="p-2 break-words max-w-32">{row.word.hanViet || '—'}</td>
              <td className="p-2 break-words max-w-60 whitespace-pre-wrap">{row.word.meaning}</td>
            </> : <td colSpan={4} className="p-2 text-rose-700">{row.message}</td>}
            <td className={`p-2 font-bold ${row.status === 'error' ? 'text-rose-700' : row.status === 'duplicate' ? 'text-amber-700' : 'text-emerald-700'}`}>
              {row.status === 'error' ? (row.word ? row.message : 'Cần sửa') : row.status === 'duplicate' ? 'Trùng — bỏ qua' : 'Sẽ thêm'}
            </td>
          </tr>)}</tbody>
        </table>
      </div>}
      <details className="text-xs text-stone-600">
        <summary className="cursor-pointer font-bold">Định dạng JSON/text được hỗ trợ</summary>
        <div className="space-y-1 pt-2 select-text">
          <p>JSON: danh sách đối tượng có word, meaning; reading và hanViet có thể bỏ trống.</p>
          <p>Text: không có hàng tiêu đề; mỗi dòng một từ, gồm 2 cột (từ, nghĩa), 3 cột (từ, cách đọc, nghĩa) hoặc 4 cột (từ, cách đọc, Hán Việt, nghĩa).</p>
          <p>Ngăn cột bằng tab, dấu |, dấu phẩy hoặc dấu gạch ngang có khoảng trắng hai bên. Đặt trường có chứa dấu ngăn trong dấu ngoặc kép.</p>
          <p>Ví dụ: 学校 | がっこう | HỌC HIỆU | Trường học</p>
          <p>Tối đa 500 từ mỗi bài và 512 KiB nội dung nhập. Chỉ bỏ khoảng trắng ở đầu/cuối từng trường.</p>
        </div>
      </details>
      {invalid && <p className="text-xs font-bold text-rose-700">Chưa lưu từ nào. Hãy quay lại sửa nội dung rồi xem trước lần nữa.</p>}
      {error && <div role="alert" className="space-y-2 text-sm text-rose-700">
        <p>{error}</p>
        <button disabled={busy} onClick={onReload} className="underline font-bold disabled:opacity-40">Tải bài và xem lại</button>
      </div>}
      <div className="flex flex-wrap justify-end gap-3">
        <RoughButton disabled={busy} onClick={onClose} className="px-4 py-2 text-sm font-bold disabled:opacity-40">Quay lại</RoughButton>
        <RoughButton disabled={!canSave || busy || invalid || preview.validCount === 0} onClick={onConfirm} fill="#0094ff" className="px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {saving ? 'Đang lưu…' : loading ? 'Đang tải…' : `Xác nhận thêm ${preview.validCount} từ`}
        </RoughButton>
      </div>
    </RoughCard>
  </dialog>;
}
