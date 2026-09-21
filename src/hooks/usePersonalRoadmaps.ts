import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContentCatalog } from './useContentCatalog';
import { api, ApiError } from '../utils/api';
import { analyzeRoadmapKanji, MAX_ROADMAPS, MAX_ROADMAP_TEXT, ROADMAP_PER_DAY, roadmapDayKanji } from '../../shared/roadmap.mjs';
import { assessRoadmapKanji, roadmapProgress } from '../../shared/roadmap-study.mjs';

export type PersonalRoadmap = {
  id: string;
  name: string;
  rawKanji: string;
  kanjiList: string[];
  perDay: number;
  totalDays: number;
  currentDay: number;
  assessments: Record<string, boolean>;
  completedDays: number[];
  progressVersion: number;
  version: number;
  startedAt: string | null;
  createdAt: string;
};
type State = {
  owner: string | null;
  roadmaps: PersonalRoadmap[];
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  error: string;
  errorCode: string;
};
type DeviceEntry = Record<string, unknown>;
type DeviceStore = { serialized: string | null; entries: DeviceEntry[]; roadmaps: PersonalRoadmap[] };
type MutationResult = { roadmaps: PersonalRoadmap[]; roadmap?: PersonalRoadmap; removed?: boolean };
const DEVICE_KEY = 'nhai_kanji_custom_roadmaps';
function createCatalogHelpers(pairs: readonly (readonly [string, string])[]) {
const kanjiIds = new Map(pairs.map(([id, character]) => [character, id]));

function fail(code: string, message: string): never { throw new ApiError(0, code, message); }
function parseRoadmap(value: unknown, legacy: boolean): PersonalRoadmap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Lộ trình không hợp lệ.');
  const item = value as Record<string, unknown>;
  const version = legacy && item.version === undefined ? 0 : item.version;
  const startedAt = legacy && item.startedAt === undefined ? null : item.startedAt;
  const legacyProgress = legacy && item.assessments === undefined && item.completedDays === undefined && item.progressVersion === undefined;
  const assessments = legacyProgress ? {} : item.assessments;
  const completedDays = legacyProgress ? [] : item.completedDays;
  const progressVersion = legacyProgress ? 0 : item.progressVersion;
  if (typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name.trim() ||
    typeof item.rawKanji !== 'string' || !Array.isArray(item.kanjiList) || !item.kanjiList.length ||
    item.kanjiList.some(kanji => typeof kanji !== 'string' || [...kanji].length !== 1) ||
    new Set(item.kanjiList).size !== item.kanjiList.length ||
    typeof item.perDay !== 'number' || !Number.isSafeInteger(item.perDay) || item.perDay < 1 ||
    typeof item.totalDays !== 'number' || item.totalDays !== Math.ceil(item.kanjiList.length / item.perDay) ||
    typeof item.currentDay !== 'number' || !Number.isSafeInteger(item.currentDay) || item.currentDay < 1 ||
    item.currentDay > item.totalDays + 1 || typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0 ||
    (startedAt !== null && (typeof startedAt !== 'string' || !Number.isFinite(Date.parse(startedAt)))) ||
    typeof item.createdAt !== 'string' || !item.createdAt) throw new Error('Lộ trình không hợp lệ.');
  const kanjiList = item.kanjiList as string[], perDay = item.perDay, totalDays = item.totalDays;
  const memberIds = new Set(kanjiList.map(character => kanjiIds.get(character)));
  if (!assessments || typeof assessments !== 'object' || Array.isArray(assessments) ||
    Object.entries(assessments).some(([id, value]) => !memberIds.has(id) || typeof value !== 'boolean') ||
    !Array.isArray(completedDays) || completedDays.some(day => !Number.isSafeInteger(day) || day < 1 || day > totalDays) ||
    new Set(completedDays).size !== completedDays.length ||
    typeof progressVersion !== 'number' || !Number.isSafeInteger(progressVersion) || progressVersion < 0 ||
    (startedAt === null && (Object.keys(assessments).length > 0 || completedDays.length > 0))) {
    throw new Error('Tiến độ lộ trình không hợp lệ.');
  }
  const progress = roadmapProgress(kanjiList, perDay, assessments as Record<string, boolean>, completedDays as number[], pairs);
  const assessedDays = Array.from({ length: totalDays }, (_, index) => index + 1).filter(day =>
    roadmapDayKanji(kanjiList, perDay, day).every(character => {
      const id = kanjiIds.get(character);
      return id !== undefined && Object.prototype.hasOwnProperty.call(assessments, id);
    }));
  if (assessedDays.length !== completedDays.length || assessedDays.some(day => !completedDays.includes(day)) ||
    (!legacyProgress && item.currentDay !== progress.currentDay)) throw new Error('Tiến độ lộ trình không hợp lệ.');
  return { id: item.id, name: item.name, rawKanji: item.rawKanji, kanjiList: item.kanjiList as string[],
    perDay: item.perDay, totalDays: item.totalDays, ...progress, progressVersion, version,
    startedAt, createdAt: item.createdAt };
}
function parseList(value: unknown, legacy: boolean) {
  if (!Array.isArray(value)) throw new Error('Danh sách lộ trình không hợp lệ.');
  const roadmaps = value.map(item => parseRoadmap(item, legacy));
  if (new Set(roadmaps.map(item => item.id)).size !== roadmaps.length) throw new Error('Mã lộ trình bị trùng.');
  return roadmaps;
}
function readDeviceRoadmaps(): DeviceStore {
  let serialized: string | null;
  try { serialized = localStorage.getItem(DEVICE_KEY); }
  catch { return fail('DEVICE_STORAGE_ERROR', 'Không đọc được dữ liệu lộ trình trên thiết bị. Vui lòng kiểm tra quyền lưu trữ và thử lại.'); }
  try {
    const entries: unknown = JSON.parse(serialized ?? '[]');
    return { serialized, entries: entries as DeviceEntry[], roadmaps: parseList(entries, true) };
  } catch { return fail('DEVICE_DATA_INVALID', 'Dữ liệu lộ trình trên thiết bị không hợp lệ; bản gốc vẫn được giữ.'); }
}
function writeDeviceRoadmaps(store: DeviceStore, entries: DeviceEntry[]) {
  try {
    if (localStorage.getItem(DEVICE_KEY) !== store.serialized) {
      fail('ROADMAP_CHANGED', 'Lộ trình đã thay đổi ở tab khác. Vui lòng tải lại và xem bản mới trước khi lưu.');
    }
    localStorage.setItem(DEVICE_KEY, JSON.stringify(entries));
  } catch (err) {
    if (err instanceof ApiError) throw err;
    fail('DEVICE_STORAGE_ERROR', 'Chưa lưu được lộ trình trên thiết bị. Nội dung đang nhập vẫn được giữ; hãy kiểm tra quyền hoặc dung lượng lưu trữ.');
  }
}
function validateDetails(name: string, perDay: number) {
  if (!name.trim() || name.trim().length > 100) fail('VALIDATION_ERROR', 'Tên lộ trình cần từ 1 đến 100 ký tự.');
  if (!ROADMAP_PER_DAY.includes(perDay)) fail('VALIDATION_ERROR', 'Số chữ mỗi ngày không hợp lệ.');
}
function latestRoadmap(store: DeviceStore, expected: PersonalRoadmap) {
  const latest = store.roadmaps.find(item => item.id === expected.id);
  // The full snapshot also detects changes made by an older guest tab without versions.
  if (!latest || JSON.stringify(latest) !== JSON.stringify(parseRoadmap(expected, true))) {
    fail('ROADMAP_CHANGED', 'Lộ trình đã thay đổi hoặc bị xóa ở tab khác. Vui lòng tải lại và xem bản mới trước khi lưu.');
  }
  return latest;
}
function validateStudyDay(roadmap: PersonalRoadmap, day: number) {
  const unsupported = roadmap.kanjiList.filter(character => !kanjiIds.has(character));
  if (unsupported.length) fail('UNSUPPORTED_KANJI', `Chưa có dữ liệu để học các chữ: ${unsupported.join(' ')}. Danh sách gốc vẫn được giữ.`);
  try { return roadmapDayKanji(roadmap.kanjiList, roadmap.perDay, day); }
  catch { return fail('VALIDATION_ERROR', 'Ngày học không tồn tại trong lộ trình.'); }
}
function latestStudyRoadmap(store: DeviceStore, expected: PersonalRoadmap, operation: 'start' | 'rate') {
  const latest = store.roadmaps.find(item => item.id === expected.id);
  if (!latest || latest.perDay !== expected.perDay || JSON.stringify(latest.kanjiList) !== JSON.stringify(expected.kanjiList) ||
    (operation === 'start' && latest.version !== expected.version)) {
    return fail('ROADMAP_CHANGED', 'Lộ trình đã thay đổi hoặc bị xóa ở tab khác. Vui lòng tải lại trước khi học.');
  }
  if (operation === 'rate' && (latest.progressVersion !== expected.progressVersion ||
    JSON.stringify(latest.assessments) !== JSON.stringify(expected.assessments) ||
    JSON.stringify(latest.completedDays) !== JSON.stringify(expected.completedDays) || latest.startedAt !== expected.startedAt)) {
    return fail('ROADMAP_PROGRESS_CHANGED', 'Tiến độ đã thay đổi ở tab khác. Vui lòng tải lại trước khi đánh giá tiếp.');
  }
  return latest;
}
function saveDeviceRoadmap(store: DeviceStore, roadmap: PersonalRoadmap): MutationResult {
  writeDeviceRoadmaps(store, store.entries.map(item => item.id === roadmap.id ? { ...item, ...roadmap } : item));
  return { roadmap, roadmaps: store.roadmaps.map(item => item.id === roadmap.id ? roadmap : item) };
}
function emptyState(owner: string | null): State {
  return { owner, roadmaps: [], loaded: false, loading: false, saving: false, error: '', errorCode: '' };
}

