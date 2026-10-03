import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, Route, Routes, useBlocker, useLocation, useNavigate, useParams, useSearchParams, type BlockerFunction } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronRight, FileText, Headphones, Layers, List, Search, Star, Target, Volume2, Zap } from 'lucide-react';
import { RoughCard, RoughButton } from '../components/RoughCard';
import { ReviewStar } from '../components/ReviewStar';
import { FlashcardStudy } from '../components/chudong/FlashcardStudy';
import { QuizStudy } from '../components/chudong/QuizStudy';
import { CramStudy } from '../components/chudong/CramStudy';
import { CurriculumReviewPicker } from '../components/curriculum/CurriculumReviewPicker';
import { useCurriculum } from '../hooks/useCurriculum';
import { useReview } from '../hooks/useReview';
import { useLearningSettings } from '../hooks/useLearningSettings';
import type { StudyLeaveState } from '../hooks/useVocabStudy';
import { api } from '../utils/api';
import { speakJapanese, cancelJapaneseSpeech } from '../utils/speech';
import { curriculumPath, curriculumLessonPath, curriculumReviewPath, curriculumSource, type CurriculumReviewSet, type CurriculumSummary, type CurriculumOutline, type CurriculumLesson, type CurriculumWord } from '../utils/curriculum';

type Props = { userId: string | null; authBusy: boolean };
type StudyMode = 'flashcard' | 'quiz' | 'cram';
const base = '/tu-vung/giao-trinh';
const levelColors: Record<string, string> = {N5:'#0094ff',N4:'#10b981',N3:'#f59e0b',N2:'#ea580c',N1:'#dc2626',SE:'#292524'};
const levelTitles: Record<string, string> = {N5:'Trình độ sơ cấp',N4:'Trình độ sơ cấp',N3:'Trình độ trung cấp',N2:'Trình độ cao cấp',N1:'Trình độ siêu cấp',SE:'Software Engineer'};

function LoadNotice({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  return <>{loading && <p role="status" className="py-4 text-sm text-stone-500">Đang tải giáo trình…</p>}{error && <div role="alert" className="my-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error} <button className="font-bold underline" onClick={retry}>Tải lại</button></div>}</>;
}

function CurriculumLeaveDialog({state,onCancel,onConfirm}: {state:StudyLeaveState;onCancel:()=>void;onConfirm:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  },[]);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onCancel();}}
    className="w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-600 bg-[#232d4b] p-5 text-slate-100 shadow-2xl backdrop:bg-black/60">
    <h2 id={titleId} className="text-lg font-bold">{state==='saving'?'Đang lưu lượt học…':'Rời lượt học hiện tại?'}</h2>
    <p className="mt-3 text-sm leading-6 text-slate-300">{state==='saving'?'Vui lòng đợi thao tác hiện tại kết thúc trước khi chuyển bài hoặc chế độ.':state==='dirty'?'Phần trả lời trong lượt này chưa được lưu. Bạn có thể ở lại để tiếp tục học hoặc thử lưu lại. Nếu rời đi, phần chưa lưu sẽ bị bỏ; kết quả đã lưu vẫn được giữ.':'Thao tác đã kết thúc. Bạn có thể tiếp tục chuyển trang hoặc ở lại bài học.'}</p>
    <div className="mt-5 flex justify-end gap-3"><button autoFocus onClick={onCancel} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-600">Ở lại bài học</button><button disabled={state==='saving'} onClick={onConfirm} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-500 disabled:opacity-50">{state==='dirty'?'Bỏ phần chưa lưu và tiếp tục':'Tiếp tục'}</button></div>
  </dialog>;
}

export function CurriculumPage(props: Props) {
  return <Routes>
    <Route index element={<CurriculumList {...props} />} />
    <Route path=":slug" element={<CurriculumCoursePage {...props} />} />
    <Route path=":slug/bai/:lessonId" element={<CurriculumCoursePage {...props} />} />
    <Route path=":slug/review/:reviewId" element={<CurriculumCoursePage {...props} />} />
    <Route path="*" element={<div className="p-8"><p>Không tìm thấy trang giáo trình.</p><Link to={base} className="text-blue-600 underline">Về giáo trình</Link></div>} />
  </Routes>;
}

