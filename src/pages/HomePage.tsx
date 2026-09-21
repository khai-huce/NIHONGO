import React, { useState, useRef } from 'react';
import { 
  Search, 
  RotateCcw, 
  FileText, 
  Sparkles, 
  BookOpen, 
  ExternalLink
} from 'lucide-react';
import { useContentCatalog } from '../hooks/useContentCatalog';
import { KanjiTile } from '../components/KanjiTile';
import { FlashcardView } from '../components/FlashcardView';
import { RoughCard, RoughButton } from '../components/RoughCard';
import { KanjiItem, JLPTLevel } from '../types';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const currentKanjiList = KANJI_DATABASE.filter(k => {
    if (activeLevel !== 'RADICALS' && k.level !== activeLevel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        k.kanji.includes(q) ||
        k.hanViet.toLowerCase().includes(q) ||
        k.meaning.toLowerCase().includes(q) ||
        k.onyomi.some(on => on.toLowerCase().includes(q)) ||
        k.kunyomi.some(kun => kun.toLowerCase().includes(q))
      );
    }
    return true;
  });

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
            <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={10} roughness={0.7}>
              <div className="relative flex items-center p-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nhập kanji hoặc âm hán việt..."
                  className="w-full bg-transparent px-3 py-1.5 text-sm text-[#292524] focus:outline-none font-sketch font-bold"
                />
                <Search className="w-4 h-4 text-[#78716c] mr-3" />
              </div>
            </RoughCard>
          </div>

          {/* Embedded Handwriting Canvas Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-[#292524] font-sketch">
                Hoặc vẽ Kanji
              </h2>
              <button
                onClick={clearCanvas}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Xóa nét
              </button>
            </div>

            <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={12} roughness={0.7} className="h-[270px] overflow-hidden">
              <div className="relative w-full h-full">
                {/* Dashed Crosshair lines */}
                <div 
                  className="pointer-events-none absolute z-10 border-l border-dashed border-[#78643c]/30" 
                  style={{ left: '50%', height: '100%' }}
                />
                <div 
                  className="pointer-events-none absolute z-10 border-t border-dashed border-[#78643c]/30" 
                  style={{ top: '50%', width: '100%' }}
                />
                
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={270}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="relative w-full h-full cursor-crosshair touch-none"
                />
              </div>
            </RoughCard>
          </div>

          {/* Ecosystem Feature Badges */}
          <div className="space-y-2">
            <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={10} roughness={0.7} className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-kanji font-bold text-base border border-blue-200">
                  漢
                </div>
                <div>
                  <div className="text-xs font-black text-[#292524]">2500+ Kanji</div>
                  <div className="text-[10px] text-[#78716c] font-bold">Chiết tự · Sơ đồ · N5→N1</div>
                </div>
              </div>
            </RoughCard>

            <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={10} roughness={0.7} className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-[#292524]">10.000+ Từ vựng</div>
                  <div className="text-[10px] text-[#78716c] font-bold">Mina · Tango · Mimikara · Tettei</div>
                </div>
              </div>
            </RoughCard>

            <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={10} roughness={0.7} className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-[#292524]">Ngữ pháp N5→N1</div>
                  <div className="text-[10px] text-[#78716c] font-bold">Mina · Shinkanzen · Somatome</div>
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
                <span className={activeLevel === 'RADICALS' ? 'text-[#6b21a8]' : 'text-[#57534e]'}>214 Bộ thủ</span>
              </RoughCard>
            </div>

          </div>

          {/* Main Card Container */}
          <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={12} roughness={0.7} className="p-5 flex max-h-[700px] flex-col">
            
            {/* Header bar inside card container */}
            <div className="mb-4 flex shrink-0 items-center justify-between border-b border-[#78716c]/30 pb-3">
              <div className="flex items-center gap-3">
                <h3 className="hidden text-base font-black sm:block text-[#292524] font-sketch">
                  {activeLevel === 'RADICALS' ? '214 Bộ thủ' : `Kanji ${activeLevel}`}
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
