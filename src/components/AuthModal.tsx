import React, { useState } from 'react';
import { Mail, Lock, User, X, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { RoughCard } from './RoughCard';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onLoginSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onLoginSuccess
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Synchronize when initialMode changes or modal reopens
  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleGoogleAuth = () => {
    setIsLoading(true);
    setErrorMsg('');
    setTimeout(() => {
      const mockUser: UserProfile = {
        id: `u-${Date.now()}`,
        name: 'Học viên Nihongo',
        email: 'hocvien@gmail.com',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=NhaiKanji',
        isPremium: true
      };
      setSuccessMsg('Đăng nhập Google thành công!');
      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess(mockUser);
        onClose();
      }, 600);
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrorMsg('Email không đúng định dạng hợp lệ.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Mật khẩu phải có tối thiểu 6 ký tự.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setErrorMsg('Vui lòng nhập tên hiển thị của bạn.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Mật khẩu xác nhận không khớp.');
        return;
      }
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const user: UserProfile = {
        id: `u-${Date.now()}`,
        name: mode === 'register' ? name.trim() : email.split('@')[0],
        email: email.trim(),
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
        isPremium: false
      };

      setSuccessMsg(mode === 'login' ? 'Đăng nhập thành công!' : 'Đăng ký tài khoản thành công!');
      setTimeout(() => {
        onLoginSuccess(user);
        onClose();
      }, 500);
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      {/* Modal Container */}
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <RoughCard
          fill="#faf7ee"
          stroke="#292524"
          strokeWidth={1.5}
          borderRadius={18}
          className="p-6 md:p-8 shadow-2xl relative"
        >
          {/* Close button (top right) */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full text-[#78716c] hover:text-[#292524] hover:bg-[#eae3d5] transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Header Title & Subtitle */}
          <div className="text-left mb-5">
            <h2 className="text-xl md:text-2xl font-black text-[#292524] tracking-tight">
              {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </h2>
            <p className="text-xs md:text-sm text-[#78716c] font-medium mt-1">
              {mode === 'login' 
                ? 'Đăng nhập để đồng bộ tiến trình học của bạn.' 
                : 'Tạo tài khoản để lưu trữ lộ trình và dữ liệu học tập của bạn.'}
            </p>
          </div>

          {/* Google Sign-in Button (matches media_1788801148300.png) */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl border-2 border-[#292524] bg-white hover:bg-[#f6f2e9] text-[#292524] font-bold text-sm shadow-sketch flex items-center justify-center gap-2.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {/* Google Multi-Color G Icon */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.27 21.36 7.35 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{mode === 'login' ? 'Đăng nhập bằng Google' : 'Đăng ký bằng Google'}</span>
          </button>

          {/* Divider: HOẶC */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#d6d3d1]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#faf7ee] px-2 text-[#78716c] font-black tracking-wider">
                HOẶC
              </span>
            </div>
          </div>

          {/* Error / Success Notifications */}
          {errorMsg && (
            <div className="mb-3 p-2 rounded-lg bg-red-50 border border-red-300 text-red-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-3 p-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            
            {/* Name input (only for Register mode) */}
            {mode === 'register' && (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#78716c]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tên của bạn"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-[#292524] bg-white text-sm text-[#292524] placeholder-[#a8a29e] focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sketch"
                />
              </div>
            )}

            {/* Email input (matches screenshot) */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#78716c]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-[#292524] bg-white text-sm text-[#292524] placeholder-[#a8a29e] focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sketch"
              />
            </div>

            {/* Password input (matches screenshot) */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#78716c]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border-2 border-[#292524] bg-white text-sm text-[#292524] placeholder-[#a8a29e] focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sketch"
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#78716c] hover:text-[#292524]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Confirm Password (only for Register mode) */}
            {mode === 'register' && (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#78716c]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Xác nhận mật khẩu"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-[#292524] bg-white text-sm text-[#292524] placeholder-[#a8a29e] focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sketch"
                />
              </div>
            )}

            {/* Primary Submit Button (matches media_1788801148300.png bright blue button) */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-[#0091ff] hover:bg-[#007fd9] active:bg-[#006ec4] text-white font-black text-sm md:text-base border-2 border-[#292524] shadow-sketch active:translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer mt-1"
            >
              {isLoading 
                ? 'Đang xử lý...' 
                : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </form>

          {/* User Request: 
              "thay dòng nếu không tiện đăng nhập gmail thì báo mình cấp tài khoản cho 
               bằng nếu chưa có tài khoản thì Đăng Ký, bấm vào thì vào form đăng ký" */}
          <div className="mt-4 text-center">
            {mode === 'login' ? (
              <p className="text-xs text-[#57534e]">
                Nếu chưa có tài khoản thì{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="font-bold text-[#0091ff] hover:underline cursor-pointer"
                >
                  Đăng Ký
                </button>
              </p>
            ) : (
              <p className="text-xs text-[#57534e]">
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="font-bold text-[#0091ff] hover:underline cursor-pointer"
                >
                  Đăng nhập
                </button>
              </p>
            )}
          </div>

          {/* Terms & Privacy note (matches screenshot footer) */}
          <div className="mt-4 pt-3 border-t border-[#d6d3d1]/80 text-[11px] text-[#78716c] text-center leading-relaxed">
            Bằng việc {mode === 'login' ? 'đăng nhập' : 'đăng ký'}, bạn đồng ý với{' '}
            <a href="#terms" className="underline hover:text-[#292524]">
              Điều khoản sử dụng
            </a>{' '}
            và{' '}
            <a href="#privacy" className="underline hover:text-[#292524]">
              Chính sách quyền riêng tư
            </a>
            .
          </div>

        </RoughCard>
      </div>
    </div>
  );
};
