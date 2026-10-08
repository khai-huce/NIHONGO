import { ReviewStar } from '../../review/components/ReviewStar';
import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Volume2, 
  Check, 
  PenTool, 
  Zap, 
  AlignLeft, 
  Target, 
  AlertTriangle,
  X
} from 'lucide-react';
import { speakJapanese } from '../../../shared/audio/speech';
import { RoughButton } from '../../../shared/ui/RoughCard';

export interface GrammarDetailItem {
  id: string;
  lesson: string;
  pattern: string;
  meaning: string;
  structurePill: string;
  structureSuffix: string;
  explanation: string[];
  usage: string[];
  notes: string[];
  seeAlso?: { pattern: string; id: string };
  examples: {
    japanese: string;
    vietnamese: string;
  }[];
  relatedPatterns: {
    id: string;
    pattern: string;
    meaning: string;
  }[];
  prevPattern?: {
    id: string;
    pattern: string;
  };
  nextPattern?: {
    id: string;
    pattern: string;
  };
}

export const SAMPLE_GRAMMAR_ITEMS: Record<string, GrammarDetailItem> = {
  's-ka': {
    id: 's-ka',
    lesson: '第1課 – Bài 1',
    pattern: 'S か',
    meaning: 'Câu hỏi nghi vấn',
    structurePill: 'S',
    structureSuffix: 'か',
    explanation: [
      'Thêm 「か」 vào cuối câu khẳng định để tạo câu hỏi.',
      'Trật tự từ giữ nguyên (không đảo như tiếng Anh).'
    ],
    usage: [
      'Hỏi xác nhận đúng/sai.',
      'Trả lời: はい、～です (đúng) / いいえ、～じゃありません (sai).',
      'Khi đọc thường lên giọng ở cuối câu.'
    ],
    notes: [
      'Văn viết lịch sự thường kết thúc bằng 「か」 và dấu 。 , không cần dấu ? .',
      'Câu hỏi có từ để hỏi (だれ・なに・なんさい...) cũng dùng 「か」 cuối câu, trả lời bằng thông tin tương ứng.'
    ],
    seeAlso: {
      id: 'n1-wa-n2-desu',
      pattern: 'N1 は N2 です'
    },
    examples: [
      {
        japanese: 'あなたはぎんこういんですか。',
        vietnamese: 'Bạn là nhân viên ngân hàng phải không?'
      },
      {
        japanese: 'しずかさんはきょうしですか。',
        vietnamese: 'Chị Shizuka là giáo viên à?'
      },
      {
        japanese: 'たなかさんはいしゃですか。――いいえ、けんきゅうしゃです。',
        vietnamese: 'Anh Tanaka là bác sĩ à? ―― Không, là nhà nghiên cứu.'
      }
    ],
    relatedPatterns: [
      {
        id: 'n1-wa-n2-desu',
        pattern: 'N1 は N2 です',
        meaning: 'N1 là N2'
      },
      {
        id: 'n1-wa-n2-dewa-arimasen',
        pattern: 'N1 は N2 ではありません',
        meaning: 'N1 không phải là N2'
      },
      {
        id: 'n-wa-question-desu-ka',
        pattern: 'N は Từ để hỏi ですか',
        meaning: 'Câu hỏi có từ để hỏi'
      },
      {
        id: 'n-mo',
        pattern: 'N も',
        meaning: 'N cũng'
      },
      {
        id: 'n1-no-n2',
        pattern: 'N1 の N2',
        meaning: 'N2 của N1 (sở hữu / nối danh từ)'
      }
    ],
    prevPattern: {
      id: 'n1-wa-n2-dewa-arimasen',
      pattern: 'N1 は N2 ではありません'
    },
    nextPattern: {
      id: 'n-wa-question-desu-ka',
      pattern: 'N は Từ để hỏi ですか'
    }
  }
};

interface GrammarDetailViewProps {
  item?: GrammarDetailItem;
  onBack: () => void;
  onSelectGrammar?: (item: GrammarDetailItem) => void;
}

