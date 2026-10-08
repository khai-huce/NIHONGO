import { ReviewStar } from '../../../features/review/components/ReviewStar';
import { useReview } from '../../../features/review/hooks/useReview';
import React, { useState, useEffect, useCallback, useRef, useMemo, useId } from 'react';
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
import type { VocabWord } from '@nihongo/shared/contracts/vocabulary';
import { useVocabProgress, type ProgressSnapshot } from '../hooks/useVocabProgress';
import type { StudyLeaveState } from '../hooks/useVocabStudy';
import { summarizeVocabProgress, nextUnratedIndex } from '../lib/vocab-progress';
import { speakJapanese, cancelJapaneseSpeech } from '../../audio/speech';

interface FlashcardStudyProps {
  words: VocabWord[];
  lessonId: string;
  lessonVersion: number;
  userId: string | null;
  authBusy: boolean;
  lessonName: string;
  onExit: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onSelectWordDetail?: (word: VocabWord) => void;
  studyScope?: 'personal' | 'catalog' | 'curriculum-review';
  embedded?: boolean;
  onSaved?: () => void;
  onCompletion?: (info: { kind: 'flashcard'; total: number; known: number }) => void;
  onExitGuardChange?: (guard: (() => boolean) | null) => void;
  onExitStateChange?: (getState: (() => StudyLeaveState) | null) => void;
}

type FlashcardWord = VocabWord & { exampleJp?: string; exampleVi?: string };

