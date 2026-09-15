import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Edit3, Target, Trophy } from 'lucide-react';
import { createPortal } from 'react-dom';
import { RoughButton, RoughCard } from './RoughCard';
import { FlashcardView } from './FlashcardView';
import { KANJI_DATABASE } from '../data/kanjiData';
import type { KanjiItem } from '../types';
import type { PersonalRoadmap, usePersonalRoadmaps } from '../hooks/usePersonalRoadmaps';
import { roadmapDayKanji } from '../../shared/roadmap.mjs';
import { speakJapanese } from '../utils/speech';

type Plans = ReturnType<typeof usePersonalRoadmaps>;
type Session = {
  roadmap: PersonalRoadmap;
  day: number;
  items: KanjiItem[];
  initialId?: string;
  reviewed: Set<string>;
  replay: boolean;
};
type Props = {
  roadmap: PersonalRoadmap;
  day: number;
  plans: Plans;
  userId: string | null;
  authBusy: boolean;
  onDay: (day: number) => void;
  onBack: () => void;
  onLogin: () => void;
  onDetail: (item: KanjiItem) => void;
};
const catalog = new Map(KANJI_DATABASE.map(item => [item.kanji, item]));

export function PersonalRoadmapStudy({ roadmap, day, plans, userId, authBusy, onDay, onBack, onLogin, onDetail }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const chars = roadmapDayKanji(roadmap.kanjiList, roadmap.perDay, day);
  const unsupported = roadmap.kanjiList.filter(char => !catalog.has(char));
  const items = chars.map(char => catalog.get(char)).filter((item): item is KanjiItem => !!item);
  const completed = roadmap.completedDays.includes(day);
  const assessed = items.filter(item => Object.prototype.hasOwnProperty.call(roadmap.assessments, item.id)).length;
  const percent = Math.round(roadmap.completedDays.length / roadmap.totalDays * 100);

  const close = () => {
    if (pending.current) return;
    sessionRef.current = null;
    setSession(null);
  };
  const start = async () => {
    if (pending.current || plans.busy || unsupported.length) return;
    pending.current = true;
    setNotice('');
    try {
      const saved = await plans.start(roadmap, day);
      if (!saved || !mounted.current) return;
      const nextItems = roadmapDayKanji(saved.kanjiList, saved.perDay, day).map(char => catalog.get(char)!);
      // An unfinished day resumes; replay assesses the whole day without clearing saved completion.
      const replay = saved.completedDays.includes(day);
      const reviewed = new Set(replay ? [] : nextItems.filter(item => Object.prototype.hasOwnProperty.call(saved.assessments, item.id)).map(item => item.id));
      const next = { roadmap: saved, day, items: nextItems, reviewed, replay, initialId: nextItems.find(item => !reviewed.has(item.id))?.id };
      sessionRef.current = next;
      setNeedsReload(false);
      setSession(next);
    } finally { pending.current = false; }
  };
  const rate = async (kanjiId: string, memorized: boolean) => {
    const current = sessionRef.current;
    if (!current || pending.current || plans.busy || needsReload) return false;
    pending.current = true;
    try {
      const saved = await plans.rate(current.roadmap, current.day, kanjiId, memorized);
      if (!mounted.current || sessionRef.current !== current) return false;
      if (!saved) { setNeedsReload(true); return false; }
      const reviewed = new Set(current.replay ? [...current.reviewed, kanjiId] : current.items.filter(item => Object.prototype.hasOwnProperty.call(saved.assessments, item.id)).map(item => item.id));
      const next = { ...current, roadmap: saved, reviewed };
      if (current.items.every(item => reviewed.has(item.id))) {
        sessionRef.current = null;
        setSession(null);
        setNotice(`Đã hoàn thành ngày ${current.day}.`);
      } else {
        sessionRef.current = next;
        setSession(next);
      }
      return true;
    } finally { pending.current = false; }
  };
  const reload = async () => {
    if (pending.current) return;
    const current = sessionRef.current;
    const latest = await plans.reload();
    if (!latest || !mounted.current || sessionRef.current !== current) return;
    const saved = latest.find(item => item.id === roadmap.id);
    if (!saved) { close(); return; }
    if (current) {
      const reviewed = current.replay ? current.reviewed : new Set(current.items.filter(item => Object.prototype.hasOwnProperty.call(saved.assessments, item.id)).map(item => item.id));
      if (current.items.every(item => reviewed.has(item.id))) {
        close();
        setNotice(`Đã hoàn thành ngày ${current.day}.`);
      } else {
        const next = { ...current, roadmap: saved, reviewed, initialId: current.items.find(item => !reviewed.has(item.id))?.id };
        sessionRef.current = next;
        setSession(next);
        setReloadKey(value => value + 1);
      }
    }
    setNeedsReload(false);
  };

  return <div className="space-y-5">
    <button type="button" onClick={onBack} disabled={plans.saving} className="flex items-center gap-1 text-xs font-bold text-[#57534e] hover:text-[#ea580c]">
      <ChevronLeft className="w-4 h-4" /> Quay lại danh sách
    </button>
    <div className="text-center space-y-0.5 py-1">
      <h1 className="text-2xl md:text-3xl font-black text-[#292524] dark:text-white font-sketch tracking-tight">{roadmap.name}</h1>
      <p className="text-xs md:text-sm font-bold text-[#78716c] dark:text-[#a8a29e]">{roadmap.perDay} chữ mỗi ngày – Tổng cộng {roadmap.totalDays} ngày</p>
    </div>
    <div className="grid grid-cols-2 gap-3.5">
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 shadow-sketch">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#0094ff]"><Calendar className="w-3.5 h-3.5" /><span>Đã học</span></div>
        <div className="mt-1.5"><div className="text-2xl font-black text-[#292524]">{roadmap.completedDays.length}/{roadmap.totalDays}</div><div className="text-[11px] font-bold text-[#78716c]">ngày</div></div>
      </RoughCard>
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 shadow-sketch">
        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600"><Trophy className="w-3.5 h-3.5" /><span>Tiến độ</span></div>
        <div className="mt-1.5"><div className="text-2xl font-black text-[#292524]">{percent}%</div><div className="text-[11px] font-bold text-[#78716c]">hoàn thành</div></div>
      </RoughCard>
    </div>
    {!session && (plans.error || plans.loading || plans.saving) && <div role={plans.error ? 'alert' : 'status'} className="text-xs text-amber-900 bg-amber-50 rounded-lg px-3 py-2">
      {plans.error || (plans.loading ? 'Đang tải lộ trình…' : 'Đang lưu lộ trình…')}
      {plans.error && <button type="button" disabled={authBusy || plans.loading || plans.saving} onClick={() => void reload()} className="ml-2 underline font-bold">Tải lại</button>}
    </div>}
    {unsupported.length > 0 && <p role="alert" className="text-xs text-rose-600">Chưa có dữ liệu cho các chữ: {unsupported.join('、')}. Chưa thể học lộ trình này.</p>}
    {notice && <p role="status" className="text-xs font-bold text-emerald-700">{notice}</p>}
    <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-2.5 shadow-sketch">
      <div className="flex items-center justify-between">
        <button aria-label="Ngày trước" disabled={day === 1 || plans.saving} onClick={() => { setNotice(''); onDay(day - 1); }} className="p-1 rounded-md hover:bg-[#eae3d5] text-[#57534e] cursor-pointer disabled:opacity-40"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex items-center gap-2 font-bold text-sm text-[#292524] font-sketch">
          <Calendar className="w-4 h-4 text-[#0094ff]" /><span>Ngày {day}</span>
          <span className="px-2.5 py-0.5 rounded-full bg-[#86efac] text-[#047857] border-sketch-subtle text-xs font-bold">{completed ? 'Đã hoàn thành' : `${assessed}/${chars.length} chữ đã học`}</span>
        </div>
        <button aria-label="Ngày tiếp theo" disabled={day === roadmap.totalDays || plans.saving} onClick={() => { setNotice(''); onDay(day + 1); }} className="p-1 rounded-md hover:bg-[#eae3d5] text-[#57534e] cursor-pointer disabled:opacity-40"><ChevronRight className="w-5 h-5" /></button>
      </div>
    </RoughCard>
    <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 shadow-sketch">
      <div className="flex items-center gap-4 text-xs font-bold text-[#78716c]">
        <span>Ngày 1</span>
        <input type="range" aria-label="Chọn ngày học" min={1} max={roadmap.totalDays} value={day} disabled={plans.saving || roadmap.totalDays === 1} onChange={event => { setNotice(''); onDay(Number(event.target.value)); }} className="flex-1 min-w-0 h-1.5 accent-[#0094ff] cursor-pointer" />
        <span>Ngày {roadmap.totalDays}</span>
      </div>
    </RoughCard>
    <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-5 space-y-4 shadow-sketch">
      <div className="flex items-center justify-between border-b border-[#78716c]/30 pb-3">
        <div className="flex items-center gap-2 font-black text-base text-[#292524] font-sketch"><Target className="w-4 h-4 text-emerald-600" /><span>Kanji ngày {day}</span></div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[#78716c]">{chars.length} chữ</span>
          <RoughButton onClick={() => void start()} disabled={plans.busy || !!unsupported.length} fill="#0094ff" stroke="#0369a1" borderRadius={8} roughness={0.7} className="text-white px-3.5 py-1.5 text-xs font-bold cursor-pointer">
            <div className="flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5" /><span>Học ngay</span></div>
          </RoughButton>
        </div>
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
        {chars.map(char => {
          const item = catalog.get(char);
          return <button type="button" key={char} onClick={() => speakJapanese(char)} aria-label={`Nghe ${char}`} className="cursor-pointer group">
            <RoughCard fill="#86efac" stroke="#292524" borderRadius={8} roughness={0.7} className="p-2 text-center transition-transform group-hover:scale-105">
              <div className="text-2xl font-kanji font-bold text-[#047857]">{char}</div>
              <div className="text-[10px] font-bold text-[#065f46] mt-0.5 truncate">{item?.hanViet ?? 'Chưa có dữ liệu'}</div>
              <div className="text-[9px] text-[#047857]/80 truncate">{item?.meaning ?? '—'}</div>
            </RoughCard>
          </button>;
        })}
      </div>
    </RoughCard>
    {session && createPortal(<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-[672px]">
        <FlashcardView key={reloadKey} items={session.items} userId={userId} authBusy={authBusy} onClose={close} onLogin={onLogin} onDetail={onDetail}
          study={{ memorizedIds: Object.keys(session.roadmap.assessments).filter(id => session.roadmap.assessments[id]), loaded: plans.loaded && !needsReload, loading: plans.loading, saving: plans.saving,
            error: plans.error || (needsReload ? 'Chưa xác nhận được đánh giá. Tải lại tiến độ đã lưu trước khi học tiếp.' : ''),
            reload, save: rate, initialId: session.initialId, guestPersistent: !userId }} />
      </div>
    </div>, document.body)}
  </div>;
}
