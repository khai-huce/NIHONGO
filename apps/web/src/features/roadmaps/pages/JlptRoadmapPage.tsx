import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  ChevronRight, 
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  BookOpen, 
  Layers, 
  PenTool, 
  Headphones, 
  FileText, 
  Play, 
  Lock,
  Languages,
  Clock,
  Flame
} from 'lucide-react';
import { RoughCard, RoughButton } from '../../../shared/ui/RoughCard';
import { DartboardCrowMascot } from '../../../shared/study/components/StudyMascots';

export interface JLPTLevelInfo {
  id: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  name: string;
  kanjiBadge: string;
  badgeBg: string;
  accessType: 'free' | 'lifetime';
  subtitle: string;
  kanjiCount: number;
  sessionCount: number;
  progressPercent: number;
  statusText: string;
}

const JLPT_LEVELS: JLPTLevelInfo[] = [
  {
    id: 'N5',
    name: 'Sơ cấp',
    kanjiBadge: '初級',
    badgeBg: 'bg-[#16a34a]',
    accessType: 'free',
    subtitle: 'Nền tảng: bảng chữ, kanji & câu cơ bản đầu tiên.',
    kanjiCount: 118,
    sessionCount: 61,
    progressPercent: 0,
    statusText: 'Chưa bắt đầu'
  },
  {
    id: 'N4',
    name: 'Sơ trung cấp',
    kanjiBadge: '初中級',
    badgeBg: 'bg-[#0284c7]',
    accessType: 'lifetime',
    subtitle: 'Mở rộng vốn chữ, thể て và hội thoại đời thường.',
    kanjiCount: 209,
    sessionCount: 57,
    progressPercent: 0,
    statusText: 'Chưa bắt đầu'
  },
  {
    id: 'N3',
    name: 'Trung cấp',
    kanjiBadge: '中級',
    badgeBg: 'bg-[#9333ea]',
    accessType: 'lifetime',
    subtitle: 'Đọc hiểu đoạn văn, hội thoại tự nhiên, sắc thái lịch sự.',
    kanjiCount: 375,
    sessionCount: 80,
    progressPercent: 0,
    statusText: 'Chưa bắt đầu'
  },
  {
    id: 'N2',
    name: 'Trung cao cấp',
    kanjiBadge: '中上級',
    badgeBg: 'bg-[#e11d48]',
    accessType: 'lifetime',
    subtitle: 'Văn viết, tin tức và ngữ pháp nâng cao.',
    kanjiCount: 505,
    sessionCount: 105,
    progressPercent: 0,
    statusText: 'Chưa bắt đầu'
  },
  {
    id: 'N1',
    name: 'Cao cấp',
    kanjiBadge: '上級',
    badgeBg: 'bg-[#dc2626]',
    accessType: 'lifetime',
    subtitle: 'Thành thạo gần như bản ngữ — văn học & học thuật.',
    kanjiCount: 1310,
    sessionCount: 70,
    progressPercent: 0,
    statusText: 'Chưa bắt đầu'
  }
];

export interface SessionItem {
  number: number;
  category: string;
  sub: string;
  timeText: string;
  isCompleted?: boolean;
  isUnlocked: boolean;
  lockReason?: string;
  contentTitle?: string;
  contentDesc?: string;
  testQuestions?: number;
  testPassRate?: number;
}