return { fail, parseRoadmap, parseList, readDeviceRoadmaps, writeDeviceRoadmaps, validateDetails, latestRoadmap, validateStudyDay, latestStudyRoadmap, saveDeviceRoadmap, emptyState, kanjiIds };
}

export function usePersonalRoadmaps(userId: string | null, authBusy: boolean) {
  const { pairs, activePairs } = useContentCatalog();
  const helpers = useMemo(() => createCatalogHelpers(pairs), [pairs]);
  const { fail, parseRoadmap, parseList, readDeviceRoadmaps, writeDeviceRoadmaps, validateDetails, latestRoadmap, validateStudyDay, latestStudyRoadmap, saveDeviceRoadmap, emptyState, kanjiIds } = helpers;
  const context = useRef({ userId, authBusy });
  const mounted = useRef(false), pending = useRef(false), revision = useRef(0);
  if (context.current.userId !== userId) { ++revision.current; pending.current = false; }
  context.current = { userId, authBusy };
  const [state, setState] = useState<State>(() => emptyState(userId));
  const current = useRef(state);
  const apply = useCallback((next: State) => { current.current = next; setState(next); }, []);
  const isCurrent = useCallback((request: number) => mounted.current && context.current.userId === userId &&
    revision.current === request, [userId]);

  const reload = useCallback(async (): Promise<PersonalRoadmap[] | undefined> => {
    if (!mounted.current || context.current.userId !== userId || context.current.authBusy || pending.current) return;
    const request = ++revision.current;
    pending.current = true;
    apply({ ...(current.current.owner === userId ? current.current : emptyState(userId)), loading: true, error: '', errorCode: '' });
    try {
      let roadmaps: PersonalRoadmap[];
      if (userId) {
        const data = await api<{ userId: string; roadmaps: unknown }>('/roadmaps');
        if (!isCurrent(request)) return;
        if (data.userId !== userId) fail('ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
        roadmaps = parseList(data.roadmaps, false);
      } else roadmaps = readDeviceRoadmaps().roadmaps;
      if (!isCurrent(request)) return;
      apply({ ...current.current, roadmaps, loaded: true, loading: false });
      return roadmaps;
    } catch (err) {
      if (isCurrent(request)) apply({ ...current.current, loading: false,
        error: err instanceof Error ? err.message : 'Chưa tải được lộ trình. Vui lòng thử lại.',
        errorCode: err instanceof ApiError ? err.code : '' });
    } finally { if (isCurrent(request)) pending.current = false; }
  }, [userId, apply, isCurrent, helpers]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++revision.current; pending.current = false; };
  }, []);
  useEffect(() => { if (!authBusy) void reload(); }, [userId, authBusy, reload]);
  useEffect(() => {
    const onFocus = () => { void reload(); };
    const onStorage = (event: StorageEvent) => {
      if (!userId && (event.key === DEVICE_KEY || event.key === null)) void reload();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('storage', onStorage); };
  }, [reload, userId]);

  const change = useCallback(async (path: string, body: Record<string, unknown>, local: (store: DeviceStore) => MutationResult) => {
    if (!mounted.current || context.current.userId !== userId || current.current.owner !== userId ||
      context.current.authBusy || pending.current || !current.current.loaded) return null;
    const request = ++revision.current;
    pending.current = true;
    apply({ ...current.current, saving: true, error: '', errorCode: '' });
    try {
      let result: MutationResult | null;
      if (userId) {
        const data = await api<{ userId: string; roadmap?: unknown; id?: string }>(path, { ...body, expectedUserId: userId });
        if (!isCurrent(request)) return null;
        if (data.userId !== userId) fail('ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
        if (path === '/roadmaps/delete') {
          if (data.id !== body.id) fail('INVALID_RESPONSE', 'Phản hồi không khớp lộ trình. Vui lòng tải lại.');
          result = { roadmaps: current.current.roadmaps.filter(item => item.id !== data.id), removed: true };
        } else {
          const roadmap = parseRoadmap(data.roadmap, false);
          if (roadmap.id !== body.id) fail('INVALID_RESPONSE', 'Phản hồi không khớp lộ trình. Vui lòng tải lại.');
          const previous = current.current.roadmaps;
          result = { roadmap, roadmaps: previous.some(item => item.id === roadmap.id)
            ? previous.map(item => item.id === roadmap.id ? roadmap : item) : [roadmap, ...previous] };
        }
      } else {
        const updateDevice = () => {
          if (!isCurrent(request) || context.current.authBusy) return null;
          return local(readDeviceRoadmaps());
        };
        // Serialize guest edits across tabs where Web Locks is available; storage is re-read inside the lock.
        result = navigator.locks ? await navigator.locks.request(DEVICE_KEY, updateDevice) : updateDevice();
      }
      if (!isCurrent(request) || !result) return null;
      apply({ ...current.current, roadmaps: result.roadmaps, saving: false });
      return result;
    } catch (err) {
      if (isCurrent(request)) apply({ ...current.current, saving: false,
        error: err instanceof Error ? err.message : 'Chưa lưu được lộ trình. Vui lòng thử lại.',
        errorCode: err instanceof ApiError ? err.code : '' });
      return null;
    } finally {
      if (isCurrent(request)) {
        pending.current = false;
        if (current.current.saving) apply({ ...current.current, saving: false });
      }
    }
  }, [userId, apply, isCurrent, helpers]);

  const create = useCallback(async (id: string, name: string, rawKanji: string, perDay: number): Promise<PersonalRoadmap | null> => {
    const result = await change('/roadmaps', { id, name, rawKanji, perDay }, store => {
      validateDetails(name, perDay);
      if (!id.trim() || rawKanji.length > MAX_ROADMAP_TEXT) fail('VALIDATION_ERROR', 'Danh sách Kanji tối đa 2.000 ký tự.');
      const { kanjiList, unsupported } = analyzeRoadmapKanji(rawKanji, activePairs);
      if (unsupported.length) fail('UNSUPPORTED_KANJI', `Chưa có dữ liệu cho: ${unsupported.join(' ')}. Hãy loại bỏ các chữ này trước khi lưu.`);
      if (!kanjiList.length) fail('VALIDATION_ERROR', 'Vui lòng nhập ít nhất một chữ Kanji có dữ liệu.');
      const existing = store.roadmaps.find(item => item.id === id);
      if (existing) {
        if (existing.name !== name.trim() || existing.rawKanji !== rawKanji || existing.perDay !== perDay) {
          fail('ROADMAP_CHANGED', 'Mã lộ trình đã được dùng cho nội dung khác. Vui lòng tải lại trước khi lưu.');
        }
        return { roadmaps: store.roadmaps, roadmap: existing };
      }
      if (store.roadmaps.length >= MAX_ROADMAPS) fail('ROADMAP_LIMIT', 'Bạn có thể lưu tối đa 100 lộ trình.');
      const roadmap: PersonalRoadmap = { id, name: name.trim(), rawKanji, kanjiList, perDay,
        totalDays: Math.ceil(kanjiList.length / perDay), currentDay: 1, assessments: {}, completedDays: [], progressVersion: 0,
        version: 1, startedAt: null, createdAt: new Date().toISOString() };
      writeDeviceRoadmaps(store, [roadmap, ...store.entries]);
      return { roadmap, roadmaps: [roadmap, ...store.roadmaps] };
    });
    return result?.roadmap ?? null;
  }, [change, helpers, pairs, activePairs]);

  const update = useCallback(async (roadmap: PersonalRoadmap, details: { name: string; perDay: number }): Promise<PersonalRoadmap | null> => {
    const result = await change('/roadmaps/update', { id: roadmap.id, version: roadmap.version, ...details }, store => {
      validateDetails(details.name, details.perDay);
      const before = latestRoadmap(store, roadmap);
      if (before.startedAt && before.perDay !== details.perDay) {
        fail('ROADMAP_STARTED', 'Lộ trình đã có tiến độ nên không thể đổi số chữ mỗi ngày.');
      }
      const saved = { ...before, name: details.name.trim(), perDay: details.perDay,
        totalDays: Math.ceil(before.kanjiList.length / details.perDay), version: before.version + 1 };
      return saveDeviceRoadmap(store, saved);
    });
    return result?.roadmap ?? null;
  }, [change, helpers, pairs, activePairs]);

  const start = useCallback(async (roadmap: PersonalRoadmap, day: number): Promise<PersonalRoadmap | null> => {
    const result = await change('/roadmaps/start', { id: roadmap.id, version: roadmap.version, day }, store => {
      const before = latestStudyRoadmap(store, roadmap, 'start');
      validateStudyDay(before, day);
      if (before.startedAt) return { roadmap: before, roadmaps: store.roadmaps };
      const saved = { ...before, startedAt: new Date().toISOString(),
        progressVersion: before.progressVersion + 1 };
      return saveDeviceRoadmap(store, saved);
    });
    return result?.roadmap ?? null;
  }, [change, helpers, pairs, activePairs]);

  const rate = useCallback(async (roadmap: PersonalRoadmap, day: number, kanjiId: string, memorized: boolean): Promise<PersonalRoadmap | null> => {
    const result = await change('/roadmaps/rate', { id: roadmap.id, progressVersion: roadmap.progressVersion, day, kanjiId, memorized }, store => {
      const before = latestStudyRoadmap(store, roadmap, 'rate');
      const dayKanji = validateStudyDay(before, day);
      if (!before.startedAt) fail('ROADMAP_NOT_STARTED', 'Hãy bấm Học ngay trước khi đánh giá chữ trong lộ trình.');
      if (typeof memorized !== 'boolean' || !dayKanji.some(character => kanjiIds.get(character) === kanjiId)) {
        fail('VALIDATION_ERROR', 'Chữ được đánh giá không thuộc ngày học này.');
      }
      const progress = assessRoadmapKanji(before.kanjiList, before.perDay, before.assessments, before.completedDays, day, kanjiId, memorized, pairs);
      return saveDeviceRoadmap(store, { ...before, ...progress, progressVersion: before.progressVersion + 1 });
    });
    return result?.roadmap ?? null;
  }, [change, helpers, pairs, activePairs]);

  const remove = useCallback(async (roadmap: PersonalRoadmap): Promise<boolean> => {
    const result = await change('/roadmaps/delete', { id: roadmap.id, version: roadmap.version }, store => {
      latestRoadmap(store, roadmap);
      writeDeviceRoadmaps(store, store.entries.filter(item => item.id !== roadmap.id));
      return { roadmaps: store.roadmaps.filter(item => item.id !== roadmap.id), removed: true };
    });
    return result?.removed ?? false;
  }, [change, helpers, pairs, activePairs]);

  const sameOwner = state.owner === userId;
  return { roadmaps: sameOwner ? state.roadmaps : [], loaded: sameOwner && state.loaded,
    loading: sameOwner && state.loading, saving: sameOwner && state.saving,
    busy: authBusy || !sameOwner || !state.loaded || state.loading || state.saving,
    error: sameOwner ? state.error : '', errorCode: sameOwner ? state.errorCode : '', reload, create, update, remove, start, rate };
}
