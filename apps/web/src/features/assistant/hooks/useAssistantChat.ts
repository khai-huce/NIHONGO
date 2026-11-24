import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@nihongo/client/api';
import { requestAssistant } from '../lib/assistant-api';
import { ASSISTANT_MESSAGE_LIMIT, ASSISTANT_VISIBLE_TURNS, assistantHistory, retainAssistantRequest, type AssistantRequest, type AssistantTurn } from '../lib/assistant-chat';

export function useAssistantChat(userId: string | null, authBusy: boolean, currentRoute: string, onLogin: () => void, shareWithGroq = false) {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [inputError, setInputError] = useState('');
  const [earlierTurnsHidden, setEarlierTurnsHidden] = useState(false);
  const mounted = useRef(false);
  const owner = useRef(userId);
  owner.current = userId;
  const active = useRef<AbortController | null>(null);
  const latestTurns = useRef(turns);
  latestTurns.current = turns;

  // App keys this component only by account: refreshes and route changes retain drafts.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; active.current?.abort(); active.current = null; };
  }, []);

  async function execute(request: AssistantRequest, turnId: string) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    const current = () => mounted.current && active.current === controller && owner.current === request.expectedUserId;
    try {
      const result = await requestAssistant(request, controller.signal);
      if (current()) setTurns(previous => previous.map(turn => turn.id === turnId ? { ...turn, request, state: 'done', reply: result.reply, error: undefined, retrySameId: undefined } : turn));
    } catch (error) {
      if (current()) setTurns(previous => previous.map(turn => turn.id === turnId ? {
        ...turn, request, state: 'failed',
        error: error instanceof Error ? error.message : 'Trợ lý chưa trả lời được. Câu hỏi của bạn vẫn được giữ.',
        retrySameId: error instanceof ApiError && retainAssistantRequest(error.status, error.code),
      } : turn));
    } finally {
      if (current()) { active.current = null; setBusy(false); }
    }
  }

  function send() {
    if (active.current || authBusy) return;
    if (!userId) { onLogin(); return; }
    const message = input.trim();
    if (!message) return;
    if (message.length > ASSISTANT_MESSAGE_LIMIT) { setInputError(`Mỗi câu hỏi tối đa ${ASSISTANT_MESSAGE_LIMIT} ký tự.`); return; }
    const id = crypto.randomUUID();
    const request: AssistantRequest = { ...(shareWithGroq ? { shareWithGroq } : {}), id, expectedUserId: userId, message, currentRoute, history: assistantHistory(latestTurns.current) };
    const turn: AssistantTurn = { id, request, state: 'pending' };
    const next = [...latestTurns.current, turn];
    if (next.length > ASSISTANT_VISIBLE_TURNS) setEarlierTurnsHidden(true);
    latestTurns.current = next.slice(-ASSISTANT_VISIBLE_TURNS);
    setTurns(latestTurns.current);
    setInput(''); setInputError('');
    void execute(request, id);
  }

  function retry(turnId: string) {
    if (active.current || authBusy) return;
    if (!userId) { onLogin(); return; }
    const turn = latestTurns.current.at(-1);
    if (!turn || turn.id !== turnId || turn.state !== 'failed' || turn.request.expectedUserId !== userId) return;
    // Retry the original question, route and history, even if navigation has changed.
    const request = { ...turn.request, id: turn.retrySameId ? turn.request.id : crypto.randomUUID() };
    setTurns(previous => previous.map(item => item.id === turnId ? { ...item, request, state: 'pending', error: undefined } : item));
    void execute(request, turnId);
  }

  return { turns, input, setInput, busy, inputError, earlierTurnsHidden, send, retry };
}
