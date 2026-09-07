import React, { useState, useEffect } from 'react';
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
  const [activeCategory, setActiveCategory] = useState<'kanji' | 'vocab' | 'grammar'>('kanji');
  const [isReviewing, setIsReviewing] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  
  // SRS Stats State
  const [hasReviewed, setHasReviewed] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(15);
  const [ratingDistribution, setRatingDistribution] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0
  });

  // Sample items per category
  const kanjiCards: ReviewItem[] = [
    {
      id: 'k-8',
      type: 'kanji',
      mainText: '八',
      subText: 'BÁT',
      meaning: 'Tám',
      hint: 'Chân đi chữ bát (八)'
    }
  ];

  const grammarCards: ReviewItem[] = [
    {
      id: 'g-ka',
      type: 'grammar',
      mainText: 'S か',
      subText: 'S か',
      meaning: 'Câu hỏi nghi vấn',
      hint: 'Câu hỏi nghi vấn',
      exampleJp: 'あなたはぎんこういんですか。',
      exampleVi: 'Bạn là nhân viên ngân hàng phải không?'
    }
  ];

  const vocabCards: ReviewItem[] = [
    {
      id: 'v-gakusei',
      type: 'vocab',
      mainText: '学生',
      subText: 'がくせい',
      meaning: 'Học sinh, sinh viên',
      hint: 'HỌC SINH',
      exampleJp: 'わたしは学生です。',
      exampleVi: 'Tôi là học sinh.'
    }
  ];

  const getCurrentDeck = () => {
    if (activeCategory === 'kanji') return kanjiCards;
    if (activeCategory === 'grammar') return grammarCards;
    return vocabCards;
  };

  const currentDeck = getCurrentDeck();
  const currentCard = currentDeck[0];

  // Countdown timer effect
  useEffect(() => {
    let timer: any = null;
    if (hasReviewed && countdownSeconds > 0) {
      timer = setInterval(() => {
        setCountdownSeconds(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [hasReviewed, countdownSeconds]);

  // Keyboard navigation when reviewing
  useEffect(() => {
    if (!isReviewing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.key === '1') {
        handleRate('again');
      } else if (e.key === '2') {
        handleRate('hard');
      } else if (e.key === '3') {
        handleRate('good');
      } else if (e.key === '4') {
        handleRate('easy');
      } else if (e.key === 'Escape') {
        setIsReviewing(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReviewing]);

  const handleRate = (rating: 'again' | 'hard' | 'good' | 'easy') => {
    setRatingDistribution(prev => ({
      ...prev,
      [rating]: prev[rating] + 1
    }));
    setHasReviewed(true);
    setCountdownSeconds(15);
    setIsReviewing(false);
    setIsFlipped(false);
  };

  const handleReset = () => {
    setHasReviewed(false);
    setCountdownSeconds(15);
    setRatingDistribution({ again: 0, hard: 0, good: 0, easy: 0 });
  };

  const formatCountdown = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ============================================================
  // VIEW: FLASHCARD REVIEWING SCREEN (Images 2 & 4)
  // ============================================================
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
                  if (activeCategory === 'grammar' || currentCard.type === 'grammar') {
                    if (onSelectGrammar) {
                      onSelectGrammar(SAMPLE_GRAMMAR_ITEMS['s-ka']);
                    }
                  } else if (onSelectKanji) {
                    const found = KANJI_DATABASE.find(k => k.kanji === currentCard.mainText || k.id === currentCard.id);
                    if (found) {
                      onSelectKanji(found);
                    } else {
                      onSelectKanji({
                        id: currentCard.id,
                        kanji: currentCard.mainText,
                        hanViet: currentCard.subText || 'BÁT',
                        meaning: currentCard.meaning || 'Số tám',
                        level: 'N5',
                        strokeCount: 2,
                        radicals: ['八'],
                        radicalParts: [{ radical: '八', hanViet: 'BÁT', meaning: 'Số 8' }],
                        mnemonic: currentCard.hint || 'Chân đi chữ bát (八)',
                        onyomi: ['ハチ (hachi)'],
                        kunyomi: ['や.っつ (ya.ttsu)', 'よう (you)'],
                        examples: [
                          { word: '八つ', reading: 'やっつ (yattsu)', meaning: 'Tám cái' },
                          { word: '八日', reading: 'ようか (youka)', meaning: 'Ngày mùng 8' }
                        ]
                      });
                    }
                  }
                }}
                className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
                title="Xem chi tiết"
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
            onClick={() => setIsReviewing(false)}
            className="flex items-center gap-1.5 hover:text-[#292524] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Thống kê</span>
          </button>

          <span className="font-mono text-sm font-black text-[#292524]">
            1 / 1
          </span>
        </div>

        {/* 4 SRS Rating Buttons */}
        <div className="w-full max-w-xl grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Button 1: Quên rồi */}
          <button
            onClick={() => handleRate('again')}
            className="p-3 rounded-2xl bg-[#fca5a5] border-sketch text-center space-y-0.5 hover:scale-102 active:scale-98 transition-transform cursor-pointer shadow-sketch"
          >
            <div className="text-sm font-black text-rose-900">Quên rồi</div>
            <div className="text-[11px] font-bold text-rose-800/80">1 phút</div>
          </button>

          {/* Button 2: Khó */}
          <button
            onClick={() => handleRate('hard')}
            className="p-3 rounded-2xl bg-[#fdba74] border-sketch text-center space-y-0.5 hover:scale-102 active:scale-98 transition-transform cursor-pointer shadow-sketch"
          >
            <div className="text-sm font-black text-orange-950">Khó</div>
            <div className="text-[11px] font-bold text-orange-900/80">6 phút</div>
          </button>

          {/* Button 3: Tốt */}
          <button
            onClick={() => handleRate('good')}
            className="p-3 rounded-2xl bg-[#86efac] border-sketch-green text-center space-y-0.5 hover:scale-102 active:scale-98 transition-transform cursor-pointer shadow-sketch"
          >
            <div className="text-sm font-black text-emerald-950">Tốt</div>
            <div className="text-[11px] font-bold text-emerald-900/80">1 ngày</div>
          </button>

          {/* Button 4: Dễ */}
          <button
            onClick={() => handleRate('easy')}
            className="p-3 rounded-2xl bg-[#93c5fd] border-sketch-blue text-center space-y-0.5 hover:scale-102 active:scale-98 transition-transform cursor-pointer shadow-sketch"
          >
            <div className="text-sm font-black text-blue-950">Dễ</div>
            <div className="text-[11px] font-bold text-blue-900/80">4 ngày</div>
          </button>
        </div>

      </div>
    );
  }

  // ============================================================
  // MAIN VIEW: THỐNG KÊ HỌC TẬP (Images 1, 3, 5)
  // ============================================================
  const remainingDue = hasReviewed ? 0 : 1;

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

      {/* 2. Category Switcher Tabs */}
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-1 shadow-sketch">
        <div className="grid grid-cols-3 gap-1">
          {/* Tab 1: Kanji */}
          <button
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
              1
            </span>
          </button>

          {/* Tab 2: Từ vựng */}
          <button
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
              1
            </span>
          </button>

          {/* Tab 3: Ngữ pháp */}
          <button
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
              1
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
            <div className={`text-2xl font-black ${hasReviewed ? 'text-[#0094ff]' : 'text-[#0094ff]'}`}>
              {hasReviewed ? 0 : 1}
            </div>
            <div className="text-[11px] font-bold text-[#78716c]">Mới thêm</div>
          </div>

          {/* Đang học */}
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-amber-500">
              {hasReviewed ? 1 : 0}
            </div>
            <div className="text-[11px] font-bold text-[#78716c]">Đang học (&lt; 6 phút)</div>
          </div>

          {/* Mới thuộc */}
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-orange-600">0</div>
            <div className="text-[11px] font-bold text-[#78716c]">Mới thuộc (ngắn hạn &lt;21 ngày)</div>
          </div>

          {/* Đã thuộc */}
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-emerald-600">0</div>
            <div className="text-[11px] font-bold text-[#78716c]">Đã thuộc (dài hạn)</div>
          </div>

          {/* Tổng đã học qua */}
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-[#292524]">1</div>
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
              onClick={handleReset}
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
                onClick={() => {
                  setIsFlipped(false);
                  setIsReviewing(true);
                }}
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
                <span>🎉 Đã hoàn thành ôn tập hôm nay!</span>
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
              {hasReviewed ? formatCountdown(countdownSeconds) : '--:--:--'}
            </div>
          </div>

          <div className="text-[11px] font-bold text-white/80">
            {hasReviewed 
              ? `Hệ thống sẽ nhắc bạn ôn lại sau ${countdownSeconds}s` 
              : 'Chưa có lịch ôn tập tiếp theo'}
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

        {!hasReviewed ? (
          /* Empty State (Images 1 & 3) */
          <div className="py-8 text-center text-xs font-bold text-[#78716c]">
            Chưa có dữ liệu ôn tập. Hãy bắt đầu ôn tập để xem thống kê!
          </div>
        ) : (
          /* Analytics State (Image 5) */
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
                  0 <span className="text-xs font-bold text-[#78716c]">ngày</span>
                </div>
              </div>

              {/* Hôm nay */}
              <div className="p-3 rounded-xl bg-[#fdfbf7] border-sketch-subtle space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#0094ff]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Hôm nay</span>
                </div>
                <div className="text-lg font-black text-[#292524]">
                  1 <span className="text-xs font-bold text-[#78716c]">lượt</span>
                </div>
              </div>

              {/* Tuần này */}
              <div className="p-3 rounded-xl bg-[#fdfbf7] border-sketch-subtle space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Tuần này</span>
                </div>
                <div className="text-lg font-black text-[#292524]">
                  1 <span className="text-xs font-bold text-[#78716c]">lượt</span>
                </div>
              </div>

              {/* TB / ngày */}
              <div className="p-3 rounded-xl bg-[#fdfbf7] border-sketch-subtle space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-purple-600">
                  <Clock className="w-3.5 h-3.5" />
                  <span>TB / ngày</span>
                </div>
                <div className="text-lg font-black text-[#292524]">
                  1 <span className="text-xs font-bold text-[#78716c]">lượt</span>
                </div>
              </div>

              {/* TB / thẻ */}
              <div className="p-3 rounded-xl bg-[#fdfbf7] border-sketch-subtle space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-teal-600">
                  <Timer className="w-3.5 h-3.5" />
                  <span>TB / thẻ</span>
                </div>
                <div className="text-lg font-black text-[#292524]">
                  3.7 <span className="text-xs font-bold text-[#78716c]">giây</span>
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
                  {['T7', 'CN', 'T2', 'T3', 'T4', 'T5', 'T6'].map((day, dIdx) => {
                    const isT5 = day === 'T5';
                    return (
                      <div key={dIdx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        {isT5 ? (
                          <div className="w-full max-w-[36px] bg-[#3b82f6] border border-[#1d4ed8] rounded-md h-16 shadow-xs" />
                        ) : (
                          <div className="w-full max-w-[36px] bg-[#eae3d5] h-1 rounded-full" />
                        )}
                        <span className="text-[10px] font-bold text-[#78716c]">{day}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold text-[#78716c]">
                  <span>Tổng: <b className="text-[#292524]">1</b> lượt</span>
                  <span>Tháng này: <b className="text-[#292524]">1</b> lượt</span>
                </div>
              </div>

              {/* Right Column: Phân bố đánh giá (1 lượt) */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-[#78716c]">
                  Phân bố đánh giá (1 lượt)
                </div>

                <div className="space-y-2 text-xs font-bold">
                  {/* Quên */}
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[11px] text-[#78716c]">Quên</span>
                    <div className="flex-1 h-2 bg-[#eae3d5] rounded-full overflow-hidden">
                      <div className="h-full bg-rose-400" style={{ width: `${ratingDistribution.again ? 100 : 0}%` }} />
                    </div>
                    <span className="text-[10px] text-[#78716c] w-12 text-right">
                      {ratingDistribution.again} ({ratingDistribution.again ? '100%' : '0%'})
                    </span>
                  </div>

                  {/* Khó */}
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[11px] text-[#78716c]">Khó</span>
                    <div className="flex-1 h-2 bg-[#eae3d5] rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400" style={{ width: `${ratingDistribution.hard ? 100 : 0}%` }} />
                    </div>
                    <span className="text-[10px] text-[#78716c] w-12 text-right">
                      {ratingDistribution.hard} ({ratingDistribution.hard ? '100%' : '0%'})
                    </span>
                  </div>

                  {/* Ổn */}
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[11px] text-[#78716c]">Ổn</span>
                    <div className="flex-1 h-2 bg-[#eae3d5] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400" style={{ width: `${ratingDistribution.good ? 100 : 0}%` }} />
                    </div>
                    <span className="text-[10px] text-[#78716c] w-12 text-right">
                      {ratingDistribution.good} ({ratingDistribution.good ? '100%' : '0%'})
                    </span>
                  </div>

                  {/* Dễ */}
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[11px] text-[#78716c]">Dễ</span>
                    <div className="flex-1 h-2 bg-[#eae3d5] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400" style={{ width: `${ratingDistribution.easy ? 100 : 0}%` }} />
                    </div>
                    <span className="text-[10px] text-[#78716c] w-12 text-right">
                      {ratingDistribution.easy} ({ratingDistribution.easy ? '100%' : '0%'})
                    </span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </RoughCard>

    </div>
  );
};
