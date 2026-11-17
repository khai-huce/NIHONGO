import { useToast, useToastFeedback } from '@nihongo/client/toast';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@nihongo/client/api';
import type { ReadingArticle } from '@nihongo/client/reading';
import { READING_SUPPLEMENT_TIMEOUT_MS, type ReadingSupplementKind, type ReadingSupplementLists, type ReadingSupplementCatalog } from '@nihongo/shared/contracts/reading-supplements';
import { readingRequest } from './useReadings';
import { sameReadingAnalysisContext, retainReadingAnalysisRequest, uncertainReadingAnalysisApply, validateReadingAnalysisApplyResponse, type ReadingAnalysisContext } from '../lib/reading-analysis';
import { supplementEligibility, validateSupplementDraft, validateSupplementResponse, supplementListsPayload } from '../lib/reading-supplements';

type Draft = { requestId: string; kind: ReadingSupplementKind; article: ReadingArticle; lists: ReadingSupplementLists; original: ReadingSupplementLists; catalog: ReadingSupplementCatalog; warnings: string[] };
type State = { context: ReadingAnalysisContext; busy: boolean; saving: boolean; draft: Draft | null; error: string; uncertain: boolean; stale: boolean };
export function useReadingSupplements(userId: string | null, article: ReadingArticle | null, authBusy: boolean, onApplied: () => void) {
  const current = useRef<ReadingAnalysisContext>({ userId, articleId: article?.id ?? null, version: article?.version ?? null, text: article?.text ?? '', authBusy, revision: 0 });
  const next = { userId, articleId: article?.id ?? null, version: article?.version ?? null, text: article?.text ?? '', authBusy, revision: current.current.revision };
  if (!sameReadingAnalysisContext(next, current.current)) current.current = { ...next, revision: current.current.revision + 1 };
  const empty = (): State => ({ context: { ...current.current }, busy: false, saving: false, draft: null, error: '', uncertain: false, stale: false });
  const [state, setState] = useState<State>(empty), active = useRef<AbortController | null>(null), mounted = useRef(false), latest = useRef(state); latest.current = state;
  const retry = useRef<{ id: string; kind: ReadingSupplementKind; context: ReadingAnalysisContext } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); }; }, []);
  useEffect(() => { active.current?.abort(); active.current = null; retry.current = null; setState(empty()); }, [userId, article?.id, article?.version, article?.text, authBusy]);
  const toast = useToast();
  useToastFeedback({ error: sameReadingAnalysisContext(state.context, current.current) ? state.error : null });
  async function start(kind: ReadingSupplementKind) {
    if (active.current || authBusy) return;
    // Eligibility depends on which empty group is requested.
    if (!article || !userId || supplementEligibility(article, userId, kind)) { setState({ ...empty(), error: article ? supplementEligibility(article, userId, kind) : 'Hãy mở bài đọc cá nhân đã lưu.' }); return; }
    const snapshot = structuredClone(article), context = { ...current.current };
    const id = retry.current?.kind === kind && sameReadingAnalysisContext(retry.current.context, context) ? retry.current.id : crypto.randomUUID();
    retry.current = { id, kind, context };
    const controller = new AbortController(); active.current = controller;
    const isCurrent = () => mounted.current && active.current === controller && !controller.signal.aborted && sameReadingAnalysisContext(context, current.current);
    setState({ ...empty(), busy: true });
    try {
      const raw = await readingRequest<unknown>(`/${encodeURIComponent(snapshot.id)}/supplements`, { method: 'POST', body: { id, expectedUserId: userId, version: snapshot.version, kind }, signal: controller.signal, timeout: READING_SUPPLEMENT_TIMEOUT_MS });
      if (!isCurrent()) return;
      const response = validateSupplementResponse(raw, userId, id, snapshot, kind), lists = supplementListsPayload(response.result);
      retry.current = null;
      setState(previous => ({ ...previous, draft: { requestId: id, kind, article: snapshot, lists: structuredClone(lists), original: lists, catalog: response.catalog, warnings: response.result.warnings } }));
    } catch (error) {
      if (!isCurrent()) return;
      if (!(error instanceof ApiError) || !retainReadingAnalysisRequest(error.status, error.code)) retry.current = null;
      setState(previous => ({ ...previous, error: error instanceof Error ? error.message : 'Chưa tạo được nội dung. Bài đã lưu vẫn giữ nguyên.' }));
    } finally { if (isCurrent()) { active.current = null; setState(previous => ({ ...previous, busy: false })); } }
  }
  async function apply() {
    const snapshot = latest.current, draft = snapshot.draft, context = { ...current.current };
    if (active.current || authBusy || !userId || !draft || snapshot.stale || !sameReadingAnalysisContext(snapshot.context, context)) return;
    const errors = validateSupplementDraft(draft.lists, draft.article, draft.kind);
    if (errors.length) { setState(previous => ({ ...previous, error: errors[0] })); return; }
    const controller = new AbortController(); active.current = controller;
    const isCurrent = () => mounted.current && active.current === controller && !controller.signal.aborted && sameReadingAnalysisContext(context, current.current);
    setState(previous => ({ ...previous, saving: true, error: '' }));
    try {
      const raw = await readingRequest<unknown>(`/${encodeURIComponent(draft.article.id)}/supplements/apply`, { method: 'POST', body: { requestId: draft.requestId, expectedUserId: userId, version: draft.article.version, kind: draft.kind, ...supplementListsPayload(draft.lists) }, signal: controller.signal });
      if (!isCurrent()) return;
      validateReadingAnalysisApplyResponse(raw, userId, draft.requestId, draft.article);
      if (!raw || typeof raw !== 'object' || !('kind' in raw) || raw.kind !== draft.kind) throw new Error('Phản hồi lưu không khớp nhóm nội dung.');
      setState(empty()); toast.success(draft.kind === 'quiz' ? 'Đã lưu câu hỏi vào bài đọc.' : 'Đã lưu từ vựng và ngữ pháp vào bài đọc.'); onApplied();
    } catch (error) {
      if (!isCurrent()) return;
      const uncertain = !(error instanceof ApiError) || uncertainReadingAnalysisApply(error.status);
      setState(previous => ({ ...previous, uncertain, stale: error instanceof ApiError && [401, 403, 404, 409].includes(error.status),
        error: uncertain ? 'Chưa xác nhận được kết quả lưu. Giữ nguyên bản sửa; thử lưu lại cùng nội dung hoặc tải lại bài để kiểm tra.' : error instanceof Error ? error.message : 'Chưa lưu được nội dung.' }));
    } finally { if (isCurrent()) { active.current = null; setState(previous => ({ ...previous, saving: false })); } }
  }
  return { ...(sameReadingAnalysisContext(state.context, current.current) ? state : empty()), start, apply,
    eligibility: (kind: ReadingSupplementKind) => supplementEligibility(article, userId, kind),
    close: () => { if (!active.current) setState(empty()); },
    reload: () => { if (!active.current) { setState(empty()); onApplied(); } },
    edit: (lists: ReadingSupplementLists) => { if (!active.current) setState(previous => !previous.draft || previous.uncertain || previous.stale || !sameReadingAnalysisContext(previous.context, current.current) ? previous : { ...previous, error: '', draft: { ...previous.draft, lists } }); },
  };
}
