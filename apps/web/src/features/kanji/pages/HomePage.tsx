import React, { useState } from 'react';
import { 
  FileText, 
  Sparkles, 
  BookOpen, 
  ExternalLink
} from 'lucide-react';
import { useContentCatalog } from '../../content/hooks/useContentCatalog';
import { HandwritingLookup } from '../components/HandwritingLookup';
import { KanjiTile } from '../components/KanjiTile';
import { KanjiSearch } from '../components/KanjiSearch';
import { FlashcardView } from '../components/FlashcardView';
import { RoughCard, RoughButton } from '../../../shared/ui/RoughCard';
import { KanjiItem, JLPTLevel } from '@nihongo/shared/contracts/core';

interface HomePageProps {
  onSelectKanji: (item: KanjiItem) => void;
  onOpenWrite: () => void;
  userId: string | null;
  authBusy: boolean;
  onLogin: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSelectKanji,
  onOpenWrite, userId, authBusy, onLogin
}) => {
  const { kanji: KANJI_DATABASE, radicals: RADICALS_DATABASE } = useContentCatalog();
  const [activeLevel, setActiveLevel] = useState<JLPTLevel | 'RADICALS'>('N5');
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);

  const currentKanjiList = KANJI_DATABASE.filter(k => activeLevel === 'RADICALS' || k.level === activeLevel);

  return (
    <div className="w-full bg-sketch-paper p-4 md:p-8 min-h-[calc(100vh-48px)] overflow-y-auto">
      
      {/* 2-Column Split Desktop Layout */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[2fr_3fr] max-w-7xl mx-auto">
        
        {/* LEFT COLUMN: Search, Hand-drawn Canvas & Feature Badges */}
        <div className="space-y-5">
          
          {/* Search box */}
          <div className="space-y-1.5">
            <h2 className="text-base font-black text-[#292524] font-sketch">
              Tìm kiếm Kanji
            </h2>
            <KanjiSearch items={KANJI_DATABASE} onSelect={onSelectKanji} />
          </div>

          <HandwritingLookup onSelectKanji={onSelectKanji} />

          {/* Ecosystem Feature Badges */}
          <div className="space-y-2">
            <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={10} roughness={0.7} className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-kanji font-bold text-base border border-blue-200">
                  漢
                </div>
                <div>
                  <div className="text-xs font-black text-[#292524]">{KANJI_DATABASE.length.toLocaleString('vi-VN')} Kanji</div>
                  <div className="text-[10px] text-[#78716c] font-bold">Trong kho đã xuất bản</div>
                </div>
              </div>
            </RoughCard>

            <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={10} roughness={0.7} className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-[#292524]">Giáo trình từ vựng</div>
                  <div className="text-[10px] text-[#78716c] font-bold">Học từ kho giáo trình đã xuất bản</div>
                </div>
              </div>
            </RoughCard>

            <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={10} roughness={0.7} className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-[#292524]">Kho ngữ pháp</div>
                  <div className="text-[10px] text-[#78716c] font-bold">Mẫu câu · Ví dụ · Bài tập</div>
                </div>
              </div>
            </RoughCard>
          </div>

        </div>

        {/* RIGHT COLUMN: Level Explorer & Dense 12-Column Kanji Grid */}
        <div className="space-y-5">
          
          <h2 className="text-xl md:text-2xl font-black text-[#292524] font-sketch">
            Khám phá Kanji theo trình độ
          </h2>

          {/* Level Tabs */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            
            <div onClick={() => setActiveLevel('N5')} className="cursor-pointer">
              <RoughCard
                fill={activeLevel === 'N5' ? '#86efac' : '#ffffff'}
                stroke={activeLevel === 'N5' ? '#047857' : '#78716c'}
                active={activeLevel === 'N5'}
                borderRadius={8}
                roughness={0.7}
                className="px-3.5 py-1.5 text-xs font-black text-center"
              >
                <span className={activeLevel === 'N5' ? 'text-[#047857]' : 'text-[#57534e]'}>N5 - Cơ bản</span>
              </RoughCard>
            </div>

            <div onClick={() => setActiveLevel('N4')} className="cursor-pointer">
              <RoughCard
                fill={activeLevel === 'N4' ? '#bae6fd' : '#ffffff'}
                stroke={activeLevel === 'N4' ? '#0369a1' : '#78716c'}
                active={activeLevel === 'N4'}
                borderRadius={8}
                roughness={0.7}
                className="px-3.5 py-1.5 text-xs font-black text-center"
              >
                <span className={activeLevel === 'N4' ? 'text-[#0369a1]' : 'text-[#57534e]'}>N4 - Sơ cấp</span>
              </RoughCard>
            </div>

            <div onClick={() => setActiveLevel('N3')} className="cursor-pointer">
              <RoughCard
                fill={activeLevel === 'N3' ? '#fde68a' : '#ffffff'}
                stroke={activeLevel === 'N3' ? '#b45309' : '#78716c'}
                active={activeLevel === 'N3'}
                borderRadius={8}
                roughness={0.7}
                className="px-3.5 py-1.5 text-xs font-black text-center"
              >
                <span className={activeLevel === 'N3' ? 'text-[#b45309]' : 'text-[#57534e]'}>N3 - Trung cấp</span>
              </RoughCard>
            </div>

            <div onClick={() => setActiveLevel('N2')} className="cursor-pointer">
              <RoughCard
                fill={activeLevel === 'N2' ? '#fed7aa' : '#ffffff'}
                stroke={activeLevel === 'N2' ? '#c2410c' : '#78716c'}
                active={activeLevel === 'N2'}
                borderRadius={8}
                roughness={0.7}
                className="px-3.5 py-1.5 text-xs font-black text-center"
              >
                <span className={activeLevel === 'N2' ? 'text-[#c2410c]' : 'text-[#57534e]'}>N2 - Trung cao</span>
              </RoughCard>
            </div>

            <div onClick={() => setActiveLevel('N1')} className="cursor-pointer">
              <RoughCard
                fill={activeLevel === 'N1' ? '#fecdd3' : '#ffffff'}
                stroke={activeLevel === 'N1' ? '#be123c' : '#78716c'}
                active={activeLevel === 'N1'}
                borderRadius={8}
                roughness={0.7}
                className="px-3.5 py-1.5 text-xs font-black text-center"
              >
                <span className={activeLevel === 'N1' ? 'text-[#be123c]' : 'text-[#57534e]'}>N1 - Cao cấp</span>
              </RoughCard>
            </div>

            <div onClick={() => setActiveLevel('RADICALS')} className="cursor-pointer">
              <RoughCard
                fill={activeLevel === 'RADICALS' ? '#e9d5ff' : '#ffffff'}
                stroke={activeLevel === 'RADICALS' ? '#6b21a8' : '#78716c'}
                active={activeLevel === 'RADICALS'}
                borderRadius={8}
                roughness={0.7}
                className="px-3.5 py-1.5 text-xs font-black text-center"
              >
                <span className={activeLevel === 'RADICALS' ? 'text-[#6b21a8]' : 'text-[#57534e]'}>{RADICALS_DATABASE.length.toLocaleString('vi-VN')} Bộ thủ</span>
              </RoughCard>
            </div>

          </div>

          {/* Main Card Container */}
          <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={12} roughness={0.7} className="p-5 flex max-h-[700px] flex-col">
            
            {/* Header bar inside card container */}
            <div className="mb-4 flex shrink-0 items-center justify-between border-b border-[#78716c]/30 pb-3">
              <div className="flex items-center gap-3">
                <h3 className="hidden text-base font-black sm:block text-[#292524] font-sketch">
                  {activeLevel === 'RADICALS' ? `${RADICALS_DATABASE.length.toLocaleString('vi-VN')} Bộ thủ` : `Kanji ${activeLevel}`}
                </h3>
                
                <RoughButton
                  onClick={() => setIsFlashcardOpen(true)}
                  fill="#86efac"
                  stroke="#047857"
                  borderRadius={8}
                  roughness={0.7}
                  className="px-3 py-1 text-xs font-bold"
                >
                  <div className="flex items-center gap-1.5 text-[#047857]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Flashcard</span>
                  </div>
                </RoughButton>

                <RoughButton
                  onClick={onOpenWrite}
                  fill="#86efac"
                  stroke="#047857"
                  borderRadius={8}
                  roughness={0.7}
                  className="px-3 py-1 text-xs font-bold"
                >
                  <div className="flex items-center gap-1.5 text-[#047857]">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Luyện viết</span>
                  </div>
                </RoughButton>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => alert('Đang tải file PDF luyện viết Kanji ' + activeLevel)}
                  className="text-[#0094ff] inline-flex items-center gap-1.5 text-xs font-bold hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Tải file luyện viết
                </button>
              </div>
            </div>

            {/* Dense Kanji Grid matching media_1787909185702.png */}
            <div className="flex-1 overflow-y-auto pr-1">
              {activeLevel === 'RADICALS' ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {RADICALS_DATABASE.map((r) => (
                    <RoughCard
                      key={r.number}
                      fill="#e9d5ff"
                      stroke="#6b7280"
                      borderRadius={8}
                      roughness={0.7}
                      className="p-2 text-center flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
                    >
                      <span className="text-xl font-kanji font-bold text-purple-700">{r.radical}</span>
                      <span className="text-[10px] font-bold text-[#292524] truncate">{r.hanViet}</span>
                    </RoughCard>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-8 gap-2 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-12 xl:grid-cols-12">
                  {currentKanjiList.map((item) => (
                    <KanjiTile
                      key={item.id}
                      item={item}
                      onSelect={onSelectKanji}
                      level={activeLevel}
                    />
                  ))}
                </div>
              )}
            </div>

          </RoughCard>

        </div>

      </div>

      {/* Flashcard Modal */}
      {isFlashcardOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <FlashcardView key={userId ?? 'guest'} items={currentKanjiList} userId={userId} authBusy={authBusy} onLogin={onLogin} onDetail={item => { setIsFlashcardOpen(false); onSelectKanji(item); }} onClose={() => setIsFlashcardOpen(false)} />
          </div>
        </div>
      )}

    </div>
  );
};
