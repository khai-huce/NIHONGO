import { useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { Activity, AlertTriangle, AlignLeft, BookOpen, Eye, PenTool, Star, Target, Volume2 } from 'lucide-react';
import { RoughButton, RoughCard } from '../../../shared/ui/RoughCard';
import { GrammarBack, GrammarListLink, GrammarNotice, GrammarProgress, GrammarText } from '../components/GrammarContent';
import { GrammarExercises } from '../components/GrammarExercises';
import { useAccountResource } from '../../../shared/hooks/useAccountResource';
import { useLearningSettings } from '../../settings/hooks/useLearningSettings';
import { useReview } from '../../review/hooks/useReview';
import { speakJapanese } from '../../../shared/audio/speech';
import { grammarCoursePath, grammarExercisePath, grammarLessonPath, grammarPatternPath, grammarSource, type GrammarOutline, type GrammarPublicPattern } from '@nihongo/shared/contracts/grammar';
import { BunpoPage } from './BunpoPage';

type Props = { userId: string | null; authBusy: boolean };

export function GrammarPage(props: Props) {
  return <Routes>
    <Route index element={<BunpoPage {...props} />} />
    <Route path="giao-trinh/:slug" element={<GrammarCoursePage {...props} />} />
    <Route path="giao-trinh/:slug/bai/:lessonId" element={<GrammarCoursePage {...props} />} />
    <Route path="mau/:id" element={<GrammarPatternPage {...props} />} />
    <Route path="mau/:id/bai-tap" element={<GrammarPatternPage {...props} exercises />} />
    <Route path="*" element={<GrammarUnavailable />} />
  </Routes>;
}

export function GrammarUnavailable() {
  return <div className="mx-auto max-w-5xl space-y-4 p-5 md:p-8"><GrammarBack to="/ngu-phap">Về kho ngữ pháp</GrammarBack><h1 className="text-xl font-bold">Chưa có nội dung ngữ pháp này</h1><p className="text-sm text-stone-600">Mẫu này chưa được xuất bản hoặc đường dẫn đã cũ. Bạn có thể chọn một giáo trình đang có trong kho.</p></div>;
}

function GrammarCoursePage({ userId, authBusy }: Props) {
  const { slug = '', lessonId } = useParams();
  const store = useAccountResource<{ course: GrammarOutline }>(`/grammar/courses/${encodeURIComponent(slug)}`, userId, authBusy);
  const progress = useAccountResource<{ completedPatternIds: string[] }>(userId ? '/grammar/progress' : null, userId, authBusy);
  const course = store.data?.course;
  const lesson = lessonId ? course?.lessons.find(item => item.id === lessonId) : undefined;
  const completed = new Set(progress.data?.completedPatternIds ?? []);
  if (course && lessonId && !lesson) return <GrammarUnavailable />;
  const patterns = lesson ? lesson.patterns : course?.lessons.flatMap(item => item.patterns) ?? [];
  return <div className="mx-auto min-h-full max-w-5xl space-y-5 p-4 md:p-8">
    <div><GrammarBack to={lessonId ? grammarCoursePath(slug) : '/ngu-phap'} /><h1 className="flex items-start gap-2 text-2xl font-black"><BookOpen size={27} className="mt-1 shrink-0" />{course ? lesson ? `${course.title} – ${lesson.title}` : course.title : 'Giáo trình ngữ pháp'}</h1>{lesson?.japanese ? <p className="mt-2 font-japanese text-sm text-slate-500">{lesson.japanese}</p> : course && <p className="mt-2 text-xs text-slate-500">{course.lessonCount} bài · {course.patternCount} mẫu ngữ pháp</p>}</div>
    <GrammarNotice {...store} />
    {course && <>
      <GrammarNotice {...progress} />
      <GrammarProgress completed={patterns.filter(pattern => completed.has(pattern.id)).length} total={patterns.length} loading={progress.loading} />
      {course.description && !lesson && <p className="whitespace-pre-wrap text-sm leading-7 text-stone-600">{course.description}</p>}
      <div className="space-y-3">{lesson ? lesson.patterns.map(pattern => <GrammarListLink key={pattern.id} to={grammarPatternPath(pattern.id)} title={pattern.pattern} subtitle={pattern.meaning} count={`${pattern.exerciseCount} câu bài tập`} completed={completed.has(pattern.id)} />) : course.lessons.map(item => <GrammarListLink key={item.id} to={grammarLessonPath(course.slug, item.id)} title={item.japanese ? `${item.japanese} – ${item.title}` : item.title} count={`${item.patterns.length} mẫu`} completed={item.patterns.length > 0 && item.patterns.every(pattern => completed.has(pattern.id))} />)}</div>
      {patterns.length === 0 && <p className="text-sm text-stone-500">Chưa có mẫu ngữ pháp trong bài này.</p>}
    </>}
  </div>;
}

function GrammarPatternPage({ userId, authBusy, exercises = false }: Props & { exercises?: boolean }) {
  const { id = '' } = useParams();
  const store = useAccountResource<{ pattern: GrammarPublicPattern }>(`/grammar/patterns/${encodeURIComponent(id)}`, userId, authBusy);
  const pattern = store.data?.pattern;
  if (!pattern) return <div className="mx-auto max-w-6xl p-5 md:p-8"><GrammarBack to="/ngu-phap" /><GrammarNotice {...store} /></div>;
  return <><GrammarNotice {...store} />{exercises ? <GrammarExercises key={`${userId ?? 'guest'}:${id}:${pattern.version}`} pattern={pattern} userId={userId} authBusy={authBusy} /> : <GrammarPatternDetail key={`${userId ?? 'guest'}:${id}:${pattern.version}`} pattern={pattern} />}</>;
}

function GrammarPatternDetail({ pattern }: { pattern: GrammarPublicPattern }) {
  const settings = useLearningSettings(), review = useReview();
  const [furigana, setFurigana] = useState<boolean | null>(null);
  const mode = furigana === null ? settings.showFurigana : furigana ? 'always' : 'never';
  const source = grammarSource(pattern);
  const starred = review.cards.some(card => card.category === 'grammar' && card.sourceId === source.sourceId && card.active);
  const sections = [
    { title: 'CẤU TRÚC', text: pattern.structure, icon: Activity, color: 'text-slate-300' },
    { title: 'GIẢI NGHĨA', text: pattern.explanation, icon: AlignLeft, color: 'text-slate-300' },
    { title: 'PHẠM VI SỬ DỤNG', text: pattern.usage, icon: Target, color: 'text-emerald-400' },
    { title: 'LƯU Ý', text: pattern.notes, icon: AlertTriangle, color: 'text-amber-400' },
  ];
  return <div className="mx-auto min-h-full max-w-6xl space-y-6 p-4 md:p-8" data-furigana={mode}>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><GrammarBack to={grammarLessonPath(pattern.courseSlug, pattern.lessonId)}>{pattern.lessonTitle}</GrammarBack><h1 className="font-japanese text-4xl font-black leading-relaxed">{pattern.pattern}</h1><p className="mt-2 text-sm text-slate-600">{pattern.meaning}</p></div><div className="flex flex-col items-end gap-2"><RoughButton className="flex items-center gap-2 px-3 py-2 text-xs text-indigo-700" aria-pressed={mode !== 'never'} onClick={() => setFurigana(mode === 'never')}><Eye size={15} /><span>漢 Furigana</span></RoughButton><Link to={grammarExercisePath(pattern.id)} className="block"><RoughCard fill="#0094ff" stroke="#292524" borderRadius={9} className="px-4 py-3 text-xs font-bold text-white [&>div]:flex [&>div]:items-center [&>div]:gap-2"><PenTool size={16} />Làm bài tập</RoughCard></Link><button type="button" disabled={review.busy} aria-pressed={starred} onClick={() => void review.toggle(source)} className={`mt-1 flex items-center gap-2 text-xs disabled:opacity-50 ${starred ? 'text-amber-600' : 'text-slate-500'} hover:text-amber-600`}><Star size={16} fill={starred ? 'currentColor' : 'none'} />{starred ? 'Đã thêm vào ghi nhớ (bỏ sao giữ lịch sử)' : 'Thêm vào ghi nhớ (lặp lại ngắt quãng)'}</button></div></div>
    <div className="grid gap-4 md:grid-cols-2">{sections.map(({ title, text, icon: Icon, color }) => <RoughCard key={title} fill="#282f49" stroke="#a8a29e" borderRadius={8} className="min-h-28 p-5 text-slate-100"><h2 className={`mb-3 flex items-center gap-2 text-xs font-black ${color}`}><Icon size={15} />{title}</h2><p className={`whitespace-pre-wrap text-sm leading-7 ${title === 'CẤU TRÚC' ? 'font-japanese' : ''}`}>{text || 'Chưa có nội dung.'}</p>{title === 'LƯU Ý' && pattern.related.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400"><span>Xem thêm:</span>{pattern.related.map(item => <Link key={item.id} to={grammarPatternPath(item.id)} className="rounded border border-slate-400/70 px-2 py-1 font-japanese text-sky-200 hover:text-white">{item.pattern}</Link>)}</div>}</RoughCard>)}</div>
    <section className="space-y-3"><h2 className="flex items-center gap-2 text-xl font-black"><span className="h-6 w-1 rounded-full bg-blue-400" />Ví dụ</h2>{pattern.examples.map((example, index) => <RoughCard key={example.id} fill="#282f49" stroke="#a8a29e" borderRadius={8} className="p-5 text-slate-100 [&>div]:flex [&>div]:items-center [&>div]:gap-4"><div className="min-w-0 flex-1"><p className="whitespace-pre-wrap font-japanese text-base font-bold leading-8"><GrammarText text={example.japanese} ruby={example.ruby} /></p><p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-300">{example.vietnamese || 'Chưa có bản dịch.'}</p></div><button type="button" className="shrink-0 p-2 text-slate-400 hover:text-white" aria-label={`Phát âm ví dụ ${index + 1}`} onClick={() => speakJapanese(example.japanese)}><Volume2 size={17} /></button></RoughCard>)}{pattern.examples.length === 0 && <p className="text-sm text-stone-500">Chưa có ví dụ.</p>}</section>
  </div>;
}
