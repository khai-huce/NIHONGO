import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import { useReview } from './useReview';
import { vocabImportKey } from '../lib/vocab-import';

export type VocabWord = {
  id: string;
  word: string;
  reading: string;
  hanViet: string;
  meaning: string;
};
export type VocabLesson = { id: string; name: string; words: VocabWord[]; version?: number };
type LessonListResponse = { userId: string; lessons: VocabLesson[] };
type ImportCounts = { importedCount: number; duplicateCount: number };
type LocalChange = VocabLesson[] | ({ lessons: VocabLesson[] } & ImportCounts);

function readDeviceLessons(): VocabLesson[] {
  const value = JSON.parse(localStorage.getItem('chu_dong_lessons') ?? '[]');
  const wordFields: (keyof VocabWord)[] = ['id', 'word', 'reading', 'hanViet', 'meaning'];
  if (!Array.isArray(value) || value.some(lesson =>
    !lesson || typeof lesson.id !== 'string' || typeof lesson.name !== 'string' ||
    !Array.isArray(lesson.words) || lesson.words.some((word: VocabWord) =>
      !word || wordFields.some(field => typeof word[field] !== 'string')))) {
    throw new Error('Dữ liệu bài học trên thiết bị không hợp lệ; bản gốc vẫn được giữ.');
  }
  return value;
}

export function useVocabLessons(userId: string | null, authBusy: boolean) {
  const { reload: reloadReview } = useReview();
  const [lessons, setLessons] = useState<VocabLesson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const pending = useRef(false);
  const revision = useRef(0);
  const currentLessons = useRef(lessons);
  currentLessons.current = lessons;

  const reload = useCallback(async () => {
    if (authBusy || pending.current) return;
    const request = ++revision.current;
    setLoading(true);
    setError('');
    try {
      let next: VocabLesson[];
      if (userId) {
        const data = await api<LessonListResponse>('/vocab/lessons');
        if (data.userId !== userId) throw new Error('Tài khoản đã đổi. Vui lòng tải lại trang.');
        next = data.lessons;
      } else {
        next = readDeviceLessons();
      }
      if (!mounted.current || request !== revision.current) return;
      currentLessons.current = next;
      setLessons(next);
      setLoaded(true);
      return next;
    } catch (err) {
      if (mounted.current && request === revision.current) {
        // A failed refresh keeps the existing editor usable, including its pending input.
        // On the initial load, loaded is already false and mutations stay blocked.
        setError((err instanceof Error ? err.message : 'Chưa tải được bài học.') + ' Tải lại trang để thử lại.');
      }
    } finally {
      if (mounted.current && request === revision.current) setLoading(false);
    }
  }, [userId, authBusy]);

  // App remounts this page per account. A late response must never reach the next account.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++revision.current; };
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  async function change(path: string, body: Record<string, unknown>, local: (previous: VocabLesson[]) => LocalChange) {
    if (authBusy || pending.current || loading || !loaded) return null;
    const request = ++revision.current;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      let next: VocabLesson[];
      let saved: VocabLesson | undefined;
      let counts: ImportCounts | undefined;
      if (userId) {
        const data = await api<{ userId: string; lesson?: VocabLesson; id?: string } & Partial<ImportCounts>>(path, { ...body, expectedUserId: userId });
        if (data.userId !== userId) throw new Error('Tài khoản đã đổi. Vui lòng tải lại trang.');
        if (data.importedCount !== undefined && data.duplicateCount !== undefined) counts = { importedCount: data.importedCount, duplicateCount: data.duplicateCount };
        saved = data.lesson;
        if (saved) {
          const lesson = saved;
          next = currentLessons.current.some(item => item.id === lesson.id)
            ? currentLessons.current.map(item => item.id === lesson.id ? lesson : item)
            : [...currentLessons.current, lesson];
        } else {
          next = currentLessons.current.filter(item => item.id !== data.id);
        }
      } else {
        const result = local(currentLessons.current);
        next = Array.isArray(result) ? result : result.lessons;
        if (!Array.isArray(result)) counts = result;
        localStorage.setItem('chu_dong_lessons', JSON.stringify(next));
        saved = next.find(lesson => lesson.id === body.id);
      }
      if (!mounted.current || request !== revision.current) return null;
      currentLessons.current = next;
      setLessons(next);
      if (userId && Array.isArray(body.words)) void reloadReview();
      return { lesson: saved, ...counts };
    } catch (err) {
      if (mounted.current && request === revision.current) setError(err instanceof Error ? err.message : 'Chưa lưu được bài học.');
      return null;
    } finally {
      pending.current = false;
      if (mounted.current && request === revision.current) setSaving(false);
    }
  }
  const create = (id: string, name: string) => change('/vocab/lessons', { id, name }, previous =>
    previous.some(lesson => lesson.id === id) ? previous : [...previous, { id, name, words: [] }]);
  const update = (lesson: VocabLesson, changes: { name?: string; words?: VocabWord[] }) =>
    change('/vocab/lessons/update', { id: lesson.id, version: lesson.version ?? 0, ...changes }, previous =>
      previous.map(item => item.id === lesson.id ? { ...item, ...changes } : item));
  const remove = (lesson: VocabLesson) => change('/vocab/lessons/delete', { id: lesson.id, version: lesson.version ?? 0 }, previous =>
    previous.filter(item => item.id !== lesson.id));
  const importWords = (lesson: VocabLesson, words: VocabWord[]) =>
    change('/vocab/lessons/import', { id: lesson.id, version: lesson.version ?? 0, words }, () => {
      // Read again before writing so another guest tab's lesson is never overwritten.
      const latest = readDeviceLessons();
      const before = latest.find(item => item.id === lesson.id);
      if (!before) throw new Error('Không tìm thấy bài học. Nội dung nhập vẫn được giữ.');
      const seen = new Set(before.words.map(vocabImportKey));
      const additions = words.filter(item => {
        const key = vocabImportKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (additions.length && (before.version !== lesson.version || JSON.stringify(before.words) !== JSON.stringify(lesson.words))) {
        throw new Error('Bài học đã thay đổi ở tab khác. Tải bài và xem lại trước khi nhập.');
      }
      if (before.words.length + additions.length > 500) throw new Error('Mỗi bài tối đa 500 từ.');
      const next = additions.length ? latest.map(item => item.id === before.id
        ? { ...item, words: [...item.words, ...additions], version: (item.version ?? 0) + 1 } : item) : latest;
      return { lessons: next, importedCount: additions.length, duplicateCount: words.length - additions.length };
    });
  return { lessons, create, update, remove, importWords, reload, loading, saving, loaded, error, busy: authBusy || loading || saving || !loaded };
}