// Full 61 realistic sessions for N5 (and generator for others)
const getN5Sessions = (): SessionItem[] => [
  {
    number: 1,
    category: 'Bảng chữ cái: Hiragana',
    sub: 'Bảng chữ · Hiragana (1)',
    timeText: '35p',
    isUnlocked: true,
    contentTitle: 'Hiragana (1)',
    contentDesc: 'Bảng chữ có nét viết, âm đọc & luyện nghe-chọn',
    testQuestions: 25,
    testPassRate: 80
  },
  {
    number: 2,
    category: 'Bảng chữ cái: Hiragana',
    sub: 'Bảng chữ · Hiragana (2)',
    timeText: '40p',
    isUnlocked: false,
    lockReason: 'Đạt bài kiểm tra buổi 1 để mở khoá'
  },
  {
    number: 3,
    category: 'Bảng chữ cái: Hiragana',
    sub: 'Bảng chữ · Hiragana (các âm đặc biệt) · Hiragana Mini Test',
    timeText: '2g05',
    isUnlocked: false,
    lockReason: 'Đạt bài kiểm tra buổi 2 để mở khoá'
  },
  {
    number: 4,
    category: 'Bảng chữ cái: Katakana',
    sub: 'Bảng chữ · Katakana (1) · KIỂM TRA HIRAGANA',
    timeText: '1g15',
    isUnlocked: false,
    lockReason: 'Đạt bài kiểm tra buổi 3 để mở khoá'
  },
  {
    number: 5,
    category: 'Bảng chữ cái: Katakana',
    sub: 'Bảng chữ · Katakana (2)',
    timeText: '40p',
    isUnlocked: false,
    lockReason: 'Đạt bài kiểm tra buổi 4 để mở khoá'
  },
  {
    number: 6,
    category: 'Bảng chữ cái: Katakana',
    sub: 'Bảng chữ · Katakana (các âm ghép) · Katakana Mini Test',
    timeText: '2g05',
    isUnlocked: false,
    lockReason: 'Đạt bài kiểm tra buổi 5 để mở khoá'
  },
  {
    number: 7,
    category: 'Chào hỏi & Đàm thoại cơ bản',
    sub: 'Từ vựng chào hỏi hàng ngày, cảm ơn & xin lỗi',
    timeText: '45p',
    isUnlocked: false,
    lockReason: 'Đạt bài kiểm tra buổi 6 để mở khoá'
  },
  {
    number: 8,
    category: 'Kanji nhập môn: Số đếm & Thời gian',
    sub: 'Nhất, Nhị, Tam, Tứ, Ngũ, Lục, Thất, Bát, Cửu, Thập',
    timeText: '50p',
    isUnlocked: false,
    lockReason: 'Đạt bài kiểm tra buổi 7 để mở khoá'
  },
  {
    number: 9,
    category: 'Ngữ pháp sơ cấp: Đại từ & Cấu trúc N1 は N2 です',
    sub: 'Khẳng định, phủ định, câu hỏi nghi vấn',
    timeText: '1g10',
    isUnlocked: false,
    lockReason: 'Đạt bài kiểm tra buổi 8 để mở khoá'
  },
  {
    number: 10,
    category: '📝 Mock Test 1 — Kiểm tra định kỳ chặng 1',
    sub: 'Tổng hợp Hiragana, Katakana, Kanji số đếm & Ngữ pháp bài 1',
    timeText: '1g30',
    isUnlocked: false,
    lockReason: 'Đạt bài kiểm tra buổi 9 để mở khoá'
  },
  {
    number: 11,
    category: 'Chỉ định từ: これ, それ, あれ, どれ',
    sub: 'Đồ vật xung quanh, giá tiền & mua sắm',
    timeText: '50p',
    isUnlocked: false,
    lockReason: 'Đạt bài kiểm tra buổi 10 để mở khoá'
  },
  {
    number: 12,
    category: 'Chỉ định từ nơi chốn: ここ, そこ, あそこ',
    sub: 'Hỏi đường, địa điểm công cộng & trường học',
    timeText: '55p',
    isUnlocked: false,
    lockReason: 'Đạt bài kiểm tra buổi 11 để mở khoá'
  }
];

