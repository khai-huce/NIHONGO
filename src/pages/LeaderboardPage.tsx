import React, { useState } from 'react';
import { Zap, Layers, BookOpen, Crown, Swords } from 'lucide-react';
import { RoughCard } from '../components/RoughCard';

interface LeaderboardUser {
  rank: number;
  name: string;
  avatarUrl?: string;
  avatarText?: string;
  avatarBg?: string;
  isPremium?: boolean;
  xp: string;
  flashcards: number;
  roadmapDays?: number;
}

export const LeaderboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'xp' | 'battle'>('xp');

  // Top 3 Users
  const topThree: LeaderboardUser[] = [
    {
      rank: 2,
      name: 'Lan Chi',
      avatarUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=120&auto=format&fit=crop&q=80',
      isPremium: true,
      xp: '39.9k',
      flashcards: 3347,
      roadmapDays: 59
    },
    {
      rank: 1,
      name: 'Tài Tử',
      avatarUrl: 'https://images.unsplash.com/photo-1551085254-e96b210df58a?w=120&auto=format&fit=crop&q=80',
      isPremium: true,
      xp: '44.9k',
      flashcards: 834,
      roadmapDays: 38
    },
    {
      rank: 3,
      name: 'Khánh Nguyễn Duy',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      isPremium: true,
      xp: '39.6k',
      flashcards: 1588,
      roadmapDays: 72
    }
  ];

  // Ranks 4 to 10
  const rankList: LeaderboardUser[] = [
    {
      rank: 4,
      name: 'Hanh Nhu Luong',
      avatarUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=120&auto=format&fit=crop&q=80',
      isPremium: true,
      xp: '39.4k',
      flashcards: 3009
    },
    {
      rank: 5,
      name: 'Hoàng Việt',
      avatarText: 'H',
      avatarBg: 'bg-stone-500 text-white',
      isPremium: true,
      xp: '38.2k',
      flashcards: 1565
    },
    {
      rank: 6,
      name: 'Mỹ Duyên',
      avatarText: 'Mỹ',
      avatarBg: 'bg-[#0094ff] text-white',
      isPremium: true,
      xp: '38k',
      flashcards: 4507
    },
    {
      rank: 7,
      name: 'Trường Vũ',
      avatarUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=120&auto=format&fit=crop&q=80',
      isPremium: true,
      xp: '36.9k',
      flashcards: 380
    },
    {
      rank: 8,
      name: 'Giao Trần Quỳnh',
      avatarText: 'G',
      avatarBg: 'bg-amber-800 text-white',
      isPremium: true,
      xp: '31.1k',
      flashcards: 0
    },
    {
      rank: 9,
      name: 'thang nguyen',
      avatarText: 't',
      avatarBg: 'bg-stone-700 text-white',
      isPremium: true,
      xp: '30.8k',
      flashcards: 1705
    },
    {
      rank: 10,
      name: 'Dung Ha',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      isPremium: true,
      xp: '30.7k',
      flashcards: 1990
    }
  ];

  // Current User
  const currentUser: LeaderboardUser = {
    rank: 2803,
    name: 'Khải Nguyễn Vĩnh',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    xp: '7',
    flashcards: 0
  };

  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-7 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* 1. Centered Top Filter Tabs */}
      <div className="flex flex-col items-center justify-center space-y-2">
        <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={12} roughness={0.7} className="p-1 inline-flex shadow-sketch">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('xp')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeTab === 'xp'
                  ? 'bg-[#fdfbf7] text-[#292524] border border-[#78716c]/60 shadow-xs'
                  : 'text-[#78716c] hover:bg-[#eae3d5]'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              <span>Tổng XP</span>
            </button>

            <button
              onClick={() => setActiveTab('battle')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeTab === 'battle'
                  ? 'bg-[#fdfbf7] text-[#292524] border border-[#78716c]/60 shadow-xs'
                  : 'text-[#78716c] hover:bg-[#eae3d5]'
              }`}
            >
              <Swords className="w-3.5 h-3.5 text-[#78716c]" />
              <span>Đấu trí tháng</span>
            </button>
          </div>
        </RoughCard>

        {/* Legend Metric Subline */}
        <div className="flex items-center gap-4 text-[11px] font-bold text-[#78716c]">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500 fill-amber-400" />
            <span>XP</span>
          </span>
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-[#78716c]" />
            <span>Thẻ ghi nhớ</span>
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-[#78716c]" />
            <span>Ngày lộ trình</span>
          </span>
        </div>
      </div>

      {/* 2. Top 3 Podium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 items-end pt-3">
        
        {/* RANK 2: Lan Chi (Left) */}
        <div className="relative order-2 md:order-1">
          {/* Medal Badge 2 */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-7 h-7 rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center text-xs font-black text-blue-700 shadow-xs">
            2
          </div>

          <RoughCard
            fill="#dbeafe"
            stroke="#78716c"
            borderRadius={14}
            roughness={0.7}
            className="p-5 text-center space-y-2.5 shadow-sketch min-h-[190px] flex flex-col justify-between"
          >
            <div className="flex flex-col items-center space-y-1.5 pt-1">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#78716c]/40 shadow-xs bg-white">
                <img src={topThree[0].avatarUrl} alt={topThree[0].name} className="w-full h-full object-cover" />
              </div>

              <div className="space-y-0.5">
                <div className="text-sm font-black text-[#292524] font-sketch">
                  {topThree[0].name}
                </div>
                {topThree[0].isPremium && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-amber-100 border border-amber-300 text-[10px] font-black text-amber-800">
                    <Crown className="w-2.5 h-2.5 text-amber-600 fill-amber-500" />
                    Premium
                  </span>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-center gap-3 text-xs font-bold text-[#57534e] pt-1">
              <span className="flex items-center gap-1 text-amber-600">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <span className="font-black">{topThree[0].xp}</span>
                <span className="text-[10px] text-[#78716c]">XP</span>
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#78716c]" />
                <span>{topThree[0].flashcards}</span>
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-[#78716c]" />
                <span>{topThree[0].roadmapDays}</span>
              </span>
            </div>
          </RoughCard>
        </div>

        {/* RANK 1: Tài Tử (Center - Taller & Highlighted) */}
        <div className="relative order-1 md:order-2 md:-translate-y-2">
          {/* Medal Badge 1 */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20 w-8 h-8 rounded-full bg-amber-400 border-2 border-amber-600 flex items-center justify-center text-sm font-black text-amber-950 shadow-md">
            1
          </div>

          <RoughCard
            fill="#fef3c7"
            stroke="#b45309"
            borderRadius={16}
            roughness={0.7}
            className="p-6 text-center space-y-3 shadow-sketch min-h-[210px] flex flex-col justify-between border-2 border-amber-400"
          >
            <div className="flex flex-col items-center space-y-1.5 pt-1">
              <div className="w-18 h-18 rounded-full overflow-hidden border-2 border-amber-500 shadow-sm bg-white">
                <img src={topThree[1].avatarUrl} alt={topThree[1].name} className="w-full h-full object-cover" />
              </div>

              <div className="space-y-0.5">
                <div className="text-base font-black text-[#292524] font-sketch">
                  {topThree[1].name}
                </div>
                {topThree[1].isPremium && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-amber-100 border border-amber-300 text-[10px] font-black text-amber-800">
                    <Crown className="w-2.5 h-2.5 text-amber-600 fill-amber-500" />
                    Premium
                  </span>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-center gap-3.5 text-xs font-bold text-[#57534e] pt-1">
              <span className="flex items-center gap-1 text-amber-600">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <span className="font-black text-sm">{topThree[1].xp}</span>
                <span className="text-[10px] text-[#78716c]">XP</span>
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#78716c]" />
                <span>{topThree[1].flashcards}</span>
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-[#78716c]" />
                <span>{topThree[1].roadmapDays}</span>
              </span>
            </div>
          </RoughCard>
        </div>

        {/* RANK 3: Khánh Nguyễn Duy (Right) */}
        <div className="relative order-3">
          {/* Medal Badge 3 */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-7 h-7 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center text-xs font-black text-emerald-800 shadow-xs">
            3
          </div>

          <RoughCard
            fill="#d1fae5"
            stroke="#78716c"
            borderRadius={14}
            roughness={0.7}
            className="p-5 text-center space-y-2.5 shadow-sketch min-h-[190px] flex flex-col justify-between"
          >
            <div className="flex flex-col items-center space-y-1.5 pt-1">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#78716c]/40 shadow-xs bg-white">
                <img src={topThree[2].avatarUrl} alt={topThree[2].name} className="w-full h-full object-cover" />
              </div>

              <div className="space-y-0.5">
                <div className="text-sm font-black text-[#292524] font-sketch">
                  {topThree[2].name}
                </div>
                {topThree[2].isPremium && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-amber-100 border border-amber-300 text-[10px] font-black text-amber-800">
                    <Crown className="w-2.5 h-2.5 text-amber-600 fill-amber-500" />
                    Premium
                  </span>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-center gap-3 text-xs font-bold text-[#57534e] pt-1">
              <span className="flex items-center gap-1 text-amber-600">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <span className="font-black">{topThree[2].xp}</span>
                <span className="text-[10px] text-[#78716c]">XP</span>
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#78716c]" />
                <span>{topThree[2].flashcards}</span>
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-[#78716c]" />
                <span>{topThree[2].roadmapDays}</span>
              </span>
            </div>
          </RoughCard>
        </div>

      </div>

      {/* 3. Ranks 4 to 10 List */}
      <div className="space-y-2.5">
        {rankList.map((user) => (
          <RoughCard
            key={user.rank}
            fill="#ffffff"
            stroke="#78716c"
            borderRadius={12}
            roughness={0.7}
            className="p-3 md:p-3.5 flex items-center justify-between shadow-sketch hover:bg-slate-50/70 transition-colors"
          >
            {/* Left: Rank Number + Avatar + Name + Premium Badge */}
            <div className="flex items-center gap-3.5">
              <span className="w-6 text-center text-xs font-black text-[#78716c] font-mono">
                {String(user.rank).padStart(2, '0')}
              </span>

              {/* User Avatar */}
              <div className="w-9 h-9 rounded-full overflow-hidden border border-[#78716c]/40 shrink-0 flex items-center justify-center font-bold text-xs">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center font-black ${user.avatarBg}`}>
                    {user.avatarText}
                  </div>
                )}
              </div>

              {/* User Name & Premium */}
              <div className="space-y-0.5">
                <div className="text-xs font-black text-[#292524] font-sketch">
                  {user.name}
                </div>
                {user.isPremium && (
                  <div className="flex items-center gap-1 text-[9px] font-black text-amber-700">
                    <Crown className="w-2.5 h-2.5 text-amber-600 fill-amber-500" />
                    <span>Premium</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: XP & Flashcards */}
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1 text-amber-600 font-black">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <span>{user.xp}</span>
                <span className="text-[10px] text-[#78716c] font-bold">XP</span>
              </span>

              <span className="flex items-center gap-1 text-[#57534e] min-w-[55px] justify-end">
                <Layers className="w-3.5 h-3.5 text-[#78716c]" />
                <span>{user.flashcards}</span>
              </span>
            </div>
          </RoughCard>
        ))}
      </div>

      {/* 4. Bottom Sticky Separator & Current User Rank */}
      <div className="space-y-3 pt-2">
        {/* Divider with Text */}
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-[#78716c]/30" />
          <span className="absolute bg-sketch-paper px-3 text-[11px] font-bold text-[#78716c]">
            Thứ hạng của bạn
          </span>
        </div>

        {/* Current User Card */}
        <RoughCard
          fill="#d8b4fe"
          stroke="#78716c"
          borderRadius={12}
          roughness={0.7}
          className="p-3 md:p-3.5 flex items-center justify-between shadow-sketch border-2 border-purple-400"
        >
          {/* Left info */}
          <div className="flex items-center gap-3.5">
            <span className="text-xs font-black text-[#292524] font-mono min-w-[32px]">
              {currentUser.rank}
            </span>

            <div className="w-9 h-9 rounded-full overflow-hidden border border-[#78716c]/40 shrink-0 bg-white">
              <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
            </div>

            <div className="text-xs font-black text-[#292524] font-sketch">
              {currentUser.name}
            </div>
          </div>

          {/* Right info */}
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1 text-amber-700 font-black">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              <span>{currentUser.xp}</span>
              <span className="text-[10px] text-purple-900 font-bold">XP</span>
            </span>

            <span className="flex items-center gap-1 text-purple-950 min-w-[55px] justify-end">
              <Layers className="w-3.5 h-3.5 text-purple-700" />
              <span>{currentUser.flashcards}</span>
            </span>
          </div>
        </RoughCard>
      </div>

    </div>
  );
};
