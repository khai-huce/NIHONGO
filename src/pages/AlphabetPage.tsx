import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  RotateCcw, 
  Sparkles, 
  FileText, 
  Download,
  Headphones
} from 'lucide-react';
import { speakJapanese } from '../utils/speech';
import { RoughCard, RoughButton } from '../components/RoughCard';
import { useKanaQuiz } from '../hooks/useKanaQuiz';
import { KANA_LIST, KANA_COUNT, SEION_ROWS as seionRows, DAKUON_ROWS as dakuonRows, YOON_ROWS as yoonRows, type Kana as KanaTileData } from '../../shared/kana-quiz.mjs';

interface AlphabetPageProps { userId: string | null; authBusy: boolean; }
const kanaById = new Map(KANA_LIST.map(kana => [kana.id, kana]));

export const AlphabetPage: React.FC<AlphabetPageProps> = ({ userId, authBusy }) => {
  const [activeTab, setActiveTab] = useState<'hiragana' | 'katakana'>('hiragana');
  const [selectedKana, setSelectedKana] = useState<KanaTileData | null>(null);
  const quiz = useKanaQuiz(userId, authBusy);
  const { mode: selectedQuizMode, index: currentQuestionIdx, started: isQuizStarted } = quiz;
  const targetKana = kanaById.get(quiz.question?.kanaId ?? '') ?? KANA_LIST[0];
  const quizOptions = (quiz.question?.options ?? []).map(id => kanaById.get(id)!);
  const selectedAnswer = kanaById.get(quiz.selectedAnswer?.answerId ?? '');
  const isAnswered = !!quiz.selectedAnswer;
  const correctCount = quiz.score, wrongCount = quiz.answered - quiz.score;
  const blocked = quiz.busy || !!quiz.error;
  const speechCancel = useRef<() => void>(() => {});

  const handlePlayQuizAudio = () => {
    if (!quiz.canAct() || !quiz.question || quiz.result) return;
    speechCancel.current();
    const char = quiz.question.script === 'hiragana' ? targetKana.hira : targetKana.kata;
    speechCancel.current = speakJapanese(char);
  };
  useEffect(() => {
    if (quiz.question) {
      const kana = kanaById.get(quiz.question.kanaId)!;
      speechCancel.current = speakJapanese(quiz.question.script === 'hiragana' ? kana.hira : kana.kata);
    }
    return () => speechCancel.current();
  }, [quiz.question, quiz.roundId]);

  const handleAnswer = (option: KanaTileData) => quiz.answer(targetKana.id, option.id);
  const handleNextQuestion = () => quiz.next(targetKana.id);

  // Ignore held keys, inputs, dialogs and native button activation.
  useEffect(() => {
    if (!isQuizStarted || quiz.result || blocked) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], dialog')
        || document.querySelector('[role="dialog"], dialog[open]')) return;
      if (e.key >= '1' && e.key <= '4') {
        const option = quizOptions[Number(e.key) - 1];
        if (option && !isAnswered) { e.preventDefault(); handleAnswer(option); }
      } else if (e.key === 'Enter' && isAnswered && !target.closest('button')) {
        e.preventDefault(); handleNextQuestion();
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault(); handlePlayQuizAudio();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quiz.question, quiz.selectedAnswer, quiz.result, quiz.mode, isQuizStarted, blocked]);

  const handleTileClick = (item: KanaTileData) => {
    setSelectedKana(item);
    const char = activeTab === 'hiragana' ? item.hira : item.kata;
    speakJapanese(char);
  };

  const renderTile = (item: KanaTileData | null, idx: number) => {
    if (!item) {
      return <div key={idx} className="aspect-square" />;
    }

    const char = activeTab === 'hiragana' ? item.hira : item.kata;
    const isSelected = selectedKana?.id === item.id;

    return (
      <div
        key={idx}
        onClick={() => handleTileClick(item)}
        className="cursor-pointer group"
      >
        <RoughCard
          fill={isSelected ? '#bae6fd' : '#ffffff'}
          stroke="#6b7280"
          strokeWidth={1.0}
          borderRadius={8}
          roughness={0.7}
          className="aspect-square flex flex-col items-center justify-center p-1 text-center transition-transform group-hover:scale-105"
        >
          <div className="text-xl md:text-2xl font-kanji font-bold text-[#292524] group-hover:text-[#0094ff] leading-none">
            {char}
          </div>
          <div className="text-[9px] md:text-[10px] font-bold text-[#0094ff] mt-1 leading-none">
            {item.romaji}
          </div>
        </RoughCard>
      </div>
    );
  };

  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-6 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-black text-[#292524] dark:text-white font-sketch">
          Bảng chữ cái tiếng Nhật
        </h1>
      </div>

      {/* Top Toggle Buttons: [ あ Hiragana ] / [ ア Katakana ] */}
      <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={10} roughness={0.7} className="p-1 max-w-2xl mx-auto">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('hiragana')}
            className={`flex-1 py-2 px-4 flex items-center justify-center gap-2 font-bold text-xs md:text-sm rounded-lg transition-all ${
              activeTab === 'hiragana'
                ? 'bg-[#0094ff] text-white shadow-xs'
                : 'text-[#57534e] hover:bg-[#eae3d5]'
            }`}
          >
            <span className="font-kanji font-bold">あ</span>
            <span>Hiragana</span>
          </button>

          <button
            onClick={() => setActiveTab('katakana')}
            className={`flex-1 py-2 px-4 flex items-center justify-center gap-2 font-bold text-xs md:text-sm rounded-lg transition-all ${
              activeTab === 'katakana'
                ? 'bg-[#0094ff] text-white shadow-xs'
                : 'text-[#57534e] hover:bg-[#eae3d5]'
            }`}
          >
            <span className="font-kanji font-bold">ア</span>
            <span>Katakana</span>
          </button>
        </div>
      </RoughCard>

      {/* ============================================================ */}
      {/* MAIN ALPHABET BOX (SEION + DAKUON + YOON) */}
      {/* ============================================================ */}
      <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={14} roughness={0.7} className="p-5 md:p-7 space-y-6">
        
        {/* Caption */}
        <p className="text-xs font-bold text-[#78716c] italic">
          Bấm để xem thứ tự nét viết và nghe âm đọc của mỗi chữ
        </p>

        {/* TOP ROW: ÂM TRONG (SEION) & ÂM ĐỤC - BÁN ĐỤC (DAKUON · HANDAKUON) */}
        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-6 items-start">
          
          {/* LEFT: ÂM TRONG (SEION) */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-[#57534e] uppercase tracking-wider">
              ÂM TRONG (SEION)
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {seionRows.map((row) => row.map((cell, cIdx) => renderTile(cell, cIdx)))}
            </div>
          </div>

          {/* RIGHT: ÂM ĐỤC · BÁN ĐỤC (DAKUON · HANDAKUON) */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-[#57534e] uppercase tracking-wider">
              ÂM ĐỤC · BÁN ĐỤC (DAKUON · HANDAKUON)
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {dakuonRows.map((row) => row.map((cell, cIdx) => renderTile(cell, cIdx)))}
            </div>
          </div>

        </div>

        {/* BOTTOM: ÂM GHÉP (YOON) */}
        <div className="space-y-2 pt-4 border-t border-[#78716c]/20">
          <h3 className="text-xs font-black text-[#57534e] uppercase tracking-wider">
            ÂM GHÉP (YOON)
          </h3>
          <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
            {yoonRows.map((row) => row.map((cell, cIdx) => renderTile(cell, cIdx)))}
          </div>
        </div>

      </RoughCard>

      {/* Action Pills below Alphabet Card */}
      <div className="flex items-center gap-2">
        <RoughButton
          onClick={() => {}}
          fill="#0094ff"
          stroke="#0369a1"
          borderRadius={8}
          roughness={0.7}
          className="text-white px-3.5 py-1.5 text-xs font-bold"
        >
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Flashcard</span>
          </div>
        </RoughButton>

        <RoughButton
          onClick={() => {}}
          fill="#0094ff"
          stroke="#0369a1"
          borderRadius={8}
          roughness={0.7}
          className="text-white px-3.5 py-1.5 text-xs font-bold"
        >
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>Luyện viết</span>
          </div>
        </RoughButton>

        <RoughButton
          onClick={() => alert('Đang tải file PDF luyện viết bảng chữ cái')}
          fill="#0094ff"
          stroke="#0369a1"
          borderRadius={8}
          roughness={0.7}
          className="text-white px-3.5 py-1.5 text-xs font-bold"
        >
          <div className="flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            <span>Tải file luyện viết</span>
          </div>
        </RoughButton>
      </div>

      {/* ============================================================ */}
      {/* BOTTOM SECTION: BÀI TẬP NGHE CHỌN CHỮ (Audio Quiz Game) */}
      {/* ============================================================ */}
      <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={14} roughness={0.7} className="p-5 md:p-6 space-y-4">
        
        {(quiz.error || quiz.loading || quiz.saving || authBusy) && <div role={quiz.error ? 'alert' : 'status'} className="text-xs text-[#57534e] py-2">
          {quiz.error || (quiz.saving ? 'Đang lưu kết quả…' : authBusy ? 'Đang kiểm tra tài khoản…' : 'Đang tải kết quả…')}
          {quiz.error && <button type="button" disabled={quiz.loading || quiz.saving || authBusy} className="ml-2 underline font-bold text-[#0094ff]"
            onClick={() => { void (quiz.errorCode === 'RESULT_CONFLICT' ? quiz.load() : quiz.retry()); }}>
            {quiz.errorCode === 'RESULT_CONFLICT' ? 'Tải lại kết quả' : quiz.completionPending ? 'Thử lưu lại' : 'Tải lại'}
          </button>}
        </div>}
        {!userId && !authBusy && <p className="text-xs text-[#78716c]">Bạn đang luyện thử. Kết quả không lưu vào tài khoản.</p>}

        {!isQuizStarted ? (
          /* Initial State matching media_1788112666497.png */
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-black text-[#292524] font-sketch">
              <Headphones className="w-4 h-4 text-[#0094ff]" />
              <span>BÀI TẬP NGHE CHỌN CHỮ</span>
            </div>

            <p className="text-xs text-[#57534e] leading-relaxed">
              Mỗi vòng đi hết 104 âm (xáo thứ tự): nghe âm đọc rồi chọn chữ cái đúng. Chỉ lưu kết quả khi hoàn thành đủ 104 câu; rời bài đang dở sẽ làm lại từ đầu. Mỗi câu chỉ hỏi trong 1 bảng chữ (không trộn Hiragana với Katakana vì hai bảng cùng âm đọc).
            </p>

            <div className="space-y-2">
              <div className="text-xs font-black text-[#292524]">Bảng chữ</div>
              <div className="flex items-center gap-2">
                <button
                  disabled={blocked}
                  onClick={() => quiz.chooseMode('hiragana')}
                  className={`px-4 py-1.5 rounded-lg border border-[#78716c] font-bold text-xs transition-all cursor-pointer ${
                    selectedQuizMode === 'hiragana'
                      ? 'bg-[#0094ff] text-white border-[#0094ff] shadow-xs'
                      : 'bg-white text-[#292524] hover:bg-slate-50'
                  }`}
                >
                  Hiragana
                </button>

                <button
                  disabled={blocked}
                  onClick={() => quiz.chooseMode('katakana')}
                  className={`px-4 py-1.5 rounded-lg border border-[#78716c] font-bold text-xs transition-all cursor-pointer ${
                    selectedQuizMode === 'katakana'
                      ? 'bg-[#0094ff] text-white border-[#0094ff] shadow-xs'
                      : 'bg-white text-[#292524] hover:bg-slate-50'
                  }`}
                >
                  Katakana
                </button>

                <button
                  disabled={blocked}
                  onClick={() => quiz.chooseMode('both')}
                  className={`px-4 py-1.5 rounded-lg border border-[#78716c] font-bold text-xs transition-all cursor-pointer ${
                    selectedQuizMode === 'both'
                      ? 'bg-[#0094ff] text-white border-[#0094ff] shadow-xs'
                      : 'bg-white text-[#292524] hover:bg-slate-50'
                  }`}
                >
                  Cả hai
                </button>
              </div>
            </div>

            <div className="pt-1">
              <RoughButton
                disabled={blocked}
                onClick={event => { if (event.detail <= 1) quiz.start(); }}
                fill="#0094ff"
                stroke="#0369a1"
                borderRadius={8}
                roughness={0.7}
                className="text-white px-5 py-2 text-xs font-bold"
              >
                <div className="flex items-center gap-2">
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Bắt đầu</span>
                </div>
              </RoughButton>
            </div>
          </div>
        ) : (
          /* Active Quiz Game */
          <>
            {/* Quiz Header */}
            <div className="space-y-2.5 border-b border-[#78716c]/20 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-black text-[#292524] font-sketch">
                  <Headphones className="w-4 h-4 text-[#0094ff]" />
                  <span>BÀI TẬP NGHE CHỌN CHỮ</span>
                </div>
                <div className="text-xs font-bold text-[#78716c]">
                  Câu {quiz.result ? quiz.result.total : currentQuestionIdx + 1}/{KANA_COUNT}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-[#57534e]">
                  <span>Bảng: {selectedQuizMode === 'hiragana' ? 'Hiragana' : selectedQuizMode === 'katakana' ? 'Katakana' : 'Cả hai'}</span>
                  <button
                    disabled={blocked}
                    onClick={() => quiz.chooseBoard()}
                    className="text-[#0094ff] hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Đổi bảng
                  </button>
                </div>
              </div>

              {/* Progress bar line */}
              <div className="w-full bg-[#eae3d5] h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#0094ff] h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(3, ((quiz.result ? quiz.result.total : currentQuestionIdx + 1) / KANA_COUNT) * 100))}%` }}
                />
              </div>
            </div>

            {quiz.result ? (
              <div className="space-y-4 py-6 text-center">
                <p className="text-lg font-black text-[#292524]">Bạn đã hoàn thành bài tập!</p>
                <p className="text-xs text-[#57534e]">{userId ? 'Kết quả đã lưu vào tài khoản.' : 'Kết quả luyện thử chỉ giữ trong lượt mở này.'}</p>
                <RoughButton onClick={event => { if (event.detail <= 1) quiz.start(); }} disabled={blocked}
                  fill="#0094ff" stroke="#0369a1" borderRadius={8} roughness={0.7}
                  className="text-white px-5 py-2 text-xs font-bold shadow-md cursor-pointer">Làm lại</RoughButton>
              </div>
            ) : <>
            {/* Quiz Main 2-Column Split */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-4 items-start pt-1">
              
              {/* Left Box: Big Blue Audio Player Card */}
              <RoughCard
                fill="#0094ff"
                stroke="#0369a1"
                borderRadius={12}
                roughness={0.7}
                className="p-5 text-white flex flex-col items-center justify-center text-center space-y-3 shadow-md h-full min-h-[220px]"
              >
                <span className="text-[10px] font-black tracking-widest uppercase bg-white/20 px-2.5 py-0.5 rounded-full">
                  NGHE CHỌN CHỮ
                </span>

                <Headphones className="w-10 h-10 stroke-[2.2]" />

                <p className="text-xs leading-relaxed font-medium">
                  Nghe rồi chọn chữ cái đúng ({selectedQuizMode === 'hiragana' ? 'Hiragana' : selectedQuizMode === 'katakana' ? 'Katakana' : 'Hiragana/Katakana'}). Bấm loa để nghe lại.
                </p>

                <button
                  disabled={blocked}
                  onClick={handlePlayQuizAudio}
                  className="p-3 bg-white text-[#0094ff] rounded-full shadow-md hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                  title="Bấm để nghe lại (R)"
                >
                  <Volume2 className="w-5 h-5 fill-[#0094ff]" />
                </button>
              </RoughCard>

              {/* Right Box: 4 Multiple Choice Options */}
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black text-[#292524] uppercase tracking-wider">
                    CHỌN CHỮ CÁI VỪA NGHE
                  </h4>
                  <p className="text-[10px] text-[#78716c]">
                    Phím tắt: 1-4 trả lời · Enter sang câu · R nghe lại
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {quizOptions.map((opt, idx) => {
                    const activeType = quiz.question!.script;
                    const char = activeType === 'hiragana' ? opt.hira : opt.kata;
                    const isSelected = selectedAnswer?.id === opt.id;
                    const isCorrect = opt.romaji === targetKana.romaji;

                    let cardFill = '#ffffff';
                    let strokeColor = '#78716c';

                    if (isAnswered) {
                      if (isCorrect) {
                        cardFill = '#f0fdf4';
                        strokeColor = '#16a34a';
                      } else if (isSelected) {
                        cardFill = '#ffffff';
                        strokeColor = '#78716c';
                      }
                    }

                    return (
                      <div
                        key={opt.id}
                        role="button" tabIndex={blocked || isAnswered ? -1 : 0}
                        aria-label={`Đáp án ${idx + 1}: ${char}`} aria-disabled={blocked || isAnswered}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault(); event.stopPropagation();
                            if (!event.repeat && !blocked) { if (isAnswered) handleNextQuestion(); else handleAnswer(opt); }
                          }
                        }}
                        onClick={event => { if (event.detail <= 1) handleAnswer(opt); }}
                        className={`cursor-pointer ${isAnswered ? 'cursor-default' : ''}`}
                      >
                        <RoughCard
                          fill={cardFill}
                          stroke={strokeColor}
                          borderRadius={10}
                          roughness={0.7}
                          className="p-3.5 flex items-center gap-3 transition-all min-h-[56px]"
                        >
                          {/* Badge indicator */}
                          {isAnswered && isCorrect ? (
                            <span className="text-emerald-600 font-black text-lg leading-none w-5 text-center">
                              ✓
                            </span>
                          ) : isAnswered && isSelected && !isCorrect ? (
                            <span className="text-rose-600 font-black text-lg leading-none w-5 text-center">
                              ✕
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded border border-[#78716c]/60 bg-[#fdfbf7] text-[11px] font-bold text-[#78716c] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                          )}

                          <span className={`text-2xl font-kanji font-bold ${
                            isAnswered && isCorrect 
                              ? 'text-emerald-700' 
                              : isAnswered && isSelected && !isCorrect 
                              ? 'text-[#292524]' 
                              : 'text-[#292524]'
                          }`}>
                            {char}
                          </span>
                        </RoughCard>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Row when Answered: Answer feedback + Cau tiep button */}
                {isAnswered && (
                  <div className="flex items-center justify-between pt-1 animate-in fade-in duration-150">
                    <div className="flex items-baseline gap-2 font-sketch">
                      <span className="text-xs font-bold text-[#57534e]">Đáp án:</span>
                      <span className="text-2xl font-kanji font-black text-[#292524]">
                        {quiz.question?.script === 'katakana' ? targetKana.kata : targetKana.hira}
                      </span>
                      <span className="text-xs font-bold text-[#78716c]">({targetKana.romaji})</span>
                    </div>

                    <RoughButton
                      disabled={blocked}
                      onClick={event => { if (event.detail <= 1) handleNextQuestion(); }}
                      fill="#0094ff"
                      stroke="#0369a1"
                      borderRadius={8}
                      roughness={0.7}
                      className="text-white px-5 py-2 text-xs font-bold shadow-md cursor-pointer"
                    >
                      <span>Câu tiếp</span>
                    </RoughButton>
                  </div>
                )}
              </div>

            </div>

            </>}

            {/* Bottom Score Footer */}
            <div className="flex items-center gap-4 text-xs font-bold pt-3 border-t border-[#78716c]/20">
              <span className="text-emerald-600 font-black">Đúng {correctCount}</span>
              <span className="text-slate-300">|</span>
              <span className="text-rose-600 font-black">Sai {wrongCount}</span>
              <span className="text-slate-300">|</span>
              <span className="text-[#78716c]">Đã làm {correctCount + wrongCount}/{KANA_COUNT}</span>
            </div>
          </>
        )}

      </RoughCard>

    </div>
  );
};