export const GrammarDetailView: React.FC<GrammarDetailViewProps> = ({
  item = SAMPLE_GRAMMAR_ITEMS['s-ka'],
  onBack,
  onSelectGrammar
}) => {
  const [isSaved, setIsSaved] = useState(true);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);

  const handlePatternClick = (patternId: string) => {
    if (SAMPLE_GRAMMAR_ITEMS[patternId] && onSelectGrammar) {
      onSelectGrammar(SAMPLE_GRAMMAR_ITEMS[patternId]);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-7 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5">
          {/* Back link */}
          <button 
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-[#0094ff] hover:underline cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{item.lesson}</span>
          </button>

          <ReviewStar source={{category:'grammar',sourceId:item.pattern,front:item.pattern,back:item.meaning,hint:item.explanation.join(' ').slice(0,2000)}} />
          {/* Pattern Title & Subtitle */}
          <h1 className="text-3xl md:text-4xl font-black text-[#292524] font-kanji tracking-wide">
            {item.pattern}
          </h1>
          <p className="text-sm font-bold text-[#57534e]">
            {item.meaning}
          </p>
        </div>

        {/* Action Button & Saved Status */}
        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <RoughButton
            onClick={() => setShowQuizModal(true)}
            fill="#0094ff"
            stroke="#292524"
            borderRadius={10}
            roughness={0.7}
            className="px-4 py-2 font-black text-xs md:text-sm text-white shadow-sketch hover:scale-102 active:scale-98 transition-transform cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <PenTool className="w-4 h-4 text-white" />
              <span>Làm bài tập</span>
            </div>
          </RoughButton>

          <button
            onClick={() => setIsSaved(!isSaved)}
            className="flex items-center gap-1.5 text-xs font-bold text-[#16a34a] hover:opacity-80 transition-opacity cursor-pointer mt-0.5"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>{isSaved ? 'Đã thêm vào ghi nhớ' : 'Chưa lưu vào ghi nhớ'}</span>
          </button>
        </div>
      </div>

      {/* 2. Four Dark Navy Info Cards (2x2 Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        
        {/* Card 1: CẤU TRÚC */}
        <div className="bg-[#1e2238] rounded-2xl p-5 border-sketch text-white shadow-sketch flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center gap-1.5 text-xs font-black text-[#cbd5e1] uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 text-[#818cf8]" />
            <span>CẤU TRÚC</span>
          </div>

          <div className="my-auto py-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#7c3aed] border border-purple-400 flex items-center justify-center font-bold text-sm text-white shadow-inner">
              {item.structurePill}
            </div>
            <span className="text-xl font-kanji font-bold text-white tracking-wide">
              {item.structureSuffix}
            </span>
          </div>
        </div>

        {/* Card 2: GIẢI NGHĨA */}
        <div className="bg-[#1e2238] rounded-2xl p-5 border-sketch text-white shadow-sketch space-y-2.5 min-h-[145px]">
          <div className="flex items-center gap-1.5 text-xs font-black text-[#cbd5e1] uppercase tracking-wider">
            <AlignLeft className="w-3.5 h-3.5 text-[#93c5fd]" />
            <span>GIẢI NGHĨA</span>
          </div>

          <ul className="space-y-1.5 text-xs md:text-sm font-bold text-slate-200">
            {item.explanation.map((exp, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-slate-400 leading-none mt-1">•</span>
                <span>{exp}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Card 3: PHẠM VI SỬ DỤNG */}
        <div className="bg-[#1e2238] rounded-2xl p-5 border-sketch text-white shadow-sketch space-y-2.5 min-h-[160px]">
          <div className="flex items-center gap-1.5 text-xs font-black text-[#4ade80] uppercase tracking-wider">
            <Target className="w-3.5 h-3.5 text-[#4ade80]" />
            <span>PHẠM VI SỬ DỤNG</span>
          </div>

          <ul className="space-y-1.5 text-xs md:text-sm font-bold text-slate-200">
            {item.usage.map((u, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-slate-400 leading-none mt-1">•</span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Card 4: LƯU Ý */}
        <div className="bg-[#1e2238] rounded-2xl p-5 border-sketch text-white shadow-sketch flex flex-col justify-between space-y-2.5 min-h-[160px]">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-[#facc15] uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5 text-[#facc15]" />
              <span>LƯU Ý</span>
            </div>

            <ul className="space-y-1.5 text-xs md:text-sm font-bold text-slate-200">
              {item.notes.map((n, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-slate-400 leading-none mt-1">•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pill button: Xem thêm */}
          {item.seeAlso && (
            <div className="pt-2 text-xs font-bold text-slate-400 flex items-center gap-2">
              <span>Xem thêm:</span>
              <button
                onClick={() => handlePatternClick(item.seeAlso!.id)}
                className="px-2.5 py-0.5 rounded border border-slate-600 bg-slate-800 text-xs font-kanji font-bold text-white hover:bg-slate-700 transition-colors cursor-pointer shadow-xs"
              >
                {item.seeAlso.pattern}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* 3. Ví dụ Section */}
      <div className="space-y-3 pt-2">
        {/* Section Heading */}
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-5 bg-[#0094ff] rounded-full" />
          <h2 className="text-xl font-black text-[#292524] font-sketch">
            Ví dụ
          </h2>
        </div>

        {/* Example Cards List */}
        <div className="space-y-2.5">
          {item.examples.map((ex, idx) => (
            <div
              key={idx}
              className="w-full bg-[#1e2238] rounded-2xl p-4 border-sketch text-white shadow-sketch flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="text-sm md:text-base font-bold font-kanji text-white">
                  {ex.japanese}
                </div>
                <div className="text-xs md:text-sm font-bold text-slate-300">
                  {ex.vietnamese}
                </div>
              </div>

              {/* Speaker Audio Button */}
              <button
                onClick={() => speakJapanese(ex.japanese)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                title="Nghe câu ví dụ"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Mẫu liên quan (beta) Section */}
      <div className="space-y-3 pt-2">
        {/* Section Heading */}
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-5 bg-[#0094ff] rounded-full" />
          <h2 className="text-xl font-black text-[#292524] font-sketch">
            Mẫu liên quan (beta)
          </h2>
        </div>

        {/* Grid of Related Pattern Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {item.relatedPatterns.map((rel) => (
            <div
              key={rel.id}
              onClick={() => handlePatternClick(rel.id)}
              className="bg-[#1e2238] rounded-xl p-3.5 border-sketch-subtle text-white shadow-sketch hover:border-[#0094ff] transition-colors cursor-pointer space-y-1"
            >
              <div className="text-sm font-bold font-kanji text-white">
                {rel.pattern}
              </div>
              <div className="text-[11px] font-bold text-slate-400">
                {rel.meaning}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Bottom Navigation (Mẫu trước / Mẫu tiếp) */}
      <div className="pt-4 border-t border-[#78716c]/30 flex items-center justify-between text-xs font-bold">
        {/* Previous Pattern */}
        <div>
          {item.prevPattern ? (
            <div className="space-y-0.5 text-left">
              <div className="text-[10px] text-[#78716c]">Mẫu trước</div>
              <button
                onClick={() => handlePatternClick(item.prevPattern!.id)}
                className="flex items-center gap-1 font-black text-[#0094ff] hover:underline cursor-pointer font-kanji"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{item.prevPattern.pattern}</span>
              </button>
            </div>
          ) : <div />}
        </div>

        {/* Next Pattern */}
        <div>
          {item.nextPattern ? (
            <div className="space-y-0.5 text-right">
              <div className="text-[10px] text-[#78716c]">Mẫu tiếp</div>
              <button
                onClick={() => handlePatternClick(item.nextPattern!.id)}
                className="flex items-center gap-1 font-black text-[#0094ff] hover:underline cursor-pointer font-kanji"
              >
                <span>{item.nextPattern.pattern}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : <div />}
        </div>
      </div>

      {/* Quiz Modal */}
      {showQuizModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowQuizModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-md bg-[#fcf9f2] border-sketch rounded-2xl p-6 shadow-sketch space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#78716c]/30 pb-3">
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-[#0094ff]" />
                <h3 className="font-black text-lg text-[#292524] font-sketch">
                  Bài tập nhanh: {item.pattern}
                </h3>
              </div>
              <button 
                onClick={() => setShowQuizModal(false)}
                className="p-1 rounded-lg hover:bg-stone-200 text-[#78716c] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs md:text-sm font-bold text-[#292524]">
              <p>Chọn từ thích hợp điền vào chỗ trống để tạo câu hỏi:</p>
              <div className="p-3 bg-white border-sketch rounded-xl font-kanji text-base font-bold text-center">
                あなたはがくせい_____。
              </div>

              <div className="space-y-2">
                {[
                  { id: 1, label: 'ですか', isCorrect: true },
                  { id: 2, label: 'でした', isCorrect: false },
                  { id: 3, label: 'じゃない', isCorrect: false },
                  { id: 4, label: 'から', isCorrect: false }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setQuizAnswer(opt.id)}
                    className={`w-full p-2.5 rounded-lg border text-left font-kanji font-bold text-xs md:text-sm flex items-center justify-between cursor-pointer transition-colors ${
                      quizAnswer === opt.id
                        ? opt.isCorrect
                          ? 'bg-emerald-50 border-sketch-green text-emerald-950 font-bold'
                          : 'bg-rose-50 border-sketch text-rose-950 line-through'
                        : 'bg-white border-sketch-subtle hover:bg-[#fcf9f2]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {quizAnswer === opt.id && (
                      <span className="text-xs font-black">
                        {opt.isCorrect ? '✓ Chính xác!' : '✗ Sai rồi!'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowQuizModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#292524] text-white text-xs font-black cursor-pointer hover:bg-black transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
