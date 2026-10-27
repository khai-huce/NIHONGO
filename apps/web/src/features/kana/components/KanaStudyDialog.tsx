import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Native modal keeps focus and the alphabet quiz's shortcuts out of the study panel. */
export function KanaStudyDialog({ title, children, onClose, variant = 'paper' }: {
  title: string; children: ReactNode; onClose: () => void; variant?: 'paper' | 'flashcard';
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    element?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={dialog} tabIndex={-1} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    className={variant === 'flashcard' ? 'kana-flashcard-dialog' : 'w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl border-2 border-[#57534e] bg-[#faf6eb] p-4 text-[#292524] shadow-sketch backdrop:bg-black/50 sm:p-6'}>
    <header className={variant === 'flashcard' ? 'kana-flashcard-header' : 'mb-4 flex items-center justify-between gap-3'}>
      <h2 id={titleId} className={variant === 'flashcard' ? 'sr-only' : 'font-sketch text-xl font-black'}>{title}</h2>
      <button type="button" onClick={onClose} aria-label="Đóng khung học" title="Đóng (Esc)"
        className="shrink-0 rounded-lg p-2 hover:bg-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><X size={20} /></button>
    </header>
    {children}
  </dialog>;
}
