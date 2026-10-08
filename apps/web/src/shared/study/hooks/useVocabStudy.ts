import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@nihongo/client/api';
import { eligibleWords, isStudyAnswerCorrect, shuffleStudyWords,
  type StudyAnswer, type StudyKind, type StudyMode, type StudyResult, type StudyWord } from '@nihongo/shared/study/vocab-study';

export type StudyLeaveState = 'ready' | 'dirty' | 'saving';

type Options = {
  lessonId:string; lessonName:string; lessonVersion:number; words:StudyWord[];
  userId:string|null; authBusy:boolean; kind:StudyKind; initialMode:StudyMode;
  studyScope?:'personal'|'catalog'|'curriculum-review'; onSaved?:()=>void;
};
type ContextResponse = {
  userId:string; lesson:{id:string; name:string; words:StudyWord[]; version:number}; result:StudyResult|null;
};
type State = {
  owner:string; mode:StudyMode; words:StudyWord[]; deck:StudyWord[]; lessonName:string; lessonVersion:number;
  roundId:string; index:number; answers:Record<string,StudyAnswer>;
  loaded:boolean; loading:boolean; saving:boolean; error:string; errorCode:string;
  result:StudyResult|null; completionPending:boolean;
};

function validResult(result:StudyResult, lessonId:string, kind:StudyKind, limit:number) {
  if (!result || result.lessonId !== lessonId || result.kind !== kind || !result.id ||
    !(kind === 'quiz' ? ['reading','kanji','meaning'] : ['reading','hanViet']).includes(result.mode) ||
    !Number.isInteger(result.total) || result.total < 1 || result.total > limit ||
    !Number.isInteger(result.correct) || result.correct < 0 || result.correct > result.total ||
    !Array.isArray(result.answers) || result.answers.length !== result.total) {
    throw new Error('Phản hồi kết quả không hợp lệ. Vui lòng thử lại.');
  }
  return result;
}

