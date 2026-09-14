import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  Volume2, 
  Heart, 
  Settings, 
  Maximize2, 
  Minimize2, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';
import type { VocabWord } from '../../hooks/useVocabLessons';
import { useVocabStudy } from '../../hooks/useVocabStudy';
import { getQuizOptions, type StudyMode } from '../../../shared/vocab-study.mjs';
import { StudyStatus } from './StudyStatus';
import { StudyModeDialog } from './StudyModeDialog';
import { speakJapanese } from '../../utils/speech';
import { DartboardCrowMascot } from './StudyMascots';
import { playCorrectSound, playWrongSound } from './studyHelpers';

interface QuizStudyProps {
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

export const QuizStudy: React.FC<QuizStudyProps> = ({
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
  const study = useVocabStudy({ lessonId, lessonName, lessonVersion, words, userId, authBusy, kind: 'quiz', initialMode: 'meaning' });
  const { mode: questionMode, index: currentIndex, currentWord, deck, score, total, finished: isFinished } = study;
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [pendingMode, setPendingMode] = useState<StudyMode|null>(null);
  const autoNextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answer = currentWord ? study.answers[currentWord.id] : undefined;
  const isAnswered = Boolean(answer);
  const hasGivenUp = answer?.answer === null;
  const blocked = study.busy || Boolean(study.error) || study.completionPending;

  const currentOptions = useMemo(() => currentWord
    ? getQuizOptions(currentWord, deck, questionMode)
    : [], [currentWord?.id, questionMode, study.roundId]);

  const cancelAutoNext = useCallback(() => {
    if (autoNextTimer.current !== null) clearTimeout(autoNextTimer.current);
    autoNextTimer.current = null;
  }, []);

  useEffect(() => {
    setSelectedOptionIndex(null);
    cancelAutoNext();
  }, [currentWord?.id, questionMode, study.roundId, cancelAutoNext]);

  useEffect(() => {
    if (blocked || !autoAdvance || isFinished) cancelAutoNext();
  }, [blocked, autoAdvance, isFinished, cancelAutoNext]);

  useEffect(() => () => {
    cancelAutoNext();
    window.speechSynthesis?.cancel();
  }, [cancelAutoNext]);

  const handlePlayAudio = useCallback(() => {
    if (currentWord && study.canAct() && !isFinished) {
      speakJapanese(currentWord.reading || currentWord.word);
    }
  }, [currentWord, study, isFinished]);

  const handleNext = useCallback(() => {
    cancelAutoNext();
    if (currentWord) study.next(currentWord.id);
  }, [cancelAutoNext, currentWord, study]);

  const handleSelectOption = useCallback((index: number) => {
    if (!currentWord || isFinished || isAnswered || index < 0 || index >= currentOptions.length) return;
    const chosen = currentOptions[index];
    const correct = study.answer(currentWord.id, chosen.text);
    if (correct === null) return;
    setSelectedOptionIndex(index);
    if (correct) {
      playCorrectSound();
      if (autoAdvance) {
        cancelAutoNext();
        const answeredWordId = currentWord.id;
        autoNextTimer.current = setTimeout(() => {
          autoNextTimer.current = null;
          study.next(answeredWordId);
        }, 1100);
      }
    } else {
      playWrongSound();
    }
  }, [currentWord, isFinished, isAnswered, currentOptions, study, autoAdvance, cancelAutoNext]);

  const handleGiveUp = useCallback(() => {
    if (!currentWord || isFinished || isAnswered || study.answer(currentWord.id, null) === null) return;
    cancelAutoNext();
    playWrongSound();
  }, [currentWord, isFinished, isAnswered, study, cancelAutoNext]);

  const handleRestart = async () => {
    cancelAutoNext();
    await study.start();
  };

  const handleModeChange = (mode: StudyMode) => {
    if (mode === questionMode || blocked) return;
    cancelAutoNext();
    setPendingMode(mode);
  };
  const confirmModeChange = async () => {
    if (!pendingMode || blocked) return;
    const mode = pendingMode;
    setPendingMode(null);
    await study.start(mode);
  };

  const handleExit = () => {
    cancelAutoNext();
    if (study.requestExit()) onExit();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || document.querySelector('dialog[open]') || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
        || (e.target instanceof HTMLElement && e.target.isContentEditable)) return;

      if (e.key === '1') {
        e.preventDefault();
        handleSelectOption(0);
      } else if (e.key === '2') {
        e.preventDefault();
        handleSelectOption(1);
      } else if (e.key === '3') {
        e.preventDefault();
        handleSelectOption(2);
      } else if (e.key === '4') {
        e.preventDefault();
        handleSelectOption(3);
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (isAnswered || hasGivenUp) {
          handleNext();
        }
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        handlePlayAudio();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectOption, isAnswered, hasGivenUp, handleNext, handlePlayAudio]);

  return (
    <div className={`w-full relative transition-all duration-200 ${
      isFullscreen 
        ? 'fixed inset-0 z-50 bg-[#171f34] flex flex-col justify-between p-4 md:p-8 overflow-y-auto' 
        : 'rounded-2xl bg-[#232d4b] border border-[#334155] shadow-2xl overflow-hidden flex flex-col'
    }`}>
      
      <StudyStatus study={study} />
      <StudyModeDialog open={pendingMode !== null} busy={blocked} onCancel={() => setPendingMode(null)} onConfirm={() => { void confirmModeChange(); }} />

      {/* 1. TOP BAR */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 text-slate-300">
        
        {/* Left: Back button + "Bí quá thì nghe" audio button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Quay lại danh sách từ"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Quay lại</span>
          </button>

          <button
            onClick={handlePlayAudio}
            disabled={blocked || isFinished || !currentWord}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-slate-700"
            title="Bí quá thì nghe phát âm (R)"
          >
            <Volume2 className="w-4 h-4 text-sky-400" />
            <span>Bí quá thì nghe</span>
          </button>
        </div>

        {/* Right: Segmented Control: [ Cách đọc | Kanji | Ý nghĩa ] + Settings + Fullscreen */}
        <div className="flex items-center gap-2 md:gap-3">
          
          {/* Segmented 3-option control (matching Images 2 & 3) */}
          <div className="flex items-center rounded-xl bg-slate-800/80 p-0.5 border border-slate-700 shadow-inner">
            <button
              onClick={(event) => { if (event.detail <= 1) void handleModeChange('reading'); }}
              disabled={blocked}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                questionMode === 'reading'
                  ? 'bg-[#e5e5d8] text-slate-900 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cách đọc
            </button>

            <button
              onClick={(event) => { if (event.detail <= 1) void handleModeChange('kanji'); }}
              disabled={blocked}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                questionMode === 'kanji'
                  ? 'bg-[#e5e5d8] text-slate-900 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Kanji
            </button>

            <button
              onClick={(event) => { if (event.detail <= 1) void handleModeChange('meaning'); }}
              disabled={blocked}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                questionMode === 'meaning'
                  ? 'bg-[#e5e5d8] text-slate-900 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ý nghĩa
            </button>
          </div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(prev => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Cài đặt trắc nghiệm"
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
        <div className="absolute right-6 top-14 w-60 bg-[#1e293b] border border-slate-700 rounded-xl p-3 shadow-2xl z-30 text-xs text-slate-200 space-y-2">
          <div className="font-bold text-slate-300 pb-1 border-b border-slate-700 flex justify-between items-center">
            <span>Cài đặt Trắc nghiệm</span>
            <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <label className="flex items-center justify-between cursor-pointer py-1">
            <span>Tự chuyển câu khi trả lời đúng</span>
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => {
                cancelAutoNext();
                setAutoAdvance(e.target.checked);
              }}
              className="rounded accent-emerald-600 cursor-pointer"
            />
          </label>
        </div>
      )}

      {/* 2. QUESTION AND OPTIONS AREA */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 md:px-12 py-6 min-h-[320px]">
        
        {/* Dartboard Crow Mascot on bottom-left watermark */}
        <div className="absolute bottom-1 left-2 md:left-6">
          <DartboardCrowMascot className="w-28 h-24 md:w-36 md:h-32" />
        </div>

        {isFinished ? (
          <div className="text-center space-y-4 py-8 z-10 animate-in fade-in duration-200">
            <span className="text-5xl">🎯</span>
            <h3 className="text-2xl font-black text-white">Bạn đã hoàn thành bài Trắc nghiệm!</h3>
            <p className="text-sm font-bold text-emerald-400">
              Điểm số: {score} / {total} câu đúng
            </p>
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={(event) => { if (event.detail <= 1) void handleRestart(); }}
                disabled={blocked}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
              >
                Làm lại bài này
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
          <p className="text-sm text-white">{study.loaded ? 'Chưa có từ vựng nào để làm trắc nghiệm.' : ''}</p>
        ) : (
          <div className="w-full max-w-2xl space-y-6 z-10">
            
            {/* Question Text */}
            <div className="text-center space-y-1.5">
              {questionMode === 'meaning' && (
                <h2 className="text-2xl md:text-3xl font-black text-white">
                  {currentWord?.meaning}
                </h2>
              )}

              {questionMode === 'kanji' && (
                <div className="space-y-1">
                  <h2 className="text-3xl md:text-4xl font-black text-white tracking-wide">
                    {currentWord?.reading}
                  </h2>
                  <p className="text-xs md:text-sm text-slate-300 font-medium">
                    {currentWord?.meaning}
                  </p>
                </div>
              )}

              {questionMode === 'reading' && (
                <div className="space-y-1">
                  <h2 className="text-3xl md:text-4xl font-black text-white tracking-wide">
                    {currentWord?.word}
                  </h2>
                  <p className="text-xs md:text-sm text-slate-400">
                    Chọn cách đọc Kana đúng
                  </p>
                </div>
              )}
            </div>

            {/* 4 Options Grid (2x2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
              {currentOptions.map((opt, idx) => {
                const isSelected = selectedOptionIndex === idx;
                const isCorrect = opt.isCorrect;
                
                // Style calculation based on answer state
                let cardStyle = 'bg-[#1a233a]/80 border-slate-700 text-slate-100 hover:border-slate-500 hover:bg-[#202b46]';
                
                if (isAnswered || hasGivenUp) {
                  if (isCorrect) {
                    cardStyle = 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]';
                  } else if (isSelected && !isCorrect) {
                    cardStyle = 'bg-rose-950/70 border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)]';
                  } else {
                    cardStyle = 'bg-[#1a233a]/40 border-slate-800 text-slate-500 opacity-60';
                  }
                }

                return (
                  <button
                    key={opt.id}
                    onClick={(event) => { if (event.detail <= 1) handleSelectOption(idx); }}
                    disabled={blocked || isAnswered || hasGivenUp}
                    className={`relative p-3.5 md:p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all cursor-pointer select-none active:scale-[0.99] ${cardStyle}`}
                  >
                    {/* Key number label (1, 2, 3, 4) */}
                    <span className="w-5 text-[11px] font-bold text-slate-400 shrink-0">
                      {idx + 1}
                    </span>

                    {/* Option Text */}
                    <span className="text-sm md:text-base font-bold flex-1">
                      {opt.text}
                    </span>

                    {/* Feedback Icon */}
                    {(isAnswered || hasGivenUp) && (
                      <span className="shrink-0">
                        {isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : isSelected ? (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        ) : null}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Answer feedback message / Continue button */}
            {(isAnswered || hasGivenUp) && !isFinished && (
              <div className="flex items-center justify-center gap-3 pt-1 animate-in fade-in duration-150">
                {hasGivenUp ? (
                  <span className="text-xs text-rose-400 font-bold">
                    Đã hiển thị đáp án đúng!
                  </span>
                ) : selectedOptionIndex !== null && currentOptions[selectedOptionIndex]?.isCorrect ? (
                  <span className="text-xs text-emerald-400 font-bold">
                    Chính xác! 🎉
                  </span>
                ) : (
                  <span className="text-xs text-rose-400 font-bold">
                    Chưa đúng rồi!
                  </span>
                )}

                <button
                  onClick={(event) => { if (event.detail <= 1) handleNext(); }}
                  disabled={blocked}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer ml-2 shadow-xs"
                >
                  Tiếp tục (Space)
                </button>
              </div>
            )}

          </div>
        )}

      </div>

      {/* 3. BOTTOM BAR */}
      <div className="bg-[#1b243d] px-5 py-2.5 flex items-center justify-between border-t border-[#2a3654] relative flex-wrap gap-2 text-xs">
        
        {/* Progress Counter */}
        <div className="text-slate-400 font-bold">
          <span className="text-slate-200">{isFinished ? total : currentWord ? currentIndex + 1 : 0}</span> / {total}
        </div>

        {/* Center shortcuts hint */}
        <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap justify-center">
          <span>Nhấn</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-600 rounded text-slate-200">1-4</kbd>
          <span>để chọn,</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-600 rounded text-slate-200">Space</kbd>
          <span>để tiếp tục,</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-600 rounded text-slate-200">R</kbd>
          <span>nghe audio</span>
        </div>

        {/* Right: "Câu này bó tay" button */}
        <button
          onClick={(event) => { if (event.detail <= 1) handleGiveUp(); }}
          disabled={blocked || isFinished || !currentWord || isAnswered || hasGivenUp}
          className={`flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
            blocked || isFinished || !currentWord || isAnswered || hasGivenUp
              ? 'text-slate-600 cursor-not-allowed' 
              : 'text-slate-400 hover:text-rose-300'
          }`}
          title="Bỏ qua câu này và hiển thị đáp án"
        >
          <Heart className="w-3.5 h-3.5" />
          <span>Câu này bó tay</span>
        </button>

        {/* Thin green progress bar at the very bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${total ? ((isFinished ? total : currentWord ? currentIndex + 1 : 0) / total) * 100 : 0}%` }}
          />
        </div>

      </div>

    </div>
  );
};
