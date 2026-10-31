import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@nihongo/client/api';
import type { VocabLesson } from '@nihongo/shared/contracts/vocabulary';
import { AI_FORMAT_MAX_CHARS, editAiRow, makeAiEditableRows, sameAiFormatContext, validateAiFormatResponse, type AiEditableRow, type AiFormatContext } from '../lib/vocab-ai-format';
import type { ImportWord } from '../lib/vocab-import';

type Draft = { lesson: VocabLesson; rows: AiEditableRow[]; warnings: string[]; context: AiFormatContext };

export function useVocabAiFormat(userId: string | null, lessonId: string | null, text: string, authBusy: boolean) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const mounted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const retry = useRef<{ id: string; context: AiFormatContext } | null>(null);
  const current = useRef<AiFormatContext>({ userId, lessonId, text, revision: 0 });
  if (current.current.userId !== userId || current.current.lessonId !== lessonId || current.current.text !== text) {
    current.current = { userId, lessonId, text, revision: current.current.revision + 1 };
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); controller.current = null; };
  }, []);
  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    retry.current = null;
    setBusy(false); setError(''); setDraft(null);
  }, [userId, lessonId, text]);

  async function start(lesson: VocabLesson) {
    if (controller.current || authBusy) return;
    if (!userId) { setError('Đăng nhập để dùng AI Format. Bạn vẫn có thể nhập JSON/text bằng nút Nhập dữ liệu vào hệ thống.'); return; }
    if (!text.trim()) { setError('Hãy nhập danh sách từ cần định dạng.'); return; }
    if (text.length > AI_FORMAT_MAX_CHARS) { setError(`AI Format nhận tối đa ${AI_FORMAT_MAX_CHARS.toLocaleString('vi-VN')} ký tự và 50 từ mỗi lượt. Hãy chia nội dung thành phần nhỏ hơn.`); return; }
    const context = { ...current.current };
    if (context.lessonId !== lesson.id) return;
    const id = retry.current && sameAiFormatContext(retry.current.context, context) ? retry.current.id : crypto.randomUUID();
    retry.current = { id, context };
    const active = new AbortController(); controller.current = active;
    const timeout = setTimeout(() => active.abort(), 105000);
    setBusy(true); setError('');
    const isCurrent = () => mounted.current && controller.current === active && sameAiFormatContext(current.current, context);
    try {
      let response: Response;
      try {
        response = await fetch('/api/vocab/ai-format', {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, expectedUserId: userId, lessonId: lesson.id, text }), signal: active.signal,
        });
      } catch {
        throw new ApiError(0, 'NETWORK_ERROR', 'Chưa nhận được kết quả AI Format. Nội dung gốc vẫn được giữ; bạn có thể bấm lại để kiểm tra lượt này.');
      }
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const body = data as { error?: { code?: string; message?: string } } | null;
        throw new ApiError(response.status, body?.error?.code ?? 'SERVER_ERROR', body?.error?.message ?? 'Chưa định dạng được nội dung. Vui lòng thử lại.');
      }
      const result = validateAiFormatResponse(data, userId, id);
      if (!isCurrent()) return;
      setDraft({ lesson, rows: makeAiEditableRows(result.result.rows), warnings: result.result.warnings, context });
      retry.current = null;
    } catch (err) {
      if (!isCurrent()) return;
      // Unknown network outcome and a pending server job keep the same request ID.
      if (!(err instanceof ApiError) || (err.status !== 0 && err.code !== 'AI_BUSY')) retry.current = null;
      setError(err instanceof Error ? err.message : 'Chưa định dạng được nội dung. Nội dung gốc vẫn được giữ.');
    } finally {
      clearTimeout(timeout);
      if (isCurrent()) { controller.current = null; setBusy(false); }
    }
  }

  const validDraft = draft && sameAiFormatContext(draft.context, current.current) ? draft : null;
  return {
    busy, error, draft: validDraft, start,
    close: () => setDraft(null),
    edit: (id: string, field: keyof ImportWord, value: string) => setDraft(previous => previous ? { ...previous, rows: editAiRow(previous.rows, id, field, value) } : null),
    replaceLesson: (lesson: VocabLesson) => setDraft(previous => previous && previous.lesson.id === lesson.id ? { ...previous, lesson } : previous),
    isCurrent: (context: AiFormatContext) => mounted.current && sameAiFormatContext(context, current.current),
  };
}
