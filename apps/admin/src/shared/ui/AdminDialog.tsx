import { useEffect, useId, useRef, type ReactNode } from 'react';

const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

export function AdminDialog({ title, busy, onClose, children }: { title: string; busy?: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => { const old = document.activeElement as HTMLElement | null; ref.current?.showModal(); const dialog = ref.current;
    return () => { dialog?.close(); old?.focus(); }; }, []);
  return <dialog ref={ref} aria-labelledby={id} aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90vh] w-[min(94vw,850px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50"><div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5"><h2 id={id} className="text-lg font-semibold">{title}</h2><button type="button" className={button} disabled={busy} onClick={onClose}>Đóng</button></div><div className="p-5">{children}</div></dialog>;
}
