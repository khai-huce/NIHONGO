import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../utils/api';
import { KANA_CATALOG_ID, KANA_COUNT, KANA_LIST, makeKanaQuiz, gradeKanaAnswers,
  type KanaMode, type KanaQuestion, type KanaAnswer } from '../../shared/kana-quiz.mjs';

export type KanaQuizResult = {
  id: string; catalogId: string; mode: KanaMode; total: number; correct: number;
  answers: (KanaAnswer & { correct: boolean })[]; completedAt: string;
};
type State = {
  owner: string | null; loaded: boolean; loading: boolean; saving: boolean;
  error: string; errorCode: string; mode: KanaMode; roundId: string;
  deck: KanaQuestion[]; index: number; answers: KanaAnswer[];
  result: KanaQuizResult | null; completionPending: boolean;
};
const byId = new Map(KANA_LIST.map(kana => [kana.id, kana]));
const emptyState = (owner: string | null): State => ({ owner, loaded: false, loading: false, saving: false,
  error: '', errorCode: '', mode: 'hiragana', roundId: '', deck: [], index: 0, answers: [],
  result: null, completionPending: false });

function validResult(result: KanaQuizResult): KanaQuizResult {
  if (!result || !result.id || result.catalogId !== KANA_CATALOG_ID || !Number.isFinite(Date.parse(result.completedAt))) {
    throw new Error('Kết quả học không hợp lệ. Vui lòng tải lại.');
  }
  const graded = gradeKanaAnswers(result.mode, result.answers);
  if (result.total !== graded.total || result.correct !== graded.correct) throw new Error('Điểm số không khớp kết quả học. Vui lòng tải lại.');
  return { ...result, answers: graded.answers };
}

