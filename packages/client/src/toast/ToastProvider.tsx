import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createToastStore, type ToastEntry } from './store';
import '../../styles/toast.css';

const Context = createContext<ReturnType<typeof createToastStore> | null>(null);
const labels = { success: 'Thành công', error: 'Chưa thực hiện được', warning: 'Lưu ý', info: 'Thông tin' };
const symbols = { success: '✓', error: '!', warning: '!', info: 'i' };

export function useToast() {
  const value = useContext(Context);
  if (!value) throw new Error('ToastProvider missing');
  return value;
}

/** Keeps existing form/retry messages intact; only announces a new feedback value. */
export function useToastFeedback({ success, error, info, warning }: { success?: string | null; error?: string | null; info?: string | null; warning?: string | null }) {
  const toast = useToast();
  const previous = useRef({ success, error, info, warning });
  const initialized = useRef(false);
  useEffect(() => {
    const next = { success, error, info, warning };
    for (const kind of ['success', 'error', 'info', 'warning'] as const) {
      if (next[kind] && (!initialized.current || next[kind] !== previous.current[kind])) toast[kind](next[kind]!);
    }
    previous.current = next;
    initialized.current = true;
  }, [toast, success, error, info, warning]);
}

function ToastCard({ item, dismiss }: { item: ToastEntry; dismiss: (id: number) => void }) {
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const remaining = useRef(item.duration);
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => {
    if (hovered || focused || hidden) return;
    const start = performance.now();
    const timer = window.setTimeout(() => dismiss(item.id), remaining.current);
    return () => { window.clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (performance.now() - start)); };
  }, [item.id, dismiss, hovered, focused, hidden]);
  return <li className={`nihongo-toast nihongo-toast--${item.kind}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
    <span className="nihongo-toast__icon" aria-hidden="true">{symbols[item.kind]}</span>
    <div className="nihongo-toast__content" role={item.kind === 'error' ? 'alert' : 'status'} aria-atomic="true">
      <strong>{labels[item.kind]}</strong><p>{item.message}</p>
    </div>
    <button type="button" className="nihongo-toast__close" aria-label={`Đóng thông báo: ${item.message}`} onClick={() => dismiss(item.id)}>×</button>
  </li>;
}

function ToastViewport({ store, variant }: { store: ReturnType<typeof createToastStore>; variant: 'web' | 'admin' }) {
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [target, setTarget] = useState<Element>(document.body);
  useEffect(() => {
    // Native modal dialogs occupy the browser's top layer. A z-index alone cannot reach it.
    const updateTarget = () => {
      const dialogs = Array.from(document.querySelectorAll('dialog[open]'));
      const modal = dialogs.filter(dialog => dialog.matches(':modal')).at(-1);
      setTarget(modal ?? document.fullscreenElement ?? document.body);
    };
    updateTarget();
    const observer = new MutationObserver(updateTarget);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    document.addEventListener('fullscreenchange', updateTarget);
    return () => { observer.disconnect(); document.removeEventListener('fullscreenchange', updateTarget); };
  }, []);
  return createPortal(<ol className={`nihongo-toasts nihongo-toasts--${variant}`} aria-label="Thông báo thao tác">
    {entries.map(item => <ToastCard key={item.id} item={item} dismiss={store.dismiss} />)}
  </ol>, target);
}

export function ToastProvider({ children, scope, variant }: { children: ReactNode; scope: string; variant: 'web' | 'admin' }) {
  // A late callback retains its old store and cannot notify a different account.
  const store = useMemo(createToastStore, [scope]);
  return <Context.Provider value={store}>{children}<ToastViewport key={scope} store={store} variant={variant} /></Context.Provider>;
}

export function ToastFeedback(props: Parameters<typeof useToastFeedback>[0]) {
  useToastFeedback(props);
  return null;
}

export function AccountToastFeedback({ userId, checking, error }: { userId: string | null; checking: boolean; error: string }) {
  const toast = useToast();
  const previous = useRef<string | null | undefined>(undefined);
  useToastFeedback({ error });
  useEffect(() => {
    if (checking || error) return;
    if (previous.current !== undefined && previous.current !== userId) {
      if (userId) toast.success('Đăng nhập thành công.');
      else toast.info('Đã đăng xuất.');
    }
    previous.current = userId;
  }, [userId, checking, error, toast]);
  return null;
}
