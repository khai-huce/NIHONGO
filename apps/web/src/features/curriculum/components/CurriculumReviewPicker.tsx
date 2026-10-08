import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { RoughButton, RoughCard } from '../../../shared/ui/RoughCard';
import type { CurriculumOutline } from '@nihongo/shared/contracts/curriculum';

type Props = {
  course: CurriculumOutline;
  onClose: () => void;
  onStart: (lessonIds: string[]) => void;
  busy?: boolean;
  error?: string;
};

export function CurriculumReviewPicker({ course, onClose, onStart, busy = false, error = '' }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId(), descriptionId = useId();
  const [selection, setSelection] = useState(() => ({ courseId: course.id, ids: new Set<string>() }));
  const lessons = useMemo(() => course.topics.flatMap(topic => topic.lessons), [course.topics]);
  const selectedIds = useMemo(() => new Set(selection.courseId === course.id ? selection.ids : []), [selection, course.id]);
  // The payload follows the catalog order, regardless of the order of checkbox clicks.
  const selectedLessons = lessons.filter(lesson => selectedIds.has(lesson.id));
  const allSelected = lessons.length > 0 && selectedLessons.length === lessons.length;
  const wordCount = selectedLessons.reduce((total, lesson) => total + lesson.wordCount, 0);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const toggleLesson = (lessonId: string) => {
    setSelection(previous => {
      const ids = new Set(previous.courseId === course.id ? previous.ids : []);
      if (ids.has(lessonId)) ids.delete(lessonId);
      else ids.add(lessonId);
      return { courseId: course.id, ids };
    });
  };

  return <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className="w-[calc(100%-2rem)] max-w-2xl max-h-none overflow-visible border-0 bg-transparent p-0 text-slate-700 backdrop:bg-black/45">
    <RoughCard fill="#fcf7eb" stroke="#57534e" strokeWidth={2} borderRadius={22} shadow={false} className="p-5 sm:p-6">
      <div className="flex max-h-[calc(100dvh-5rem)] min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4">
          <h2 id={titleId} className="font-sketch text-lg font-black text-stone-700">Chọn bài để ôn tập</h2>
          <button type="button" aria-label="Đóng chọn bài ôn tập" onClick={onClose} disabled={busy}
            className="-mr-1 rounded p-1 text-slate-400 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-40"><X size={22} /></button>
        </div>
        <p id={descriptionId} className="sr-only">Chọn các bài trong giáo trình {course.title} để bắt đầu Review.</p>
        <button type="button" autoFocus disabled={busy || !lessons.length} aria-pressed={allSelected}
          onClick={() => setSelection({ courseId: course.id, ids: new Set(allSelected ? [] : lessons.map(lesson => lesson.id)) })}
          className="my-4 shrink-0 self-start rounded text-sm font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-40">
          {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
        </button>
        <div className="min-h-0 max-h-[65dvh] flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
          {course.topics.map(topic => <fieldset key={topic.id} disabled={busy} className="mb-4 min-w-0 last:mb-0 disabled:opacity-60">
            <legend className="mb-1 w-full pt-2 text-xs font-black uppercase text-slate-400">
              {topic.japanese && <><span className="font-japanese normal-case">{topic.japanese}</span><span> – </span></>}{topic.title}
            </legend>
            {topic.lessons.map(lesson => <label key={lesson.id} className="flex min-h-[52px] cursor-pointer items-center gap-4 rounded px-1 py-3 text-sm hover:bg-blue-50/60">
              <input type="checkbox" checked={selectedIds.has(lesson.id)} onChange={() => toggleLesson(lesson.id)}
                className="h-5 w-5 shrink-0 accent-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" />
              <span className="min-w-0 flex-1 font-semibold">{lesson.title}</span>
              <span className="shrink-0 text-xs font-semibold text-slate-400">{lesson.wordCount} từ</span>
            </label>)}
            {!topic.lessons.length && <p className="py-3 text-xs text-slate-400">Chưa có bài học.</p>}
          </fieldset>)}
          {!lessons.length && <p className="py-6 text-center text-sm text-slate-500">Giáo trình chưa có bài để ôn tập.</p>}
        </div>
        <div className="mt-4 shrink-0 border-t border-slate-200/70 pt-3">
          {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
          <p aria-live="polite" className="mb-2 text-center text-xs text-slate-500">{selectedLessons.length} bài · {wordCount} từ đã chọn</p>
          <RoughButton type="button" disabled={busy || !selectedLessons.length}
            onClick={event => { if (!busy && event.detail <= 1 && selectedLessons.length) onStart(selectedLessons.map(lesson => lesson.id)); }}
            fill={selectedLessons.length ? '#3b82f6' : '#93bbf3'} stroke="#a8a29e" borderRadius={12}
            className="w-full px-4 py-4 text-sm font-black text-white disabled:cursor-not-allowed">
            {busy ? 'Đang chuẩn bị Review…' : selectedLessons.length ? `Bắt đầu Review · ${selectedLessons.length} bài` : 'Chọn ít nhất 1 bài'}
          </RoughButton>
        </div>
      </div>
    </RoughCard>
  </dialog>;
}