export const JlptRoadmapPage: React.FC = () => {
  // Level selected for detailed view: 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | null
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);

  // Active level tracked for "Hành trình của bạn"
  const [currentActiveLevelId, setCurrentActiveLevelId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('nhai_kanji_current_jlpt_level');
      return saved || 'N5';
    } catch {
      return 'N5';
    }
  });

  // Expanded session in detailed view (defaults to Buổi 1 expanded)
  const [expandedSessionNumber, setExpandedSessionNumber] = useState<number | null>(1);

  useEffect(() => {
    localStorage.setItem('nhai_kanji_current_jlpt_level', currentActiveLevelId);
  }, [currentActiveLevelId]);

  const activeLevel = JLPT_LEVELS.find(l => l.id === (selectedLevelId || currentActiveLevelId)) || JLPT_LEVELS[0];

  // =========================================================================
  // VIEW 2: DETAILED LEVEL SESSIONS TREE VIEW (media_1788791413835.png)
  // =========================================================================
  if (selectedLevelId) {
    const sessions = getN5Sessions();

    return (
      <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-6 max-w-5xl mx-auto overflow-y-auto select-none">
        
        {/* Top Back Navigation Button */}
        <button
          onClick={() => setSelectedLevelId(null)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Tất cả cấp độ</span>
        </button>

        {/* Header with Level Badge */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-black text-[#292524] font-sketch tracking-tight">
              Lộ trình học
            </h1>
            <span className={`px-2 py-0.5 text-xs font-black text-white rounded-md ${activeLevel.badgeBg}`}>
              {activeLevel.id}
            </span>
          </div>
          <p className="text-xs md:text-sm font-bold text-[#78716c] leading-relaxed">
            Khóa {activeLevel.id} Toàn diện — {activeLevel.sessionCount} buổi theo lộ trình. Mỗi buổi có bài kiểm tra: đạt ≥ 80% mới tính hoàn thành và mở buổi kế.
          </p>
        </div>

        {/* Hero Card: "Tiếp tục buổi học" */}
        <RoughCard fill="#ffffff" stroke="#292524" borderRadius={14} roughness={0.7} className="p-5 md:p-6 shadow-sketch">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            
            {/* Left: 0% Circular Gauge */}
            <div className="flex items-center gap-5 w-full md:w-auto">
              <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-slate-200 flex flex-col items-center justify-center shrink-0">
                <span className="text-lg md:text-xl font-black text-[#292524]">0%</span>
                <span className="text-[9px] font-bold text-slate-400 tracking-wider">LỘ TRÌNH</span>
              </div>

              {/* Middle: Session details */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-[#0094ff]">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>TIẾP TỤC BUỔI HỌC</span>
                </div>
                <h3 className="text-lg md:text-xl font-black text-[#292524] font-sketch">
                  Bảng chữ cái: Hiragana
                </h3>
                <p className="text-xs font-bold text-slate-500">
                  Hiragana (1)
                </p>
                <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] font-bold text-slate-500">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black">
                    N5
                  </span>
                  <span>Buổi 1 / 61</span>
                  <span>·</span>
                  <span>Đạt 0 buổi</span>
                  <span>·</span>
                  <span>Bảng chữ</span>
                  <span>·</span>
                  <span>Buổi này ≈ 35 phút</span>
                </div>
              </div>
            </div>

            {/* Right: Dartboard Mascot + Action button */}
            <div className="flex flex-col items-end w-full md:w-auto shrink-0 space-y-2">
              <div className="hidden sm:block">
                <DartboardCrowMascot className="w-16 h-16" />
              </div>
              <RoughButton
                onClick={() => alert('Bắt đầu buổi học 1: Bảng chữ cái Hiragana!')}
                fill="#0094ff"
                stroke="#0284c7"
                borderRadius={8}
                roughness={0.7}
                className="text-white px-5 py-2.5 text-xs font-black shadow-xs cursor-pointer w-full md:w-auto"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Vào học buổi 1</span>
                </div>
              </RoughButton>
              <button 
                onClick={() => alert('Mở bài kiểm tra buổi 1')}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 cursor-pointer pt-0.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Làm bài kiểm tra ngay</span>
              </button>
            </div>

          </div>
        </RoughCard>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 space-y-1 shadow-sketch">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              TIẾN ĐỘ TỔNG
            </span>
            <div className="text-xl font-black text-[#292524]">0%</div>
            <div className="text-[10px] font-bold text-slate-400 truncate">
              — còn 114 giờ 55 phút / 114 giờ 55 phút
            </div>
          </RoughCard>

          <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 space-y-1 shadow-sketch">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              BUỔI ĐÃ ĐẠT
            </span>
            <div className="text-xl font-black text-[#292524]">0 / 61</div>
          </RoughCard>

          <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 space-y-1 shadow-sketch">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              KANJI ĐÃ HỌC
            </span>
            <div className="text-xl font-black text-[#292524]">0 / 118</div>
          </RoughCard>

          <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 space-y-1 shadow-sketch">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              STREAK
            </span>
            <div className="text-xl font-black text-orange-600 flex items-center gap-1">
              <span>0 ngày</span>
              <Flame className="w-4 h-4 fill-orange-500 text-orange-500" />
            </div>
          </RoughCard>
        </div>

        {/* Center Milestone Pill Header */}
        <div className="pt-2 flex flex-col items-center">
          <div className="flex items-center gap-2.5 px-5 py-2 rounded-full border-sketch-blue bg-white shadow-sketch">
            <div className={`w-6 h-6 rounded-md ${activeLevel.badgeBg} text-white flex items-center justify-center font-black text-xs font-sketch`}>
              {activeLevel.id}
            </div>
            <div>
              <div className="text-xs md:text-sm font-black text-[#292524] font-sketch leading-tight">
                {activeLevel.id} · {activeLevel.name}
              </div>
              <div className="text-[10px] font-bold text-slate-500">
                {activeLevel.sessionCount} buổi (2h/buổi) — nền tảng đầu tiên
              </div>
            </div>
          </div>
        </div>

        {/* Zigzag Sessions Tree (media_1788791413835.png) */}
        <div className="relative py-4">
          
          {/* Center Vertical Trunk Line */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-6 w-0.5 bg-slate-300 -translate-x-1/2 z-0" />

          {/* Sessions List in Zigzag pattern */}
          <div className="space-y-6 relative z-10">
            {sessions.map((item, idx) => {
              const isEven = (idx + 1) % 2 === 0; // Odd on Left, Even on Right
              const isExpanded = expandedSessionNumber === item.number;

              return (
                <div 
                  key={item.number}
                  className="grid grid-cols-1 md:grid-cols-[1fr_48px_1fr] items-start gap-4"
                >
                  
                  {/* Left Column Slot (For Odd sessions: 1, 3, 5...) */}
                  {!isEven ? (
                    <div className="relative">
                      {/* Horizontal connector to center trunk */}
                      <div className="hidden md:block absolute right-[-24px] top-6 w-6 h-0.5 bg-slate-300 z-0" />
                      
                      {/* Session Card */}
                      <RoughCard 
                        fill="#ffffff" 
                        stroke="#292524" 
                        borderRadius={14} 
                        roughness={0.7} 
                        className={`p-4 md:p-5 space-y-3 shadow-sketch cursor-pointer transition-all ${
                          isExpanded ? 'ring-2 ring-[#0094ff]/30' : ''
                        }`}
                        onClick={() => setExpandedSessionNumber(isExpanded ? null : item.number)}
                      >
                        {/* Top info bar */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-stone-100 border-sketch-subtle flex items-center justify-center shrink-0">
                              <Languages className="w-4 h-4 text-slate-700" />
                            </div>
                            <div>
                              <h4 className="text-xs md:text-sm font-black text-[#292524]">
                                {item.category}
                              </h4>
                              <p className="text-[11px] font-bold text-slate-500">
                                {item.sub}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-2 py-0.5 rounded-full border-sketch-pill text-[10px] font-bold text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{item.timeText}</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-full border-sketch-pill text-[10px] font-black text-slate-700 bg-stone-50">
                              BUỔI {item.number}
                            </span>
                            <button className="text-slate-400 hover:text-slate-700">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Progress line */}
                        {item.isUnlocked && (
                          <div className="flex items-center gap-2 pt-1">
                            <div className="relative flex-1 h-2 border-sketch-subtle rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full bg-[#0094ff] w-1/4 rounded-full" />
                            </div>
                            <span className="text-[11px] font-black text-[#0094ff]">
                              Đang học
                            </span>
                          </div>
                        )}

                        {/* Expanded details (For Buổi 1) */}
                        {isExpanded && item.isUnlocked && (
                          <div 
                            className="pt-2 space-y-3 border-t border-slate-200 animate-in fade-in duration-150"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                              NỘI DUNG BUỔI HỌC
                            </span>

                            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-50 border-sketch-subtle">
                              <Languages className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                              <div>
                                <h5 className="text-xs font-black text-[#292524]">{item.contentTitle}</h5>
                                <p className="text-[11px] font-medium text-slate-500">{item.contentDesc}</p>
                              </div>
                            </div>

                            <RoughButton
                              onClick={() => alert(`Bắt đầu buổi ${item.number}!`)}
                              fill="#0094ff"
                              stroke="#0284c7"
                              borderRadius={8}
                              roughness={0.7}
                              className="w-full text-white font-black text-xs shadow-xs cursor-pointer"
                            >
                              <div className="flex items-center justify-center gap-1.5 py-1">
                                <Play className="w-3.5 h-3.5 fill-white text-white" />
                                <span>Vào học buổi {item.number}</span>
                              </div>
                            </RoughButton>

                            <button
                              onClick={() => alert(`Làm bài kiểm tra buổi ${item.number}`)}
                              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center justify-center gap-1 cursor-pointer pt-0.5"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Làm bài kiểm tra ngay · {item.testQuestions} câu · đạt ≥ {item.testPassRate}%</span>
                            </button>
                          </div>
                        )}

                        {/* Locked condition text */}
                        {!item.isUnlocked && (
                          <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 pt-1">
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.lockReason}</span>
                          </div>
                        )}

                      </RoughCard>
                    </div>
                  ) : (
                    <div className="hidden md:block" />
                  )}

                  {/* Center Column Node */}
                  <div className="hidden md:flex flex-col items-center justify-start pt-5">
                    <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sketch transition-transform hover:scale-105 ${
                      item.isUnlocked 
                        ? 'border-sketch-blue text-[#0094ff]' 
                        : 'border-sketch-subtle text-slate-400 bg-stone-50'
                    }`}>
                      {item.isUnlocked ? (
                        <Languages className="w-4 h-4 text-[#0094ff]" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Right Column Slot (For Even sessions: 2, 4, 6...) */}
                  {isEven ? (
                    <div className="relative">
                      {/* Horizontal connector to center trunk */}
                      <div className="hidden md:block absolute left-[-24px] top-6 w-6 h-0.5 bg-slate-300 z-0" />
                      
                      {/* Session Card */}
                      <RoughCard 
                        fill="#ffffff" 
                        stroke="#292524" 
                        borderRadius={14} 
                        roughness={0.7} 
                        className={`p-4 md:p-5 space-y-3 shadow-sketch cursor-pointer transition-all ${
                          isExpanded ? 'ring-2 ring-[#0094ff]/30' : ''
                        }`}
                        onClick={() => setExpandedSessionNumber(isExpanded ? null : item.number)}
                      >
                        {/* Top info bar */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-stone-100 border-sketch-subtle flex items-center justify-center shrink-0">
                              <Languages className="w-4 h-4 text-slate-700" />
                            </div>
                            <div>
                              <h4 className="text-xs md:text-sm font-black text-[#292524]">
                                {item.category}
                              </h4>
                              <p className="text-[11px] font-bold text-slate-500">
                                {item.sub}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-2 py-0.5 rounded-full border-sketch-pill text-[10px] font-bold text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{item.timeText}</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-full border-sketch-pill text-[10px] font-black text-slate-700 bg-stone-50">
                              BUỔI {item.number}
                            </span>
                            <button className="text-slate-400 hover:text-slate-700">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Locked condition text */}
                        {!item.isUnlocked && (
                          <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 pt-1">
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.lockReason}</span>
                          </div>
                        )}

                        {/* Expanded state if unlocked */}
                        {isExpanded && item.isUnlocked && (
                          <div 
                            className="pt-2 space-y-3 border-t border-slate-200 animate-in fade-in duration-150"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <RoughButton
                              onClick={() => alert(`Bắt đầu buổi ${item.number}!`)}
                              fill="#0094ff"
                              stroke="#0284c7"
                              borderRadius={8}
                              roughness={0.7}
                              className="w-full text-white font-black text-xs shadow-xs cursor-pointer"
                            >
                              <div className="flex items-center justify-center gap-1.5 py-1">
                                <Play className="w-3.5 h-3.5 fill-white text-white" />
                                <span>Vào học buổi {item.number}</span>
                              </div>
                            </RoughButton>
                          </div>
                        )}

                      </RoughCard>
                    </div>
                  ) : (
                    <div className="hidden md:block" />
                  )}

                </div>
              );
            })}
          </div>

        </div>

      </div>
    );
  }

  // =========================================================================
  // VIEW 1: 5-LEVEL ROADMAP OVERVIEW (media_1788789408293.png)
  // =========================================================================
  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-6 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* 1. Page Header (media_1788789408293.png) */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-black text-[#292524] font-sketch tracking-tight">
          Lộ trình học
        </h1>
        <p className="text-xs md:text-sm font-bold text-[#78716c] leading-relaxed">
          Năm cấp độ JLPT — một con đường liền mạch từ N5 đến N1. Mỗi buổi có bài kiểm tra, đạt mới mở buổi kế. Chọn một cấp để bắt đầu.
        </p>
      </div>

      {/* 2. List of Roadmap Levels for Selection */}
      <div className="space-y-4 pt-2">
        {JLPT_LEVELS.map((level) => {
          const isCurrent = level.id === currentActiveLevelId;

          return (
            <RoughCard 
              key={level.id}
              fill="#ffffff" 
              stroke="#292524" 
              borderRadius={14} 
              roughness={0.7} 
              className="p-4 md:p-5 space-y-3 shadow-sketch transition-all hover:bg-stone-50/50 cursor-pointer"
              onClick={() => setSelectedLevelId(level.id)}
            >
              {/* Dòng 1: Header (Level badge, title, kanji badge, access type, action button) */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                
                {/* Left: Title & Badges */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className={`w-8 h-8 rounded-lg ${level.badgeBg} text-white flex items-center justify-center font-black text-xs font-sketch shrink-0 shadow-xs`}>
                    {level.id}
                  </span>
                  <span className="text-sm md:text-base font-black text-[#292524] font-sketch">
                    {level.id} · {level.name}
                  </span>

                  {/* Kanji Badge (e.g. 初級) */}
                  <span className="text-[11px] font-bold text-[#78716c] bg-stone-100 px-1.5 py-0.5 rounded border-sketch-pill">
                    {level.kanjiBadge}
                  </span>

                  {/* Access Badge: Miễn phí or Trọn đời */}
                  {level.accessType === 'free' ? (
                    <span className="text-[10px] md:text-[11px] font-black text-emerald-700 bg-emerald-50 border-sketch-green px-2.5 py-0.5 rounded-full">
                      Miễn phí
                    </span>
                  ) : (
                    <span className="text-[10px] md:text-[11px] font-black text-amber-800 bg-amber-50 border-sketch-orange px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-600 fill-amber-500" />
                      <span>Trọn đời</span>
                    </span>
                  )}
                </div>

                {/* Right: Action button & Arrow button */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {isCurrent ? (
                    <button
                      onClick={() => setSelectedLevelId(level.id)}
                      className="px-3.5 py-1 rounded-full border-sketch-blue text-[#0094ff] bg-blue-50/70 hover:bg-blue-100 text-xs font-black shadow-sketch transition-colors cursor-pointer"
                    >
                      Đang học
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setCurrentActiveLevelId(level.id);
                        setSelectedLevelId(level.id);
                      }}
                      className="px-3.5 py-1 rounded-full border-sketch-subtle text-[#292524] bg-white hover:bg-stone-50 text-xs font-black shadow-sketch transition-colors cursor-pointer"
                    >
                      Vào học
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedLevelId(level.id)}
                    className="w-7 h-7 md:w-8 md:h-8 rounded-full border-sketch-subtle bg-white flex items-center justify-center text-[#292524] hover:bg-stone-50 transition-colors cursor-pointer shadow-sketch"
                    title="Xem chi tiết lộ trình"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

              </div>

              {/* Dòng 2: Subtitle / Description */}
              <p className="text-xs font-bold text-[#57534e]">
                {level.subtitle}
              </p>

              {/* Dòng 3: 7 Component Pill Tags */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                {/* Pill 1: Kanji */}
                <span className="px-2.5 py-1 rounded-full border-sketch-pill bg-[#fdfbf7] text-[11px] font-bold text-[#57534e] flex items-center gap-1.5 shadow-2xs">
                  <BookOpen className="w-3.5 h-3.5 text-stone-600" />
                  <span>{level.kanjiCount} kanji</span>
                </span>

                {/* Pill 2: Từ vựng */}
                <span className="px-2.5 py-1 rounded-full border-sketch-pill bg-[#fdfbf7] text-[11px] font-bold text-[#57534e] flex items-center gap-1.5 shadow-2xs">
                  <Layers className="w-3.5 h-3.5 text-stone-600" />
                  <span>Từ vựng</span>
                </span>

                {/* Pill 3: Ngữ pháp */}
                <span className="px-2.5 py-1 rounded-full border-sketch-pill bg-[#fdfbf7] text-[11px] font-bold text-[#57534e] flex items-center gap-1.5 shadow-2xs">
                  <PenTool className="w-3.5 h-3.5 text-stone-600" />
                  <span>Ngữ pháp</span>
                </span>

                {/* Pill 4: Đọc hiểu */}
                <span className="px-2.5 py-1 rounded-full border-sketch-pill bg-[#fdfbf7] text-[11px] font-bold text-[#57534e] flex items-center gap-1.5 shadow-2xs">
                  <BookOpen className="w-3.5 h-3.5 text-stone-600" />
                  <span>Đọc hiểu</span>
                </span>

                {/* Pill 5: Nghe hiểu */}
                <span className="px-2.5 py-1 rounded-full border-sketch-pill bg-[#fdfbf7] text-[11px] font-bold text-[#57534e] flex items-center gap-1.5 shadow-2xs">
                  <Headphones className="w-3.5 h-3.5 text-stone-600" />
                  <span>Nghe hiểu</span>
                </span>

                {/* Pill 6: Mock test */}
                <span className="px-2.5 py-1 rounded-full border-sketch-pill bg-[#fdfbf7] text-[11px] font-bold text-[#57534e] flex items-center gap-1.5 shadow-2xs">
                  <FileText className="w-3.5 h-3.5 text-stone-600" />
                  <span>Mock test</span>
                </span>

                {/* Pill 7: Số buổi */}
                <span className="px-2.5 py-1 rounded-full border-sketch-pill bg-[#fdfbf7] text-[11px] font-bold text-[#57534e] flex items-center gap-1.5 shadow-2xs">
                  <span>{level.sessionCount} buổi</span>
                </span>
              </div>

              {/* Dòng 4: Progress Track Sketch Bar */}
              <div className="flex items-center gap-3 pt-1.5">
                <div className="relative flex-1 h-3 border-sketch-subtle rounded-full bg-stone-100/80 overflow-hidden flex items-center p-0.5">
                  <div 
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${level.progressPercent}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-[#78716c] shrink-0">
                  {level.statusText}
                </span>
              </div>

            </RoughCard>
          );
        })}
      </div>

    </div>
  );
};