export const FlashcardStudy: React.FC<FlashcardStudyProps> = ({
  words,
  lessonId,
  lessonVersion,
  userId,
  authBusy,
  lessonName,
  onExit,
  isFullscreen,
  onToggleFullscreen,
  studyScope = 'personal',
  embedded = false,
  onSaved,
  onCompletion,
  onExitGuardChange,
  onExitStateChange
}) => {
  const progressStore = useVocabProgress({ lessonId, lessonVersion, userId, authBusy, words, studyScope, onSaved });
  const [order, setOrder] = useState(words.map(word => word.id));
  const deck = useMemo(() => {
    const byId = new Map(progressStore.words.map(word => [word.id, word]));
    const ordered = order.flatMap(id => {
      const word = byId.get(id);
      if (!word) return [];
      byId.delete(id);
      return [word];
    });
    return [...ordered, ...byId.values()];
  }, [order, progressStore.words]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const review = useReview();

  // Study direction: jp-vi (default) or vi-jp
  const [direction, setDirection] = useState<'jp-vi' | 'vi-jp'>('jp-vi');
  const [contentMode, setContentMode] = useState<'word' | 'example'>('word');
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoSpeechOnFlip, setAutoSpeechOnFlip] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const resetTitleId = useId();
  useEffect(() => {
    const dialog = resetDialog.current;
    if (resetOpen && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [resetOpen]);

  // Statistics
  const summary = summarizeVocabProgress(progressStore.words, progressStore.progress);
  const knownCount = summary.known;
  const unknownCount = summary.unknown;
  const [isFinished, setIsFinished] = useState(false);

  const initialized = useRef(false);
  const actionPending = useRef(false);
  const busy = progressStore.busy;
  const blocked = busy || !!progressStore.error;
  const exitBlocked = useRef(false);
  exitBlocked.current = progressStore.saving;
  const handleExit = () => { if (!actionPending.current && !exitBlocked.current) onExit(); };
  useEffect(() => {
    onExitGuardChange?.(() => !actionPending.current && !exitBlocked.current);
    return () => onExitGuardChange?.(null);
  }, [onExitGuardChange]);
  const getLeaveState = useCallback((): StudyLeaveState => actionPending.current || exitBlocked.current ? 'saving' : 'ready', []);
  useEffect(() => {
    onExitStateChange?.(getLeaveState);
  }, [onExitStateChange, getLeaveState, progressStore.saving, progressStore.loading, resetOpen]);
  useEffect(() => () => onExitStateChange?.(null), [onExitStateChange]);
  const completionCallback = useRef(onCompletion);
  completionCallback.current = onCompletion;
  const reportedCompletion = useRef('');
  useEffect(() => {
    if (!isFinished || !progressStore.loaded || summary.rated !== progressStore.words.length) {
      reportedCompletion.current = '';
      return;
    }
    const completedKey = JSON.stringify([studyScope, userId, lessonId, lessonVersion, summary.rated, knownCount]);
    if (summary.rated > 0 && reportedCompletion.current !== completedKey) {
      reportedCompletion.current = completedKey;
      completionCallback.current?.({ kind: 'flashcard', total: summary.rated, known: knownCount });
    }
  }, [isFinished, progressStore.loaded, progressStore.words.length, summary.rated, knownCount, studyScope, userId, lessonId, lessonVersion]);
  const reviewPrefix = studyScope === 'personal' ? 'custom:' : 'curriculum:';

  // A fresh load opens the first word with no saved assessment. False is assessed too.
  useEffect(() => {
    if (!progressStore.loaded) {
      initialized.current = false;
      return;
    }
    if (progressStore.loading || initialized.current) return;
    initialized.current = true;
    const first = summarizeVocabProgress(progressStore.words, progressStore.progress).firstUnratedIndex;
    setOrder(progressStore.words.map(word => word.id));
    setCurrentIndex(first < 0 ? Math.max(0, progressStore.words.length - 1) : first);
    setIsFinished(first < 0 && progressStore.words.length > 0);
    setIsFlipped(false);
    setIsAutoPlay(false);
  }, [progressStore.loaded, progressStore.loading, progressStore.words, progressStore.progress]);

  const canInteract = () => initialized.current && !actionPending.current && progressStore.canActNow() && !progressStore.error;
  const resumeSnapshot = (snapshot: ProgressSnapshot) => {
    const first = summarizeVocabProgress(snapshot.words, snapshot.progress).firstUnratedIndex;
    setOrder(snapshot.words.map(word => word.id));
    setCurrentIndex(first < 0 ? Math.max(0, snapshot.words.length - 1) : first);
    setIsFinished(first < 0 && snapshot.words.length > 0);
    setIsFlipped(false);
    setIsAutoPlay(false);
    initialized.current = true;
  };
  const handleReload = async () => {
    if (actionPending.current || progressStore.loading || progressStore.saving) return;
    actionPending.current = true;
    setIsAutoPlay(false);
    try {
      const snapshot = await progressStore.reload();
      if (snapshot) resumeSnapshot(snapshot);
    } finally { actionPending.current = false; }
  };

  const currentWord = (deck[currentIndex] || null) as FlashcardWord | null;
  const showExample = studyScope !== 'personal' && contentMode === 'example';
  const exampleJp = currentWord?.exampleJp?.trim() ?? '';
  const exampleVi = currentWord?.exampleVi?.trim() ?? '';
  const spokenText = showExample ? exampleJp : currentWord?.reading || currentWord?.word;
  const toggleStar = useCallback(() => {
    if (canInteract() && !isFinished && currentWord) void review.toggle({category:'vocab',sourceId:reviewPrefix+currentWord.id,front:currentWord.word,back:currentWord.meaning,reading:currentWord.reading});
  }, [currentWord, review, blocked, isFinished, progressStore.canActNow, reviewPrefix]);

  // Viewing, moving and automatic playback never save an assessment.
  const handleFlip = () => {
    if (!canInteract() || isFinished) return;
    const next = !isFlipped;
    setIsFlipped(next);
    if (next && autoSpeechOnFlip && spokenText) speakJapanese(spokenText);
  };
  const handleNext = () => {
    if (!canInteract() || isFinished) return;
    if (currentIndex < deck.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      setIsAutoPlay(false);
      // Reaching the end by navigation is not the same as assessing every word.
      if (summary.rated === deck.length) setIsFinished(true);
    }
  };
  const handlePrev = () => {
    if (!canInteract()) return;
    if (isFinished) {
      setIsFinished(false);
      setCurrentIndex(Math.max(0, deck.length - 1));
    } else if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
    setIsFlipped(false);
  };
  const handleAssessment = async (memorized: boolean) => {
    if (!canInteract() || isFinished || !currentWord) return;
    actionPending.current = true;
    setIsAutoPlay(false);
    try {
      const snapshot = await progressStore.rate(currentWord.id, memorized);
      if (!snapshot) return;
      const next = nextUnratedIndex(deck, snapshot.progress, currentIndex);
      setIsFlipped(false);
      setIsFinished(next < 0);
      if (next >= 0) setCurrentIndex(next);
    } finally { actionPending.current = false; }
  };
  // The second click of a double-click must not rate the newly displayed word.
  const handleKnown = (event?: React.MouseEvent) => { if (!event || event.detail <= 1) void handleAssessment(true); };
  const handleUnknown = (event?: React.MouseEvent) => { if (!event || event.detail <= 1) void handleAssessment(false); };
  const handleAudio = () => {
    if (spokenText && canInteract() && !isFinished) speakJapanese(spokenText);
  };
  const changeContentMode = (mode: 'word' | 'example') => {
    if (!canInteract() || isFinished || mode === contentMode) return;
    cancelJapaneseSpeech();
    setContentMode(mode);
    setIsFlipped(false);
    setIsAutoPlay(false);
  };
  const handleRestart = async () => {
    if (!canInteract()) return;
    setIsAutoPlay(false);
    actionPending.current = true;
    if (studyScope !== 'personal') {
      setResetOpen(true);
      return;
    }
    try {
      if (!window.confirm(`Học lại từ đầu bài “${lessonName}”? Đặt lại kết quả của ${summary.rated} từ đã đánh giá. Sao và lịch Ôn tập vẫn được giữ nguyên.`)) return;
      const snapshot = await progressStore.reset();
      if (snapshot) resumeSnapshot(snapshot);
    } finally { actionPending.current = false; }
  };
  const cancelReset = () => { setResetOpen(false); actionPending.current = false; };
  const confirmReset = async () => {
    if (!resetOpen || !actionPending.current || !progressStore.canActNow()) return;
    setResetOpen(false);
    try {
      const snapshot = await progressStore.reset();
      if (snapshot) resumeSnapshot(snapshot);
    } finally { actionPending.current = false; }
  };
  const handleShuffle = () => {
    if (!canInteract() || isFinished) return;
    const shuffled = deck.map(word => word.id);
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setOrder(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };
  useEffect(() => {
    if (!isAutoPlay || isFinished || blocked) return;
    const timer = window.setTimeout(() => {
      if (!canInteract()) return;
      if (isFlipped) handleNext();
      else handleFlip();
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [isAutoPlay, isFinished, blocked, isFlipped, currentIndex, deck, autoSpeechOnFlip, spokenText]);
  useEffect(() => { if (blocked) setIsAutoPlay(false); }, [blocked]);
  useEffect(() => () => { cancelJapaneseSpeech(); }, []);

  // Global Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLElement && e.target.isContentEditable) || document.querySelector('dialog[open]')) return;

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

  const status = progressStore.error || (progressStore.loading ? 'Đang tải tiến độ…' : progressStore.saving ? 'Đang lưu tiến độ…' : '');
  const statusNotice = status ? <div role={progressStore.error ? 'alert' : 'status'}
    className="relative z-10 mx-5 my-2 rounded-lg bg-[#182035] px-3 py-2 text-xs text-slate-200">
    {status}
    {progressStore.error && <button disabled={progressStore.loading || progressStore.saving || authBusy} onClick={() => { void handleReload(); }} className="ml-3 underline font-bold">Tải lại tiến độ</button>}
  </div> : null;

  if (deck.length === 0) {
    return (
      <div className="w-full p-8 text-center bg-[#232d4b] text-white rounded-2xl">
        {statusNotice}
        {progressStore.loaded && <p className="text-sm">Chưa có từ vựng nào trong bài học này.</p>}
        <button onClick={handleExit} className="mt-4 px-4 py-2 bg-blue-600 rounded-xl text-xs font-bold">
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className={`w-full relative transition-all duration-200 ${
      isFullscreen 
        ? 'fixed inset-0 z-50 bg-[#171f34] flex flex-col justify-between p-4 md:p-8 overflow-y-auto' 
        : embedded && studyScope !== 'personal'
          ? 'rounded-md bg-[#2d3755] border border-[#334155] shadow-sm overflow-hidden flex flex-col'
          : 'rounded-2xl bg-[#232d4b] border border-[#334155] shadow-2xl overflow-hidden flex flex-col'
    }`}>
      
      {statusNotice}
      {resetOpen && <dialog ref={resetDialog} aria-labelledby={resetTitleId}
        onCancel={event => { event.preventDefault(); cancelReset(); }}
        className="w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-600 bg-[#232d4b] p-5 text-slate-100 shadow-2xl backdrop:bg-black/60">
        <h2 id={resetTitleId} className="text-lg font-bold">Học lại từ đầu?</h2>
        <p className="mt-3 text-sm text-slate-300">Đặt lại kết quả của {summary.rated} từ đã đánh giá trong bài “{lessonName}”. Sao và lịch Ôn tập vẫn được giữ nguyên.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button autoFocus onClick={cancelReset} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-600">Hủy</button>
          <button disabled={busy} onClick={() => { void confirmReset(); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-500 disabled:opacity-50">Học lại từ đầu</button>
        </div>
      </dialog>}
      {/* 1. TOP BAR */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 text-slate-300">
        {!embedded ? <button
          onClick={handleExit}
          className="flex items-center gap-1.5 text-xs md:text-sm font-medium hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button> : <span aria-hidden="true" />}

        <div className="flex items-center gap-3">
          {currentWord && <ReviewStar source={{category:'vocab',sourceId:reviewPrefix+currentWord.id,front:currentWord.word,back:currentWord.meaning,reading:currentWord.reading}} />}

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
          disabled={blocked || (!isFinished && currentIndex === 0)}
          className={`absolute left-3 md:left-6 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            !isFinished && currentIndex === 0
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
                disabled={blocked}
                onClick={() => { void handleRestart(); }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
              >
                Học lại từ đầu
              </button>
              <button
                onClick={handleExit}
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
            {showExample ? (
              !exampleJp ? <p className="text-base leading-relaxed text-slate-300">Chưa có câu ví dụ cho từ này</p> : <div className="flex flex-col items-center space-y-4 animate-in fade-in duration-200">
                {!isFlipped ? <p className={`whitespace-pre-wrap text-2xl leading-relaxed md:text-3xl ${direction === 'jp-vi' ? 'font-kanji text-white' : 'text-amber-200'}`}>
                  {direction === 'jp-vi' ? exampleJp : exampleVi || 'Chưa có bản dịch cho câu ví dụ này'}
                </p> : <>
                  <p className="whitespace-pre-wrap font-kanji text-2xl leading-relaxed text-white md:text-3xl">{exampleJp}</p>
                  <p className="whitespace-pre-wrap text-lg leading-relaxed text-amber-200">{exampleVi || 'Chưa có bản dịch cho câu ví dụ này'}</p>
                </>}
                <button onClick={event => { event.stopPropagation(); handleAudio(); }}
                  className="rounded-full p-2.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white" title="Nghe câu ví dụ (R)">
                  <Volume2 className="h-6 w-6" />
                </button>
              </div>
            ) : !isFlipped ? (
              <div className="space-y-4 animate-in fade-in duration-200 flex flex-col items-center">
                {direction === 'jp-vi' ? (
                  <>
                    <h2 className="text-5xl md:text-6xl font-black text-white tracking-wide font-kanji">
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
                <h2 className="text-4xl md:text-5xl font-black text-white font-kanji">
                  {currentWord?.word}
                </h2>

                {currentWord?.reading && currentWord?.reading !== currentWord?.word && (
                  <p className="text-xl md:text-2xl font-bold text-sky-300 font-kanji">
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
          disabled={blocked || isFinished || currentIndex === deck.length - 1}
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
        {studyScope !== 'personal' && <div role="group" aria-label="Nội dung Flashcard" className="inline-flex rounded-lg border border-slate-400 p-0.5 text-[11px]">
          {([{ value: 'word', label: 'Từ đơn' }, { value: 'example', label: 'Ví dụ' }] as const).map(item => <button key={item.value} type="button"
            disabled={blocked || isFinished} aria-pressed={contentMode === item.value} onClick={() => changeContentMode(item.value)}
            className={`rounded-md px-2 py-1.5 disabled:opacity-50 ${contentMode === item.value ? 'bg-[#f7f0dc] text-slate-800' : 'text-slate-300 hover:text-white'}`}>{item.label}</button>)}
        </div>}
        
        {/* Left: Unknown X and Known Check buttons */}
        <div className="flex items-center gap-4">
          {/* Red X Button (Chưa biết) */}
          <button
            disabled={blocked || isFinished}
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
            disabled={blocked || isFinished}
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
          <button disabled={blocked || isFinished}
            onClick={() => {
              if (!canInteract() || isFinished) return;
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
            disabled={blocked}
            onClick={() => { void handleRestart(); }}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
            title="Bắt đầu lại từ đầu"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Auto Play Slideshow */}
          <button
            disabled={blocked || isFinished}
            onClick={() => { if (canInteract()) setIsAutoPlay(prev => !prev); }}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isAutoPlay ? 'text-amber-400 bg-amber-400/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
            }`}
            title={isAutoPlay ? "Tạm dừng tự động" : "Tự động chuyển thẻ"}
          >
            {isAutoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Shuffle */}
          <button
            disabled={blocked || isFinished}
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
