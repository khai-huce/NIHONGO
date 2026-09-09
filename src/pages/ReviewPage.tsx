import React, { useState, useEffect, useRef } from 'react';
import { 
  RotateCcw, 
  ExternalLink, 
  Volume2, 
  Flame, 
  Calendar, 
  BarChart2, 
  Clock, 
  Timer, 
  ArrowLeft
} from 'lucide-react';
import { useReview, type Rating, type ReviewCard, type ReviewCategory } from '../hooks/useReview';
import { reviewGroups, StudyTimer } from '../utils/review';
import { speakJapanese } from '../utils/speech';
import { RoughCard, RoughButton } from '../components/RoughCard';
import { KANJI_DATABASE } from '../data/kanjiData';
import { KanjiItem } from '../types';
import { GrammarDetailItem, SAMPLE_GRAMMAR_ITEMS } from '../components/GrammarDetailView';

interface ReviewItem {
  id: string;
  type: 'kanji' | 'vocab' | 'grammar';
  mainText: string;
  subText: string;
  meaning: string;
  hint?: string;
  exampleJp?: string;
  exampleVi?: string;
}

interface ReviewPageProps {
  onSelectKanji?: (item: KanjiItem) => void;
  onSelectGrammar?: (item: GrammarDetailItem) => void;
}