function CurriculumList({userId, authBusy}: Props) {
  const store = useCurriculum<{courses: CurriculumSummary[]}>('/curriculum/courses',userId,authBusy);
  return <div className="mx-auto min-h-full w-full max-w-5xl space-y-8 bg-sketch-paper p-4 md:p-8">
    <div className="space-y-2"><h1 className="flex flex-wrap items-center gap-2 font-sketch text-2xl font-black text-[#292524] md:text-3xl"><span className="rounded-lg border border-[#292524] bg-[#0094ff] px-2.5 py-0.5 text-white">Học Bản Chất</span><span>–</span><span className="underline decoration-amber-400 decoration-4 underline-offset-4">Không Học Vẹt</span></h1><div className="space-y-1 text-xs font-bold text-[#57534e] md:text-sm"><p>Không chỉ là nghĩa của từ mà là cách dùng đúng của từ trong câu ví dụ.</p><p className="text-[#78716c]">Website này sẽ giúp bạn nắm được Kanji, âm Hán Việt, Accent của từ vựng và ghi nhớ lâu bằng flashcard (Spaced Repetition).</p></div></div>
    <LoadNotice {...store} retry={() => void store.reload()} />
    {!store.loading && !store.error && store.data?.courses.length === 0 && <RoughCard className="p-7 text-center text-stone-600"><BookOpen className="mx-auto mb-3" /><p>Chưa có giáo trình được xuất bản.</p><p className="mt-2 text-sm">Các chủ đề, bài học và từ vựng sẽ xuất hiện tại đây khi nội dung đã sẵn sàng.</p></RoughCard>}
    {['N5','N4','N3','N2','N1','SE'].map(level => {
      const courses = store.data?.courses.filter(item => item.level === level) ?? [];
      if (!courses.length) return null;
      return <section key={level} className="space-y-3"><div className="flex items-center gap-2"><div className="h-7 w-1.5 rounded-full" style={{backgroundColor:levelColors[level]}} /><div><h2 className="text-base font-black leading-tight">{level}</h2><p className="text-[11px] font-bold text-stone-500">{levelTitles[level]}</p></div></div><div className="grid gap-4 md:grid-cols-2">{courses.map(course => <CurriculumCover key={course.id} course={course} />)}</div></section>;
    })}
  </div>;
}

function CurriculumCover({course}: {course: CurriculumSummary}) {
  const tango = course.style === 'tango', color = levelColors[course.level];
  const fill = tango ? ({N5:'#ffd166',N4:'#c084fc',N3:'#10b981',N2:'#fb7185',N1:'#38bdf8',SE:'#ffffff'}[course.level]) : '#ffffff';
  return <Link to={curriculumPath(course.slug)} className="group block focus-visible:outline-blue-500"><RoughCard fill={fill} stroke={tango ? '#b45309' : '#78716c'} borderRadius={14} roughness={0.7} className="flex min-h-[145px] flex-col justify-between p-5 shadow-sketch transition-transform group-hover:scale-[1.015]"><div className="flex items-center gap-3">{course.style === 'mimikara' && <Headphones className="h-8 w-8 text-emerald-600" />}<div><p className="text-xs font-bold text-stone-600">{course.subtitle}</p><h3 className="font-kanji text-2xl font-black">{course.title}</h3></div></div><div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-500/20 pt-2 text-xs"><span className="shrink-0 font-black" style={{color:tango ? '#292524' : color}}>{course.wordCount} từ vựng</span><span className="text-right text-stone-600">{course.topicCount} chủ đề · {course.lessonCount} bài</span></div>{course.description && <p className="mt-2 text-[11px] text-stone-600">{course.description}</p>}</RoughCard></Link>;
}

