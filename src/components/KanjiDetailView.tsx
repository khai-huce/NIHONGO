import { ReviewStar } from './ReviewStar';
import React, { useState } from 'react';
import { 
  Volume2, 
  ArrowLeft, 
  BookOpen, 
  PenTool, 
  X, 
  Sparkles
} from 'lucide-react';
import { KanjiItem } from '../types';
import { speakJapanese } from '../utils/speech';
import { RoughCard, RoughButton } from './RoughCard';

interface KanjiDetailViewProps {
  item: KanjiItem;
  onBack: () => void;
}

export const KanjiDetailView: React.FC<KanjiDetailViewProps> = ({
  item,
  onBack
}) => {
  const [showStrokeModal, setShowStrokeModal] = useState(false);
  const [showPhoneticModal, setShowPhoneticModal] = useState(false);

  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-5 max-w-6xl mx-auto overflow-y-auto select-none">
      
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <RoughButton
          onClick={onBack}
          fill="#ffffff"
          stroke="#78716c"
          borderRadius={10}
          roughness={0.7}
          className="px-3.5 py-1.5 font-black text-xs md:text-sm shadow-sketch cursor-pointer hover:bg-[#eae3d5] transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            <span>← Trở lại danh sách Kanji</span>
          </div>
        </RoughButton>
      </div>

      {/* Main 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        
        {/* ============================================================ */}
        {/* LEFT COLUMN: Kanji Details Matching media_1788503233235.png */}
        {/* ============================================================ */}
        <RoughCard 
          fill="#ffffff" 
          stroke="#292524" 
          borderRadius={14} 
          roughness={0.7} 
          className="p-6 md:p-7 shadow-sketch space-y-5"
        >
          {/* Top Row: [ ✍ Xem nét vẽ ] + {item.kanji} - {item.hanViet} [ ⭐ ] */}
          <div className="flex items-start gap-5 md:gap-7">
            
            {/* Button: Xem nét vẽ */}
            <RoughButton
              onClick={() => setShowStrokeModal(true)}
              fill="#ffffff"
              stroke="#292524"
              borderRadius={10}
              roughness={0.7}
              className="px-4 py-3 font-bold text-xs md:text-sm shadow-xs hover:bg-[#fcf9f2] transition-colors cursor-pointer shrink-0"
            >
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-[#292524]" />
                <span className="font-sketch font-bold text-[#292524]">Xem nét vẽ</span>
              </div>
            </RoughButton>

            {/* Title & Star & Phonetic rule link */}
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-black text-[#292524] font-kanji tracking-wide">
                  {item.kanji} - {item.hanViet}
                </h1>

                {/* Square Star Favorite Button */}
                <ReviewStar source={{category:'kanji',sourceId:item.id,front:item.kanji,back:item.meaning,reading:item.hanViet,hint:item.mnemonic}} />
              </div>

              {/* Link: → Quy tắc chuyển âm */}
              <div 
                onClick={() => setShowPhoneticModal(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#ea580c] cursor-pointer hover:underline pt-0.5"
              >
                <span>→ Quy tắc chuyển âm</span>
              </div>
            </div>

          </div>

          {/* Metadata rows */}
          <div className="space-y-2.5 text-xs md:text-sm font-bold text-[#292524] font-sketch pt-2">
            
            {/* Ý nghĩa */}
            <p>
              <span>Ý nghĩa: </span>
              <strong className="text-[#0094ff] font-bold">{item.meaning}</strong>
            </p>

            {/* Trình độ JLPT */}
            <p>
              <span>Trình độ JLPT: </span>
              <strong className="text-[#0094ff] font-bold">{item.level}</strong>
            </p>

            {/* Số nét (Chỉ số) */}
            <p>
              <span>Số nét: </span>
              <strong className="text-[#0094ff] font-bold">{item.strokeCount}</strong>
            </p>

            {/* Âm Kun */}
            <p>
              <span>Âm Kun: </span>
              <strong className="text-[#0094ff] font-bold font-kanji">
                {item.kunyomi.map(k => k.split(' ')[0]).join(', ') || item.kunyomi.join(', ') || '-'}
              </strong>
            </p>

            {/* Âm On */}
            <p>
              <span>Âm On: </span>
              <strong className="text-[#0094ff] font-bold font-kanji">
                {item.onyomi.map(o => o.split(' ')[0]).join(', ') || item.onyomi.join(', ') || '-'}
              </strong>
            </p>

            {/* Cấu tạo từ các bộ thủ */}
            <p>
              <span>Cấu tạo từ các bộ thủ: </span>
              <strong className="text-[#0094ff] font-bold font-kanji">
                {item.radicals && item.radicals.length > 0 
                  ? item.radicals.join(' ') 
                  : item.radicalParts.map(r => r.radical).join(' ')}
              </strong>
            </p>

            {/* Gợi ý cách nhớ */}
            <p className="leading-relaxed">
              <span>Gợi ý cách nhớ: </span>
              <span className="text-[#0094ff] font-bold font-sketch">{item.mnemonic || 'Chưa có gợi nhớ được biên tập.'}</span>
            </p>

          </div>

        </RoughCard>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: Compound Vocabulary List (Mina, Tango)         */}
        {/* ============================================================ */}
        <RoughCard 
          fill="#ffffff" 
          stroke="#292524" 
          borderRadius={14} 
          roughness={0.7} 
          className="p-5 md:p-6 shadow-sketch flex flex-col justify-between space-y-4"
        >
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-xs md:text-sm font-black text-[#ea580c] uppercase tracking-wide flex items-center gap-1.5 font-sketch">
                <BookOpen className="w-4 h-4" />
                <span>TỪ VỰNG TRONG (MINA, TANGO, MIMIKARA)</span>
              </h2>
              <span className="text-xs text-[#78716c] font-black">
                {item.examples.length} từ phổ biến
              </span>
            </div>

            {/* Divider line */}
            <div className="w-full border-b-2 border-[#292524] mt-2 mb-3.5" />

            {/* List of Vocabularies */}
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1 [scrollbar-width:none]">
              {item.examples.map((ex, idx) => (
                <RoughCard
                  key={idx}
                  fill="#ffffff"
                  stroke="#292524"
                  borderRadius={10}
                  roughness={0.7}
                  className="p-3 shadow-xs hover:bg-[#fcf9f2] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {/* Audio Sound Button */}
                    <button
                      onClick={() => speakJapanese(ex.reading || ex.word)}
                      className="p-2 rounded-lg border border-[#292524] bg-[#fdfbf7] text-[#292524] hover:text-[#0094ff] hover:bg-blue-50 transition-colors cursor-pointer shrink-0 shadow-2xs"
                      title="Nghe phát âm"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>

                    {/* Word, Reading & Meaning */}
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-base md:text-lg font-bold font-kanji text-[#292524]">
                          {ex.word}
                        </span>
                        <span className="text-xs font-black font-kanji text-[#0094ff]">
                          ({ex.reading})
                        </span>
                      </div>
                      <div className="text-xs text-[#57534e] font-bold mt-0.5">
                        {ex.meaning}
                      </div>
                    </div>
                  </div>
                </RoughCard>
              ))}
            </div>
          </div>

          {/* Bottom Highlight Banner */}
          <RoughCard 
            fill="#eff6ff" 
            stroke="#3b82f6" 
            borderRadius={10} 
            className="p-3 text-xs text-[#1e40af] font-bold mt-3"
          >
            <div className="flex items-center justify-between">
              <span>Học Kanji qua từ vựng ngữ cảnh giúp nhớ lâu hơn 3 lần!</span>
              <span className="font-black font-sketch tracking-wide text-blue-950">nihongo</span>
            </div>
          </RoughCard>

        </RoughCard>

      </div>

      {/* ============================================================ */}
      {/* MODAL 1: XEM NÉT VẼ (Stroke Order Animation)                 */}
      {/* ============================================================ */}
      {showStrokeModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowStrokeModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-md bg-[#fcf9f2] border-2 border-[#292524] rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#78716c]/30 pb-3">
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-[#ea580c]" />
                <h3 className="font-black text-lg text-[#292524] font-sketch">
                  Thứ tự nét vẽ: {item.kanji} ({item.hanViet})
                </h3>
              </div>
              <button 
                onClick={() => setShowStrokeModal(false)}
                className="p-1 rounded-lg hover:bg-stone-200 text-[#78716c] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stroke Display Box */}
            <div className="w-full aspect-square bg-white border-2 border-[#292524] rounded-xl flex flex-col items-center justify-center relative p-4 shadow-inner">
              {/* Kanji Background Grid Guide */}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
                <div className="border-r border-b border-dashed border-stone-300" />
                <div className="border-b border-dashed border-stone-300" />
                <div className="border-r border-dashed border-stone-300" />
                <div />
              </div>

              {/* Giant Kanji */}
              <div className="text-9xl font-kanji font-bold text-[#292524] select-none z-10">
                {item.kanji}
              </div>

              <div className="absolute bottom-3 left-4 text-xs font-bold text-[#78716c]">
                Tổng số nét: <span className="text-[#ea580c] font-black">{item.strokeCount} nét</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-[#78716c]">
                Bộ thủ: <b className="text-[#0094ff]">{item.radicals?.join(' ') || item.radicalParts[0]?.radical}</b>
              </span>

              <button
                onClick={() => speakJapanese(item.kanji)}
                className="px-3.5 py-1.5 rounded-lg bg-[#ea580c] text-white text-xs font-black flex items-center gap-1.5 hover:bg-[#c2410c] transition-colors cursor-pointer shadow-xs"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Phát âm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: QUY TẮC CHUYỂN ÂM (Phonetic Transformation Rules)    */}
      {/* ============================================================ */}
      {showPhoneticModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowPhoneticModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-lg bg-[#fcf9f2] border-2 border-[#292524] rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#78716c]/30 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#ea580c]" />
                <h3 className="font-black text-lg text-[#292524] font-sketch">
                  Quy tắc chuyển âm Hán Việt: {item.hanViet} → {item.onyomi.join(', ')}
                </h3>
              </div>
              <button 
                onClick={() => setShowPhoneticModal(false)}
                className="p-1 rounded-lg hover:bg-stone-200 text-[#78716c] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs md:text-sm font-bold text-[#292524]">
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1">
                <div className="text-amber-900 font-black">💡 Bản chất quy tắc:</div>
                <p className="text-[#57534e]">
                  Âm Hán Việt <b>{item.hanViet}</b> có phụ âm đầu và phần vần tương ứng chuyển sang âm On trong tiếng Nhật là <b>{item.onyomi.join(', ')}</b>.
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-black text-[#78716c] uppercase">Ví dụ ghép từ thực tế:</div>
                {item.examples.slice(0, 3).map((ex, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#78716c]/30">
                    <span className="font-kanji font-bold text-base">{ex.word} ({ex.reading})</span>
                    <span className="text-[#0094ff] text-xs">{ex.meaning}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowPhoneticModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#292524] text-white text-xs font-black cursor-pointer hover:bg-black transition-colors"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
