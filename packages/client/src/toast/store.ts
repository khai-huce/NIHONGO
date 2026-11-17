export type ToastKind = 'success' | 'error' | 'warning' | 'info';
export type ToastEntry = { id: number; kind: ToastKind; message: string; duration: number };
export const TOAST_LIMIT = 3;

/** Each provider owns a store: no persistence, cross-tab events, or shared account state. */
export function createToastStore() {
  let entries: ToastEntry[] = [];
  let sequence = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  const show = (kind: ToastKind, text: string) => {
    const message = text.trim();
    if (!message) return;
    const existing = entries.find(item => item.kind === kind && item.message === message);
    if (existing) return existing.id;
    const id = ++sequence;
    entries = [...entries, { id, kind, message, duration: kind === 'error' ? 8000 : 5000 }].slice(-TOAST_LIMIT);
    emit();
    return id;
  };
  return {
    getSnapshot: () => entries,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dismiss: (id: number) => { entries = entries.filter(item => item.id !== id); emit(); },
    success: (message: string) => show('success', message),
    error: (message: string) => show('error', message),
    warning: (message: string) => show('warning', message),
    info: (message: string) => show('info', message),
  };
}
