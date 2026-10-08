import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function ShadowingDialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className="w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] rounded-2xl border-2 border-[#57534e] bg-[#faf6eb] p-5 text-[#292524] shadow-sketch backdrop:bg-black/50">
    <header className="flex items-center justify-between gap-4 mb-4"><h2 id={id} className="text-xl font-black">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Đóng" className="p-1"><X /></button></header>
    {children}
  </dialog>;
}
