import React, { useState, useRef, useEffect } from 'react';
import { Bell, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { UserProfile } from '../types';

interface TopHeaderProps {
  onUpgradeClick: () => void;
  currentUser: UserProfile | null;
  onOpenAuthModal: (mode?: 'login' | 'register') => void;
  onLogout: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentUser,
  onOpenAuthModal,
  onLogout
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-[#fcf9f2] dark:bg-[#181614] flex h-12 items-center border-b-2 border-[#292524] dark:border-[#a8a29e] justify-between px-4 sm:px-6 sticky top-0 z-30 select-none w-full shrink-0">
      
      {/* Brand logo: 漢字 "nihongo" with doodle bird */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 cursor-pointer">
          <span className="px-2 py-0.5 rounded-md bg-[#0094ff] text-white border-2 border-[#292524] font-kanji font-bold text-xs shadow-2xs">
            漢字
          </span>
          <div className="flex items-center font-black text-lg text-[#292524] dark:text-white tracking-wide font-sketch">
            <span>“nihongo</span>
            {/* Mascot crow / bird standing on the logo */}
            <span className="text-base ml-1">🐦”</span>
          </div>
        </div>
      </div>

      {/* Right User Bar */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <button 
          className="p-1.5 rounded-full hover:bg-[#eae3d5] dark:hover:bg-[#292524] text-[#292524] dark:text-[#d6d3d1] transition-colors"
          title="Thông báo"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* Auth Button or User Profile (matches media_1788801159505.png) */}
        {currentUser ? (
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setIsUserMenuOpen(prev => !prev)}
              className="flex items-center gap-2 p-1 pl-2 rounded-xl border-2 border-[#292524] bg-white hover:bg-[#f6f2e9] shadow-sketch transition-all cursor-pointer"
            >
              <span className="text-xs font-bold text-[#292524] max-w-[100px] truncate hidden sm:inline">
                {currentUser.name}
              </span>
              <div className="w-7 h-7 rounded-full bg-[#0094ff] border border-[#292524] text-white flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
                {currentUser.avatarUrl ? (
                  <img 
                    src={currentUser.avatarUrl} 
                    alt={currentUser.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border-2 border-[#292524] bg-white p-2 shadow-sketch z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-[#e7e5e4] mb-1">
                  <p className="font-bold text-xs text-[#292524] truncate">{currentUser.name}</p>
                  <p className="text-[10px] text-[#78716c] truncate">{currentUser.email}</p>
                </div>
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Exact [->] Đăng nhập button from media_1788801159505.png */
          <button
            onClick={() => onOpenAuthModal('login')}
            className="px-3.5 py-1.5 rounded-xl border-2 border-[#292524] bg-white hover:bg-[#f6f2e9] text-[#292524] font-bold text-xs md:text-sm shadow-sketch flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <LogIn className="w-4 h-4 stroke-[2.2]" />
            <span>Đăng nhập</span>
          </button>
        )}
      </div>

    </header>
  );
};