function CurriculumCoursePage({userId,authBusy}: Props) {
  const {slug = '',lessonId,reviewId} = useParams();
  const navigate = useNavigate();
  const [selecting,setSelecting] = useState(false), [creatingReview,setCreatingReview] = useState(false), [reviewError,setReviewError] = useState('');
  const reviewLock=useRef(false), live=useRef(false);
  const reviewContext=useRef('');
  reviewContext.current=JSON.stringify([userId,slug,lessonId,reviewId]);
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  const courseStore = useCurriculum<{course: CurriculumOutline}>(`/curriculum/courses/${encodeURIComponent(slug)}`,userId,authBusy);
  const course = courseStore.data?.course;
  const progress = useCurriculum<{completedLessonIds: string[]}>(userId && course ? `/curriculum/progress/course?courseId=${course.id}` : null,userId,authBusy);
  const [guestCompleted,setGuestCompleted] = useState<string[]>([]);
  const completed = new Set(userId ? progress.data?.completedLessonIds ?? [] : guestCompleted);
  const onSaved = useCallback(() => { if (userId) void progress.reload(); },[userId,progress.reload]);
  const onCompletion = useCallback(() => {
    if (userId) void progress.reload();
    else if (lessonId) setGuestCompleted(old => old.includes(lessonId) ? old : [...old,lessonId]);
  },[userId,lessonId,progress.reload]);
  const startReview = async (lessonIds:string[]) => {
    if (!course || authBusy || reviewLock.current) return;
    if (!userId) {
      setSelecting(false);
      navigate(curriculumReviewPath(course.slug,'guest'),{state:{lessonIds}});
      return;
    }
    reviewLock.current=true;setCreatingReview(true);setReviewError('');
    const requestContext=reviewContext.current;
    try {
      const result=await api<{userId:string;reviewSet:CurriculumReviewSet}>('/curriculum/review-sets',{courseId:course.id,lessonIds,expectedUserId:userId});
      if(!live.current||reviewContext.current!==requestContext)return;
      if(result.userId!==userId||result.reviewSet.courseId!==course.id)throw new Error('Tài khoản hoặc giáo trình đã thay đổi. Vui lòng tải lại.');
      setSelecting(false);navigate(curriculumReviewPath(course.slug,result.reviewSet.id));
    } catch(error){if(live.current&&reviewContext.current===requestContext)setReviewError(error instanceof Error?error.message:'Chưa tạo được bài Review.');}
    finally{reviewLock.current=false;if(live.current)setCreatingReview(false);}
  };
  if (!course) return <div className="mx-auto max-w-6xl p-5 md:p-8"><Link to={base} className="text-sm text-blue-600">← Quay lại</Link><LoadNotice {...courseStore} retry={() => void courseStore.reload()} /></div>;
  return <div className={`mx-auto min-h-full w-full p-4 md:p-7 ${lessonId ? 'max-w-[1280px]' : 'max-w-5xl'}`}>
    {courseStore.error && <LoadNotice loading={false} error={courseStore.error} retry={() => void courseStore.reload()} />}
    {progress.error && <LoadNotice loading={false} error={progress.error} retry={() => void progress.reload()} />}
    {lessonId || reviewId ? <CurriculumLessonPage key={`${userId ?? 'guest'}:${reviewId ? 'review:' : 'lesson:'}${reviewId ?? lessonId}`} {...{userId,authBusy,course,completed}} lessonId={(reviewId ?? lessonId)!} combined={!!reviewId} onSaved={reviewId ? undefined : onSaved} onCompletion={reviewId ? undefined : onCompletion} /> : <>
      <Link to={base} className="mb-4 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600"><ArrowLeft size={13} />Quay lại</Link>
      <h1 className="flex items-center gap-2 text-2xl font-black"><BookOpen size={28} />{course.title}</h1><p className="mb-5 mt-2 text-xs text-slate-500">{course.topicCount} chủ đề</p>
      <CourseProgress course={course} completed={completed} />
      <div className="my-5 space-y-3">{course.topics.map(topic => <TopicAccordion key={topic.id} topic={topic} course={course} completed={completed} />)}</div>
      <RoughButton disabled={authBusy||creatingReview} onClick={()=>{setReviewError('');setSelecting(true);}} className="flex w-full items-center justify-center gap-2 p-3 text-xs font-bold text-blue-600"><BookOpen size={14} />Review</RoughButton>
      {selecting&&<CurriculumReviewPicker course={course} busy={creatingReview} error={reviewError} onClose={()=>{if(!reviewLock.current)setSelecting(false);}} onStart={ids=>void startReview(ids)} />}
    </>}
  </div>;
}