export const ReviewPage: React.FC<ReviewPageProps> = ({ onSelectKanji, onSelectGrammar }) => {
  const review = useReview();
  const [activeCategory, setActiveCategory] = useState<ReviewCategory>('kanji');
  const [isReviewing, setIsReviewing] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [queue, setQueue] = useState<ReviewCard[]>([]);
  const [index, setIndex] = useState(0);
  const [resetCount, setResetCount] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const studyTimer = useRef(new StudyTimer()), submitting = useRef(false);
  const clock = now + review.clockOffset;
  const cards = review.cards.filter(c => c.active && c.category === activeCategory);
  const due = cards.filter(c => Date.parse(c.dueAt) <= clock);
  const remainingDue = due.length;
  const nextDue = cards.filter(c => Date.parse(c.dueAt) > clock).reduce<number | null>((min,c) => Math.min(min ?? Infinity, Date.parse(c.dueAt)), null);
  const countdownSeconds = nextDue === null ? 0 : Math.max(0, Math.ceil((nextDue-clock)/1000));
  const stats = review.stats.find(s => s.category === activeCategory);
  const ratingDistribution = stats?.distribution ?? { again: 0, hard: 0, good: 0, easy: 0 };
  const percent = (rating: Rating) => stats?.total ? Math.round(ratingDistribution[rating]/stats.total*100) : 0;
  const groups = reviewGroups(cards);
  const current = queue[index];
  useEffect(() => {
    if (!isReviewing || !current || review.busy || !review.loaded) return;
    const latest = review.cards.find(c => c.id === current.id);
    if (!latest?.active || latest.version !== current.version) setIsReviewing(false);
  }, [isReviewing, current, review.cards, review.busy, review.loaded]);
  const grammar = current?.category === 'grammar' ? Object.values(SAMPLE_GRAMMAR_ITEMS).find(g => g.pattern === current.sourceId) : undefined;
  const kanji = current?.category === 'kanji' ? KANJI_DATABASE.find(k => k.id === current.sourceId) : undefined;
  const currentCard: ReviewItem | undefined = current && { id: current.id, type: current.category, mainText: current.front, subText: current.reading ?? '', meaning: current.back, hint: current.hint };
  const day = new Date(clock + 7*3600000).toISOString().slice(0,10);
  const lastDay = useRef(day);
  const daily = stats?.daily ?? Array.from({length:7}, (_,i) => ({day: new Date(Date.parse(day)+(i-6)*86400000).toISOString().slice(0,10), count:0}));
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()),1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (lastDay.current !== day && !review.busy) { lastDay.current = day; void review.reload(); } }, [day, review.reload, review.busy]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void review.reload(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus',refresh); document.removeEventListener('visibilitychange',refresh); };
  }, [review.reload]);
  const pauseTimer = () => {
    studyTimer.current.pause(performance.now());
  };
  useEffect(() => {
    studyTimer.current.reset();
  }, [current?.id, isReviewing]);
  useEffect(() => {
    const sync = () => {
      pauseTimer();
      if (isReviewing && current && !review.busy && !submitting.current && document.visibilityState === 'visible') studyTimer.current.resume(performance.now());
    };
    sync(); document.addEventListener('visibilitychange',sync);
    return () => { pauseTimer(); document.removeEventListener('visibilitychange',sync); };
  }, [current?.id, isReviewing, review.busy]);
  const handleRate = async (rating: Rating) => {
    if (!current || !isFlipped || review.busy || submitting.current) return;
    submitting.current = true; pauseTimer();
    const success = await review.rate(current,rating,studyTimer.current.elapsed);
    submitting.current = false;
    if (success) {
      setIsFlipped(false);
      if (index+1 >= queue.length) setIsReviewing(false);
      else setIndex(index+1);
    } else if (document.visibilityState === 'visible') studyTimer.current.resume(performance.now());
  };
  useEffect(() => {
    if (!isReviewing) return;
    const keydown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || /INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); setIsFlipped(v => !v); }
      if (['1','2','3','4'].includes(e.key)) { e.preventDefault(); void handleRate((['again','hard','good','easy'] as Rating[])[Number(e.key)-1]); }
      if (e.key === 'Escape' && !review.busy) setIsReviewing(false);
    };
    window.addEventListener('keydown',keydown); return () => window.removeEventListener('keydown',keydown);
  });
  const startReview = () => {
    if (!review.userId) { review.onLogin(); return; }
    if (review.busy || !due.length) return;
    setQueue(due); setIndex(0); setIsFlipped(false); setIsReviewing(true);
  };
  const handleReset = () => setResetCount(cards.length);
  const confirmReset = async () => {
    if (resetCount !== null && await review.reset(activeCategory,resetCount)) setResetCount(null);
  };
  const formatCountdown = (secs: number) => [Math.floor(secs/3600),Math.floor(secs/60)%60,secs%60].map(n=>String(n).padStart(2,'0')).join(':');
  const daysFor = (rating: 'good'|'easy') => Math.min(365, Math.max(rating==='good' ? 1 : 4,(current?.intervalSeconds ?? 0)/86400*(rating==='good' ? 2 : 3)));

  if (isReviewing && currentCard) {
    return (
      <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 flex flex-col items-center justify-center space-y-6 max-w-3xl mx-auto select-none">
        
        {/* Main Dark Navy Flashcard */}
        <div className="w-full max-w-xl">
          <div 
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full min-h-[360px] rounded-3xl bg-[#1e2238] text-white p-7 shadow-sketch relative flex flex-col justify-between cursor-pointer border-sketch hover:border-[#0094ff] transition-colors"
          >
            {/* Top-left action: Xem chi tiết */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (grammar) onSelectGrammar?.(grammar);
                  if (kanji) onSelectKanji?.(kanji);
                }}
                className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
                title="Xem chi tiết" disabled={!grammar && !kanji}
              >
                <ExternalLink className="w-4 h-4" />
                <span>Xem chi tiết</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  speakJapanese(currentCard.mainText);
                }}
                className="p-1 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {/* Center Content: Smooth 3D Flip Animation */}
            <div 
              className="relative w-full my-auto flex items-center justify-center min-h-[220px]"
              style={{ perspective: '1200px' }}
            >
              <div 
                className="w-full relative transition-transform duration-500 ease-out"
                style={{
                  transformStyle: 'preserve-3d',
                  WebkitTransformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
              >
                {/* FRONT FACE: Only question/character */}
                <div 
                  className="w-full flex flex-col items-center justify-center select-none py-6"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden'
                  }}
                >
                  <div className="text-7xl sm:text-8xl font-kanji font-bold tracking-wider text-white">
                    {currentCard.mainText}
                  </div>
                </div>

                {/* BACK FACE: Full explanation, meaning, hint & examples */}
                <div 
                  className="w-full absolute inset-0 flex flex-col items-center justify-center space-y-3 select-none py-2"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  <div className="text-6xl font-kanji font-bold tracking-wider text-white">
                    {currentCard.mainText}
                  </div>

                  <div className="text-lg font-bold text-slate-300 font-kanji">
                    {currentCard.subText}
                  </div>

                  <div className="text-xl font-black text-white">
                    {currentCard.meaning}
                  </div>

                  {/* Hint Pill */}
                  {currentCard.hint && (
                    <div className="pt-2">
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-bold text-amber-300 shadow-inner">
                        <span>💡</span>
                        <span>{currentCard.hint}</span>
                      </span>
                    </div>
                  )}

                  {/* Grammar & Vocab Examples */}
                  {currentCard.exampleJp && (
                    <div className="pt-3 border-t border-slate-700/50 text-xs font-bold text-slate-300 space-y-1">
                      <div className="font-kanji text-sm text-white">{currentCard.exampleJp}</div>
                      <div className="text-slate-400 text-[11px]">{currentCard.exampleVi}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mascot crow in bottom-right */}
            <div className="absolute right-4 bottom-14 opacity-90 select-none pointer-events-none">
              <div className="text-5xl transform -rotate-12">🐦</div>
            </div>

            {/* Bottom Keyboard Hint Bar */}
            <div className="pt-4 border-t border-slate-700/60 flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400">
              <span>⌨ Nhấn</span>
              <span className="px-2 py-0.5 rounded border border-slate-600 bg-slate-800 text-white font-mono text-[10px]">
                Space
              </span>
              <span>để lật, bấm</span>
              <span className="px-2 py-0.5 rounded border border-slate-600 bg-slate-800 text-white font-mono text-[10px]">
                1-4
              </span>
              <span>để đánh giá</span>
            </div>
          </div>
        </div>

        {/* Navigation & Progress */}
        <div className="w-full max-w-xl flex items-center justify-between text-xs font-bold text-[#78716c]">
          <button
            disabled={review.busy} onClick={() => setIsReviewing(false)}
            className="flex items-center gap-1.5 hover:text-[#292524] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Thống kê</span>
          </button>

          <span className="font-mono text-sm font-black text-[#292524]">
            {index + 1} / {queue.length}
          </span>
        </div>

        {/* 4 SRS Rating Buttons */}
        <div className="w-full max-w-xl grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Button 1: Quên rồi */}
          <button
            disabled={!isFlipped || review.busy} onClick={() => void handleRate('again')}
            className="p-3 rounded-2xl bg-[#fca5a5] border-sketch text-center space-y-0.5 hover:scale-102 active:scale-98 transition-transform cursor-pointer shadow-sketch"
          >
            <div className="text-sm font-black text-rose-900">Quên rồi</div>
            <div className="text-[11px] font-bold text-rose-800/80">1 phút</div>
          </button>

          {/* Button 2: Khó */}
          <button
            disabled={!isFlipped || review.busy} onClick={() => void handleRate('hard')}
            className="p-3 rounded-2xl bg-[#fdba74] border-sketch text-center space-y-0.5 hover:scale-102 active:scale-98 transition-transform cursor-pointer shadow-sketch"
          >
            <div className="text-sm font-black text-orange-950">Khó</div>
            <div className="text-[11px] font-bold text-orange-900/80">6 phút</div>
          </button>

          {/* Button 3: Tốt */}
          <button
            disabled={!isFlipped || review.busy} onClick={() => void handleRate('good')}
            className="p-3 rounded-2xl bg-[#86efac] border-sketch-green text-center space-y-0.5 hover:scale-102 active:scale-98 transition-transform cursor-pointer shadow-sketch"
          >
            <div className="text-sm font-black text-emerald-950">Tốt</div>
            <div className="text-[11px] font-bold text-emerald-900/80">{daysFor('good')} ngày</div>
          </button>

          {/* Button 4: Dễ */}
          <button
            disabled={!isFlipped || review.busy} onClick={() => void handleRate('easy')}
            className="p-3 rounded-2xl bg-[#93c5fd] border-sketch-blue text-center space-y-0.5 hover:scale-102 active:scale-98 transition-transform cursor-pointer shadow-sketch"
          >
            <div className="text-sm font-black text-blue-950">Dễ</div>
            <div className="text-[11px] font-bold text-blue-900/80">{daysFor('easy')} ngày</div>
          </button>
        </div>

      </div>
    );
  }

  // ============================================================
  // MAIN VIEW: THỐNG KÊ HỌC TẬP (Images 1, 3, 5)
  // ============================================================


  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-6 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* 1. Header Banner */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-black text-[#292524] dark:text-white font-sketch tracking-tight">
          Thống kê học tập
        </h1>
        <div className="text-xs md:text-sm font-bold text-[#57534e] space-y-0.5">
          <p>Theo dõi tiến độ và kế hoạch ôn tập của bạn,</p>
          <p className="text-[#78716c]">
            theo các báo cáo 21 ngày ôn tập kiến thức sẽ được nạp vào trí nhớ dài hạn
          </p>
        </div>
      </div>

      {!review.userId && <p className="text-sm"><button className="underline font-bold" onClick={review.onLogin}>Đăng nhập</button> để lưu và ôn những thẻ bạn gắn sao.</p>}
      {review.loading && <p role="status" className="text-xs">Đang tải dữ liệu ôn tập…</p>}
      {/* 2. Category Switcher Tabs */}
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-1 shadow-sketch">
        <div className="grid grid-cols-3 gap-1">
          {/* Tab 1: Kanji */}
          <button
            disabled={resetCount !== null}
            onClick={() => setActiveCategory('kanji')}
            className={`py-2 px-3 flex items-center justify-center gap-1.5 font-black text-xs md:text-sm transition-all rounded-lg cursor-pointer ${
              activeCategory === 'kanji'
                ? 'bg-[#ea580c] text-white shadow-xs'
                : 'text-[#57534e] hover:bg-[#eae3d5]'
            }`}
          >
            <span>⛩ Kanji</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeCategory === 'kanji' ? 'bg-white text-[#ea580c]' : 'bg-orange-100 text-orange-700'
            }`}>
              {review.cards.filter(c => c.active && c.category === 'kanji').length}
            </span>
          </button>

          {/* Tab 2: Từ vựng */}
          <button
            disabled={resetCount !== null}
            onClick={() => setActiveCategory('vocab')}
            className={`py-2 px-3 flex items-center justify-center gap-1.5 font-black text-xs md:text-sm transition-all rounded-lg cursor-pointer ${
              activeCategory === 'vocab'
                ? 'bg-[#ea580c] text-white shadow-xs'
                : 'text-[#57534e] hover:bg-[#eae3d5]'
            }`}
          >
            <span>👑 Từ vựng</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeCategory === 'vocab' ? 'bg-white text-[#ea580c]' : 'bg-amber-100 text-amber-700'
            }`}>
              {review.cards.filter(c => c.active && c.category === 'vocab').length}
            </span>
          </button>

          {/* Tab 3: Ngữ pháp */}
          <button
            disabled={resetCount !== null}
            onClick={() => setActiveCategory('grammar')}
            className={`py-2 px-3 flex items-center justify-center gap-1.5 font-black text-xs md:text-sm transition-all rounded-lg cursor-pointer ${
              activeCategory === 'grammar'
                ? 'bg-[#c084fc] text-white shadow-xs'
                : 'text-[#57534e] hover:bg-[#eae3d5]'
            }`}
          >
            <span>🌸 Ngữ pháp</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeCategory === 'grammar' ? 'bg-white text-[#7e22ce]' : 'bg-purple-100 text-purple-700'
            }`}>
              {review.cards.filter(c => c.active && c.category === 'grammar').length}
            </span>
          </button>
        </div>
      </RoughCard>

      {/* 3. 6 Stat Counters Row */}
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-4 shadow-sketch">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
          {/* Cần ôn */}
          <div className="space-y-0.5">
            <div className={`text-2xl font-black ${remainingDue > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
              {remainingDue}
            </div>
            <div className="text-[11px] font-bold text-[#78716c]">Cần ôn</div>
          </div>

          {/* Mới thêm */}
          <div className="space-y-0.5">
            <div className={`text-2xl font-black text-[#0094ff]`}>
              {groups.new}
            </div>
            <div className="text-[11px] font-bold text-[#78716c]">Mới thêm</div>
          </div>

          {/* Đang học */}
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-amber-500">
              {groups.learning}
            </div>
            <div className="text-[11px] font-bold text-[#78716c]">Đang học (&lt; 6 phút)</div>
          </div>

          {/* Mới thuộc */}
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-orange-600">{groups.short}</div>
            <div className="text-[11px] font-bold text-[#78716c]">Mới thuộc (ngắn hạn &lt;21 ngày)</div>
          </div>

          {/* Đã thuộc */}
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-emerald-600">{groups.long}</div>
            <div className="text-[11px] font-bold text-[#78716c]">Đã thuộc (dài hạn)</div>
          </div>

          {/* Tổng đã học qua */}
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-[#292524]">{cards.length}</div>
            <div className="text-[11px] font-bold text-[#78716c]">Tổng đã học qua</div>
          </div>
        </div>
      </RoughCard>

      {/* 4. 2 Action Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Left Card: Thẻ cần ôn hôm nay */}
        <RoughCard
          fill={
            activeCategory === 'grammar' 
              ? '#e9d5ff' 
              : activeCategory === 'vocab'
              ? '#fef3c7'
              : '#fed7aa'
          }
          stroke="#292524"
          borderRadius={14}
          roughness={0.7}
          className="p-5 flex flex-col justify-between min-h-[170px] shadow-sketch"
        >
          <div className="flex items-start justify-between">
            <div className="text-xs font-black text-[#292524]">
              {activeCategory === 'grammar' 
                ? 'Thẻ ngữ pháp cần ôn hôm nay' 
                : activeCategory === 'vocab'
                ? 'Thẻ từ vựng cần ôn hôm nay'
                : 'Thẻ kanji cần ôn hôm nay'}
            </div>

            <button
              disabled={review.busy || !review.userId || !cards.length} onClick={handleReset}
              className="px-2.5 py-1 rounded-full border-sketch-subtle bg-white/70 hover:bg-white text-[10px] font-bold text-[#292524] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Học lại từ đầu</span>
            </button>
          </div>

          <div className="my-2">
            <div className="text-4xl md:text-5xl font-black text-[#292524]">
              {remainingDue}
            </div>
          </div>

          <div>
            {remainingDue > 0 ? (
              <RoughButton
                disabled={review.busy} onClick={startReview}
                fill="#fdfbf7"
                stroke="#292524"
                borderRadius={8}
                roughness={0.7}
                className="text-[#292524] px-4 py-1.5 text-xs font-black cursor-pointer shadow-xs"
              >
                <span>Ôn tập ngay</span>
              </RoughButton>
            ) : (
              <div className="text-xs font-black text-emerald-800 flex items-center gap-1">
                <span>{cards.length ? 'Đã hết thẻ đến hạn.' : 'Chưa có thẻ đang gắn sao.'}</span>
              </div>
            )}
          </div>
        </RoughCard>

        {/* Right Card: Lượt ôn tập tiếp theo */}
        <RoughCard
          fill="#60a5fa"
          stroke="#292524"
          borderRadius={14}
          roughness={0.7}
          className="p-5 flex flex-col justify-between min-h-[170px] shadow-sketch text-white"
        >
          <div className="text-xs font-black text-white/90">
            Lượt ôn tập tiếp theo
          </div>

          <div className="my-auto py-2">
            <div className="text-3xl md:text-4xl font-mono font-black tracking-widest text-white">
              {nextDue !== null ? formatCountdown(countdownSeconds) : remainingDue ? '00:00:00' : '--:--:--'}
            </div>
          </div>

          <div className="text-[11px] font-bold text-white/80">
            {nextDue !== null ? 'Thời gian đến lượt ôn tiếp theo' : remainingDue ? 'Có thẻ đã đến hạn ôn tập' : 'Chưa có lịch ôn tập tiếp theo'}
          </div>
        </RoughCard>

      </div>

      {/* ============================================================ */}
      {/* 5. CHI TIẾT ÔN TẬP (EMPTY BEFORE REVIEW / ANALYTICS AFTER REVIEW) */}
      {/* ============================================================ */}
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={14} roughness={0.7} className="p-6 space-y-5 shadow-sketch">
        <h3 className="text-sm font-black text-[#292524] font-sketch">
          Chi tiết ôn tập
        </h3>

          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* 5 Stat Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {/* Streak */}
              <div className="p-3 rounded-xl bg-[#fdfbf7] border-sketch-subtle space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-orange-500">
                  <Flame className="w-3.5 h-3.5 fill-orange-500" />
                  <span>Streak</span>
                </div>
                <div className="text-lg font-black text-[#292524]">
                  {stats?.streak ?? 0} <span className="text-xs font-bold text-[#78716c]">ngày</span>
                </div>
              </div>

              {/* Hôm nay */}
              <div className="p-3 rounded-xl bg-[#fdfbf7] border-sketch-subtle space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#0094ff]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Hôm nay</span>
                </div>
                <div className="text-lg font-black text-[#292524]">
                  {stats?.today ?? 0} <span className="text-xs font-bold text-[#78716c]">lượt</span>
                </div>
              </div>

              {/* Tuần này */}
              <div className="p-3 rounded-xl bg-[#fdfbf7] border-sketch-subtle space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Tuần này</span>
                </div>
                <div className="text-lg font-black text-[#292524]">
                  {stats?.week ?? 0} <span className="text-xs font-bold text-[#78716c]">lượt</span>
                </div>
              </div>

              {/* TB / ngày */}
              <div className="p-3 rounded-xl bg-[#fdfbf7] border-sketch-subtle space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-purple-600">
                  <Clock className="w-3.5 h-3.5" />
                  <span>TB / ngày</span>
                </div>
                <div className="text-lg font-black text-[#292524]">
                  {Number((stats?.averagePerDay ?? 0).toFixed(1))} <span className="text-xs font-bold text-[#78716c]">lượt</span>
                </div>
              </div>

              {/* TB / thẻ */}
              <div className="p-3 rounded-xl bg-[#fdfbf7] border-sketch-subtle space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-teal-600">
                  <Timer className="w-3.5 h-3.5" />
                  <span>TB / thẻ</span>
                </div>
                <div className="text-lg font-black text-[#292524]">
                  {((stats?.averageMs ?? 0)/1000).toFixed(1)} <span className="text-xs font-bold text-[#78716c]">giây</span>
                </div>
              </div>
            </div>

            {/* Two Column Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              
              {/* Left Column: 7 ngày gần nhất */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-[#78716c]">
                  7 ngày gần nhất
                </div>

                <div className="h-28 flex items-end justify-between gap-2 pt-4 px-2 border-b border-[#78716c]/30">
                  {daily.map((entry, dIdx) => {
                    const day = ['CN','T2','T3','T4','T5','T6','T7'][new Date(entry.day).getUTCDay()];
                    return (
                      <div key={dIdx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        {entry.count > 0 ? (
                          <div className="w-full max-w-[36px] bg-[#3b82f6] border border-[#1d4ed8] rounded-md shadow-xs" title={`${entry.day}: ${entry.count} lượt`} style={{height: `${Math.max(4,64*entry.count/Math.max(1,...daily.map(d=>d.count)))}px`}} />
                        ) : (
                          <div className="w-full max-w-[36px] bg-[#eae3d5] h-1 rounded-full" />
                        )}
                        <span className="text-[10px] font-bold text-[#78716c]">{day}</span>
                      </div>
                    );
                  })}
                </div>


              </div>

              {/* Right Column: Phân bố đánh giá ({stats?.total ?? 0} lượt) */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-[#78716c]">
                  Phân bố đánh giá ({stats?.total ?? 0} lượt)
                </div>

                <div className="space-y-2 text-xs font-bold">
                  {/* Quên */}
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[11px] text-[#78716c]">Quên</span>
                    <div className="flex-1 h-2 bg-[#eae3d5] rounded-full overflow-hidden">
                      <div className="h-full bg-rose-400" style={{ width: `${percent('again')}%` }} />
                    </div>
                    <span className="text-[10px] text-[#78716c] w-12 text-right">
                      {ratingDistribution.again} ({percent('again')}%)
                    </span>
                  </div>

                  {/* Khó */}
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[11px] text-[#78716c]">Khó</span>
                    <div className="flex-1 h-2 bg-[#eae3d5] rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400" style={{ width: `${percent('hard')}%` }} />
                    </div>
                    <span className="text-[10px] text-[#78716c] w-12 text-right">
                      {ratingDistribution.hard} ({percent('hard')}%)
                    </span>
                  </div>

                  {/* Ổn */}
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[11px] text-[#78716c]">Ổn</span>
                    <div className="flex-1 h-2 bg-[#eae3d5] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400" style={{ width: `${percent('good')}%` }} />
                    </div>
                    <span className="text-[10px] text-[#78716c] w-12 text-right">
                      {ratingDistribution.good} ({percent('good')}%)
                    </span>
                  </div>

                  {/* Dễ */}
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[11px] text-[#78716c]">Dễ</span>
                    <div className="flex-1 h-2 bg-[#eae3d5] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400" style={{ width: `${percent('easy')}%` }} />
                    </div>
                    <span className="text-[10px] text-[#78716c] w-12 text-right">
                      {ratingDistribution.easy} ({percent('easy')}%)
                    </span>
                  </div>
                </div>

              </div>

            </div>

          </div>

                <div className="flex items-center gap-6 border-t border-[#78716c] pt-3 text-[11px] font-bold text-[#78716c]">
                  <span>Tổng: <b className="text-[#292524]">{stats?.total ?? 0}</b> lượt</span>
                  <span>Tháng này: <b className="text-[#292524]">{stats?.month ?? 0}</b> lượt</span>
                </div>
      </RoughCard>

      {resetCount !== null && <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="reset-title" onKeyDown={e => {
        if (e.key === 'Escape' && !review.busy) setResetCount(null);
        if (e.key === 'Tab') {
          const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          e.preventDefault();
          if (buttons.length) buttons[(buttons.indexOf(document.activeElement as HTMLButtonElement)+(e.shiftKey ? -1 : 1)+buttons.length)%buttons.length].focus();
        }
      }}>
        <RoughCard fill="#fdfbf7" className="p-6 max-w-md space-y-4">
          <h2 id="reset-title" className="font-bold">Học lại từ đầu</h2>
          <p>Đặt lại lịch và tiến độ của {resetCount} thẻ {activeCategory === 'kanji' ? 'Kanji' : activeCategory === 'vocab' ? 'Từ vựng' : 'Ngữ pháp'} đang gắn sao? Các thẻ sẽ đến hạn ngay. Toàn bộ lịch sử ôn được giữ nguyên.</p>
          <div className="flex justify-end gap-4">
            <button autoFocus disabled={review.busy} onClick={() => setResetCount(null)}>Hủy</button>
            <RoughButton disabled={review.busy} className="px-4 py-2 font-bold" onClick={() => void confirmReset()}>Xác nhận học lại</RoughButton>
          </div>
        </RoughCard>
      </div>}

    </div>
  );
};
