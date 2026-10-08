import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@nihongo/client/api';
import { SENTENCE_MAX_LENGTH, type SentenceAnalysis, type SentenceAnalysisResponse, type SentenceAiAnalysis, type SentenceAiResponse } from '@nihongo/shared/contracts/sentence-analysis';
import { createSentenceRequestSession, normalizeSentenceInput } from '../utils/sentenceRequests';
import { sentenceApi } from '../utils/sentenceApi';

type State = {
  key: string; analysis: SentenceAnalysis | null; ai: SentenceAiAnalysis | null;
  loading: boolean; aiLoading: boolean; error: string; aiError: string; showAi: boolean;
};
const empty = (key: string): State => ({ key, analysis: null, ai: null, loading: false, aiLoading: false, error: '', aiError: '', showAi: false });

export function useSentenceAnalysis(userId: string | null, authBusy: boolean) {
  const [inputText, setInput] = useState('');
  const keyFor = (input: string) => JSON.stringify([userId, authBusy, input]);
  const session = useRef(createSentenceRequestSession()).current;
  const context = keyFor(inputText);
  const key = JSON.stringify([context, session.sync(context)]);
  const [state, setState] = useState<State>(() => empty(key));
  const visible = state.key === key ? state : empty(key);
  useEffect(() => { session.mount(); return () => session.unmount(); }, [session]);

  const setInputText = (value: string) => {
    session.sync(keyFor(value));
    setInput(value);
  };

  const analyze = async (sample?: string) => {
    if (authBusy) return;
    const raw = sample ?? inputText;
    if (sample !== undefined) setInputText(sample);
    const nextContext = keyFor(raw);
    const nextKey = JSON.stringify([nextContext, session.sync(nextContext)]);
    const request = session.begin('analyze');
    if (!request) return;
    const sentence = normalizeSentenceInput(raw);
    const error = !sentence ? 'Nhập một câu tiếng Nhật để phân tích.' : sentence.length > SENTENCE_MAX_LENGTH ? `Câu tối đa ${SENTENCE_MAX_LENGTH} ký tự. Hãy rút ngắn rồi thử lại.` : '';
    if (error) {
      setState({ ...empty(nextKey), error }); request.finish(); return;
    }
    setState({ ...empty(nextKey), loading: true });
    try {
      const response = await sentenceApi<SentenceAnalysisResponse>('analyze', { sentence, expectedUserId: userId });
      if (!request.current()) return;
      if (response.userId !== userId || response.analysis.sentence !== sentence) throw new Error('Phiên hoặc câu đã thay đổi. Vui lòng phân tích lại.');
      setState({ ...empty(nextKey), analysis: response.analysis });
    } catch (error) {
      if (request.current()) setState({ ...empty(nextKey), error: error instanceof Error ? error.message : 'Chưa phân tích được câu. Vui lòng thử lại.' });
    } finally { request.finish(); }
  };

  const toggleAi = async () => {
    if (authBusy || !visible.analysis || visible.loading) return;
    if (visible.ai) { setState(old => ({ ...old, showAi: !old.showAi })); return; }
    if (!userId) { setState(old => ({ ...old, aiError: 'Đăng nhập để phân tích cấu trúc câu bằng AI. Không yêu cầu Premium.' })); return; }
    const request = session.begin('ai');
    if (!request) return;
    const sentence = visible.analysis.sentence, id = session.aiId();
    setState(old => ({ ...old, aiLoading: true, aiError: '' }));
    try {
      const response = await sentenceApi<SentenceAiResponse>('ai', { id, sentence, expectedUserId: userId });
      if (!request.current()) return;
      if (response.userId !== userId || response.analysis.sentence !== sentence) throw new Error('Phiên hoặc câu đã thay đổi. Vui lòng phân tích lại.');
      setState(old => ({ ...old, ai: response.analysis, aiLoading: false, showAi: true }));
    } catch (error) {
      if (!request.current()) return;
      if (error instanceof ApiError) session.retryAi(error.code);
      setState(old => ({ ...old, aiLoading: false, aiError: error instanceof Error ? error.message : 'Chưa nhận được phân tích AI. Vui lòng thử lại.' }));
    } finally { request.finish(); }
  };
  return { ...visible, inputText, setInputText, analyze, toggleAi };
}
