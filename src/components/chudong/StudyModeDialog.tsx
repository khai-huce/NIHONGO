import { useEffect, useId, useRef } from 'react';

export function StudyModeDialog({open, busy, onCancel, onConfirm}:{
  open:boolean; busy:boolean; onCancel:()=>void; onConfirm:()=>void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [open]);
  if (!open) return null;
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onCancel(); }}
    className="w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-600 bg-[#232d4b] p-5 text-slate-100 shadow-2xl backdrop:bg-black/60">
    <h2 id={titleId} className="text-lg font-bold">Đổi chế độ học?</h2>
    <p className="mt-3 text-sm text-slate-300">Đổi chế độ sẽ bắt đầu lượt mới. Lượt chưa hoàn thành sẽ không được lưu. Kết quả đã lưu vẫn được giữ.</p>
    <div className="mt-5 flex justify-end gap-3">
      <button autoFocus onClick={onCancel} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-600">Hủy</button>
      <button disabled={busy} onClick={onConfirm} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-500 disabled:opacity-50">Bắt đầu lượt mới</button>
    </div>
  </dialog>;
}