function CourseProgress({course,completed}: {course: CurriculumOutline; completed: Set<string>}) {
  const count = course.topics.flatMap(topic => topic.lessons).filter(lesson => completed.has(lesson.id)).length;
  const percentage = course.lessonCount ? Math.round(count / course.lessonCount * 100) : 0;
  return <RoughCard className="space-y-2 p-4"><div className="flex justify-between text-xs text-slate-600"><span>Tiến độ học</span><span>{count}/{course.lessonCount} bài</span></div><div role="progressbar" aria-label="Tiến độ giáo trình" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded bg-slate-100"><div className="h-full bg-blue-500 transition-all" style={{width:`${percentage}%`}} /></div><p className="text-right text-[10px] text-slate-500">{percentage}% hoàn thành</p></RoughCard>;
}

function TopicAccordion({topic,course,completed,currentLesson,onNavigate,compact=false}: {topic: CurriculumOutline['topics'][number];course:CurriculumOutline;completed:Set<string>;currentLesson?:string;onNavigate?:(path:string)=>void;compact?:boolean}) {
  const [open,setOpen] = useState(topic.lessons.some(lesson => lesson.id === currentLesson));
  const contents = <><button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className={`flex w-full items-center gap-2 text-left ${compact ? 'py-3 text-xs' : `px-5 py-4 ${open ? 'bg-blue-50' : ''}`}`}><span className={`font-japanese ${compact ? '' : 'text-lg'}`}>{topic.japanese || topic.title}</span>{topic.japanese && <span className="text-xs text-slate-600">{topic.title}</span>}{!compact && <span className="text-[10px] text-slate-400">({topic.lessons.length} bài)</span>}{open ? <ChevronDown size={14} className="ml-auto shrink-0 text-slate-400" /> : <ChevronRight size={14} className="ml-auto shrink-0 text-slate-400" />}</button>{open && <div className={compact ? 'grid grid-cols-2 gap-2 pb-3' : 'border-t border-slate-200 bg-slate-50/80'}>{topic.lessons.map(lesson => {
    const inner = <><span className={`flex items-center gap-2 ${compact ? 'justify-center' : ''}`}>{!compact && <FileText size={14} className="text-slate-400" />}{completed.has(lesson.id) && <Check size={13} className="shrink-0 text-green-500" />}<span>{lesson.title}</span></span><span className="shrink-0 text-[10px] font-normal text-slate-400">{lesson.wordCount} từ</span></>;
    const className = compact ? `flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[11px] font-bold ${currentLesson === lesson.id ? 'text-blue-600' : 'text-slate-700'}` : 'flex w-full items-center justify-between gap-3 border-b border-slate-200/50 px-6 py-3 text-left text-xs text-slate-700 hover:bg-blue-50';
    const link = onNavigate ? <button type="button" aria-current={currentLesson === lesson.id ? 'page' : undefined} className={className} onClick={() => onNavigate(curriculumLessonPath(course.slug,lesson.id))}>{inner}</button> : <Link className={className} to={curriculumLessonPath(course.slug,lesson.id)}>{inner}</Link>;
    return compact ? <RoughCard key={lesson.id} fill={currentLesson === lesson.id ? '#eff6ff' : '#fffdf6'} stroke={currentLesson === lesson.id ? '#60a5fa' : '#78716c'} borderRadius={8}>{link}</RoughCard> : <div key={lesson.id}>{link}</div>;
  })}{topic.lessons.length === 0 && <p className="p-4 text-xs text-slate-500">Chưa có bài học.</p>}</div>}</>;
  return compact ? <div>{contents}</div> : <RoughCard fill="#ffffff" className="overflow-hidden" borderRadius={9}>{contents}</RoughCard>;
}

