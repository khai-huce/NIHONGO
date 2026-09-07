import React from 'react';
import { Bell } from 'lucide-react';

interface TopHeaderProps {
  onUpgradeClick: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({}) => {
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
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button 
          className="p-1.5 rounded-full hover:bg-[#eae3d5] dark:hover:bg-[#292524] text-[#292524] dark:text-[#d6d3d1] transition-colors"
          title="Thông báo"
        >
          <Bell className="w-5 h-5" />
        </button>

        {/* User avatar circle */}
        <div className="w-8 h-8 rounded-full bg-[#0094ff] border-2 border-[#292524] text-white flex items-center justify-center font-bold text-xs shadow-2xs overflow-hidden">
          <img 
            src="https://api.dicebear.com/7.x/bottts/svg?seed=NhaiKanji" 
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

    </header>
  );
};
