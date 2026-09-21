import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContentCatalog, type RoadmapDefinition } from './useContentCatalog';
import { api, ApiError } from '../utils/api';
import { studyStreak, vietnamStudyDate } from '../../shared/default-roadmap.mjs';
import { roadmapDayKanji } from '../../shared/roadmap.mjs';
import { assessRoadmapKanji, roadmapProgress } from '../../shared/roadmap-study.mjs';

export type DefaultRoadmap = {
  id: string;
  kanjiList: string[];
  perDay: number;
  totalDays: number;
  currentDay: number;
  assessments: Record<string, boolean>;
  completedDays: number[];
  progressVersion: number;
  startedAt: string | null;
  activityDays: string[];
  streak: number;
};
type State = {
  owner: string | null;
  roadmap: DefaultRoadmap;
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  error: string;
  errorCode: string;
  serverNow: string | null;
  clockOffset: number;
};
type DeviceStore = { serialized: string | null; roadmap: DefaultRoadmap };
const DEVICE_KEY = 'nhai_kanji_default_roadmap_n5_v1';
const DAY_MS = 86_400_000;
function createCatalogHelpers(DEFAULT_ROADMAP: RoadmapDefinition, pairs: readonly (readonly [string, string])[]) {
const kanjiIds = new Map(pairs.map(([id, character]) => [character, id]));
const memberIds = new Set(DEFAULT_ROADMAP.kanjiList.map(character => kanjiIds.get(character)));

function fail(code: string, message: string): never { throw new ApiError(0, code, message); }
function emptyRoadmap(): DefaultRoadmap {
  return { id: DEFAULT_ROADMAP.id, kanjiList: [...DEFAULT_ROADMAP.kanjiList], perDay: DEFAULT_ROADMAP.perDay,
    totalDays: Math.ceil(DEFAULT_ROADMAP.kanjiList.length / DEFAULT_ROADMAP.perDay), currentDay: 1,
    assessments: {}, completedDays: [], progressVersion: 0, startedAt: null, activityDays: [], streak: 0 };
}
function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
function parseRoadmap(value: unknown, now: Date, stored = false): DefaultRoadmap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Lộ trình mặc định không hợp lệ.');
  const item = value as Record<string, unknown>, metadata = emptyRoadmap();
  const assessments = item.assessments, completedDays = item.completedDays, activityDays = item.activityDays;
  if (item.id !== metadata.id || item.perDay !== metadata.perDay || item.totalDays !== metadata.totalDays ||
    !Array.isArray(item.kanjiList) || JSON.stringify(item.kanjiList) !== JSON.stringify(metadata.kanjiList) ||
    !assessments || typeof assessments !== 'object' || Array.isArray(assessments) ||
    Object.entries(assessments).some(([id, memorized]) => !memberIds.has(id) || typeof memorized !== 'boolean') ||
    !Array.isArray(completedDays) || completedDays.some(day => !Number.isSafeInteger(day) || day < 1 || day > metadata.totalDays) ||
    new Set(completedDays).size !== completedDays.length ||
    typeof item.progressVersion !== 'number' || !Number.isSafeInteger(item.progressVersion) || item.progressVersion < 0 ||
    (item.startedAt !== null && (typeof item.startedAt !== 'string' || !Number.isFinite(Date.parse(item.startedAt)))) ||
    !Array.isArray(activityDays) || activityDays.some(day => !validDate(day)) ||
    new Set(activityDays).size !== activityDays.length ||
    typeof item.streak !== 'number' || !Number.isSafeInteger(item.streak) || item.streak < 0) {
    throw new Error('Tiến độ lộ trình mặc định không hợp lệ.');
  }
  const assessedCount = Object.keys(assessments).length;
  if ((item.startedAt === null && (assessedCount || completedDays.length || activityDays.length || item.progressVersion)) ||
    (item.startedAt !== null && item.progressVersion < 1) ||
    (assessedCount > 0) !== (activityDays.length > 0)) throw new Error('Tiến độ lộ trình mặc định không hợp lệ.');
  const progress = roadmapProgress(metadata.kanjiList, metadata.perDay, assessments, completedDays, pairs);
  const assessedDays = Array.from({ length: metadata.totalDays }, (_, index) => index + 1).filter(day =>
    roadmapDayKanji(metadata.kanjiList, metadata.perDay, day).every(character => {
      const id = kanjiIds.get(character);
      return id !== undefined && Object.prototype.hasOwnProperty.call(assessments, id);
    }));
  const streak = studyStreak(activityDays as string[], now);
  if (item.currentDay !== progress.currentDay || assessedDays.length !== completedDays.length ||
    assessedDays.some(day => !completedDays.includes(day)) || (!stored && item.streak !== streak)) {
    throw new Error('Tiến độ lộ trình mặc định không khớp dữ liệu học.');
  }
  return { ...metadata, ...progress, progressVersion: item.progressVersion, startedAt: item.startedAt,
    activityDays: [...activityDays as string[]].sort(), streak };
}
function readDeviceRoadmap(): DeviceStore {
  let serialized: string | null;
  try { serialized = localStorage.getItem(DEVICE_KEY); }
  catch { return fail('DEVICE_STORAGE_ERROR', 'Không đọc được tiến độ trên thiết bị. Vui lòng kiểm tra quyền lưu trữ và thử lại.'); }
  if (serialized === null) return { serialized, roadmap: emptyRoadmap() };
  try { return { serialized, roadmap: parseRoadmap(JSON.parse(serialized), new Date(), true) }; }
  catch { return fail('DEVICE_DATA_INVALID', 'Dữ liệu lộ trình mặc định trên thiết bị không hợp lệ; bản gốc vẫn được giữ.'); }
}
function writeDeviceRoadmap(store: DeviceStore, roadmap: DefaultRoadmap): DefaultRoadmap {
  try {
    if (localStorage.getItem(DEVICE_KEY) !== store.serialized) {
      fail('ROADMAP_PROGRESS_CHANGED', 'Tiến độ đã thay đổi ở tab khác. Vui lòng tải lại trước khi học tiếp.');
    }
    localStorage.setItem(DEVICE_KEY, JSON.stringify(roadmap));
  } catch (err) {
    if (err instanceof ApiError) throw err;
    fail('DEVICE_STORAGE_ERROR', 'Chưa lưu được tiến độ trên thiết bị. Hãy kiểm tra quyền hoặc dung lượng lưu trữ rồi thử lại.');
  }
  return roadmap;
}
function validateDay(day: number) {
  try { return roadmapDayKanji(DEFAULT_ROADMAP.kanjiList, DEFAULT_ROADMAP.perDay, day); }
  catch { return fail('INVALID_ROADMAP_DAY', 'Ngày học không tồn tại trong lộ trình.'); }
}
function emptyState(owner: string | null): State {
  return { owner, roadmap: emptyRoadmap(), loaded: false, loading: false, saving: false,
    error: '', errorCode: '', serverNow: null, clockOffset: 0 };
}

