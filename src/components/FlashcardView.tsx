import React, { useState } from 'react';
import { Volume2, RotateCw, ArrowLeft, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { KanjiItem } from '../types';
import { speakJapanese } from '../utils/speech';

interface FlashcardViewProps {
  items: KanjiItem[];
  onClose: () => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ items, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [memorizedIds, setMemorizedIds] = useState<string[]>([]);

  if (items.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500">
        Không có từ vựng nào trong danh sách flashcard này.
      </div>
    );
  }

  const current = items[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleRemembered = () => {
    if (!memorizedIds.includes(current.id)) {
      setMemorizedIds([...memorizedIds, current.id]);
    }
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 }
    });
    handleNext();
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          ← Quay lại danh sách
        </button>

        <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
          Thẻ {currentIndex + 1} / {items.length} 
          <span className="ml-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            (Đã thuộc: {memorizedIds.length})
          </span>
        </div>
      </div>

      {/* 3D Flip Card Container */}
      <div 
        onClick={() => setIsFlipped(!isFlipped)}
        className="perspective-1000 w-full h-96 cursor-pointer select-none"
      >
        <div className={`relative w-full h-full duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* FRONT FACE */}
          <div className="absolute inset-0 backface-hidden bg-white dark:bg-slate-800 rounded-3xl p-8 border-2 border-slate-200 dark:border-slate-700 shadow-xl flex flex-col items-center justify-between text-center">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {current.level} • {current.strokeCount} nét
            </span>

            <div>
              <span className="text-8xl font-japanese font-black text-slate-900 dark:text-white">
                {current.kanji}
              </span>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5" />
              Chạm để lật xem chiết tự & nghĩa
            </div>
          </div>

          {/* BACK FACE */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-amber-50/90 to-blue-50/90 dark:from-slate-800 dark:to-slate-900 rounded-3xl p-6 border-2 border-amber-300/60 dark:border-slate-700 shadow-xl flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-slate-700 pb-2">
                <span className="text-2xl font-bold font-japanese text-blue-600 dark:text-blue-400">
                  {current.kanji}
                </span>
                <span className="text-xl font-extrabold text-[#FF6C00] dark:text-orange-400">
                  {current.hanViet}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    speakJapanese(current.kunyomi[0] || current.onyomi[0] || current.kanji);
                  }}
                  className="p-1.5 rounded-full bg-white dark:bg-slate-800 shadow-xs"
                >
                  <Volume2 className="w-4 h-4 text-blue-500" />
                </button>
              </div>

              <div className="text-center font-bold text-slate-800 dark:text-slate-100 text-lg">
                {current.meaning}
              </div>

              {/* Chiết tự */}
              <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-amber-200 dark:border-slate-700 text-xs italic text-slate-700 dark:text-slate-200">
                <span className="font-bold not-italic text-amber-600 dark:text-amber-400 block mb-1">
                  💡 Chiết tự ghi nhớ:
                </span>
                "{current.mnemonic}"
              </div>

              {/* On / Kun */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-800/70">
                  <span className="font-bold text-amber-600 dark:text-amber-400 block">On:</span>
                  <span className="font-japanese">{current.onyomi.join(', ') || '-'}</span>
                </div>
                <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-800/70">
                  <span className="font-bold text-blue-600 dark:text-blue-400 block">Kun:</span>
                  <span className="font-japanese">{current.kunyomi.join(', ') || '-'}</span>
                </div>
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-400 mt-2">
              Chạm để lật lại mặt trước
            </div>
          </div>

        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={handlePrev}
          className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Thẻ trước"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 flex-1 justify-center">
          <button
            onClick={handleNext}
            className="flex-1 py-3 px-4 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-sm hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5"
          >
            <XCircle className="w-4 h-4" />
            Chưa thuộc
          </button>

          <button
            onClick={handleRemembered}
            className="flex-1 py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md shadow-emerald-500/25 transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            Đã thuộc!
          </button>
        </div>

        <button
          onClick={handleNext}
          className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Thẻ sau"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

    </div>
  );
};
