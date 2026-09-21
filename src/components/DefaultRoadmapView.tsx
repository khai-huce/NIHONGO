import { Calendar, Target, Flame, Trophy, ChevronLeft, ChevronRight, Crown, Edit3 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { RoughCard, RoughButton } from './RoughCard';
import { useDefaultRoadmap } from '../hooks/useDefaultRoadmap';
import { useRoadmapStudy } from '../hooks/useRoadmapStudy';
import { RoadmapStudyOverlay } from './RoadmapStudyOverlay';
import { useContentCatalog } from '../hooks/useContentCatalog';
import { roadmapDayKanji } from '../../shared/roadmap.mjs';
import { speakJapanese } from '../utils/speech';
import type { KanjiItem } from '../types';
import type { KeyboardEvent } from 'react';

const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
type Props = { userId: string | null; authBusy: boolean; onLogin: () => void; onDetail: (item: KanjiItem) => void };

export function DefaultRoadmapView({ userId, authBusy, onLogin, onDetail }: Props) {
  const { byCharacter: catalog } = useContentCatalog();
  const plans = useDefaultRoadmap(userId, authBusy);
  const {roadmap} = plans;
  const [search, setSearch] = useSearchParams();
  const requestedLevel = search.get('level') ?? 'N5';
  const selectedLevel = levels.includes(requestedLevel) ? requestedLevel : 'N5';
  const supported = selectedLevel === 'N5';
  const requestedDay = Number(search.get('day'));
  const currentDay = supported && Number.isInteger(requestedDay) && requestedDay >= 1 && requestedDay <= roadmap.totalDays ? requestedDay : supported ? roadmap.currentDay : 1;
  const study = useRoadmapStudy(roadmap, currentDay, plans);
  const setCurrentDay = (day: number) => {
    study.setNotice('');
    setSearch({level: selectedLevel, day: String(day)}, {replace: true});
  };
  const setSelectedLevel = (level: string) => { study.setNotice(''); setSearch({level}); };
  const levelChoice = (level: string) => ({
    role: 'button', tabIndex: 0, 'aria-label': `Chọn ${level}`, 'aria-pressed': selectedLevel === level,
    onClick: () => setSelectedLevel(level),
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedLevel(level); }
    },
  });
  const defaultDayKanjiList = supported ? roadmapDayKanji(roadmap.kanjiList, roadmap.perDay, currentDay).map(char => catalog.get(char)!) : [];
  return <>
        <div className="space-y-5">
          
          {/* Main Title Section */}
          <div className="text-center space-y-0.5 py-1">
            <h1 className="text-2xl md:text-3xl font-black text-[#292524] dark:text-white font-sketch tracking-tight">
              Lộ trình học Kanji
            </h1>
            <p className="text-xs md:text-sm font-bold text-[#78716c] dark:text-[#a8a29e]">
              {roadmap.perDay} chữ mỗi ngày – Tổng cộng {roadmap.totalDays} ngày
            </p>
          </div>

          <p className="text-xs font-bold text-[#78716c]">Đang học {roadmap.kanjiList.length} chữ N5 hiện có; chưa phải bộ N5 đầy đủ.</p>
          {!study.session && (plans.error || plans.loading || plans.saving) && <div role={plans.error ? 'alert' : 'status'} className="text-xs text-amber-900 bg-amber-50 rounded-lg px-3 py-2">
            {plans.error || (plans.loading ? 'Đang tải tiến độ…' : 'Đang lưu tiến độ…')}
            {plans.error && <button type="button" disabled={authBusy || plans.loading || plans.saving} onClick={() => void study.reload()} className="ml-2 underline font-bold">Tải lại</button>}
          </div>}
          {study.notice && <p role="status" className="text-xs font-bold text-emerald-700">{study.notice}</p>}

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 shadow-sketch">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0094ff]">
                <Calendar className="w-3.5 h-3.5" />
                <span>Đã học</span>
              </div>
              <div className="mt-1.5">
                <div className="text-2xl font-black text-[#292524] dark:text-white">{plans.loaded ? roadmap.completedDays.length : '—'}/{roadmap.totalDays}</div>
                <div className="text-[11px] font-bold text-[#78716c]">ngày</div>
              </div>
            </RoughCard>

            <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 shadow-sketch">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <Target className="w-3.5 h-3.5" />
                <span>Kanji</span>
              </div>
              <div className="mt-1.5">
                <div className="text-2xl font-black text-[#292524] dark:text-white">{plans.loaded ? Object.keys(roadmap.assessments).length : '—'}</div>
                <div className="text-[11px] font-bold text-[#78716c]">chữ đã học</div>
              </div>
            </RoughCard>

            <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 shadow-sketch">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-500">
                <Flame className="w-3.5 h-3.5 fill-orange-500" />
                <span>Streak</span>
              </div>
              <div className="mt-1.5">
                <div className="text-2xl font-black text-[#292524] dark:text-white">{plans.loaded ? roadmap.streak : '—'}</div>
                <div className="text-[11px] font-bold text-[#78716c]">ngày liên tiếp</div>
              </div>
            </RoughCard>

            <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 shadow-sketch">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600">
                <Trophy className="w-3.5 h-3.5" />
                <span>Tiến độ</span>
              </div>
              <div className="mt-1.5">
                <div className="text-2xl font-black text-[#292524] dark:text-white">{plans.loaded ? `${Math.round(roadmap.completedDays.length / roadmap.totalDays * 100)}%` : '—'}</div>
                <div className="text-[11px] font-bold text-[#78716c]">hoàn thành</div>
              </div>
            </RoughCard>
          </div>

          {/* Level Selection Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div {...levelChoice('N5')} className="cursor-pointer">
              <RoughCard 
                fill="#86efac" 
                stroke="#047857" 
                borderRadius={10}
                roughness={0.7} 
                active={selectedLevel === 'N5'}
                className="p-3 text-center shadow-sketch"
              >
                <div className="text-base font-black text-[#047857]">N5</div>
                <div className="text-[11px] font-bold text-[#065f46]">{roadmap.kanjiList.length} chữ – {roadmap.totalDays} ngày</div>
                <div className="text-[10px] font-bold text-[#047857] mt-0.5">{plans.loaded ? roadmap.completedDays.length : '—'}/{roadmap.totalDays} ngày</div>
              </RoughCard>
            </div>

            <div {...levelChoice('N4')} className="cursor-pointer">
              <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3 text-center hover:bg-slate-50 shadow-sketch">
                <div className="flex items-center justify-center gap-1 text-base font-black text-[#292524]">
                  <span>N4</span>
                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                </div>
                <div className="text-[11px] font-bold text-[#a8a29e]">Premium</div>
              </RoughCard>
            </div>

            <div {...levelChoice('N3')} className="cursor-pointer">
              <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3 text-center hover:bg-slate-50 shadow-sketch">
                <div className="flex items-center justify-center gap-1 text-base font-black text-[#292524]">
                  <span>N3</span>
                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                </div>
                <div className="text-[11px] font-bold text-[#a8a29e]">Premium</div>
              </RoughCard>
            </div>

            <div {...levelChoice('N2')} className="cursor-pointer">
              <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3 text-center hover:bg-slate-50 shadow-sketch">
                <div className="flex items-center justify-center gap-1 text-base font-black text-[#292524]">
                  <span>N2</span>
                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                </div>
                <div className="text-[11px] font-bold text-[#a8a29e]">Premium</div>
              </RoughCard>
            </div>

            <div {...levelChoice('N1')} className="cursor-pointer">
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
                aria-label="Ngày trước" disabled={!supported || currentDay === 1 || plans.saving}
                onClick={() => setCurrentDay(currentDay - 1)}
                className="p-1 rounded-md hover:bg-[#eae3d5] text-[#57534e] cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 font-bold text-sm text-[#292524] font-sketch">
                <Calendar className="w-4 h-4 text-[#0094ff]" />
                <span>Ngày {currentDay}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#86efac] text-[#047857] border-sketch-subtle text-xs font-bold">
                  {selectedLevel}{supported ? ' - Cơ bản' : ''}
                </span>
              </div>

              <button 
                aria-label="Ngày tiếp theo" disabled={!supported || currentDay === roadmap.totalDays || plans.saving}
                onClick={() => setCurrentDay(currentDay + 1)}
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
              <div className="relative flex-1 flex items-center focus-within:outline focus-within:outline-2 focus-within:outline-[#0094ff] focus-within:outline-offset-4">
                <input type="range" aria-label="Chọn ngày học" min={1} max={roadmap.totalDays} value={currentDay} disabled={!supported || plans.saving} onChange={event => setCurrentDay(Number(event.target.value))} className="absolute inset-0 w-full h-5 -top-2 opacity-0 z-10 cursor-pointer" />
                <div className="w-full h-1.5 rounded-full bg-slate-200">
                  <div 
                    className="h-full rounded-full bg-[#0094ff]"
                    style={{ width: `${((currentDay - 1) / Math.max(1, roadmap.totalDays - 1)) * 100}%` }}
                  />
                </div>
                <div 
                  className="absolute w-3.5 h-3.5 rounded-full bg-[#0094ff] border-2 border-white shadow-xs -translate-x-1/2 cursor-pointer"
                  style={{ left: `${((currentDay - 1) / Math.max(1, roadmap.totalDays - 1)) * 100}%` }}
                />
              </div>
              <span>Ngày {supported ? roadmap.totalDays : '—'} ({selectedLevel})</span>
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
                <span className="text-xs font-bold text-[#78716c]">{defaultDayKanjiList.length} chữ</span>
                <RoughButton
                  disabled={!supported || plans.busy}
                  onClick={() => { setCurrentDay(currentDay); void study.start(); }}
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

            {!supported && <p role="status" className="text-xs text-[#78716c]">Lộ trình {selectedLevel} chưa có dữ liệu trong đợt này. Vui lòng chọn N5 để học.</p>}

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
    <RoadmapStudyOverlay study={study} userId={userId} authBusy={authBusy} onLogin={onLogin} onDetail={onDetail} />
  </>;
}
