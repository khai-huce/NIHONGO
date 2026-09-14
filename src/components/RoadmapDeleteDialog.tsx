import { useEffect, useId, useRef } from 'react';
import { RoughButton, RoughCard } from './RoughCard';

export function RoadmapDeleteDialog({name, busy, error, onCancel, onConfirm}:{
  name:string; busy:boolean; error:string; onCancel:()=>void; onConfirm:()=>void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}
    className="fixed inset-0 !m-auto w-[calc(100%-2rem)] max-w-md border-0 bg-transparent p-1 backdrop:bg-black/50">
    <RoughCard fill="#ffffff" stroke="#292524" borderRadius={16} roughness={0.7} className="p-6 space-y-4 shadow-sketch bg-white font-sketch text-[#292524]">
      <h3 id={titleId} className="text-base font-black">Xóa lộ trình</h3>
      <p className="text-sm">Bạn có chắc chắn muốn xóa lộ trình này không?</p>
      <p className="text-sm font-bold break-words">{name}</p>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      {busy && <p role="status" className="text-xs text-[#78716c]">Đang xóa lộ trình…</p>}
      <div className="flex justify-end gap-3">
        <RoughButton autoFocus disabled={busy} onClick={onCancel} fill="#ffffff" stroke="#78716c" borderRadius={8} className="px-4 py-2 text-xs font-bold">Hủy</RoughButton>
        <RoughButton disabled={busy} onClick={onConfirm} fill="#e11d48" stroke="#9f1239" borderRadius={8} className="px-4 py-2 text-xs font-bold text-white">Xóa lộ trình</RoughButton>
      </div>
    </RoughCard>
  </dialog>;
}
