import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Target, 
  Flame, 
  Trophy, 
  ChevronLeft, 
  ChevronRight, 
  Crown, 
  MapPin, 
  Compass, 
  Edit3,
  Plus,
  Route,
  X,
  Trash2
} from 'lucide-react';
import { speakJapanese } from '../utils/speech';
import { RoughCard, RoughButton } from '../components/RoughCard';

interface CustomRoadmap {
  id: string;
  name: string;
  rawKanji: string;
  kanjiList: string[];
  perDay: number;
  totalDays: number;
  currentDay: number;
  createdAt: string;
}

export const PersonalRoadmapPage: React.FC = () => {
  const [activeRoadmap, setActiveRoadmap] = useState<'default' | 'my'>('default');
  const [selectedLevel, setSelectedLevel] = useState<'N5' | 'N4' | 'N3' | 'N2' | 'N1'>('N5');
  const [currentDay, setCurrentDay] = useState(2);
  const [isStudyModalOpen, setIsStudyModalOpen] = useState(false);

  // Custom Roadmaps State
  const [customRoadmaps, setCustomRoadmaps] = useState<CustomRoadmap[]>(() => {
    try {
      const saved = localStorage.getItem('nhai_kanji_custom_roadmaps');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoadmapName, setNewRoadmapName] = useState('');
  const [newRoadmapKanjiText, setNewRoadmapKanjiText] = useState('');
  const [newRoadmapPerDay, setNewRoadmapPerDay] = useState<number>(10);

  useEffect(() => {
    localStorage.setItem('nhai_kanji_custom_roadmaps', JSON.stringify(customRoadmaps));
  }, [customRoadmaps]);

  // Extract unique Kanji characters from text
  const extractedKanji = Array.from(
    new Set(
      newRoadmapKanjiText.match(/[\u4e00-\u9faf\u3400-\u4dbf]/g) || []
    )
  );

  const handleCreateRoadmap = () => {
    if (!newRoadmapName.trim()) {
      alert('Vui lòng nhập tên lộ trình!');
      return;
    }
    if (extractedKanji.length === 0) {
      alert('Vui lòng nhập hoặc dán ít nhất 1 chữ Kanji!');
      return;
    }

    const totalDays = Math.ceil(extractedKanji.length / newRoadmapPerDay);
    const newRoadmap: CustomRoadmap = {
      id: 'roadmap-' + Date.now(),
      name: newRoadmapName.trim(),
      rawKanji: newRoadmapKanjiText,
      kanjiList: extractedKanji,
      perDay: newRoadmapPerDay,
      totalDays: totalDays,
      currentDay: 1,
      createdAt: new Date().toLocaleDateString('vi-VN')
    };

    setCustomRoadmaps(prev => [newRoadmap, ...prev]);
    setIsCreateModalOpen(false);
    setNewRoadmapName('');
    setNewRoadmapKanjiText('');
    setNewRoadmapPerDay(10);
  };

  const handleDeleteRoadmap = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Bạn có chắc chắn muốn xóa lộ trình này không?')) {
      setCustomRoadmaps(prev => prev.filter(r => r.id !== id));
    }
  };

  const defaultDayKanjiList = [
    { kanji: '一', hanViet: 'NHẤT', meaning: 'Một' },
    { kanji: '二', hanViet: 'NHỊ', meaning: 'Hai' },
    { kanji: '八', hanViet: 'BÁT', meaning: 'Tám' },
    { kanji: '六', hanViet: 'LỤC', meaning: 'Sáu' },
    { kanji: '日', hanViet: 'NHẬT', meaning: 'Ngày' },
    { kanji: '目', hanViet: 'MỤC', meaning: 'Mắt' },
    { kanji: '三', hanViet: 'TAM', meaning: 'Ba' },
    { kanji: '手', hanViet: 'THỦ', meaning: 'Tay' },
    { kanji: '十', hanViet: 'THẬP', meaning: 'Mười' },
    { kanji: '千', hanViet: 'THIÊN', meaning: 'Nghìn' }
  ];

  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-5 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* Top Toggle: Lộ trình mặc định / Lộ trình của tôi */}
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-1 shadow-sketch">
        <div className="flex items-center justify-between gap-1">
          <button
            onClick={() => setActiveRoadmap('default')}
            className={`flex-1 py-2 px-4 flex items-center justify-center gap-2 font-bold text-sm transition-all rounded-lg cursor-pointer ${
              activeRoadmap === 'default'
                ? 'bg-[#0094ff] text-white shadow-xs'
                : 'text-[#57534e] hover:bg-[#f6f2e9]'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Lộ trình mặc định</span>
          </button>

          <button
            onClick={() => setActiveRoadmap('my')}
            className={`flex-1 py-2 px-4 flex items-center justify-center gap-2 font-bold text-sm transition-all rounded-lg cursor-pointer ${
              activeRoadmap === 'my'
                ? 'bg-[#ea580c] text-white shadow-xs'
                : 'text-[#57534e] hover:bg-[#f6f2e9]'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Lộ trình của tôi</span>
          </button>
        </div>
      </RoughCard>

      {/* ============================================================ */}
      {/* 1. VIEW: LỘ TRÌNH CỦA TÔI (MY CUSTOM ROADMAP - Images 1 & 2) */}
      {/* ============================================================ */}
      {activeRoadmap === 'my' ? (
        <div className="space-y-4">
          
          {/* Subheader & Action Button */}
          <div className="flex items-center justify-between">
            <p className="text-xs md:text-sm font-bold text-[#57534e]">
              Tự tạo lộ trình học với danh sách kanji của riêng bạn
            </p>

            <RoughButton
              onClick={() => setIsCreateModalOpen(true)}
              fill="#ea580c"
              stroke="#9a3412"
              borderRadius={8}
              roughness={0.7}
              className="text-white px-4 py-2 text-xs font-bold cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-1.5">
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Tạo lộ trình</span>
              </div>
            </RoughButton>
          </div>

          {/* Main Content Area */}
          {customRoadmaps.length === 0 ? (
            /* Empty State Container matching media_1788169823651.png */
            <RoughCard
              fill="#ffffff"
              stroke="#292524"
              borderRadius={14}
              roughness={0.7}
              className="p-8 md:p-16 shadow-sketch min-h-[360px]"
            >
              <div className="w-full h-full flex flex-col items-center justify-center text-center space-y-4 py-4">
                {/* S-curve flow icon */}
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-slate-300 mx-auto">
                  <Route className="w-14 h-14 stroke-[1.5]" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-base md:text-lg font-black text-[#292524] font-sketch">
                    Bạn chưa có lộ trình nào
                  </h3>
                  <p className="text-xs font-bold text-[#78716c]">
                    Tạo lộ trình đầu tiên để bắt đầu!
                  </p>
                </div>

                <div className="pt-2 flex justify-center">
                  <RoughButton
                    onClick={() => setIsCreateModalOpen(true)}
                    fill="#ea580c"
                    stroke="#9a3412"
                    borderRadius={8}
                    roughness={0.7}
                    className="text-white px-6 py-2.5 text-xs font-black cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>Tạo lộ trình đầu tiên</span>
                    </div>
                  </RoughButton>
                </div>
              </div>
            </RoughCard>
          ) : (
            /* List of User Custom Roadmaps */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customRoadmaps.map((r) => (
                <RoughCard
                  key={r.id}
                  fill="#ffffff"
                  stroke="#292524"
                  borderRadius={12}
                  roughness={0.7}
                  className="p-5 space-y-3 shadow-sketch"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base font-black text-[#292524] font-sketch">
                        {r.name}
                      </h4>
                      <p className="text-[11px] font-bold text-[#78716c]">
                        {r.kanjiList.length} chữ · {r.perDay} chữ/ngày · {r.totalDays} ngày
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleDeleteRoadmap(r.id, e)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                      title="Xóa lộ trình"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Sample Kanji preview */}
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {r.kanjiList.slice(0, 8).map((k, kIdx) => (
                      <span key={kIdx} className="w-8 h-8 rounded-lg bg-[#fdfbf7] border-sketch-subtle flex items-center justify-center font-kanji font-bold text-sm text-[#047857]">
                        {k}
                      </span>
                    ))}
                    {r.kanjiList.length > 8 && (
                      <span className="text-[10px] font-bold text-[#78716c]">+{r.kanjiList.length - 8}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#78716c]/20">
                    <span className="text-xs font-bold text-[#ea580c]">
                      Ngày {r.currentDay}/{r.totalDays}
                    </span>

                    <RoughButton
                      onClick={() => alert(`Bắt đầu học lộ trình: ${r.name}`)}
                      fill="#ea580c"
                      stroke="#9a3412"
                      borderRadius={6}
                      roughness={0.7}
                      className="text-white px-3.5 py-1.5 text-xs font-bold cursor-pointer"
                    >
                      <span>Học ngay</span>
                    </RoughButton>
                  </div>
                </RoughCard>
              ))}
            </div>
          )}

        </div>
      ) : (
        /* ============================================================ */
        /* 2. VIEW: LỘ TRÌNH MẶC ĐỊNH (DEFAULT ROADMAP) */
        /* ============================================================ */
        <div className="space-y-5">
          
          {/* Main Title Section */}
          <div className="text-center space-y-0.5 py-1">
            <h1 className="text-2xl md:text-3xl font-black text-[#292524] dark:text-white font-sketch tracking-tight">
              Lộ trình học Kanji
            </h1>
            <p className="text-xs md:text-sm font-bold text-[#78716c] dark:text-[#a8a29e]">
              10 chữ mỗi ngày – Tổng cộng 253 ngày
            </p>
          </div>

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 shadow-sketch">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0094ff]">
                <Calendar className="w-3.5 h-3.5" />
                <span>Đã học</span>
              </div>
              <div className="mt-1.5">
                <div className="text-2xl font-black text-[#292524] dark:text-white">1/253</div>
                <div className="text-[11px] font-bold text-[#78716c]">ngày</div>
              </div>
            </RoughCard>

            <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 shadow-sketch">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <Target className="w-3.5 h-3.5" />
                <span>Kanji</span>
              </div>
              <div className="mt-1.5">
                <div className="text-2xl font-black text-[#292524] dark:text-white">10</div>
                <div className="text-[11px] font-bold text-[#78716c]">chữ đã học</div>
              </div>
            </RoughCard>

            <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 shadow-sketch">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-500">
                <Flame className="w-3.5 h-3.5 fill-orange-500" />
                <span>Streak</span>
              </div>
              <div className="mt-1.5">
                <div className="text-2xl font-black text-[#292524] dark:text-white">1</div>
                <div className="text-[11px] font-bold text-[#78716c]">ngày liên tiếp</div>
              </div>
            </RoughCard>

            <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 shadow-sketch">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600">
                <Trophy className="w-3.5 h-3.5" />
                <span>Tiến độ</span>
              </div>
              <div className="mt-1.5">
                <div className="text-2xl font-black text-[#292524] dark:text-white">0%</div>
                <div className="text-[11px] font-bold text-[#78716c]">hoàn thành</div>
              </div>
            </RoughCard>
          </div>

          {/* Level Selection Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div onClick={() => setSelectedLevel('N5')} className="cursor-pointer">
              <RoughCard 
                fill="#86efac" 
                stroke="#047857" 
                borderRadius={10}
                roughness={0.7} 
                active={selectedLevel === 'N5'}
                className="p-3 text-center shadow-sketch"
              >
                <div className="text-base font-black text-[#047857]">N5</div>
                <div className="text-[11px] font-bold text-[#065f46]">118 chữ – 12 ngày</div>
                <div className="text-[10px] font-bold text-[#047857] mt-0.5">1/12 ngày</div>
              </RoughCard>
            </div>

            <div onClick={() => setSelectedLevel('N4')} className="cursor-pointer">
              <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3 text-center hover:bg-slate-50 shadow-sketch">
                <div className="flex items-center justify-center gap-1 text-base font-black text-[#292524]">
                  <span>N4</span>
                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                </div>
                <div className="text-[11px] font-bold text-[#a8a29e]">Premium</div>
              </RoughCard>
            </div>

            <div onClick={() => setSelectedLevel('N3')} className="cursor-pointer">
              <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3 text-center hover:bg-slate-50 shadow-sketch">
                <div className="flex items-center justify-center gap-1 text-base font-black text-[#292524]">
                  <span>N3</span>
                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                </div>
                <div className="text-[11px] font-bold text-[#a8a29e]">Premium</div>
              </RoughCard>
            </div>

            <div onClick={() => setSelectedLevel('N2')} className="cursor-pointer">
              <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3 text-center hover:bg-slate-50 shadow-sketch">
                <div className="flex items-center justify-center gap-1 text-base font-black text-[#292524]">
                  <span>N2</span>
                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                </div>
                <div className="text-[11px] font-bold text-[#a8a29e]">Premium</div>
              </RoughCard>
            </div>

            <div onClick={() => setSelectedLevel('N1')} className="cursor-pointer">
              <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3 text-center hover:bg-slate-50 shadow-sketch">
                <div className="flex items-center justify-center gap-1 text-base font-black text-[#292524]">
                  <span>N1</span>
                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                </div>
                <div className="text-[11px] font-bold text-[#a8a29e]">Premium</div>
              </RoughCard>
            </div>
          </div>

          {/* Day Selector Box */}
          <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-2.5 shadow-sketch">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setCurrentDay(d => Math.max(1, d - 1))}
                className="p-1 rounded-md hover:bg-[#eae3d5] text-[#57534e] cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 font-bold text-sm text-[#292524] font-sketch">
                <Calendar className="w-4 h-4 text-[#0094ff]" />
                <span>Ngày {currentDay}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#86efac] text-[#047857] border-sketch-subtle text-xs font-bold">
                  {selectedLevel} - Cơ bản
                </span>
              </div>

              <button 
                onClick={() => setCurrentDay(d => Math.min(12, d + 1))}
                className="p-1 rounded-md hover:bg-[#eae3d5] text-[#57534e] cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </RoughCard>

          {/* Progress Slider Box */}
          <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 shadow-sketch">
            <div className="flex items-center gap-4 text-xs font-bold text-[#78716c]">
              <span>Ngày 1</span>
              <div className="relative flex-1 flex items-center">
                <div className="w-full h-1.5 rounded-full bg-slate-200">
                  <div 
                    className="h-full rounded-full bg-[#0094ff]"
                    style={{ width: `${(currentDay / 12) * 100}%` }}
                  />
                </div>
                <div 
                  className="absolute w-3.5 h-3.5 rounded-full bg-[#0094ff] border-2 border-white shadow-xs -translate-x-1/2 cursor-pointer"
                  style={{ left: `${(currentDay / 12) * 100}%` }}
                />
              </div>
              <span>Ngày 12 ({selectedLevel})</span>
            </div>
          </RoughCard>

          {/* Daily Lesson Card */}
          <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-5 space-y-4 shadow-sketch">
            <div className="flex items-center justify-between border-b border-[#78716c]/30 pb-3">
              <div className="flex items-center gap-2 font-black text-base text-[#292524] font-sketch">
                <Target className="w-4 h-4 text-emerald-600" />
                <span>Kanji ngày {currentDay}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#78716c]">10 chữ</span>
                <RoughButton
                  onClick={() => setIsStudyModalOpen(true)}
                  fill="#0094ff"
                  stroke="#0369a1"
                  borderRadius={8}
                  roughness={0.7}
                  className="text-white px-3.5 py-1.5 text-xs font-bold cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Học ngay</span>
                  </div>
                </RoughButton>
              </div>
            </div>

            {/* Kanji tiles grid in the lesson */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
              {defaultDayKanjiList.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => speakJapanese(item.kanji)}
                  className="cursor-pointer group"
                >
                  <RoughCard 
                    fill="#86efac" 
                    stroke="#292524" 
                    borderRadius={8}
                    roughness={0.7} 
                    className="p-2 text-center transition-transform group-hover:scale-105"
                  >
                    <div className="text-2xl font-kanji font-bold text-[#047857]">
                      {item.kanji}
                    </div>
                    <div className="text-[10px] font-bold text-[#065f46] mt-0.5 truncate">
                      {item.hanViet}
                    </div>
                    <div className="text-[9px] text-[#047857]/80 truncate">
                      {item.meaning}
                    </div>
                  </RoughCard>
                </div>
              ))}
            </div>
          </RoughCard>

          {/* Bottom Mascot */}
          <div className="flex items-center gap-2 text-xs font-bold text-[#78716c] pt-1">
            <div className="text-2xl">🐦</div>
            <span className="font-sketch italic">"Tự tin lên! Mỗi ngày 10 chữ là thành công!"</span>
          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: TẠO LỘ TRÌNH MỚI (Matching media_1788169839805.png) */}
      {/* ============================================================ */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div 
            className="w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <RoughCard
              fill="#ffffff"
              stroke="#292524"
              borderRadius={16}
              roughness={0.7}
              className="p-6 md:p-7 space-y-4 shadow-sketch bg-white"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-[#292524] font-sketch">
                  Tạo lộ trình mới
                </h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 rounded-lg text-[#78716c] hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Field 1: Tên lộ trình */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#292524]">
                  Tên lộ trình
                </label>
                <input
                  type="text"
                  value={newRoadmapName}
                  onChange={(e) => setNewRoadmapName(e.target.value)}
                  placeholder="VD: Kanji cần ôn, Luyện N3 sprint..."
                  className="w-full bg-[#fdfbf7] border-sketch-subtle rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#292524] focus:outline-none"
                />
              </div>

              {/* Field 2: Danh sách Kanji */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#292524]">
                  Danh sách Kanji
                </label>
                <textarea
                  value={newRoadmapKanjiText}
                  onChange={(e) => setNewRoadmapKanjiText(e.target.value)}
                  placeholder="Nhập hoặc dán kanji vào đây..."
                  rows={4}
                  className="w-full bg-[#fdfbf7] border-sketch-subtle rounded-xl p-3 text-xs font-kanji font-bold text-[#292524] focus:outline-none resize-none"
                />
                <div className="text-[11px] font-bold text-[#78716c]">
                  {extractedKanji.length === 0 ? 'Chưa có kanji' : `Đã nhận diện: ${extractedKanji.length} chữ Kanji`}
                </div>
              </div>

              {/* Field 3: Số kanji mỗi ngày */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#292524]">
                  Số kanji mỗi ngày
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[5, 10, 15, 20, 25, 30].map((num) => {
                    const isSelected = newRoadmapPerDay === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setNewRoadmapPerDay(num)}
                        className={`py-1.5 px-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-sketch-orange bg-amber-50 text-[#ea580c] shadow-sketch font-black'
                            : 'border-sketch-subtle bg-white text-[#57534e] hover:bg-slate-50'
                        }`}
                      >
                        {num}/ngày
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <RoughButton
                  onClick={handleCreateRoadmap}
                  fill="#fbbf24"
                  stroke="#d97706"
                  borderRadius={10}
                  roughness={0.7}
                  className="w-full text-white py-2.5 text-xs font-black shadow-xs cursor-pointer"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Tạo lộ trình</span>
                  </div>
                </RoughButton>
              </div>

            </RoughCard>
          </div>
        </div>
      )}

      {/* Study Modal for Default Roadmap */}
      {isStudyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <RoughCard fill="#ffffff" stroke="#292524" borderRadius={16} roughness={0.7} className="p-6 max-w-xl w-full shadow-sketch space-y-4">
            <h3 className="text-lg font-black text-center font-sketch">
              🌸 Bài học Ngày {currentDay} - 10 Chữ Kanji
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 max-h-80 overflow-y-auto p-1">
              {defaultDayKanjiList.map((item, idx) => (
                <RoughCard key={idx} fill="#86efac" stroke="#292524" borderRadius={8} roughness={0.7} className="p-2.5 text-center shadow-xs">
                  <div className="text-2xl font-kanji font-bold text-[#047857]">{item.kanji}</div>
                  <div className="text-xs font-bold text-[#065f46] mt-0.5">{item.hanViet}</div>
                  <div className="text-[10px] text-[#047857]/80">{item.meaning}</div>
                </RoughCard>
              ))}
            </div>
            <div className="text-center pt-2">
              <RoughButton
                onClick={() => setIsStudyModalOpen(false)}
                fill="#0094ff"
                stroke="#0369a1"
                borderRadius={8}
                roughness={0.7}
                className="text-white px-5 py-2 text-xs font-bold cursor-pointer"
              >
                Đã hiểu bài!
              </RoughButton>
            </div>
          </RoughCard>
        </div>
      )}

    </div>
  );
};
