import { useToastFeedback } from '@nihongo/client/toast';
import React, { useRef, useState } from 'react';
import { Mail, Lock, User, X, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { RoughCard } from '../../../shared/ui/RoughCard';
import { GoogleSignIn } from './GoogleSignIn';
import { api } from '@nihongo/client/api';
import type { UserProfile } from '@nihongo/shared/contracts/core';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@nihongo/shared/contracts/auth-policy';
interface AuthModalProps {
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onLoginSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, initialMode = 'login', onLoginSuccess }) => {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  useToastFeedback({ error: errorMsg });
  const [isLoading, setIsLoading] = useState(false);
  const pending = useRef(false);

  const authenticate = async (path: string, body: unknown) => {
    if (pending.current) return;
    pending.current = true;
    setShowPassword(false);
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { user } = await api<{ user: UserProfile }>(path, body);
      onLoginSuccess(user);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Đăng nhập chưa thành công. Vui lòng thử lại.');
    } finally {
      pending.current = false;
      setIsLoading(false);
    }
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowPassword(false);
    if (mode === 'register' && password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }
    void authenticate(`/auth/${mode}`, { email, password, ...(mode === 'register' ? { name } : {}) });
  };
  function resetForm() {
    setShowPassword(false);
    setPassword('');
    setConfirmPassword('');
    setEmail('');
    setName('');
    setErrorMsg('');
  }
  const inputClass = 'w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-[#292524] bg-white text-sm text-[#292524] placeholder-[#a8a29e] focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sketch';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 max-h-full">
        <RoughCard fill="#faf7ee" stroke="#292524" strokeWidth={1.5} borderRadius={18} className="p-6 md:p-8 shadow-2xl relative">
          <button onClick={onClose} disabled={isLoading} className="absolute top-4 right-4 p-1 rounded-full text-[#78716c] hover:text-[#292524] hover:bg-[#eae3d5] disabled:opacity-50" title="Đóng" aria-label="Đóng"><X className="w-5 h-5 stroke-[2.2]" /></button>
          <div className="text-left mb-5">
            <h2 id="auth-title" className="text-xl md:text-2xl font-black text-[#292524] tracking-tight">{mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</h2>
            <p className="text-xs md:text-sm text-[#78716c] font-medium mt-1">{mode === 'login' ? 'Chào mừng bạn trở lại NIHONGO.' : 'Tạo tài khoản NIHONGO của bạn.'}</p>
          </div>
          <GoogleSignIn disabled={isLoading} onCredential={credential => authenticate('/auth/google', { credential })} />
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#d6d3d1]" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#faf7ee] px-2 text-[#78716c] font-black tracking-wider">HOẶC</span></div>
          </div>
          {errorMsg && <div role="alert" className="mb-3 p-2 rounded-lg bg-red-50 border border-red-300 text-red-700 text-xs font-bold flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{errorMsg}</span></div>}
          <form key={mode} onSubmit={handleSubmit}>
            <fieldset disabled={isLoading} className="space-y-3">
              {mode === 'register' && <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-[#78716c]" />
                <input type="text" name="name" autoComplete="name" aria-label="Tên của bạn" value={name} onChange={e => setName(e.target.value)} placeholder="Tên của bạn" required maxLength={100} className={inputClass} />
              </div>}
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-[#78716c]" />
                <input type="email" name="email" autoComplete="email" aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required maxLength={254} className={inputClass} />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#78716c]" />
                <input type={showPassword ? 'text' : 'password'} name="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} aria-label="Mật khẩu" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mật khẩu" required minLength={mode === 'register' ? PASSWORD_MIN_LENGTH : 1} maxLength={PASSWORD_MAX_LENGTH} className={`${inputClass} pr-10`} />
                <button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute inset-y-0 right-0 pr-3.5 text-[#78716c]">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
              {mode === 'register' && <>
                <p className="text-xs text-[#78716c]">Mật khẩu từ {PASSWORD_MIN_LENGTH} đến {PASSWORD_MAX_LENGTH} ký tự. Có thể dùng một cụm từ dễ nhớ.</p>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#78716c]" />
                  <input type="password" name="confirmPassword" autoComplete="new-password" aria-label="Xác nhận mật khẩu" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Xác nhận mật khẩu" required maxLength={PASSWORD_MAX_LENGTH} className={inputClass} />
                </div>
              </>}
              <button type="submit" className="w-full py-2.5 rounded-xl bg-[#0091ff] hover:bg-[#007fd9] text-white font-black text-sm md:text-base border-2 border-[#292524] shadow-sketch transition-all disabled:opacity-50 cursor-pointer">{isLoading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</button>
            </fieldset>
          </form>
          <div className="mt-4 text-center text-xs text-[#57534e]">
            {mode === 'login' ? 'Nếu chưa có tài khoản thì ' : 'Đã có tài khoản? '}
            <button type="button" disabled={isLoading} onClick={() => { resetForm(); setMode(mode === 'login' ? 'register' : 'login'); }} className="font-bold text-[#0091ff] hover:underline">{mode === 'login' ? 'Đăng Ký' : 'Đăng nhập'}</button>
          </div>
          <p className="mt-4 pt-3 border-t border-[#d6d3d1]/80 text-[11px] text-[#78716c] text-center leading-relaxed">Đăng nhập để lưu bài học cá nhân, lịch ôn và tiến độ học được hỗ trợ theo tài khoản, dùng tiếp trên thiết bị khác. Dữ liệu khách và cài đặt trên thiết bị giữ riêng, không tự chuyển vào tài khoản.</p>
        </RoughCard>
      </div>
    </div>
  );
};
