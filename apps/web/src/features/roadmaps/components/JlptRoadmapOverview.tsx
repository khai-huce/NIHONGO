import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, FileText, Headphones, Languages, Layers, PenTool } from 'lucide-react';
import type { JlptResourceKind, JlptRoadmapSummary, JlptStudy } from '@nihongo/shared/contracts/jlpt';
import { RoughCard } from '../../../shared/ui/RoughCard';
import { useAccountResource } from '../../../shared/hooks/useAccountResource';
import { JLPT_LEVEL_PRESENTATION, JLPT_RESOURCE_LABELS, jlptPercent, roadmapForLevel } from '../utils/jlpt-catalog';

const resourceIcons = { kanji: BookOpen, vocabulary: Layers, grammar: PenTool, reading: BookOpen, shadowing: Headphones, kana: Languages };
const orderedKinds: JlptResourceKind[] = ['kanji', 'vocabulary', 'grammar', 'reading', 'shadowing', 'kana'];

export function JlptRoadmapOverview({ items, ready, loading, userId, authBusy }: { items: JlptRoadmapSummary[]; ready: boolean; loading: boolean; userId: string | null; authBusy: boolean }) {
  return <>
    <div className="space-y-1">
      <h1 className="text-2xl md:text-3xl font-black text-[#292524] font-sketch tracking-tight">Lộ trình học</h1>
      <p className="text-xs md:text-sm font-bold text-[#78716c] leading-relaxed">Năm cấp độ JLPT — chọn một cấp để xem các buổi học và mở nội dung đã xuất bản.</p>
    </div>
    <div className="space-y-4 pt-2">
      {JLPT_LEVEL_PRESENTATION.map(level => {
        const roadmap = roadmapForLevel(items, level.id);
        return <RoughCard key={level.id} fill="#ffffff" stroke="#292524" borderRadius={14} roughness={0.7} className="p-4 md:p-5 space-y-3 shadow-sketch transition-all hover:bg-stone-50/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`w-8 h-8 rounded-lg ${level.badgeBg} text-white flex items-center justify-center font-black text-xs font-sketch shrink-0 shadow-xs`}>{level.id}</span>
              <span className="text-sm md:text-base font-black text-[#292524] font-sketch">{level.id} · {level.name}</span>
              <span className="text-[11px] font-bold text-[#78716c] bg-stone-100 px-1.5 py-0.5 rounded border-sketch-pill">{level.kanjiBadge}</span>
              <span className={`text-[10px] md:text-[11px] font-black px-2.5 py-0.5 rounded-full ${roadmap ? 'text-emerald-700 bg-emerald-50 border-sketch-green' : 'text-stone-500 bg-stone-50 border-sketch-pill'}`}>{!ready ? loading ? 'Đang tải' : 'Chưa tải được' : roadmap ? 'Đã xuất bản' : 'Chưa có nội dung'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`?level=${level.id}`} className="px-3.5 py-1 rounded-full border-sketch-subtle text-[#292524] bg-white hover:bg-stone-50 text-xs font-black shadow-sketch transition-colors">Xem lộ trình</Link>
              <Link to={`?level=${level.id}`} aria-label={`Xem chi tiết lộ trình ${level.id}`} className="w-7 h-7 md:w-8 md:h-8 rounded-full border-sketch-subtle bg-white flex items-center justify-center text-[#292524] hover:bg-stone-50 transition-colors shadow-sketch"><ChevronRight className="w-4 h-4" /></Link>
            </div>
          </div>
          <p className="text-xs font-bold text-[#57534e]">{roadmap ? roadmap.description || roadmap.title : ready ? `Chưa có lộ trình ${level.id} được xuất bản.` : loading ? 'Đang tải thông tin lộ trình…' : 'Chưa tải được thông tin lộ trình.'}</p>
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            {orderedKinds.filter(kind => kind === 'kanji' || roadmap?.resourceKinds.includes(kind)).map(kind => {
              const Icon = resourceIcons[kind];
              return <span key={kind} className="px-2.5 py-1 rounded-full border-sketch-pill bg-[#fdfbf7] text-[11px] font-bold text-[#57534e] flex items-center gap-1.5 shadow-2xs"><Icon className="w-3.5 h-3.5 text-stone-600" /><span>{kind === 'kanji' ? `${ready ? roadmap?.kanjiCount ?? 0 : '—'} kanji` : JLPT_RESOURCE_LABELS[kind]}</span></span>;
            })}
            {roadmap && <span className="px-2.5 py-1 rounded-full border-sketch-pill bg-[#fdfbf7] text-[11px] font-bold text-[#57534e] flex items-center gap-1.5 shadow-2xs"><FileText className="w-3.5 h-3.5" /><span>Kiểm tra cuối buổi · đạt ≥ {roadmap.passPercent}%</span></span>}
            <span className="px-2.5 py-1 rounded-full border-sketch-pill bg-[#fdfbf7] text-[11px] font-bold text-[#57534e] shadow-2xs">{ready ? roadmap?.sessionCount ?? 0 : '—'} buổi</span>
          </div>
          <LevelProgress key={`${userId ?? 'guest'}:${level.id}`} roadmap={roadmap} ready={ready} userId={userId} authBusy={authBusy} />
        </RoughCard>;
      })}
    </div>
  </>;
}

function LevelProgress({ roadmap, ready, userId, authBusy }: { roadmap: JlptRoadmapSummary | null; ready: boolean; userId: string | null; authBusy: boolean }) {
  const store = useAccountResource<JlptStudy>(userId && roadmap && ready ? `/jlpt/study/roadmaps/${roadmap.level}` : null, userId, authBusy);
  const study = !authBusy && store.data?.roadmapId === roadmap?.id ? store.data : null;
  const percent = jlptPercent(study?.percent);
  const label = !ready ? 'Chưa tải được tiến độ' : !roadmap ? 'Chưa có lộ trình' : !userId ? 'Đăng nhập để lưu tiến độ' : store.error ? 'Chưa tải được tiến độ' : store.loading || percent === null ? 'Đang tải tiến độ…' : `${study!.completedCount}/${roadmap.sessionCount} buổi · ${percent}%`;
  return <div>
    <div className="flex items-center gap-3 pt-1.5">
      <div role={percent === null ? undefined : 'progressbar'} aria-label="Tiến độ lộ trình" aria-valuenow={percent ?? undefined} aria-valuemin={percent === null ? undefined : 0} aria-valuemax={percent === null ? undefined : 100} className="relative flex-1 h-3 border-sketch-subtle rounded-full bg-stone-100/80 overflow-hidden">
        {percent !== null && <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${percent}%` }} />}
      </div>
      <span className="text-[11px] font-bold text-[#78716c] shrink-0">{label}</span>
    </div>
    {store.error && <p role="alert" className="mt-2 text-xs text-red-700">{store.error} <button type="button" className="font-bold underline" onClick={() => void store.reload()}>Thử lại</button></p>}
  </div>;
}
