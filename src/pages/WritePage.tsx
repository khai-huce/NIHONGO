import React, { useState, useRef } from 'react';
import { PenTool, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useContentCatalog } from '../hooks/useContentCatalog';
import { speakJapanese } from '../utils/speech';

export const WritePage: React.FC = () => {
  const { kanji: KANJI_DATABASE } = useContentCatalog();
  const [selectedKanjiIndex, setSelectedKanjiIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#2563eb');
  const [brushWidth, setBrushWidth] = useState(8);

  const currentKanji = KANJI_DATABASE[selectedKanjiIndex % KANJI_DATABASE.length];

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
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushWidth;
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

  if (!currentKanji) return <p className="p-6">Chưa có Kanji được xuất bản.</p>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 text-white p-6 sm:p-8 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold text-rose-200 mb-2">
          <PenTool className="w-3.5 h-3.5" />
          Phòng Luyện Viết Chữ Hán Chuẩn Nét
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          LUYỆN VIẾT KANJI TRÊN Ô CHỮ ĐIỀN
        </h1>
        <p className="text-rose-100 text-sm mt-1 max-w-xl">
          Tập viết chữ Kanji trên lưới Genkouyoushi để định hình chuẩn bố cục, cân đối nét và ghi nhớ cấu tạo chiết tự bền vững.
        </p>
      </div>

      {/* Kanji Selector Carousel */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
        <button
          onClick={() => {
            clearCanvas();
            setSelectedKanjiIndex(prev => (prev - 1 + KANJI_DATABASE.length) % KANJI_DATABASE.length);
          }}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <span className="text-2xl font-black font-japanese text-blue-600 dark:text-blue-400">
            {currentKanji.kanji}
          </span>
          <span className="text-base font-extrabold text-[#FF6C00] ml-2">
            - {currentKanji.hanViet}
          </span>
          <span className="text-xs text-slate-400 block mt-0.5">
            {currentKanji.meaning} ({currentKanji.strokeCount} nét • {currentKanji.level})
          </span>
        </div>

        <button
          onClick={() => {
            clearCanvas();
            setSelectedKanjiIndex(prev => (prev + 1) % KANJI_DATABASE.length);
          }}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Big Practice Canvas */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg flex flex-col items-center space-y-6">
        
        <div className="relative w-80 sm:w-96 aspect-square rounded-3xl bg-slate-50 dark:bg-slate-950 border-4 border-slate-300 dark:border-slate-700 shadow-inner overflow-hidden japanese-crosshair">
          {/* Ghost Character Background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <span className="text-[180px] sm:text-[220px] font-japanese font-black text-slate-200/80 dark:text-slate-800/80">
              {currentKanji.kanji}
            </span>
          </div>

          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-full cursor-crosshair touch-none relative z-10"
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold">
          
          <button
            onClick={clearCanvas}
            className="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Xóa nét viết
          </button>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700/60 px-3 py-1.5 rounded-xl">
            <span>Màu bút:</span>
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              className="w-6 h-6 rounded-md cursor-pointer border-0"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700/60 px-3 py-1.5 rounded-xl">
            <span>Độ dày ({brushWidth}px):</span>
            <input
              type="range"
              min="2"
              max="24"
              value={brushWidth}
              onChange={(e) => setBrushWidth(Number(e.target.value))}
              className="w-24 accent-rose-500"
            />
          </div>

          <button
            onClick={() => speakJapanese(currentKanji.kunyomi[0] || currentKanji.onyomi[0] || currentKanji.kanji)}
            className="px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center gap-2"
          >
            🔊 Nghe phát âm
          </button>
        </div>

      </div>

    </div>
  );
};
