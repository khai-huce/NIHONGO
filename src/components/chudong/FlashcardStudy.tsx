import { ReviewStar } from '../ReviewStar';
import { useReview } from '../../hooks/useReview';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ArrowLeft, 
  Volume2, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Play, 
  Pause, 
  Shuffle, 
  Settings, 
  Maximize2, 
  Minimize2, 
  Check, 
  X 
} from 'lucide-react';
import { VocabWord } from '../../pages/ChuDongPage';
import { speakJapanese } from '../../utils/speech';

interface FlashcardStudyProps {
  words: VocabWord[];
  lessonName: string;
  onExit: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onSelectWordDetail?: (word: VocabWord) => void;
}

export const FlashcardStudy: React.FC<FlashcardStudyProps> = ({
  words,
  onExit,
  isFullscreen,
  onToggleFullscreen
}) => {
  const [deck, setDeck] = useState<VocabWord[]>([...words]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const review = useReview();

  // Study direction: jp-vi (default) or vi-jp
  const [direction, setDirection] = useState<'jp-vi' | 'vi-jp'>('jp-vi');
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoSpeechOnFlip, setAutoSpeechOnFlip] = useState(true);

  // Statistics
  const [knownCount, setKnownCount] = useState(0);
  const [unknownCount, setUnknownCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentWord = deck[currentIndex] || null;
  const toggleStar = useCallback(() => {
    if (currentWord) void review.toggle({category:'vocab',sourceId:'custom:'+currentWord.id,front:currentWord.word,back:currentWord.meaning,reading:currentWord.reading});
  }, [currentWord, review]);

  // Flip card
  const handleFlip = useCallback(() => {
    setIsFlipped(prev => {
      const next = !prev;
      if (next && autoSpeechOnFlip && currentWord) {
        speakJapanese(currentWord.reading || currentWord.word);
      }
      return next;
    });
  }, [autoSpeechOnFlip, currentWord]);

  // Next card
  const handleNext = useCallback(() => {
    if (currentIndex < deck.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      setIsFinished(true);
    }
  }, [currentIndex, deck.length]);

  // Previous card
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  // Mark Known (Z)
  const handleKnown = useCallback(() => {
    setKnownCount(prev => prev + 1);
    handleNext();
  }, [handleNext]);

  // Mark Unknown (X)
  const handleUnknown = useCallback(() => {
    setUnknownCount(prev => prev + 1);
    handleNext();
  }, [handleNext]);

  // Play Audio
  const handleAudio = useCallback(() => {
    if (currentWord) {
      speakJapanese(currentWord.reading || currentWord.word);
    }
  }, [currentWord]);

  // Restart
  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownCount(0);
    setUnknownCount(0);
    setIsFinished(false);
  };

  // Shuffle deck
  const handleShuffle = () => {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  // Auto-play loop
  useEffect(() => {
    if (!isAutoPlay || isFinished) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      return;
    }

    autoPlayTimerRef.current = setInterval(() => {
      setIsFlipped(f => {
        if (!f) {
          if (autoSpeechOnFlip && currentWord) {
            speakJapanese(currentWord.reading || currentWord.word);
          }
          return true;
        } else {
          handleNext();
          return false;
        }
      });
    }, 2800);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [isAutoPlay, isFinished, handleNext, autoSpeechOnFlip, currentWord]);

  // Global Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.code === 'KeyZ') {
        e.preventDefault();
        handleKnown();
      } else if (e.code === 'KeyX') {
        e.preventDefault();
        handleUnknown();
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        toggleStar();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        handleAudio();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleKnown, handleUnknown, toggleStar, handleAudio, handlePrev, handleNext]);

  if (deck.length === 0) {
    return (
      <div className="w-full p-8 text-center bg-[#232d4b] text-white rounded-2xl">
        <p className="text-sm">Chưa có từ vựng nào trong bài học này.</p>
        <button onClick={onExit} className="mt-4 px-4 py-2 bg-blue-600 rounded-xl text-xs font-bold">
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className={`w-full relative transition-all duration-200 ${
      isFullscreen 
        ? 'fixed inset-0 z-50 bg-[#171f34] flex flex-col justify-between p-4 md:p-8 overflow-y-auto' 
        : 'rounded-2xl bg-[#232d4b] border border-[#334155] shadow-2xl overflow-hidden flex flex-col'
    }`}>
      
      {/* 1. TOP BAR */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 text-slate-300">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs md:text-sm font-medium hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>

        <div className="flex items-center gap-3">
          {currentWord && <ReviewStar source={{category:'vocab',sourceId:'custom:'+currentWord.id,front:currentWord.word,back:currentWord.meaning,reading:currentWord.reading}} />}

          {/* Fullscreen Toggle */}
          <button
            onClick={onToggleFullscreen}
            className="flex items-center gap-1 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? "Thu nhỏ" : "Phóng to"}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4" />
                <span className="hidden sm:inline">Thu nhỏ</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                <span className="hidden sm:inline">Phóng to</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. CARD BODY & NAVIGATION */}
      <div className="relative flex-1 flex items-center justify-center min-h-[300px] md:min-h-[360px] px-4 py-6">
        
        {/* Previous Button */}
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className={`absolute left-3 md:left-6 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            currentIndex === 0 
              ? 'opacity-20 cursor-not-allowed text-slate-500' 
              : 'bg-black/25 text-slate-300 hover:bg-black/50 hover:text-white shadow-lg'
          }`}
          title="Thẻ trước (←)"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* The Flip Card */}
        {isFinished ? (
          <div className="text-center space-y-4 py-8 animate-in fade-in duration-300">
            <span className="text-5xl">🎉</span>
            <h3 className="text-2xl font-black text-white">Bạn đã hoàn thành lượt học!</h3>
            <div className="flex items-center justify-center gap-6 text-sm font-bold pt-2">
              <span className="text-emerald-400">✓ Đã thuộc: {knownCount}</span>
              <span className="text-rose-400">✕ Cần ôn lại: {unknownCount}</span>
            </div>
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={handleRestart}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
              >
                Học lại từ đầu
              </button>
              <button
                onClick={onExit}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-black shadow-md cursor-pointer"
              >
                Quay lại danh sách từ
              </button>
            </div>
          </div>
        ) : (
          <div 
            onClick={handleFlip}
            className="w-full max-w-lg cursor-pointer select-none flex flex-col items-center justify-center text-center p-6 md:p-10 transition-transform active:scale-[0.99]"
          >
            {/* Front View */}
            {!isFlipped ? (
              <div className="space-y-4 animate-in fade-in duration-200 flex flex-col items-center">
                {direction === 'jp-vi' ? (
                  <>
                    <h2 className="text-5xl md:text-6xl font-black text-white tracking-wide font-sans">
                      {currentWord?.word}
                    </h2>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAudio();
                      }}
                      className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Nghe phát âm (R)"
                    >
                      <Volume2 className="w-6 h-6" />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Ý nghĩa</p>
                    <h2 className="text-3xl md:text-4xl font-black text-amber-300">
                      {currentWord?.meaning}
                    </h2>
                    <span className="text-xs text-slate-400 pt-2">(Nhấn để xem từ tiếng Nhật)</span>
                  </>
                )}
              </div>
            ) : (
              /* Back View (Flipped) */
              <div className="space-y-3 animate-in fade-in duration-200 flex flex-col items-center">
                <h2 className="text-4xl md:text-5xl font-black text-white">
                  {currentWord?.word}
                </h2>

                {currentWord?.reading && currentWord?.reading !== currentWord?.word && (
                  <p className="text-xl md:text-2xl font-bold text-sky-300">
                    {currentWord.reading}
                  </p>
                )}

                {currentWord?.hanViet && (
                  <p className="text-xs md:text-sm font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/40 px-3 py-1 rounded-md border border-emerald-700/50">
                    Âm Hán: {currentWord.hanViet}
                  </p>
                )}

                <p className="text-lg md:text-xl font-medium text-amber-200 pt-1">
                  {currentWord?.meaning}
                </p>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAudio();
                  }}
                  className="mt-2 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Nghe phát âm (R)"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={currentIndex === deck.length - 1}
          className={`absolute right-3 md:right-6 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            currentIndex === deck.length - 1 
              ? 'opacity-20 cursor-not-allowed text-slate-500' 
              : 'bg-black/25 text-slate-300 hover:bg-black/50 hover:text-white shadow-lg'
          }`}
          title="Thẻ sau (→)"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* 3. SHORTCUTS STRIP (Image 1) */}
      <div className="bg-[#182035] py-2 px-4 text-center border-t border-[#2a3654]">
        <p className="text-[11px] md:text-xs text-slate-400 flex items-center justify-center flex-wrap gap-2 md:gap-3">
          <span className="text-slate-500">Phím tắt:</span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-600 rounded text-slate-200">Space</kbd>
            <span>lật</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-600 rounded text-slate-200">Z</kbd>
            <span>biết</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-600 rounded text-slate-200">X</kbd>
            <span>chưa biết</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-600 rounded text-slate-200">C</kbd>
            <span>thêm deck</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-600 rounded text-slate-200">R</kbd>
            <span>nghe</span>
          </span>
        </p>
      </div>

      {/* 4. BOTTOM CONTROLS (Image 1) */}
      <div className="bg-[#1b243d] px-5 py-3 flex items-center justify-between border-t border-[#2a3654] flex-wrap gap-3">
        
        {/* Left: Unknown X and Known Check buttons */}
        <div className="flex items-center gap-4">
          {/* Red X Button (Chưa biết) */}
          <button
            onClick={handleUnknown}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#ef4444]/90 hover:bg-[#dc2626] text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
            title="Chưa biết (X)"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Counter Progress */}
          <span className="text-xs md:text-sm font-bold text-slate-200 min-w-[50px] text-center">
            {currentIndex + 1} / {deck.length}
          </span>

          {/* Green Check Button (Biết) */}
          <button
            onClick={handleKnown}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#10b981]/90 hover:bg-[#059669] text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
            title="Đã biết (Z)"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Right side tools */}
        <div className="flex items-center gap-2 relative">
          
          {/* JP -> VI Toggle Pill */}
          <button
            onClick={() => {
              setDirection(prev => prev === 'jp-vi' ? 'vi-jp' : 'jp-vi');
              setIsFlipped(false);
            }}
            className="px-2.5 py-1 rounded-full bg-slate-700/80 hover:bg-slate-600 text-[11px] font-bold text-slate-200 flex items-center gap-1 border border-slate-600 transition-colors cursor-pointer"
            title="Đổi chiều học"
          >
            <span>⇄</span>
            <span>{direction === 'jp-vi' ? 'JP→VI' : 'VI→JP'}</span>
          </button>

          {/* Restart */}
          <button
            onClick={handleRestart}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
            title="Bắt đầu lại từ đầu"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Auto Play Slideshow */}
          <button
            onClick={() => setIsAutoPlay(prev => !prev)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isAutoPlay ? 'text-amber-400 bg-amber-400/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
            }`}
            title={isAutoPlay ? "Tạm dừng tự động" : "Tự động chuyển thẻ"}
          >
            {isAutoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Shuffle */}
          <button
            onClick={handleShuffle}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
            title="Xáo trộn thẻ"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Settings gear */}
          <button
            onClick={() => setShowSettings(prev => !prev)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
            title="Cài đặt Flashcard"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Settings popover */}
          {showSettings && (
            <div className="absolute right-0 bottom-12 w-60 bg-[#1e293b] border border-slate-700 rounded-xl p-3 shadow-2xl z-30 text-xs text-slate-200 space-y-2">
              <div className="font-bold text-slate-300 pb-1 border-b border-slate-700 flex justify-between items-center">
                <span>Cài đặt Flashcard</span>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <label className="flex items-center justify-between cursor-pointer py-1">
                <span>Tự phát âm khi lật thẻ</span>
                <input
                  type="checkbox"
                  checked={autoSpeechOnFlip}
                  onChange={(e) => setAutoSpeechOnFlip(e.target.checked)}
                  className="rounded accent-blue-600 cursor-pointer"
                />
              </label>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
