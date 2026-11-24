import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings, 
  ChevronRight, 
  BookOpen, 
  Languages, 
  Route, 
  TrendingUp, 
  Brain,
  Sparkles,
  Crown,
  Volume2,
  Mic
} from 'lucide-react';
import { UserSettings } from '@nihongo/shared/contracts/core';
import { RoughCard } from '../../shared/ui/RoughCard';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: UserSettings;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  setIsSettingsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  setIsSettingsOpen
}) => {
  // Flyout submenu state: null | 'vocab' | 'personal' | 'lifetime'
  const [openSubmenu, setOpenSubmenu] = useState<'vocab' | 'personal' | 'lifetime' | null>(null);
  
  // Dynamic positioning for flyout popovers
  const [popoverTop, setPopoverTop] = useState<number>(0);

  const vocabRef = useRef<HTMLDivElement | null>(null);
  const personalRef = useRef<HTMLDivElement | null>(null);
  const lifetimeRef = useRef<HTMLDivElement | null>(null);

  const updatePopoverPos = (type: 'vocab' | 'personal' | 'lifetime') => {
    let targetEl: HTMLElement | null = null;
    if (type === 'vocab') targetEl = vocabRef.current;
    if (type === 'personal') targetEl = personalRef.current;
    if (type === 'lifetime') targetEl = lifetimeRef.current;

    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      // Vertically center or align top of popover with the button
      setPopoverTop(rect.top);
    }
  };

  const handleNavClick = (id: 'vocab' | 'personal' | 'lifetime' | 'kanji' | 'bunpo' | 'accent' | 'leaderboard' | 'upgrade') => {
    if (id === 'vocab' || id === 'personal' || id === 'lifetime') {
      if (openSubmenu === id) {
        setOpenSubmenu(null);
      } else {
        updatePopoverPos(id);
        setOpenSubmenu(id);
      }
    } else {
      setOpenSubmenu(null);
      setActiveTab(id);
    }
  };

  useEffect(() => {
    if (openSubmenu) {
      updatePopoverPos(openSubmenu);
    }
  }, [openSubmenu]);

  return (
    <>
      <aside className="bg-[#fdfbf7] dark:bg-[#181614] border-r-2 border-[#292524] h-full w-20 shrink-0 flex flex-col justify-between select-none z-40 relative">
        
        {/* Navigation Items */}
        <div>
          <nav className="flex flex-col items-center gap-1.5 p-1.5 pt-2 overflow-y-auto max-h-[calc(100vh-140px)] [scrollbar-width:none]">
            
            {/* 1. Hán tự */}
            <button
              onClick={() => handleNavClick('kanji')}
              className={`relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 p-1 text-[10px] font-bold transition-all rounded-xl ${
                activeTab === 'kanji' 
                  ? 'border-sketch-sm bg-[#b3ab9e] text-[#292521] shadow-sketch' 
                  : 'text-[#44403c] hover:bg-[#eae3d5]'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M7 6v14M17 6v14M3 20h18M9 11h6M9 15h6" />
              </svg>
              <span className="text-center leading-none" style={{ fontSize: '9px' }}>Hán tự</span>
            </button>

            {/* 2. Từ vựng > */}
            <div ref={vocabRef} className="relative w-full">
              <button
                onClick={() => handleNavClick('vocab')}
                className={`relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-0.5 p-1 text-[10px] font-bold transition-all rounded-xl ${
                  activeTab.startsWith('vocab') || openSubmenu === 'vocab'
                    ? 'border-sketch-sm bg-[#b3ab9e] text-[#292521] shadow-sketch' 
                    : 'text-[#44403c] hover:bg-[#eae3d5]'
                }`}
              >
                <Crown className="w-5 h-5" />
                <span className="text-center leading-none" style={{ fontSize: '9px' }}>Từ vựng</span>
                <ChevronRight className="w-3 h-3 text-[#78716c] -mt-0.5" />
              </button>
            </div>

            {/* 3. Ngữ pháp */}
            <button
              onClick={() => handleNavClick('bunpo')}
              className={`relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 p-1 text-[10px] font-bold transition-all rounded-xl ${
                activeTab === 'bunpo' 
                  ? 'border-sketch-sm bg-[#b3ab9e] text-[#292521] shadow-sketch' 
                  : 'text-[#44403c] hover:bg-[#eae3d5]'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span className="text-center leading-none" style={{ fontSize: '9px' }}>Ngữ pháp</span>
            </button>

            {/* 4. Cá nhân hoá > */}
            <div ref={personalRef} className="relative w-full">
              <button
                onClick={() => handleNavClick('personal')}
                className={`relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-0.5 p-1 text-[10px] font-bold transition-all rounded-xl ${
                  activeTab.startsWith('personal') || openSubmenu === 'personal'
                    ? 'border-sketch-sm bg-[#b3ab9e] text-[#292521] shadow-sketch' 
                    : 'text-[#44403c] hover:bg-[#eae3d5]'
                }`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="7" r="4" />
                  <path d="M5.5 21a8.38 8.38 0 0 1 13 0" />
                </svg>
                <span className="text-center leading-none" style={{ fontSize: '9px' }}>Cá nhân hoá</span>
                <ChevronRight className="w-3 h-3 text-[#78716c] -mt-0.5" />
              </button>
            </div>

            {/* 5. Trọng âm */}
            <button
              onClick={() => handleNavClick('accent')}
              className={`relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 p-1 text-[10px] font-bold transition-all rounded-xl ${
                activeTab === 'accent' 
                  ? 'border-sketch-sm bg-[#b3ab9e] text-[#292521] shadow-sketch' 
                  : 'text-[#44403c] hover:bg-[#eae3d5]'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 10v4M6 4v16M10 8v8M14 2v20M18 6v12M22 10v4" />
              </svg>
              <span className="text-center leading-none" style={{ fontSize: '9px' }}>Trọng âm</span>
            </button>

            {/* 6. Xếp hạng */}
            <button
              onClick={() => handleNavClick('leaderboard')}
              className={`relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 p-1 text-[10px] font-bold transition-all rounded-xl ${
                activeTab === 'leaderboard' 
                  ? 'border-sketch-sm bg-[#b3ab9e] text-[#292521] shadow-sketch' 
                  : 'text-[#44403c] hover:bg-[#eae3d5]'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7M14 14.66V17c0 .55.45 1 1 1h2M18 4H6v7a6 6 0 0 0 12 0V4Z" />
              </svg>
              <span className="text-center leading-none" style={{ fontSize: '9px' }}>Xếp hạng</span>
            </button>

            {/* 7. Trọn đời > (Diamond with Gold Crown - Theo ảnh media_1788111971691) */}
            <div ref={lifetimeRef} className="relative w-full">
              <button
                onClick={() => handleNavClick('lifetime')}
                className={`relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-0.5 p-1 text-[10px] font-bold transition-all rounded-xl ${
                  activeTab.startsWith('lifetime') || openSubmenu === 'lifetime'
                    ? 'border-sketch-sm bg-[#b3ab9e] text-[#292521] shadow-sketch' 
                    : 'text-amber-600 hover:bg-amber-50'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  {/* Diamond Icon */}
                  <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3h12l4 6-10 12L2 9z" />
                    <path d="M11 3 8 9l4 12 4-12-3-6" />
                    <path d="M2 9h20" />
                  </svg>
                  {/* Gold Crown on top-right */}
                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 absolute -top-1.5 -right-2.5" />
                </div>
                <span className="text-center font-bold text-amber-600 leading-none" style={{ fontSize: '9px' }}>Trọn đời</span>
                <ChevronRight className="w-3 h-3 text-amber-500 -mt-0.5" />
              </button>
            </div>

          </nav>
        </div>

        {/* Bottom Controls: Nâng cấp + Cài đặt */}
        <div className="flex flex-col items-center gap-1 p-1.5 border-t-2 border-[#292524] bg-[#f6f2e9]">
          
          {/* Nâng cấp (Sparkles / Star icon in amber/orange) */}
          <button
            onClick={() => {
              setOpenSubmenu(null);
              setActiveTab('upgrade');
            }}
            className="flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-xl p-1 text-[#f59e0b] hover:bg-amber-50 transition-all font-bold group"
            title="Nâng cấp tài khoản"
          >
            <div className="relative">
              <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400/30 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-center font-black text-amber-600 leading-none" style={{ fontSize: '9px' }}>
              Nâng cấp
            </span>
          </button>

          {/* Cài đặt */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-xl p-1 text-[#44403c] hover:bg-[#eae3d5] transition-colors"
            title="Cài đặt"
          >
            <Settings className="w-5 h-5" />
            <span style={{ fontSize: '9px' }}>Cài đặt</span>
          </button>

        </div>

      </aside>

      {/* ============================================================ */}
      {/* 1. FLYOUT SUBMENU FOR "TỪ VỰNG" (Vertically aligned) */}
      {/* ============================================================ */}
      {openSubmenu === 'vocab' && (
        <div 
          className="fixed left-[84px] z-50 animate-in fade-in zoom-in-95 duration-150"
          style={{ top: `${popoverTop}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <RoughCard 
            fill="#ffffff" 
            stroke="#292524" 
            borderRadius={12} 
            roughness={0.7} 
            className="p-2 shadow-sketch bg-white"
          >
            <div className="flex items-center gap-2">
              
              {/* Option 1: Giáo trình */}
              <div 
                onClick={() => {
                  setActiveTab('vocab-giao-trinh');
                  setOpenSubmenu(null);
                }}
                className="cursor-pointer"
              >
                <RoughCard
                  fill={activeTab === 'vocab-giao-trinh' ? '#b3ab9e' : '#fdfbf7'}
                  stroke="#292524"
                  borderRadius={10}
                  roughness={0.7}
                  active={activeTab === 'vocab-giao-trinh'}
                  className="w-20 h-20 flex flex-col items-center justify-center gap-1.5 p-2 text-center hover:scale-105 transition-transform shadow-xs"
                >
                  <BookOpen className="w-5 h-5 text-[#292524]" />
                  <span className="text-[10px] font-black text-[#292524] leading-tight">
                    Giáo trình
                  </span>
                </RoughCard>
              </div>

              {/* Option 2: Bảng chữ cái */}
              <div 
                onClick={() => {
                  setActiveTab('vocab-bang-chu-cai');
                  setOpenSubmenu(null);
                }}
                className="cursor-pointer"
              >
                <RoughCard
                  fill={activeTab === 'vocab-bang-chu-cai' ? '#b3ab9e' : '#ffffff'}
                  stroke="#292524"
                  borderRadius={10}
                  roughness={0.7}
                  active={activeTab === 'vocab-bang-chu-cai'}
                  className="w-20 h-20 flex flex-col items-center justify-center gap-1.5 p-2 text-center hover:scale-105 transition-transform shadow-xs"
                >
                  <Languages className="w-5 h-5 text-[#292524]" />
                  <span className="text-[10px] font-black text-[#292524] leading-tight">
                    Bảng chữ cái
                  </span>
                </RoughCard>
              </div>

            </div>
          </RoughCard>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. FLYOUT SUBMENU FOR "CÁ NHÂN HOÁ" (Vertically aligned) */}
      {/* ============================================================ */}
      {openSubmenu === 'personal' && (
        <div 
          className="fixed left-[84px] z-50 animate-in fade-in zoom-in-95 duration-150"
          style={{ top: `${popoverTop}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <RoughCard 
            fill="#ffffff" 
            stroke="#292524" 
            borderRadius={12} 
            roughness={0.7} 
            className="p-2 shadow-sketch bg-white"
          >
            <div className="flex items-center gap-2">
              
              {/* Option 1: Lộ trình Kanji */}
              <div 
                onClick={() => {
                  setActiveTab('personal-lo-trinh');
                  setOpenSubmenu(null);
                }}
                className="cursor-pointer"
              >
                <RoughCard
                  fill={activeTab === 'personal-lo-trinh' || activeTab === 'personal' ? '#b3ab9e' : '#ffffff'}
                  stroke="#292524"
                  borderRadius={10}
                  roughness={0.7}
                  active={activeTab === 'personal-lo-trinh' || activeTab === 'personal'}
                  className="w-20 h-20 flex flex-col items-center justify-center gap-1.5 p-2 text-center hover:scale-105 transition-transform shadow-xs"
                >
                  <Route className="w-5 h-5 text-[#292524]" />
                  <span className="text-[10px] font-black text-[#292524] leading-tight">
                    Lộ trình Kanji
                  </span>
                </RoughCard>
              </div>

              {/* Option 2: Ôn tập */}
              <div 
                onClick={() => {
                  setActiveTab('personal-on-tap');
                  setOpenSubmenu(null);
                }}
                className="cursor-pointer"
              >
                <RoughCard
                  fill={activeTab === 'personal-on-tap' ? '#b3ab9e' : '#ffffff'}
                  stroke="#292524"
                  borderRadius={10}
                  roughness={0.7}
                  active={activeTab === 'personal-on-tap'}
                  className="w-20 h-20 flex flex-col items-center justify-center gap-1.5 p-2 text-center hover:scale-105 transition-transform shadow-xs"
                >
                  <TrendingUp className="w-5 h-5 text-[#292524]" />
                  <span className="text-[10px] font-black text-[#292524] leading-tight">
                    Ôn tập
                  </span>
                </RoughCard>
              </div>

              {/* Option 3: Chủ động */}
              <div 
                onClick={() => {
                  setActiveTab('personal-chu-dong');
                  setOpenSubmenu(null);
                }}
                className="cursor-pointer"
              >
                <RoughCard
                  fill={activeTab === 'personal-chu-dong' ? '#b3ab9e' : '#ffffff'}
                  stroke="#292524"
                  borderRadius={10}
                  roughness={0.7}
                  active={activeTab === 'personal-chu-dong'}
                  className="w-20 h-20 flex flex-col items-center justify-center gap-1.5 p-2 text-center hover:scale-105 transition-transform shadow-xs"
                >
                  <Brain className="w-5 h-5 text-[#292524]" />
                  <span className="text-[10px] font-black text-[#292524] leading-tight">
                    Chủ động
                  </span>
                </RoughCard>
              </div>

            </div>
          </RoughCard>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. FLYOUT SUBMENU FOR "TRỌN ĐỜI" (Theo ảnh media_1788111971691) */}
      {/* ============================================================ */}
      {openSubmenu === 'lifetime' && (
        <div 
          className="fixed left-[84px] z-50 animate-in fade-in zoom-in-95 duration-150"
          style={{ top: `${popoverTop}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <RoughCard 
            fill="#ffffff" 
            stroke="#292524" 
            borderRadius={12} 
            roughness={0.7} 
            className="p-2 shadow-sketch bg-white"
          >
            <div className="flex items-center gap-2">
              
              {/* Option 1: Lộ trình JLPT (có badge Gợi ý / Mới) */}
              <div 
                onClick={() => {
                  setActiveTab('lifetime-jlpt');
                  setOpenSubmenu(null);
                }}
                className="cursor-pointer relative"
              >
                {/* Blue pill badge */}
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-[#0094ff] text-white text-[8px] font-black px-1.5 py-0.2 rounded-full border border-[#292524] z-20 shadow-2xs">
                  Gợi ý
                </span>
                <RoughCard
                  fill={activeTab === 'lifetime-jlpt' ? '#b3ab9e' : '#ffffff'}
                  stroke="#292524"
                  borderRadius={10}
                  roughness={0.7}
                  active={activeTab === 'lifetime-jlpt'}
                  className="w-20 h-20 flex flex-col items-center justify-center gap-1.5 p-2 text-center hover:scale-105 transition-transform shadow-xs"
                >
                  <Route className="w-5 h-5 text-[#292524]" />
                  <span className="text-[10px] font-black text-[#292524] leading-tight">
                    Lộ trình JLPT
                  </span>
                </RoughCard>
              </div>

              {/* Option 2: Đọc hiểu */}
              <div 
                onClick={() => {
                  setActiveTab('lifetime-doc-hieu');
                  setOpenSubmenu(null);
                }}
                className="cursor-pointer"
              >
                <RoughCard
                  fill={activeTab === 'lifetime-doc-hieu' ? '#b3ab9e' : '#ffffff'}
                  stroke="#292524"
                  borderRadius={10}
                  roughness={0.7}
                  active={activeTab === 'lifetime-doc-hieu'}
                  className="w-20 h-20 flex flex-col items-center justify-center gap-1.5 p-2 text-center hover:scale-105 transition-transform shadow-xs"
                >
                  <Mic className="w-5 h-5 text-[#292524]" />
                  <span className="text-[10px] font-black text-[#292524] leading-tight">
                    Đọc hiểu
                  </span>
                </RoughCard>
              </div>

              {/* Option 3: Shadowing */}
              <div 
                onClick={() => {
                  setActiveTab('lifetime-shadowing');
                  setOpenSubmenu(null);
                }}
                className="cursor-pointer"
              >
                <RoughCard
                  fill={activeTab === 'lifetime-shadowing' ? '#b3ab9e' : '#ffffff'}
                  stroke="#292524"
                  borderRadius={10}
                  roughness={0.7}
                  active={activeTab === 'lifetime-shadowing'}
                  className="w-20 h-20 flex flex-col items-center justify-center gap-1.5 p-2 text-center hover:scale-105 transition-transform shadow-xs"
                >
                  <Volume2 className="w-5 h-5 text-[#292524]" />
                  <span className="text-[10px] font-black text-[#292524] leading-tight">
                    Shadowing
                  </span>
                </RoughCard>
              </div>


            </div>
          </RoughCard>
        </div>
      )}
    </>
  );
};