export function useKanaQuiz(userId: string | null, authBusy: boolean) {
  const [state, setState] = useState<State>(() => emptyState(userId));
  const current = useRef(state);
  const context = useRef({ userId, authBusy });
  const mounted = useRef(false), pending = useRef(false), revision = useRef(0);
  if (context.current.userId !== userId) { revision.current++; pending.current = false; }
  context.current = { userId, authBusy };
  const apply = useCallback((next: State) => { current.current = next; setState(next); }, []);
  const isCurrent = useCallback((request: number) => mounted.current && context.current.userId === userId
    && request === revision.current, [userId]);
  const canAct = useCallback(() => mounted.current && context.current.userId === userId && current.current.owner === userId
    && !context.current.authBusy && current.current.loaded && !pending.current && !current.current.error
    && !current.current.completionPending, [userId]);

  const load = useCallback(async () => {
    if (!mounted.current || context.current.userId !== userId || context.current.authBusy || pending.current) return;
    const request = ++revision.current;
    pending.current = true;
    apply({ ...emptyState(userId), loading: true });
    try {
      const data = userId ? await api<{ userId: string; result: KanaQuizResult | null }>('/kana/results') : null;
      if (!isCurrent(request)) return;
      if (data && data.userId !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại trang.');
      const result = data?.result ? validResult(data.result) : null;
      apply({ ...emptyState(userId), loaded: true, mode: result?.mode ?? 'hiragana', result });
    } catch (err) {
      if (isCurrent(request)) apply({ ...current.current, loading: false,
        error: err instanceof Error ? err.message : 'Chưa tải được kết quả học.', errorCode: err instanceof ApiError ? err.code : '' });
    } finally { if (isCurrent(request)) pending.current = false; }
  }, [userId, apply, isCurrent]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; revision.current++; pending.current = false; };
  }, []);
  useEffect(() => {
    if (!authBusy && !current.current.error && (!current.current.loaded || current.current.owner !== userId)) void load();
  }, [authBusy, userId, load]);

  const save = useCallback(async () => {
    const before = current.current;
    if (!mounted.current || context.current.userId !== userId || before.owner !== userId || context.current.authBusy
      || pending.current || !before.completionPending || before.result) return;
    const request = ++revision.current;
    pending.current = true;
    apply({ ...before, saving: true, error: '', errorCode: '' });
    try {
      let result: KanaQuizResult;
      if (userId) {
        const data = await api<{ userId: string; result: KanaQuizResult }>('/kana/results', {
          id: before.roundId, expectedUserId: userId, catalogId: KANA_CATALOG_ID, mode: before.mode, answers: before.answers,
        });
        if (data.userId !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại trang.');
        result = validResult(data.result);
        if (result.id !== before.roundId || result.mode !== before.mode
          || JSON.stringify(result.answers.map(({ kanaId, script, answerId }) => ({ kanaId, script, answerId }))) !== JSON.stringify(before.answers)) {
          throw new Error('Kết quả không khớp lượt học. Vui lòng thử lưu lại.');
        }
      } else {
        result = { id: before.roundId, catalogId: KANA_CATALOG_ID, mode: before.mode,
          ...gradeKanaAnswers(before.mode, before.answers), completedAt: new Date().toISOString() };
      }
      if (isCurrent(request)) apply({ ...current.current, saving: false, completionPending: false, result });
    } catch (err) {
      if (isCurrent(request)) apply({ ...current.current, saving: false,
        error: err instanceof Error ? err.message : 'Chưa lưu được kết quả. Vui lòng thử lại.', errorCode: err instanceof ApiError ? err.code : '' });
    } finally { if (isCurrent(request)) pending.current = false; }
  }, [userId, apply, isCurrent]);

  const start = useCallback(() => {
    if (!canAct() || (current.current.deck.length > 0 && !current.current.result)) return false;
    apply({ ...emptyState(userId), loaded: true, mode: current.current.mode,
      roundId: crypto.randomUUID(), deck: makeKanaQuiz(current.current.mode) });
    return true;
  }, [canAct, userId, apply]);
  const chooseMode = useCallback((mode: KanaMode) => {
    if (canAct() && !current.current.deck.length && !current.current.result) apply({ ...current.current, mode });
  }, [canAct, apply]);
  const chooseBoard = useCallback(() => {
    if (!canAct()) return false;
    apply({ ...emptyState(userId), loaded: true, mode: current.current.mode });
    return true;
  }, [canAct, userId, apply]);
  const answer = useCallback((kanaId: string, answerId: string) => {
    const before = current.current, question = before.deck[before.index];
    if (!canAct() || before.result || !question || question.kanaId !== kanaId || before.answers.length !== before.index
      || !question.options.includes(answerId)) return;
    const answers = [...before.answers, { kanaId, script: question.script, answerId }];
    const completionPending = answers.length === KANA_COUNT;
    apply({ ...before, answers, completionPending });
    if (completionPending) void save();
  }, [canAct, apply, save]);
  const next = useCallback((kanaId: string) => {
    const before = current.current;
    if (!canAct() || before.result || before.deck[before.index]?.kanaId !== kanaId
      || before.answers.length !== before.index + 1 || before.index >= KANA_COUNT - 1) return;
    apply({ ...before, index: before.index + 1 });
  }, [canAct, apply]);
  const retry = useCallback(() => current.current.completionPending ? save() : load(), [save, load]);

  const sameOwner = state.owner === userId;
  const question = sameOwner && !state.result ? state.deck[state.index] : undefined;
  const score = state.result?.correct ?? state.answers.filter(answer => byId.get(answer.kanaId)?.romaji === byId.get(answer.answerId)?.romaji).length;
  return { ...state, result: sameOwner ? state.result : null, question,
    started: sameOwner && (state.deck.length > 0 || !!state.result),
    score: sameOwner ? score : 0, answered: sameOwner ? state.result?.total ?? state.answers.length : 0,
    selectedAnswer: sameOwner ? state.answers[state.index] : undefined,
    busy: authBusy || !sameOwner || !state.loaded || state.loading || state.saving || state.completionPending,
    canAct, load, start, answer, next, retry, chooseMode, chooseBoard };
}
