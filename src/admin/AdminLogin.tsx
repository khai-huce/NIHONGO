import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../utils/api';
import type { UserProfile } from '../types';

export function AdminLogin({ onClose, onSuccess }: { onClose: () => void; onSuccess: (user: UserProfile) => void }) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId(), busy = useRef(false), mounted = useRef(true);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState('');
  useEffect(() => { mounted.current = true; const previous = document.activeElement as HTMLElement | null, dialog = ref.current; dialog?.showModal(); return () => { mounted.current = false; dialog?.close(); previous?.focus(); }; }, []);
  const submit = async () => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { const { user } = await api<{ user: UserProfile }>('/auth/login', { email, password }); if (mounted.current) { onSuccess(user); onClose(); } }
    catch (caught) { if (mounted.current) setError(caught instanceof Error ? caught.message : 'Chưa đăng nhập được.'); }
    finally { busy.current = false; if (mounted.current) setPending(false); }
  };
  const button = 'rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50';
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!pending) onClose(); }} className="m-auto w-[min(94vw,440px)] rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
    <div className="mb-5 flex items-center justify-between gap-3"><h2 id={titleId} className="text-xl font-semibold">Đăng nhập quản trị</h2><button className={button} disabled={pending} onClick={onClose}>Đóng</button></div>
    <a href={`${import.meta.env.VITE_APP_ORIGIN || 'http://localhost:3000'}/kanji`} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-slate-300 px-4 py-3 text-center text-sm font-medium text-blue-700">Đăng nhập Google qua trang học</a>
    <p className="mb-5 mt-2 text-xs leading-5 text-slate-500">Ở trang học, chọn Đăng nhập và Google. Sau đó quay lại đây; phiên đăng nhập được dùng chung.</p>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}><fieldset disabled={pending} className="space-y-4"><p className="text-sm text-slate-500">Hoặc dùng email và mật khẩu đã đăng ký:</p>
      <label className="block text-sm font-medium">Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      <label className="block text-sm font-medium">Mật khẩu<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button type="submit" className={`${button} w-full !border-blue-600 bg-blue-600 text-white`}>{pending ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
    </fieldset></form>
  </dialog>;
}
