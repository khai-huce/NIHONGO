import { useEffect, useRef, useState } from 'react';
import type { FlashcardProgress } from '../components/FlashcardView';
import { useContentCatalog } from '../hooks/useContentCatalog';
import type { KanjiItem } from '../types';
import { roadmapDayKanji } from '../../shared/roadmap.mjs';

export type RoadmapStudyData = {
  id: string;
  kanjiList: string[];
  perDay: number;
  assessments: Record<string, boolean>;
  completedDays: number[];
  progressVersion: number;
};

export type RoadmapStudyAdapter<T extends RoadmapStudyData> = {
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  busy: boolean;
  error: string;
  start: (roadmap: T, day: number) => Promise<T | null>;
  rate: (roadmap: T, day: number, kanjiId: string, memorized: boolean) => Promise<T | null>;
  reload: () => Promise<T | undefined>;
};

type Session<T extends RoadmapStudyData> = {
  roadmap: T;
  day: number;
  items: KanjiItem[];
  initialId?: string;
  reviewed: Set<string>;
  replay: boolean;
};


export function useRoadmapStudy<T extends RoadmapStudyData>(roadmap: T, day: number, plans: RoadmapStudyAdapter<T>) {
  const { byCharacter: catalog } = useContentCatalog();
  const [session, setSession] = useState<Session<T> | null>(null);
  const sessionRef = useRef<Session<T> | null>(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const close = () => {
    if (pending.current) return;
    sessionRef.current = null;
    setSession(null);
  };
  const start = async () => {
    if (pending.current || plans.busy || roadmap.kanjiList.some(char => !catalog.has(char))) return;
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
    const saved = await plans.reload();
    if (!mounted.current || sessionRef.current !== current) return;
    // A failed read remains blocked until an explicit successful reload, even if focus refreshes the list.
    if (!saved) return;
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

  const flashcardProgress: FlashcardProgress = {
    memorizedIds: session ? Object.keys(session.roadmap.assessments).filter(id => session.roadmap.assessments[id]) : [],
    loaded: plans.loaded && !needsReload,
    loading: plans.loading,
    saving: plans.saving,
    error: plans.error || (needsReload ? 'Chưa xác nhận được đánh giá. Tải lại tiến độ đã lưu trước khi học tiếp.' : ''),
    reload,
    save: rate,
    initialId: session?.initialId,
  };

  return { session, notice, setNotice, start, close, reload, flashcardProgress, reloadKey };
}