export function useVocabStudy(options:Options) {
  const {lessonId, userId, kind, initialMode, authBusy, studyScope = 'personal'} = options;
  const owner = JSON.stringify([studyScope, userId, lessonId, kind]);
  const endpoint = studyScope === 'curriculum-review' ? '/curriculum/review-sets/results' : studyScope === 'catalog' ? '/curriculum/results' : '/vocab/results';
  const resultLimit = studyScope === 'curriculum-review' ? 5000 : 500;
  const savedCallback = useRef(options.onSaved);
  savedCallback.current = options.onSaved;
  const context = useRef({...options, owner});
  const mounted = useRef(false), pending = useRef(false), revision = useRef(0);
  const loadIntent = useRef<{mode?:StudyMode;resume:boolean}>({resume:true});
  if (context.current.owner !== owner) { revision.current++; pending.current = false; }
  context.current = {...options, owner};
  const [state, setState] = useState<State>(() => ({owner, mode:initialMode,
    words:[], deck:[], lessonName:options.lessonName, lessonVersion:options.lessonVersion,
    roundId:'', index:0, answers:{}, loaded:false, loading:false, saving:false,
    error:'', errorCode:'', result:null, completionPending:false,
  }));
  const current = useRef(state);
  const apply = useCallback((next:State) => { current.current = next; setState(next); }, []);
  const isCurrent = useCallback((request:number) => mounted.current && context.current.owner === owner && revision.current === request, [owner]);
  const canAct = useCallback(() => mounted.current && context.current.owner === owner &&
    current.current.owner === owner && !context.current.authBusy && !pending.current &&
    current.current.loaded && !current.current.error && !current.current.completionPending && !current.current.result, [owner]);

  const load = useCallback(async (nextMode?:StudyMode, resumeResult = false) => {
    if (!mounted.current || context.current.owner !== owner || context.current.authBusy || pending.current) return;
    loadIntent.current = {mode:nextMode, resume:resumeResult};
    const request = ++revision.current;
    pending.current = true;
    apply({...current.current, loading:true, error:'', errorCode:''});
    try {
      const data:ContextResponse = userId
        ? await api<ContextResponse>(`${endpoint}?lessonId=${encodeURIComponent(lessonId)}&kind=${kind}`)
        : {userId:'', lesson:{id:lessonId, name:context.current.lessonName, words:context.current.words, version:context.current.lessonVersion}, result:null};
      if (!isCurrent(request)) return;
      if ((userId && data.userId !== userId) || data.lesson?.id !== lessonId || !Array.isArray(data.lesson.words) || !Number.isInteger(data.lesson.version)) {
        throw new Error('Tài khoản hoặc bài học đã thay đổi. Vui lòng tải lại trang.');
      }
      const result = resumeResult && data.result ? validResult(data.result, lessonId, kind, resultLimit) : null;
      const mode = result?.mode ?? nextMode ?? initialMode;
      const eligible = eligibleWords(data.lesson.words, kind, mode);
      const deck = kind === 'quiz' ? shuffleStudyWords(eligible) : eligible;
      apply({owner, mode, words:data.lesson.words, deck, lessonName:data.lesson.name, lessonVersion:data.lesson.version,
        roundId:result?.id ?? crypto.randomUUID(), index:result ? Math.max(0, result.total - 1) : 0,
        answers:{}, loaded:true, loading:false, saving:false, error:'', errorCode:'', result, completionPending:false});
    } catch (err) {
      if (isCurrent(request)) apply({...current.current, loading:false,
        error:err instanceof Error ? err.message : 'Chưa tải được lượt học. Vui lòng thử lại.',
        errorCode:err instanceof ApiError ? err.code : ''});
    } finally { if (isCurrent(request)) pending.current = false; }
  }, [owner, userId, lessonId, kind, initialMode, endpoint, resultLimit, apply, isCurrent]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; revision.current++; pending.current = false; };
  }, []);
  useEffect(() => {
    // Checking the same account on tab focus pauses actions, not the round itself.
    if (!authBusy && (!current.current.loaded || current.current.owner !== owner) && !pending.current) void load(undefined, true);
  }, [authBusy, owner, load]);

  const save = useCallback(async () => {
    const before = current.current;
    if (!mounted.current || context.current.owner !== owner || before.owner !== owner || context.current.authBusy ||
      pending.current || !before.completionPending || before.result) return;
    const request = ++revision.current;
    pending.current = true;
    apply({...before, saving:true, error:'', errorCode:''});
    try {
      const answers = before.deck.map(word => before.answers[word.id]);
      let result:StudyResult;
      if (userId) {
        const data = await api<{userId:string;result:StudyResult}>(endpoint, {
          id:before.roundId, expectedUserId:userId, lessonId, lessonVersion:before.lessonVersion, kind, mode:before.mode,
          answers:answers.map(({wordId, answer}) => ({wordId, answer})),
        });
        if (data.userId !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại trang.');
        result = validResult(data.result, lessonId, kind, resultLimit);
        if (result.id !== before.roundId || result.mode !== before.mode || result.total !== before.deck.length) {
          throw new Error('Phản hồi không khớp lượt học. Vui lòng thử lưu lại.');
        }
      } else {
        result = {id:before.roundId, lessonId, lessonName:before.lessonName, lessonVersion:before.lessonVersion,
          kind, mode:before.mode, total:answers.length, correct:answers.filter(answer => answer.correct).length,
          completedAt:new Date().toISOString(), answers};
      }
      if (isCurrent(request)) {
        apply({...current.current, result, completionPending:false, saving:false});
        savedCallback.current?.();
      }
    } catch (err) {
      if (isCurrent(request)) apply({...current.current, saving:false,
        error:err instanceof Error ? err.message : 'Chưa lưu được kết quả. Vui lòng thử lại.',
        errorCode:err instanceof ApiError ? err.code : ''});
    } finally { if (isCurrent(request)) pending.current = false; }
  }, [owner, userId, lessonId, kind, endpoint, resultLimit, apply, isCurrent]);

  const answer = useCallback((wordId:string, text:string|null):boolean|null => {
    const before = current.current, word = before.deck[before.index];
    if (!canAct() || !word || word.id !== wordId || Object.prototype.hasOwnProperty.call(before.answers, wordId) ||
      (text !== null && text.length > (studyScope === 'personal' ? 500 : 2000))) return null;
    const correct = isStudyAnswerCorrect(word, kind, before.mode, text);
    apply({...before, answers:{...before.answers, [wordId]:{wordId, answer:text, correct}}});
    return correct;
  }, [canAct, kind, studyScope, apply]);

  const next = useCallback((wordId:string) => {
    const before = current.current;
    if (!canAct() || before.deck[before.index]?.id !== wordId || !Object.prototype.hasOwnProperty.call(before.answers, wordId)) return;
    if (before.index < before.deck.length - 1) apply({...before, index:before.index + 1});
    else if (before.deck.every(word => Object.prototype.hasOwnProperty.call(before.answers, word.id))) {
      apply({...before, completionPending:true});
      void save();
    }
  }, [canAct, apply, save]);

  const start = useCallback(async (mode?:StudyMode) => {
    await load(mode ?? current.current.mode);
  }, [load]);
  const retry = useCallback(async () => {
    if (current.current.completionPending) await save();
    else await load(loadIntent.current.mode, loadIntent.current.resume);
  }, [save, load]);
  const requestExit = useCallback(() => {
    if (context.current.owner !== owner || pending.current) return false;
    if (!current.current.completionPending) return true;
    // Catalog navigation owns its page dialog; do not open a second system prompt.
    return studyScope === 'personal' && window.confirm('Kết quả lượt này chưa được lưu. Thoát sẽ mất phần chưa lưu. Bạn vẫn muốn thoát?');
  }, [owner, studyScope]);
  const getLeaveState = useCallback((): StudyLeaveState => {
    if (context.current.owner !== owner || pending.current || current.current.saving) return 'saving';
    if (current.current.completionPending || (!current.current.result && Object.keys(current.current.answers).length > 0)) return 'dirty';
    return 'ready';
  }, [owner]);

  const sameOwner = state.owner === owner;
  return {mode:state.mode, deck:sameOwner ? state.deck : [], currentWord:sameOwner && !state.result ? state.deck[state.index] ?? null : null,
    index:state.index, score:state.result?.correct ?? Object.values(state.answers).filter(answer => answer.correct).length,
    total:state.result?.total ?? state.deck.length, skipped:state.words.length - state.deck.length,
    roundId:state.roundId, answers:sameOwner ? state.answers : {},
    loaded:sameOwner && state.loaded, loading:state.loading, saving:state.saving,
    busy:authBusy || !sameOwner || !state.loaded || state.loading || state.saving || state.completionPending,
    error:state.error, errorCode:state.errorCode, finished:sameOwner && !!state.result, completionPending:state.completionPending,
    canAct, answer, next, start, retry, requestExit, getLeaveState,
  };
}
