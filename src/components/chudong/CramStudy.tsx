import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft,
  Keyboard, 
  Lightbulb, 
  Settings, 
  Maximize2, 
  Minimize2, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';
import type { VocabWord } from '../../hooks/useVocabLessons';
import { useVocabStudy } from '../../hooks/useVocabStudy';
import { getStudyTarget, isStudyAnswerCorrect } from '../../../shared/vocab-study.mjs';
import { TypingCrowMascot } from './StudyMascots';
import { StudyStatus } from './StudyStatus';
import { StudyModeDialog } from './StudyModeDialog';
import { playCorrectSound, playWrongSound, romajiToHiragana } from './studyHelpers';

interface CramStudyProps {
  words: VocabWord[];
  lessonId: string;
  lessonName: string;
  lessonVersion: number;
  userId: string | null;
  authBusy: boolean;
  onExit: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

type CramMode = 'reading' | 'hanViet';

export const CramStudy: React.FC<CramStudyProps> = ({
  words,
  lessonId,
  lessonName,
  lessonVersion,
  userId,
  authBusy,
  onExit,
  isFullscreen,
  onToggleFullscreen
}) => {
  const study = useVocabStudy({
    lessonId, lessonName, lessonVersion, words, userId, authBusy,
    kind: 'cram', initialMode: 'reading',
  });
  const cramMode = study.mode;
  const currentIndex = study.index;
  const currentWord = study.currentWord;
  const isFinished = study.finished;
  const score = study.score;
  const blocked = study.busy || !!study.error;
  const [inputValue, setInputValue] = useState('');
  const [hintCount, setHintCount] = useState(0);
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoConvertRomaji, setAutoConvertRomaji] = useState(true);
  const [pendingMode, setPendingMode] = useState<CramMode|null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const actionPending = useRef(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stopSound = useRef<(() => void) | undefined>(undefined);
  const composing = useRef(false);
  const targetAnswer = currentWord ? getStudyTarget(currentWord, 'cram', cramMode) : '';
  const targetChars = Array.from(targetAnswer);
  const maxHints = targetChars.length;

  const resetWordState = useCallback(() => {
    setInputValue('');
    setHintCount(0);
    setIsChecked(false);
    setIsCorrect(false);
  }, []);

  useEffect(() => {
    resetWordState();
  }, [currentWord?.id, study.roundId, cramMode, resetWordState]);

  useEffect(() => {
    if (!isFinished && !blocked && currentWord) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [currentWord?.id, study.roundId, cramMode, isFinished, blocked]);

  useEffect(() => () => {
    clearTimeout(unlockTimer.current);
    stopSound.current?.();
  }, []);

  // React state updates render later; the ref also guards repeated calls in this event turn.
  const acquireAction = () => {
    if (actionPending.current || !study.canAct() || isFinished || !currentWord) return false;
    actionPending.current = true;
    unlockTimer.current = setTimeout(() => { actionPending.current = false; }, 0);
    return true;
  };

  const handleExit = () => {
    if (!study.requestExit()) return;
    stopSound.current?.();
    onExit();
  };

  const handleModeChange = (mode: CramMode) => {
    if (mode === cramMode || blocked || actionPending.current) return;
    actionPending.current = true;
    setPendingMode(mode);
  };
  const confirmModeChange = () => {
    if (!pendingMode || blocked) return;
    const mode = pendingMode;
    setPendingMode(null);
    stopSound.current?.();
    void study.start(mode).finally(() => { actionPending.current = false; });
  };

  const handleNext = () => {
    if (!currentWord || !Object.prototype.hasOwnProperty.call(study.answers, currentWord.id) || !acquireAction()) return;
    stopSound.current?.();
    study.next(currentWord.id);
  };

  const handleUseHint = () => {
    if (hintCount >= maxHints || (isChecked && isCorrect) || !acquireAction()) return;
    const nextHint = hintCount + 1;
    setHintCount(nextHint);
    setInputValue(targetChars.slice(0, nextHint).join(''));
    inputRef.current?.focus();
  };

  const handleCheck = () => {
    if (isChecked && isCorrect) {
      handleNext();
      return;
    }
    if (!currentWord || !inputValue.trim() || !acquireAction()) return;

    // Only the first attempt contributes to the saved result. Retrying remains practice.
    const correct = Object.prototype.hasOwnProperty.call(study.answers, currentWord.id)
      ? isStudyAnswerCorrect(currentWord, 'cram', cramMode, inputValue)
      : study.answer(currentWord.id, inputValue);
    if (correct === null) return;
    setIsChecked(true);
    setIsCorrect(correct);
    stopSound.current?.();
    stopSound.current = correct ? playCorrectSound() : playWrongSound();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (blocked || isFinished || (isChecked && isCorrect)) return;
    const val = e.target.value;
    // Leave trailing n/nn pending until the next key or answer check resolves ん vs. na/ni/....
    const pendingN = val.match(/n+$/i)?.[0] ?? '';
    const converted = pendingN
      ? romajiToHiragana(val.slice(0, -pendingN.length)) + pendingN
      : romajiToHiragana(val);
    setInputValue(cramMode === 'reading' && autoConvertRomaji && !composing.current
      ? converted
      : val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing || composing.current) return;
      e.preventDefault();
      if (e.repeat) return;
      handleCheck();
    }
  };

  const handleRestart = () => {
    if (blocked || actionPending.current) return;
    actionPending.current = true;
    stopSound.current?.();
    void study.start().finally(() => { actionPending.current = false; });
  };

  return (
    <div className={`w-full relative transition-all duration-200 ${
      isFullscreen 
        ? 'fixed inset-0 z-50 bg-[#171f34] flex flex-col justify-between p-4 md:p-8 overflow-y-auto' 
        : 'rounded-2xl bg-[#232d4b] border border-[#334155] shadow-2xl overflow-hidden flex flex-col'
    }`}>
      
      <StudyStatus study={study} />
      <StudyModeDialog open={pendingMode !== null} busy={blocked}
        onCancel={() => { setPendingMode(null); actionPending.current = false; }} onConfirm={confirmModeChange} />

      {/* 1. TOP BAR */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 text-slate-300">
        
        {/* Top-Left: Back button + Typing Crow Mascot (Images 4 & 5) */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Quay lại danh sách từ"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Quay lại</span>
          </button>
          <TypingCrowMascot className="w-16 h-14 md:w-20 md:h-16" />
        </div>

        {/* Top-Right: Segmented Control [ Cách đọc | Âm Hán ] + Settings + Fullscreen */}
        <div className="flex items-center gap-2 md:gap-3">
          
          {/* Segmented 2-option control with orange active state (Images 4 & 5) */}
          <div className="flex items-center rounded-xl bg-slate-800/90 p-0.5 border border-slate-700 shadow-inner">
            <button
              onClick={(event) => { if (event.detail <= 1) handleModeChange('reading'); }}
              disabled={blocked}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                cramMode === 'reading'
                  ? 'bg-[#ea580c] text-white shadow-xs font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cách đọc
            </button>

            <button
              onClick={(event) => { if (event.detail <= 1) handleModeChange('hanViet'); }}
              disabled={blocked}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                cramMode === 'hanViet'
                  ? 'bg-[#ea580c] text-white shadow-xs font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Âm Hán
            </button>
          </div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(prev => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Cài đặt nhồi nhét"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={onToggleFullscreen}
            className="flex items-center gap-1 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? "Thu nhỏ" : "Phóng to"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Settings Dropdown Popover */}
      {showSettings && (
        <div className="absolute right-6 top-14 w-64 bg-[#1e293b] border border-slate-700 rounded-xl p-3 shadow-2xl z-30 text-xs text-slate-200 space-y-2">
          <div className="font-bold text-slate-300 pb-1 border-b border-slate-700 flex justify-between items-center">
            <span>Cài đặt Nhồi nhét</span>
            <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <label className="flex items-center justify-between cursor-pointer py-1">
            <span>Tự chuyển Romaji sang Hiragana</span>
            <input
              type="checkbox"
              checked={autoConvertRomaji}
              onChange={(e) => setAutoConvertRomaji(e.target.checked)}
              className="rounded accent-orange-600 cursor-pointer"
            />
          </label>
        </div>
      )}

      {/* 2. MAIN CRAM AREA */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-12 py-6 min-h-[320px]">
        
        {isFinished ? (
          <div className="text-center space-y-4 py-8 z-10 animate-in fade-in duration-200">
            <span className="text-5xl">⚡</span>
            <h3 className="text-2xl font-black text-white">Đã hoàn thành lượt Nhồi nhét!</h3>
            <p className="text-sm font-bold text-orange-400">
              Chính xác: {score} / {study.total} từ
            </p>
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={(event) => { if (event.detail <= 1) handleRestart(); }}
                disabled={blocked}
                className="px-5 py-2.5 bg-[#ea580c] hover:bg-orange-600 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
              >
                Học lại lần nữa
              </button>
              <button
                onClick={handleExit}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-black shadow-md cursor-pointer"
              >
                Quay lại danh sách từ
              </button>
            </div>
          </div>
        ) : !currentWord ? (
          <p className="text-sm text-slate-300 text-center">
            {study.error
              ? 'Hãy tải lại lượt học để tiếp tục.'
              : study.loaded && !study.loading
                ? (cramMode === 'reading'
                  ? 'Chưa có từ vựng đủ dữ liệu để học cách đọc. Hãy bổ sung từ, nghĩa và cách đọc hoặc chọn chế độ khác.'
                  : 'Chưa có từ vựng đủ dữ liệu để học âm Hán Việt. Hãy bổ sung từ, nghĩa và âm Hán Việt hoặc chọn chế độ khác.')
                : 'Đang tải bài học…'}
          </p>
        ) : (
          <div className="w-full max-w-xl space-y-6 text-center">
            
            {/* Word & Meaning */}
            <div className="space-y-1">
              <h2 className="text-4xl md:text-5xl font-black text-white tracking-wide font-kanji">
                {currentWord?.word}
              </h2>
              <p className="text-xs md:text-sm text-slate-300 font-medium pt-1">
                {currentWord?.meaning}
              </p>
            </div>

            {/* Letter placeholders / dashes (Images 4 & 5) */}
            <div className="flex items-center justify-center gap-2 md:gap-3 text-lg md:text-xl font-mono text-slate-300 select-none py-1">
              {cramMode === 'hanViet' && !targetAnswer ? (
                <span className="text-xs text-slate-400 italic">
                  (Từ này không có âm Hán Việt)
                </span>
              ) : (
                targetChars.map((ch, idx) => {
                  const isRevealed = idx < hintCount;
                  const isSpace = ch === ' ';
                  
                  if (isSpace) {
                    return <span key={idx} className="w-3"></span>;
                  }

                  return (
                    <span 
                      key={idx} 
                      className={`${cramMode === 'reading' ? 'font-kanji' : ''} inline-block w-5 md:w-6 border-b-2 text-center pb-0.5 transition-all ${
                        isRevealed 
                          ? 'border-amber-400 text-amber-300 font-bold' 
                          : 'border-slate-500 text-transparent'
                      }`}
                    >
                      {isRevealed ? ch : '_'}
                    </span>
                  );
                })
              )}
            </div>

            {/* Input Field with Hand-drawn sketch border */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                maxLength={500}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={blocked}
                readOnly={isChecked && isCorrect}
                onCompositionStart={() => { composing.current = true; }}
                onCompositionEnd={() => { composing.current = false; }}
                placeholder={
                  cramMode === 'reading'
                    ? 'Gõ romaji (vd: toshokan → としょかん)'
                    : 'Nhập âm Hán Việt...'
                }
                className={`${cramMode === 'reading' ? 'font-kanji' : ''} w-full px-4 py-3 md:py-3.5 rounded-xl bg-[#182238] border-2 text-center text-sm md:text-base text-white placeholder-slate-500 outline-none transition-all ${
                  isChecked 
                    ? isCorrect
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200'
                      : 'border-rose-500 bg-rose-950/40 text-rose-200'
                    : 'border-slate-700 focus:border-orange-500 focus:bg-[#1a253e]'
                }`}
              />

              {/* Feedback indicator inside input */}
              {isChecked && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  {isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400" />
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons: Gợi ý & Kiểm tra (Images 4 & 5) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              
              {/* Hint button (Gray) */}
              <button
                onClick={(event) => { if (event.detail <= 1) handleUseHint(); }}
                disabled={blocked || hintCount >= maxHints || (isChecked && isCorrect)}
                className="py-2.5 px-3 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <Lightbulb className="w-4 h-4 text-amber-300" />
                <span>Gợi ý ({hintCount}/{maxHints})</span>
              </button>

              {/* Check button (Orange) */}
              <button
                onClick={(event) => { if (event.detail <= 1) handleCheck(); }}
                disabled={blocked}
                className={`py-2.5 px-3 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-[0.99] ${
                  isChecked && isCorrect
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-[#ea580c] hover:bg-orange-600'
                }`}
              >
                <Keyboard className="w-4 h-4" />
                <span>{isChecked ? (isCorrect ? 'Tiếp tục (Enter)' : 'Thử lại / Bỏ qua') : 'Kiểm tra'}</span>
              </button>

            </div>

            {/* If wrong, display correct answer */}
            {isChecked && !isCorrect && (
              <div className="pt-2 text-xs text-rose-300 font-medium animate-in fade-in duration-150">
                <span>Đáp án đúng: </span>
                <span className={`font-bold text-amber-300 ${cramMode === 'reading' ? 'font-kanji' : ''}`}>{targetAnswer}</span>
                <button
                  onClick={(event) => { if (event.detail <= 1) handleNext(); }}
                  disabled={blocked}
                  className="ml-3 underline text-sky-300 hover:text-sky-200 cursor-pointer"
                >
                  Bỏ qua sang câu tiếp theo
                </button>
              </div>
            )}

          </div>
        )}

      </div>

      {/* 3. BOTTOM BAR */}
      <div className="bg-[#1b243d] px-5 py-2.5 flex items-center justify-between border-t border-[#2a3654] relative text-xs">
        
        {/* Progress Counter */}
        <div className="text-slate-400 font-bold">
          <span className="text-slate-200">{isFinished ? study.total : (study.total ? currentIndex + 1 : 0)}</span> / {study.total}
        </div>

        {/* Shortcuts hint */}
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <span>Nhấn</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-600 rounded text-slate-200">Enter</kbd>
          <span>để kiểm tra</span>
        </div>

        {/* Empty placeholder for symmetry */}
        <div className="w-12"></div>

        {/* Thin green progress bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${study.total ? ((isFinished ? study.total : currentIndex + 1) / study.total) * 100 : 0}%` }}
          />
        </div>

      </div>

    </div>
  );
};