return { kanjiIds, fail, emptyRoadmap, parseRoadmap, readDeviceRoadmap, writeDeviceRoadmap, validateDay, emptyState };
}

export function useDefaultRoadmap(userId: string | null, authBusy: boolean) {
  const { pairs, roadmaps } = useContentCatalog();
  const DEFAULT_ROADMAP = roadmaps.find(item => item.id === 'n5-v1')!;
  const helpers = useMemo(() => createCatalogHelpers(DEFAULT_ROADMAP, pairs), [DEFAULT_ROADMAP, pairs]);
  const { kanjiIds, fail, emptyRoadmap, parseRoadmap, readDeviceRoadmap, writeDeviceRoadmap, validateDay, emptyState } = helpers;
  const context = useRef({ userId, authBusy });
  const mounted = useRef(false), pending = useRef(false), revision = useRef(0);
  if (context.current.userId !== userId) { ++revision.current; pending.current = false; }
  context.current = { userId, authBusy };
  const [state, setState] = useState<State>(() => emptyState(userId));
  const [clockTick, setClockTick] = useState(0);
  const current = useRef(state);
  const apply = useCallback((next: State) => { current.current = next; setState(next); }, []);
  const isCurrent = useCallback((request: number) => mounted.current && context.current.userId === userId &&
    revision.current === request, [userId]);
  const parseResponse = useCallback((data: { userId: string; roadmap: unknown; serverNow: string }) => {
    if (data.userId !== userId) fail('ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    if (typeof data.serverNow !== 'string' || !Number.isFinite(Date.parse(data.serverNow))) {
      fail('INVALID_RESPONSE', 'Thời gian máy chủ không hợp lệ. Vui lòng tải lại.');
    }
    let roadmap: DefaultRoadmap;
    try { roadmap = parseRoadmap(data.roadmap, new Date(data.serverNow)); }
    catch { return fail('INVALID_RESPONSE', 'Phản hồi tiến độ lộ trình không hợp lệ. Vui lòng tải lại.'); }
    return { roadmap, serverNow: data.serverNow, clockOffset: Date.parse(data.serverNow) - Date.now() };
  }, [userId, helpers]);

  const reload = useCallback(async (): Promise<DefaultRoadmap | undefined> => {
    if (!mounted.current || context.current.userId !== userId || context.current.authBusy || pending.current) return;
    const request = ++revision.current;
    pending.current = true;
    apply({ ...(current.current.owner === userId ? current.current : emptyState(userId)), loading: true, error: '', errorCode: '' });
    try {
      let result: Pick<State, 'roadmap' | 'serverNow' | 'clockOffset'>;
      if (userId) {
        const data = await api<{ userId: string; roadmap: unknown; serverNow: string }>('/roadmaps/default');
        if (!isCurrent(request)) return;
        result = parseResponse(data);
      } else result = { roadmap: readDeviceRoadmap().roadmap, serverNow: null, clockOffset: 0 };
      if (!isCurrent(request)) return;
      apply({ ...current.current, ...result, loaded: true, loading: false });
      return result.roadmap;
    } catch (err) {
      if (isCurrent(request)) apply({ ...current.current, loading: false,
        error: err instanceof Error ? err.message : 'Chưa tải được lộ trình. Vui lòng thử lại.',
        errorCode: err instanceof ApiError ? err.code : '' });
    } finally { if (isCurrent(request)) pending.current = false; }
  }, [userId, apply, isCurrent, parseResponse, helpers]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++revision.current; pending.current = false; };
  }, []);
  useEffect(() => { if (!authBusy) void reload(); }, [userId, authBusy, reload]);
  useEffect(() => {
    const onFocus = () => { setClockTick(value => value + 1); void reload(); };
    const onVisible = () => { if (!document.hidden) onFocus(); };
    const onStorage = (event: StorageEvent) => {
      if (!userId && (event.key === DEVICE_KEY || event.key === null)) void reload();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, [reload, userId]);
  useEffect(() => {
    // Recompute at Vietnam midnight even when this page stays open and no new rating is submitted.
    const now = Date.now() + state.clockOffset;
    const elapsedToday = ((now + 7 * 3_600_000) % DAY_MS + DAY_MS) % DAY_MS;
    const timer = window.setTimeout(() => setClockTick(value => value + 1), DAY_MS - elapsedToday + 50);
    return () => window.clearTimeout(timer);
  }, [state.clockOffset, clockTick, helpers]);

  const change = useCallback(async (path: string, body: Record<string, unknown>, local: (store: DeviceStore) => DefaultRoadmap) => {
    if (!mounted.current || context.current.userId !== userId || current.current.owner !== userId ||
      context.current.authBusy || pending.current || !current.current.loaded) return null;
    const request = ++revision.current;
    pending.current = true;
    apply({ ...current.current, saving: true, error: '', errorCode: '' });
    try {
      let result: Pick<State, 'roadmap' | 'serverNow' | 'clockOffset'> | null;
      if (userId) {
        const data = await api<{ userId: string; roadmap: unknown; serverNow: string }>(path, { ...body, expectedUserId: userId });
        if (!isCurrent(request)) return null;
        result = parseResponse(data);
        if (path.endsWith('/rate') && (result.roadmap.progressVersion !== (body.progressVersion as number) + 1 ||
          result.roadmap.assessments[body.kanjiId as string] !== body.memorized)) {
          fail('INVALID_RESPONSE', 'Phản hồi không khớp đánh giá vừa lưu. Vui lòng tải lại tiến độ.');
        }
      } else {
        const updateDevice = () => {
          if (!isCurrent(request) || context.current.authBusy) return null;
          return { roadmap: local(readDeviceRoadmap()), serverNow: null, clockOffset: 0 };
        };
        result = navigator.locks ? await navigator.locks.request(DEVICE_KEY, updateDevice) : updateDevice();
      }
      if (!isCurrent(request) || !result) return null;
      apply({ ...current.current, ...result, saving: false });
      return result.roadmap;
    } catch (err) {
      if (isCurrent(request)) apply({ ...current.current, saving: false,
        error: err instanceof Error ? err.message : 'Chưa lưu được tiến độ. Vui lòng thử lại.',
        errorCode: err instanceof ApiError ? err.code : '' });
      return null;
    } finally {
      if (isCurrent(request)) {
        pending.current = false;
        if (current.current.saving) apply({ ...current.current, saving: false });
      }
    }
  }, [userId, apply, isCurrent, parseResponse, helpers]);

  const start = useCallback(async (roadmap: DefaultRoadmap, day: number): Promise<DefaultRoadmap | null> => {
    return change('/roadmaps/default/start', { catalogId: roadmap.id, day }, store => {
      if (roadmap.id !== DEFAULT_ROADMAP.id) fail('VALIDATION_ERROR', 'Lộ trình không hợp lệ.');
      validateDay(day);
      if (store.roadmap.startedAt) return store.roadmap;
      return writeDeviceRoadmap(store, { ...store.roadmap, startedAt: new Date().toISOString(),
        progressVersion: store.roadmap.progressVersion + 1 });
    });
  }, [change, helpers, DEFAULT_ROADMAP, pairs]);
  const rate = useCallback(async (roadmap: DefaultRoadmap, day: number, kanjiId: string, memorized: boolean): Promise<DefaultRoadmap | null> => {
    return change('/roadmaps/default/rate', { catalogId: roadmap.id, progressVersion: roadmap.progressVersion, day, kanjiId, memorized }, store => {
      if (roadmap.id !== DEFAULT_ROADMAP.id) fail('VALIDATION_ERROR', 'Lộ trình không hợp lệ.');
      const before = store.roadmap, dayKanji = validateDay(day);
      if (before.progressVersion !== roadmap.progressVersion || before.startedAt !== roadmap.startedAt ||
        JSON.stringify(before.assessments) !== JSON.stringify(roadmap.assessments) ||
        JSON.stringify(before.completedDays) !== JSON.stringify(roadmap.completedDays) ||
        JSON.stringify(before.activityDays) !== JSON.stringify(roadmap.activityDays)) {
        fail('ROADMAP_PROGRESS_CHANGED', 'Tiến độ đã thay đổi ở tab khác. Vui lòng tải lại trước khi đánh giá tiếp.');
      }
      if (!before.startedAt) fail('ROADMAP_NOT_STARTED', 'Hãy bấm Học ngay trước khi đánh giá chữ trong lộ trình.');
      if (typeof memorized !== 'boolean' || !dayKanji.some(character => kanjiIds.get(character) === kanjiId)) {
        fail('VALIDATION_ERROR', 'Chữ được đánh giá không thuộc ngày học này.');
      }
      const now = new Date(), activityDays = [...new Set([...before.activityDays, vietnamStudyDate(now)])].sort();
      const progress = assessRoadmapKanji(before.kanjiList, before.perDay, before.assessments, before.completedDays, day, kanjiId, memorized, pairs);
      return writeDeviceRoadmap(store, { ...before, ...progress, progressVersion: before.progressVersion + 1,
        activityDays, streak: studyStreak(activityDays, now) });
    });
  }, [change, helpers, DEFAULT_ROADMAP, pairs]);

  const sameOwner = state.owner === userId;
  const roadmap = useMemo(() => sameOwner
    ? { ...state.roadmap, streak: studyStreak(state.roadmap.activityDays, new Date(Date.now() + state.clockOffset)) }
    : emptyRoadmap(), [sameOwner, state.roadmap, state.clockOffset, clockTick, helpers]);
  return { roadmap, loaded: sameOwner && state.loaded, loading: sameOwner && state.loading,
    saving: sameOwner && state.saving, busy: authBusy || !sameOwner || !state.loaded || state.loading || state.saving,
    error: sameOwner ? state.error : '', errorCode: sameOwner ? state.errorCode : '',
    serverNow: sameOwner ? state.serverNow : null, reload, start, rate };
}
