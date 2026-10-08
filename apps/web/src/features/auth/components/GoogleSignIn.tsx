import { useEffect, useRef, useState } from 'react';
import { api } from '@nihongo/client/api';

type GoogleIdentity = {
  initialize(options: { client_id: string; nonce: string; callback: (response: { credential: string }) => void; auto_select: boolean }): void;
  renderButton(parent: HTMLElement, options: { type: string; theme: string; size: string; width: number; locale: string }): void;
};
declare global { interface Window { google?: { accounts: { id: GoogleIdentity } } } }

let sdkPromise: Promise<GoogleIdentity> | undefined;
function loadGoogle() {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  sdkPromise ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    const timer = window.setTimeout(() => fail(), 15000);
    const fail = () => { window.clearTimeout(timer); script.remove(); sdkPromise = undefined; reject(new Error('Chưa tải được đăng nhập Google. Vui lòng thử lại.')); };
    script.onerror = fail;
    script.onload = () => { window.clearTimeout(timer); if (window.google?.accounts.id) resolve(window.google.accounts.id); else fail(); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export function GoogleSignIn({ disabled, onCredential }: { disabled: boolean; onCredential: (credential: string) => Promise<void> }) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const busy = useRef(disabled);
  callback.current = onCredential; busy.current = disabled;
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  useEffect(() => {
    if (!clientId) return;
    let active = true;
    setError(''); setReady(false);
    async function prepare() {
      try {
        const google = await loadGoogle();
        if (!active) return;
        const { nonce } = await api<{ nonce: string }>('/auth/google/nonce', {});
        if (!active || !container.current) return;
        google.initialize({ client_id: clientId!, nonce, auto_select: false, callback: response => {
          if (!active || busy.current) return;
          void callback.current(response.credential).finally(() => { if (active) setAttempt(value => value + 1); });
        } });
        container.current.replaceChildren();
        google.renderButton(container.current, { type: 'standard', theme: 'outline', size: 'large', width: Math.min(container.current.clientWidth || 320, 400), locale: 'vi' });
        setReady(true);
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Google chưa sẵn sàng.'); }
    }
    void prepare();
    return () => { active = false; container.current?.replaceChildren(); };
  }, [clientId, attempt]);
  if (!clientId) return <p className="text-xs text-stone-600 text-center py-2">Đăng nhập Google chưa sẵn sàng. Bạn có thể dùng email.</p>;
  return <div aria-busy={!ready && !error}>
    <div ref={container} className={`min-h-10 flex justify-center ${disabled ? 'pointer-events-none opacity-50' : ''}`} />
    {!ready && !error && <p className="text-xs text-center text-stone-500">Đang tải đăng nhập Google…</p>}
    {error && <div className="text-xs text-center text-red-700" role="status">{error} <button type="button" onClick={() => setAttempt(value => value + 1)} className="underline">Thử lại</button></div>}
  </div>;
}
