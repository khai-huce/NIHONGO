import { ArrowLeft, BookOpen, Check, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RoughCard } from '../../../shared/ui/RoughCard';
import type { GrammarRuby, GrammarSummary } from '@nihongo/shared/contracts/grammar';
import { grammarCoursePath } from '@nihongo/shared/contracts/grammar';

export function GrammarNotice({ loading, error, reload }: { loading: boolean; error: string; reload: () => Promise<void> }) {
  return <>{loading && <p role="status" className="py-4 text-sm text-slate-500">Đang tải ngữ pháp…</p>}{error && <div role="alert" className="my-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error} <button type="button" className="font-bold underline" onClick={() => void reload()}>Tải lại</button></div>}</>;
}

export function GrammarBack({ to, children = 'Quay lại' }: { to: string; children?: React.ReactNode }) {
  return <Link to={to} className="mb-4 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><ArrowLeft size={14} />{children}</Link>;
}

export function GrammarText({ text, ruby = [] }: { text: string; ruby?: GrammarRuby }) {
  // Only display supplied annotations which describe the exact displayed sentence.
  if (!ruby.length || ruby.map(part => part.text).join('') !== text) return <>{text}</>;
  return <>{ruby.map((part, index) => part.reading ? <ruby key={index} tabIndex={0}>{part.text}<rt>{part.reading}</rt></ruby> : <span key={index}>{part.text}</span>)}</>;
}

export function GrammarProgress({ completed, total, loading = false, title = 'Tiến độ học' }: { completed: number; total: number; loading?: boolean; title?: string }) {
  const percent = total ? Math.min(100, Math.round(completed / total * 100)) : 0;
  return <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-4 shadow-sketch [&>div]:space-y-2"><div className="flex justify-between gap-3 text-xs font-bold text-[#78716c]"><span>{title}</span><span>{loading ? 'Đang tải…' : `${completed}/${total} mẫu · ${percent}%`}</span></div><div role="progressbar" aria-label={title} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-[#eae3d5]"><div className="h-full bg-[#0094ff] transition-[width]" style={{ width: `${percent}%` }} /></div></RoughCard>;
}

export function GrammarCourseCards({ courses, levels, title, subtitle }: { courses: GrammarSummary[]; levels: string[]; title: string; subtitle: string }) {
  const filtered = courses.filter(course => levels.includes(course.level));
  const fills: Record<string, string> = { N5: '#ffffff', N4: '#7ba899', N3: '#588157', N2: '#2d6a4f', N1: '#606c38' };
  return <section className="space-y-3"><div className="flex items-center gap-2"><div className={`h-6 w-1.5 rounded-full ${levels.includes('N5') ? 'bg-[#0094ff]' : 'bg-amber-600'}`} /><div><h3 className="font-sketch text-base font-black text-[#292524]">{title}</h3><p className="text-[11px] font-bold text-[#78716c]">{subtitle}</p></div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{filtered.map(course => {
    const dark = !['N5', 'N4'].includes(course.level);
    return <Link key={course.id} to={grammarCoursePath(course.slug)} className="group block focus-visible:outline-blue-500"><RoughCard fill={fills[course.level]} stroke="#292524" borderRadius={14} roughness={0.7} className={`min-h-[140px] p-5 [&>div]:flex [&>div]:flex-col [&>div]:justify-between shadow-sketch transition-transform group-hover:scale-[1.01] ${dark ? 'text-white' : 'text-[#292524]'}`}><div><h4 className={`text-xs font-bold ${dark ? 'text-white/90' : 'text-[#57534e]'}`}>{course.title}</h4><p className="font-kanji text-3xl font-black">{course.level}</p>{course.subtitle && <p className="mt-1 text-xs">{course.subtitle}</p>}</div><div className={`mt-3 flex items-center justify-between gap-2 text-xs font-bold ${dark ? 'border-t border-white/20 pt-2' : 'rounded-lg bg-[#2a9d8f] px-3 py-1.5 text-white'}`}><span>{course.lessonCount} bài học</span><span className="text-[11px] opacity-90">{course.patternCount} mẫu ngữ pháp</span></div></RoughCard></Link>;
  })}</div>{filtered.length === 0 && <RoughCard className="p-5 text-sm text-stone-500"><BookOpen size={20} className="mb-2" />Chưa có giáo trình được xuất bản.</RoughCard>}</section>;
}

export function GrammarListLink({ to, title, subtitle, count, completed = false }: { to: string; title: string; subtitle?: string; count?: string; completed?: boolean }) {
  return <Link to={to} className="block focus-visible:outline-blue-500"><RoughCard fill="#ffffff" stroke="#78716c" borderRadius={8} className="p-4 hover:bg-blue-50 [&>div]:flex [&>div]:items-center [&>div]:gap-3"><div className="min-w-0 flex-1"><p className="flex items-center gap-2 font-japanese text-base font-bold">{completed && <Check size={16} className="shrink-0 text-green-600" />}{title}</p>{subtitle && <p className="mt-1 text-xs text-slate-600">{subtitle}</p>}</div>{count && <span className="shrink-0 text-[11px] text-slate-500">{count}</span>}<ChevronRight size={16} className="shrink-0 text-slate-400" /></RoughCard></Link>;
}