function CurriculumLessonPage({course,lessonId,userId,authBusy,completed,onSaved,onCompletion,combined=false}: Props & {course:CurriculumOutline;lessonId:string;completed:Set<string>;onSaved?:()=>void;onCompletion?:()=>void;combined?:boolean}) {
  const location=useLocation();
  const guestIds=combined&&lessonId==='guest'&&Array.isArray(location.state?.lessonIds) ? location.state.lessonIds.filter((id:unknown):id is string=>typeof id==='string') : null;
  const canLoad=!combined||lessonId!=='guest'||!!guestIds?.length;
  const path=!combined ? `/curriculum/courses/${encodeURIComponent(course.slug)}/lessons/${encodeURIComponent(lessonId)}` : lessonId==='guest' ? `/curriculum/courses/${encodeURIComponent(course.slug)}/review-preview` : `/curriculum/review-sets/${encodeURIComponent(lessonId)}`;
  const store = useCurriculum<{lesson?:CurriculumLesson;reviewSet?:CurriculumReviewSet}>(canLoad?path:null,userId,authBusy,combined&&lessonId==='guest'?{lessonIds:guestIds}:undefined);
  const [wordLimit,setWordLimit]=useState(50);
  const [search,setSearch] = useState(''), [fullscreen,setFullscreen] = useState(false), [bulkBusy,setBulkBusy] = useState(false), [bulkError,setBulkError] = useState(''), [bulkNotice,setBulkNotice] = useState('');
  const [params,setParams] = useSearchParams();
  const mode:StudyMode = params.get('mode') === 'quiz' ? 'quiz' : params.get('mode') === 'cram' ? 'cram' : 'flashcard';
  const settings = useLearningSettings(), [furigana,setFurigana] = useState<boolean|null>(null);
  const furiganaMode = furigana === null ? settings.showFurigana : furigana ? 'always' : 'never';
  const navigate = useNavigate(), review = useReview(), exitState = useRef<(()=>StudyLeaveState)|null>(null), mounted = useRef(true), bulkLock = useRef(false);
  const [leaveState,setLeaveState] = useState<StudyLeaveState>('ready');
  const onExitStateChange = useCallback((next:(()=>StudyLeaveState)|null) => { exitState.current=next; setLeaveState(next?.()??'ready'); },[]);
  const readLeaveState = useCallback(():StudyLeaveState=>bulkLock.current?'saving':exitState.current?.()??'ready',[]);
  const blocker = useBlocker(useCallback<BlockerFunction>(({currentLocation,nextLocation}) =>
    (currentLocation.pathname!==nextLocation.pathname || currentLocation.search!==nextLocation.search || currentLocation.hash!==nextLocation.hash) && readLeaveState()!=='ready', [readLeaveState]));
  const move = (path:string) => navigate(path);
  const changeMode = (next:StudyMode) => { if (next===mode) return; setParams(previous=>{const p=new URLSearchParams(previous);p.set('mode',next);return p;},{state:location.state}); };
  useEffect(()=>{setFullscreen(false);cancelJapaneseSpeech();},[mode]);
  useEffect(()=>{
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(readLeaveState()!=='ready'){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',beforeUnload);
    return()=>window.removeEventListener('beforeunload',beforeUnload);
  },[readLeaveState]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cancelJapaneseSpeech(); }; },[]);
  const loadedLesson = combined ? store.data?.reviewSet : store.data?.lesson;
  const matchingCourse=!loadedLesson || loadedLesson.courseId===course.id;
  const lesson=matchingCourse ? loadedLesson : undefined;
  const guestReview=combined&&lessonId==='guest';
  const topic = combined ? undefined : course.topics.find(item => item.id === store.data?.lesson?.topicId);
  const addAll = async () => {
    if (!userId) { review.onLogin(); return; }
    if (guestReview) { setBulkError('Đây là lượt học khách. Quay lại giáo trình và chọn bài Review bằng tài khoản để lưu riêng.'); return; }
    if (!lesson || bulkLock.current || review.busy || authBusy) return;
    bulkLock.current = true; setBulkBusy(true); setBulkError(''); setBulkNotice('');
    try {
      const result = await api<{userId:string;count:number}>(combined?'/curriculum/review-sets/star-lesson':'/curriculum/star-lesson',{lessonId:lesson.id,lessonVersion:lesson.version,expectedUserId:userId});
      if (!mounted.current) return;
      if (result.userId !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại.');
      await review.reload();
      if (mounted.current) setBulkNotice(`Đã thêm ${result.count} từ vào ôn tập. Các thẻ đã có giữ nguyên lịch ôn.`);
    } catch(error) { if (mounted.current) setBulkError(error instanceof Error ? error.message : 'Chưa thêm được bài vào ôn tập.'); }
    finally { bulkLock.current = false; if (mounted.current) setBulkBusy(false); }
  };
  const studyProps = lesson ? {words:lesson.words,lessonId:lesson.id,lessonVersion:lesson.version,userId:guestReview?null:userId,authBusy,lessonName:lesson.name,onExit:()=>{setFullscreen(false);requestAnimationFrame(()=>document.getElementById('curriculum-words')?.scrollIntoView({behavior:'smooth'}));},isFullscreen:fullscreen,onToggleFullscreen:()=>setFullscreen(value=>!value),studyScope:combined?'curriculum-review' as const:'catalog' as const,embedded:true,onSaved,onCompletion,onExitStateChange} : null;
  const words = lesson?.words.filter(word => [word.word,word.reading,word.meaning,word.hanViet].some(value => value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))) ?? [];
  return <div className={`grid items-start gap-6 ${combined?'':'lg:grid-cols-[minmax(0,1fr)_230px]'}`}>
    {blocker.state==='blocked'&&<CurriculumLeaveDialog state={bulkBusy?'saving':leaveState} onCancel={()=>blocker.reset()} onConfirm={()=>{const state=readLeaveState();setLeaveState(state);if(state==='saving')return;cancelJapaneseSpeech();blocker.proceed();}} />}
    <div className="min-w-0"><button className="mb-3 inline-flex items-center gap-1 text-xs text-blue-600" onClick={() => move(curriculumPath(course.slug))}><ArrowLeft size={14} />Quay lại</button><div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-black">{course.title}{combined ? ` - Review${store.data?.reviewSet ? ` · ${store.data.reviewSet.lessonCount} bài` : ''}` : lesson ? ` - ${lesson.name}` : ''}</h1>{topic && <p className="mt-2 text-xs text-slate-500"><span className="font-japanese">{topic.japanese}</span>{topic.japanese && ' - '}{topic.title}</p>}</div><RoughButton className="flex items-center gap-1 px-3 py-2 text-xs text-blue-700" aria-pressed={furiganaMode !== 'never'} onClick={() => setFurigana(furiganaMode === 'never')}>漢 Furigana</RoughButton></div>
      <LoadNotice {...store} retry={() => void store.reload()} />
      {(!canLoad||!matchingCourse)&&<p role="alert" className="mb-5 text-sm text-red-700">Bài Review không thuộc giáo trình này hoặc chưa chọn bài. Hãy quay lại giáo trình và chọn các bài cần ôn.</p>}
      {studyProps && !store.error && <>
        <RoughCard fill="#2d3755" stroke="#a8a29e" borderRadius={9} className="overflow-hidden">{mode === 'flashcard' ? <FlashcardStudy key={`flashcard:${lesson!.version}`} {...studyProps} /> : mode === 'quiz' ? <QuizStudy key={`quiz:${lesson!.version}`} {...studyProps} /> : <CramStudy key={`cram:${lesson!.version}`} {...studyProps} />}</RoughCard>
        <RoughCard className="my-6 px-4 py-3 text-xs text-orange-600" fill="#fffdf6"><span aria-hidden="true">ⓘ </span>Không dùng bộ gõ tiếng Nhật với chế độ nhồi nhét</RoughCard>
        <h2 className="mb-3 font-black">Chọn chế độ học</h2><div className="mb-7 grid grid-cols-3 gap-3">{([{id:'flashcard',label:'Flashcard',Icon:Layers},{id:'quiz',label:'Trắc nghiệm',Icon:Target},{id:'cram',label:'Nhồi nhét',Icon:Zap}] as const).map(({id,label,Icon})=><RoughButton key={id} fill={mode===id?'#eff6ff':'#fffdf6'} stroke={mode===id?'#3b82f6':'#78716c'} aria-pressed={mode===id} disabled={bulkBusy} onClick={()=>changeMode(id)} className={`flex flex-col items-center gap-1 px-2 py-3 text-xs font-bold ${mode===id?'text-blue-600':'text-slate-600'}`}><Icon size={18} />{label}</RoughButton>)}</div>
        <section id="curriculum-words" className="scroll-mt-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-black">Thuật ngữ trong bài này ({lesson!.words.length})</h2><RoughButton fill="#ffd60a" stroke="#a16207" disabled={bulkBusy||review.busy||authBusy} onClick={()=>void addAll()} className="flex items-center gap-2 px-4 py-2 text-xs font-bold"><Star size={16} />{bulkBusy?'Đang thêm…':'Thêm cả bài vào ôn tập'}</RoughButton></div>
          {bulkError && <p role="alert" className="mb-3 text-sm text-red-700">{bulkError}</p>}{bulkNotice && <p role="status" className="mb-3 text-xs text-green-700">{bulkNotice}</p>}
          <label className="mb-4 flex items-center gap-2 rounded border border-stone-300 bg-white/60 px-3 py-2 text-slate-500"><Search size={16} /><input aria-label="Tìm từ trong bài" value={search} onChange={event=>{setSearch(event.target.value);setWordLimit(50);}} placeholder="Tìm từ trong bài…" className="w-full bg-transparent text-sm outline-none" /></label>
          <div data-furigana={furiganaMode} className="space-y-3">{words.slice(0,wordLimit).map(word=><CurriculumWordCard key={word.id} word={word} number={lesson!.words.findIndex(item=>item.id===word.id)+1} />)}{words.length===0&&<p className="p-5 text-sm text-slate-500">Không có từ khớp tìm kiếm.</p>}</div>
          {words.length>wordLimit&&<RoughButton className="mt-4 w-full p-3 text-xs text-blue-600" onClick={()=>setWordLimit(value=>value+50)}>Xem thêm từ ({wordLimit}/{words.length})</RoughButton>}
        </section><button className="my-6 inline-flex items-center gap-1 text-xs text-blue-600" onClick={()=>move(curriculumPath(course.slug))}><ArrowLeft size={14} />Quay lại</button>
      </>}
    </div>
    {!combined&&<aside className="min-w-0 lg:sticky lg:top-5"><h2 className="flex items-center gap-2 font-black"><List size={16} />Mục lục</h2><p className="mb-4 mt-2 flex items-center gap-2 text-xs">{course.title}<span className="rounded bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">✓ {course.topics.flatMap(item=>item.lessons).filter(item=>completed.has(item.id)).length}/{course.lessonCount}</span></p>{course.topics.map(item=><TopicAccordion key={item.id} topic={item} course={course} currentLesson={lessonId} completed={completed} compact onNavigate={move} />)}</aside>}
  </div>;
}

