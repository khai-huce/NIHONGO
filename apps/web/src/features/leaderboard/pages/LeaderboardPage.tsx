import React, { useEffect, useRef, useState } from 'react';
import { Zap, Layers, BookOpen, Crown, Swords } from 'lucide-react';
import { RoughCard } from '../../../shared/ui/RoughCard';
import { useAccountResource } from '../../../shared/hooks/useAccountResource';
import type { LeaderboardPeriod, LeaderboardResponse } from '@nihongo/shared/contracts/leaderboard';
import { LeaderboardAvatar } from '../components/LeaderboardAvatar';
import { formatXp, leaderboardSlots } from '../utils/display';

type Props = { userId: string | null; authBusy: boolean; onLogin: () => void };
export const LeaderboardPage: React.FC<Props> = ({ userId, authBusy, onLogin }) => {
  const [activeTab, setActiveTab] = useState<LeaderboardPeriod>('all');
  const resource = useAccountResource<LeaderboardResponse>(`/leaderboard?period=${activeTab}`, userId, authBusy);
  const lastRefresh = useRef(0);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefresh.current < 1000) return;
      lastRefresh.current = Date.now();
      void resource.reload();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [resource.reload]);
  const board = !authBusy && resource.data?.period === activeTab ? resource.data : null;
  const { topThree, rankList } = leaderboardSlots(board?.entries ?? []);
  const currentUser = board?.currentUser ?? null;

  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-7 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* 1. Centered Top Filter Tabs */}
      <div className="flex flex-col items-center justify-center space-y-2">
        <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} className="p-1 inline-flex">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('all')}
              aria-pressed={activeTab === 'all'}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#fdfbf7] text-[#292524] border border-[#78716c]/60 shadow-xs'
                  : 'text-[#78716c] hover:bg-[#eae3d5]'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              <span>Tổng XP</span>
            </button>

            <button
              onClick={() => setActiveTab('month')}
              aria-pressed={activeTab === 'month'}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeTab === 'month'
                  ? 'bg-[#fdfbf7] text-[#292524] border border-[#78716c]/60 shadow-xs'
                  : 'text-[#78716c] hover:bg-[#eae3d5]'
              }`}
            >
              <Swords className="w-3.5 h-3.5 text-[#78716c]" />
              <span>XP tháng</span>
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

      {resource.loading && !board && <p role="status" className="text-center text-sm">Đang tải bảng xếp hạng…</p>}
      {resource.error && <div role="alert" className="text-center text-sm text-red-700">{resource.error} <button className="underline font-bold" onClick={() => void resource.reload()}>Thử lại</button></div>}
      {board && board.entries.length === 0 && <RoughCard fill="#ffffff" className="p-6 text-center text-sm"><p>{activeTab === 'month' ? 'Chưa có điểm XP trong tháng này.' : 'Chưa có người học nhận XP.'}</p><p className="mt-2 text-[#78716c]">XP được tính từ các hoạt động học đã lưu kể từ khi chức năng xếp hạng bắt đầu.</p></RoughCard>}
      {/* 2. Top 3 Podium Cards */}
      <div role="region" aria-label="Ba vị trí đầu" className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 items-end pt-3">
        
        {topThree[0] && (
        <div className="relative order-2 md:order-1 md:col-start-1">
          {/* Medal Badge 2 */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-7 h-7 rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center text-xs font-black text-blue-700 shadow-xs">
            {topThree[0].rank}
          </div>

          <RoughCard
            fill="#dbeafe"
            stroke="#292524"
            borderRadius={14}
            className="p-5 text-center space-y-2.5 min-h-[190px] flex flex-col justify-between"
          >
            <div className="flex flex-col items-center space-y-1.5 pt-1">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#78716c]/40 shadow-xs bg-white">
                <LeaderboardAvatar user={topThree[0]} />
              </div>

              <div className="space-y-0.5">
                <div className="text-sm font-black text-[#292524] font-sketch [overflow-wrap:anywhere]">
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
                <span className="font-black">{formatXp(topThree[0].xp)}</span>
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
        )}

        {topThree[1] && (
        <div className="relative order-1 md:order-2 md:col-start-2 md:-translate-y-2">
          {/* Medal Badge 1 */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20 w-8 h-8 rounded-full bg-amber-400 border-2 border-amber-600 flex items-center justify-center text-sm font-black text-amber-950 shadow-md">
            {topThree[1].rank}
          </div>

          <RoughCard
            fill="#fef3c7"
            stroke="#292524"
            borderRadius={16}
            className="p-6 text-center space-y-3 min-h-[210px] flex flex-col justify-between"
          >
            <div className="flex flex-col items-center space-y-1.5 pt-1">
              <div className="w-[72px] h-[72px] rounded-full overflow-hidden border-2 border-amber-500 shadow-sm bg-white">
                <LeaderboardAvatar user={topThree[1]} />
              </div>

              <div className="space-y-0.5">
                <div className="text-base font-black text-[#292524] font-sketch [overflow-wrap:anywhere]">
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
                <span className="font-black text-sm">{formatXp(topThree[1].xp)}</span>
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
        )}

        {topThree[2] && (
        <div className="relative order-3 md:col-start-3">
          {/* Medal Badge 3 */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-7 h-7 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center text-xs font-black text-emerald-800 shadow-xs">
            {topThree[2].rank}
          </div>

          <RoughCard
            fill="#d1fae5"
            stroke="#292524"
            borderRadius={14}
            className="p-5 text-center space-y-2.5 min-h-[190px] flex flex-col justify-between"
          >
            <div className="flex flex-col items-center space-y-1.5 pt-1">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#78716c]/40 shadow-xs bg-white">
                <LeaderboardAvatar user={topThree[2]} />
              </div>

              <div className="space-y-0.5">
                <div className="text-sm font-black text-[#292524] font-sketch [overflow-wrap:anywhere]">
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
                <span className="font-black">{formatXp(topThree[2].xp)}</span>
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
        )}

      </div>

      {/* 3. Ranks 4 to 10 List */}
      <div className="space-y-2.5">
        {rankList.map((user) => (
          <RoughCard
            key={user.userId}
            fill="#ffffff"
            stroke="#292524"
            borderRadius={12}
            className="p-3 md:p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
          >
            {/* Left: Rank Number + Avatar + Name + Premium Badge */}
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="w-6 text-center text-xs font-black text-[#78716c] font-mono">
                {String(user.rank).padStart(2, '0')}
              </span>

              {/* User Avatar */}
              <div className="w-9 h-9 rounded-full overflow-hidden border border-[#78716c]/40 shrink-0 flex items-center justify-center font-bold text-xs">
                <LeaderboardAvatar user={user} />
              </div>

              {/* User Name & Premium */}
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs font-black text-[#292524] font-sketch [overflow-wrap:anywhere]">
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
            <div className="flex items-center gap-4 text-xs font-bold shrink-0">
              <span className="flex items-center gap-1 text-amber-600 font-black">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <span>{formatXp(user.xp)}</span>
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
        {currentUser ? <RoughCard
          role="region" aria-label="Thứ hạng cá nhân"
          fill="#d8b4fe"
          stroke="#292524"
          borderRadius={12}
          className="p-3 md:p-3.5 flex items-center justify-between"
        >
          {/* Left info */}
          <div className="flex items-center gap-3.5 min-w-0">
            <span title={currentUser.rank === null ? 'Chưa có XP trong kỳ này' : `Hạng ${currentUser.rank}`} className="text-xs font-black text-[#292524] font-mono min-w-[32px]">
              {currentUser.rank ?? '—'}
            </span>

            <div className="w-9 h-9 rounded-full overflow-hidden border border-[#78716c]/40 shrink-0 bg-white">
              <LeaderboardAvatar user={currentUser} />
            </div>

            <div className="text-xs font-black text-[#292524] font-sketch [overflow-wrap:anywhere] min-w-0">
              {currentUser.name}
            </div>
          </div>

          {/* Right info */}
          <div className="flex items-center gap-4 text-xs font-bold shrink-0">
            <span className="flex items-center gap-1 text-amber-700 font-black">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              <span>{formatXp(currentUser.xp)}</span>
              <span className="text-[10px] text-purple-900 font-bold">XP</span>
            </span>

            <span className="flex items-center gap-1 text-purple-950 min-w-[55px] justify-end">
              <Layers className="w-3.5 h-3.5 text-purple-700" />
              <span>{currentUser.flashcards}</span>
            </span>
          </div>
        </RoughCard> : !userId && !authBusy ? <RoughCard fill="#d8b4fe" stroke="#292524" borderRadius={12} className="p-3 md:p-3.5 text-center text-sm"><button type="button" className="underline font-bold" onClick={onLogin}>Đăng nhập để xem thứ hạng của bạn</button></RoughCard> : null}
      </div>

    </div>
  );
};
