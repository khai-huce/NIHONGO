import React, { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { RoughCard, RoughButton } from '../../../shared/ui/RoughCard';
import { useAccountResource } from '../../../shared/hooks/useAccountResource';
import { GrammarCourseCards, GrammarNotice, GrammarProgress } from '../components/GrammarContent';
import { SentenceAnalyzer } from '../components/SentenceAnalyzer';
import type { GrammarSummary } from '@nihongo/shared/contracts/grammar';

export const BunpoPage: React.FC<{ userId: string | null; authBusy: boolean }> = ({ userId, authBusy }) => {
  const catalog = useAccountResource<{ courses: GrammarSummary[] }>('/grammar/courses', userId, authBusy);
  const progress = useAccountResource<{ completedPatternIds: string[] }>(userId ? '/grammar/progress' : null, userId, authBusy);
  const courses = catalog.data?.courses ?? [];
  const total = courses.reduce((count, course) => count + course.patternCount, 0);
  const completedCount = progress.data?.completedPatternIds.length ?? 0;
  const [isConjugationModalOpen, setIsConjugationModalOpen] = useState(false);

  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-7 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* 1. Header Banner */}
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-black text-[#292524] dark:text-white font-sketch flex flex-wrap items-center gap-2">
          <span className="bg-[#0094ff] text-white px-2.5 py-0.5 rounded-lg border border-[#292524] shadow-xs">
            JLPT Mindmap
          </span>
          <span>–</span>
          <span>Càng học càng cuốn</span>
        </h1>

        <div className="text-xs md:text-sm font-bold text-[#57534e] space-y-0.5">
          <p>Không chỉ để thi mà còn để dùng thực tế, hiểu bản chất trong từng ngữ cảnh.</p>
          <p className="text-[#78716c]">
            Vẫn là các giáo trình quen thuộc nhưng được mở rộng theo mindmap trong từng mẫu ngữ pháp.
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. SENTENCE ANALYZER CARD (Phân tích câu 「文の分析」) */}
      {/* ============================================================ */}
      <SentenceAnalyzer userId={userId} authBusy={authBusy} />

      {/* ============================================================ */}
      {/* 3. GRAMMAR SYMBOLS & CONJUGATION BANNER */}
      {/* ============================================================ */}
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-5 space-y-3 shadow-sketch">
        <h3 className="text-xs font-black text-[#292524] uppercase tracking-wider">
          Ký hiệu viết tắt trong cấu trúc ngữ pháp
        </h3>

        {/* Legend Symbols */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs font-bold">
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-[#0094ff] font-black mr-1">[ N ]</span>
            <span>Danh từ (名詞)</span>
          </div>
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-emerald-600 font-black mr-1">[ V ]</span>
            <span>Động từ (動詞)</span>
          </div>
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-amber-600 font-black mr-1">[ A ]</span>
            <span>Tính từ (形容詞)</span>
          </div>
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-amber-600 font-black mr-1">[ Aい ]</span>
            <span>Tính từ đuôi い</span>
          </div>
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-amber-600 font-black mr-1">[ Aな ]</span>
            <span>Tính từ đuôi な</span>
          </div>
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-purple-600 font-black mr-1">[ S ]</span>
            <span>Câu (文)</span>
          </div>
          <div className="p-2 rounded-lg bg-[#fdfbf7] border-sketch-subtle text-center">
            <span className="text-cyan-600 font-black mr-1">[ TTT ]</span>
            <span>Thể thông thường</span>
          </div>
        </div>

        {/* Conjugation modal trigger banner */}
        <div 
          onClick={() => setIsConjugationModalOpen(true)}
          className="p-3 rounded-xl bg-amber-50 border-sketch-orange flex items-center justify-between text-xs font-bold text-amber-900 cursor-pointer hover:bg-amber-100 transition-colors shadow-sketch"
        >
          <div>
            <div className="font-black">Bảng chia thể động từ · tính từ</div>
            <div className="text-[11px] text-amber-700">Thể thông thường, thể て, thể ない, khả năng, bị động, sai khiến...</div>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-600" />
        </div>
      </RoughCard>

      <GrammarNotice {...catalog} />
      <GrammarNotice {...progress} />
      <GrammarProgress title="Tiến độ tổng" completed={completedCount} total={total} loading={catalog.loading || progress.loading} />
      {!catalog.loading && !catalog.error && <div className="space-y-6">
        <GrammarCourseCards courses={courses} levels={['N5', 'N4']} title="Giáo trình quốc dân" subtitle="Sơ cấp I · II" />
        <GrammarCourseCards courses={courses} levels={['N3', 'N2', 'N1']} title="Ngữ pháp chuyên sâu" subtitle="N3 · N2 · N1" />
      </div>}

      {/* ============================================================ */}
      {/* MODAL: BẢNG CHIA THỂ ĐỘNG TỪ & TÍNH TỪ */}
      {/* ============================================================ */}
      {isConjugationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setIsConjugationModalOpen(false)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={16} roughness={0.7} className="p-6 space-y-4 shadow-2xl bg-white">
              <div className="flex items-center justify-between border-b border-[#78716c]/20 pb-3">
                <h3 className="text-base font-black text-[#292524] font-sketch">
                  📚 Bảng chia thể Động từ & Tính từ tiếng Nhật
                </h3>
                <button onClick={() => setIsConjugationModalOpen(false)} className="p-1 rounded hover:bg-slate-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-bold text-[#57534e]">
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                  <div className="text-blue-800 font-black">1. Thể て (Te-form)</div>
                  <p>Nhóm 1: い・ち・り → って | み・び・に → んで | き → いて | ぎ → いで | し → して</p>
                  <p>Nhóm 2: Bỏ ます + て (食べる → 食べて)</p>
                  <p>Nhóm 3: します → して | きます → きて</p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                  <div className="text-emerald-800 font-black">2. Thể ない (Nai-form)</div>
                  <p>Nhóm 1: Chuyển âm [i] sang cột [a] + ない (書く → 書かない, 行く → 行かない)</p>
                  <p>Nhóm 2: Bỏ ます + ない (見る → 見ない)</p>
                  <p>Nhóm 3: します → しない | きます → こない</p>
                </div>

                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 space-y-1">
                  <div className="text-purple-800 font-black">3. Thể Khả năng (Potential)</div>
                  <p>Nhóm 1: Chuyển âm [u] sang cột [e] + る (話す → 話せる, 読む → 読める)</p>
                  <p>Nhóm 2: Bỏ る + られる (食べる → 食べられる)</p>
                  <p>Nhóm 3: する → できる | くる → こられる</p>
                </div>
              </div>

              <div className="text-center pt-2">
                <RoughButton
                  onClick={() => setIsConjugationModalOpen(false)}
                  fill="#0094ff"
                  stroke="#0369a1"
                  borderRadius={8}
                  roughness={0.7}
                  className="text-white px-5 py-2 text-xs font-bold"
                >
                  Đã hiểu
                </RoughButton>
              </div>
            </RoughCard>
          </div>
        </div>
      )}


    </div>
  );
};