function CurriculumWordCard({word,number}:{word:CurriculumWord;number:number}) {
  return <RoughCard fill="#282f49" stroke="#a8a29e" borderRadius={8} className="p-5 text-slate-100"><div className="flex items-start gap-4"><div className="w-28 shrink-0 text-center sm:w-36"><p className="text-[10px] text-slate-400">{number}.</p><p className="break-words font-japanese text-2xl leading-relaxed">{word.word}</p><div className="mt-1 flex flex-wrap justify-center gap-1">{word.partOfSpeech?.map(tag=><span key={tag} className="rounded-full border border-sky-200/50 px-2 text-[10px] text-sky-200">{tag}</span>)}</div></div><div className="min-w-0 flex-1 border-l border-slate-500/50 pl-4"><p className="break-words font-japanese text-lg text-sky-200">{word.ruby?.length ? word.ruby.map((part,index)=><ruby key={index} tabIndex={part.reading?0:undefined}>{part.text}{part.reading&&<rt>{part.reading}</rt>}</ruby>) : word.reading || word.word}</p>{word.hanViet&&<p className="mt-1 text-xs text-slate-400">{word.hanViet}</p>}<p className="mt-1 whitespace-pre-wrap text-sm">{word.meaning}</p></div><div className="flex shrink-0 flex-col items-center sm:flex-row"><ReviewStar source={curriculumSource(word)} /><button aria-label={`Phát âm ${word.word}`} title="Phát âm" onClick={()=>speakJapanese(word.reading||word.word)} className="p-2 text-slate-400 hover:text-white"><Volume2 size={16} /></button></div></div>{word.exampleJp&&<div className="mt-4 border-t border-slate-500/30 pt-3"><div className="flex items-start justify-between gap-3"><p className="font-japanese text-sm leading-7">{word.exampleJp}</p><button aria-label={`Phát âm ví dụ ${word.word}`} onClick={()=>speakJapanese(word.exampleJp)} className="shrink-0 p-1 text-slate-400 hover:text-white"><Volume2 size={14} /></button></div>{word.exampleVi&&<p className="mt-1 text-xs text-slate-400">{word.exampleVi}</p>}</div>}</RoughCard>;
}
