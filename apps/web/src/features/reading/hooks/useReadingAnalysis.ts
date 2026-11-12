import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@nihongo/client/api';
import type { ReadingArticle, ReadingSentence } from '@nihongo/client/reading';
import { READING_ANALYSIS_TIMEOUT_MS, type ReadingAnalysisField, type ReadingAnalysisSentence } from '@nihongo/shared/contracts/reading-analysis';
import { readingRequest } from './useReadings';
import { editReadingAnalysisSentence, readingAnalysisAnnotations, readingAnalysisEligibility, retainReadingAnalysisRequest,
  sameReadingAnalysisContext, uncertainReadingAnalysisApply, validateReadingAnalysisApplyResponse, validateReadingAnalysisDraft,
  validateReadingAnalysisResponse, type ReadingAnalysisContext, type ReadingAnalysisSnapshot } from '../lib/reading-analysis';

type Draft = { requestId: string; article: ReadingAnalysisSnapshot; title: string; rows: ReadingAnalysisSentence[]; warnings: string[] };
type State = { context: ReadingAnalysisContext; busy: boolean; saving: boolean; draft: Draft | null; error: string; uncertain: boolean; stale: boolean };

export function useReadingAnalysis(userId: string | null, article: ReadingArticle | null, authBusy: boolean, onApplied: () => void) {
  const current = useRef<ReadingAnalysisContext>({ userId, articleId: article?.id ?? null, version: article?.version ?? null,
    text: article?.text ?? '', authBusy, revision: 0 });
  const nextContext = { userId, articleId: article?.id ?? null, version: article?.version ?? null, text: article?.text ?? '', authBusy,
    revision: current.current.revision };
  if (!sameReadingAnalysisContext(nextContext, current.current)) current.current = { ...nextContext, revision: current.current.revision + 1 };
  const empty = (): State => ({ context: { ...current.current }, busy: false, saving: false, draft: null, error: '', uncertain: false, stale: false });
  const [state, setState] = useState<State>(empty);
  const mounted = useRef(false), active = useRef<AbortController | null>(null);
  const retry = useRef<{ id: string; context: ReadingAnalysisContext } | null>(null);
  const latest = useRef(state); latest.current = state;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); }; }, []);
  useEffect(() => {
    active.current?.abort(); active.current = null; retry.current = null;
    setState(empty());
  }, [userId, article?.id, article?.version, article?.text, authBusy]);

  async function start() {
    if (active.current || authBusy) return;
    const context = { ...current.current };
    const eligibility = readingAnalysisEligibility(article, userId);
    if (eligibility || !article || !userId) { setState({ ...empty(), error: eligibility }); return; }
    const snapshot = structuredClone(article);
    const id = retry.current && sameReadingAnalysisContext(retry.current.context, context) ? retry.current.id : crypto.randomUUID();
    retry.current = { id, context };
    const controller = new AbortController(); active.current = controller;
    setState({ ...empty(), busy: true });
    const isCurrent = () => mounted.current && active.current === controller && !controller.signal.aborted && sameReadingAnalysisContext(current.current, context);
    try {
      const data = await readingRequest<unknown>(`/${encodeURIComponent(snapshot.id)}/analysis`, { method: 'POST',
        body: { id, expectedUserId: userId, version: snapshot.version }, signal: controller.signal, timeout: READING_ANALYSIS_TIMEOUT_MS });
      if (!isCurrent()) return;
      const response = validateReadingAnalysisResponse(data, userId, id, snapshot);
      retry.current = null;
      setState(previous => ({ ...previous, draft: { requestId: id, article: snapshot, title: snapshot.title,
        rows: structuredClone(response.result.sentences), warnings: [...response.result.warnings] } }));
    } catch (error) {
      if (!isCurrent()) return;
      if (!(error instanceof ApiError) || !retainReadingAnalysisRequest(error.status, error.code)) retry.current = null;
      setState(previous => ({ ...previous, error: error instanceof Error ? error.message : 'Chưa phân tích được bài đọc. Nội dung đã lưu vẫn được giữ nguyên.' }));
    } finally {
      if (isCurrent()) { active.current = null; setState(previous => ({ ...previous, busy: false })); }
    }
  }

  async function apply() {
    const snapshot = latest.current, draft = snapshot.draft, context = { ...current.current };
    if (active.current || authBusy || !userId || !draft || snapshot.stale || !sameReadingAnalysisContext(snapshot.context, context)) return;
    const errors = validateReadingAnalysisDraft(draft.rows, draft.article);
    if (errors.length) { setState(previous => ({ ...previous, error: errors[0] })); return; }
    const controller = new AbortController(); active.current = controller;
    setState(previous => ({ ...previous, saving: true, error: '' }));
    const isCurrent = () => mounted.current && active.current === controller && !controller.signal.aborted && sameReadingAnalysisContext(current.current, context);
    try {
      const response = await readingRequest<unknown>(`/${encodeURIComponent(draft.article.id)}/analysis/apply`, { method: 'POST',
        body: { requestId: draft.requestId, expectedUserId: userId, version: draft.article.version, annotations: readingAnalysisAnnotations(draft.rows) }, signal: controller.signal });
      if (!isCurrent()) return;
      validateReadingAnalysisApplyResponse(response, userId, draft.requestId, draft.article);
      setState(empty());
      onApplied();
    } catch (error) {
      if (!isCurrent()) return;
      const uncertain = !(error instanceof ApiError) || uncertainReadingAnalysisApply(error.status);
      const stale = error instanceof ApiError && [401, 403, 404, 409].includes(error.status);
      setState(previous => ({ ...previous, uncertain, stale,
        error: uncertain ? 'Chưa xác nhận được kết quả lưu. Các chỉnh sửa đang được giữ; bấm thử lưu lại cùng nội dung hoặc tải lại bài để kiểm tra.'
          : error instanceof Error ? error.message : 'Chưa áp dụng được bản phân tích.' }));
    } finally {
      if (isCurrent()) { active.current = null; setState(previous => ({ ...previous, saving: false })); }
    }
  }

  const visible = sameReadingAnalysisContext(state.context, current.current) ? state : empty();
  return { ...visible, start, apply,
    eligibility: readingAnalysisEligibility(article, userId),
    close: () => { if (!active.current) setState(empty()); },
    reload: () => { if (!active.current) { setState(empty()); onApplied(); } },
    edit: (sentenceId: string, field: ReadingAnalysisField, value: string | ReadingSentence['ruby']) => {
      if (active.current) return;
      setState(previous => !previous.draft || previous.uncertain || previous.stale || !sameReadingAnalysisContext(previous.context, current.current) ? previous
        : { ...previous, error: '', draft: { ...previous.draft, rows: editReadingAnalysisSentence(previous.draft.rows, sentenceId, field, value) } });
    },
  };
}
