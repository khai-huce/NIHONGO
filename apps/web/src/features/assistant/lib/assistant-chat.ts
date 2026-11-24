export const ASSISTANT_MESSAGE_LIMIT = 1000;
export const ASSISTANT_VISIBLE_TURNS = 10;
export type AssistantSource = { id: string; title: string; url: string };
export type AssistantReply = { text: string; sources: AssistantSource[] };
export type AssistantHistoryMessage = { role: 'user' | 'assistant'; content: string };
export type AssistantRequest = { shareWithGroq?: boolean; id: string; expectedUserId: string; message: string; currentRoute: string; history: AssistantHistoryMessage[] };
export type AssistantResponse = { userId: string; id: string; cached: boolean; reply: AssistantReply };
export type AssistantTurn = {
  id: string;
  request: AssistantRequest;
  state: 'pending' | 'failed' | 'done';
  reply?: AssistantReply;
  error?: string;
  retrySameId?: boolean;
};

export function isInternalAssistantUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.length > 2000) return false;
  // Encoded slashes/control characters must not bypass the same-origin check.
  let decoded = value;
  for (let depth = 0; depth < 3; depth++) {
    if (/^[\/]{2}|[\\\u0000-\u0020\u007f]/u.test(decoded)) return false;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch { return false; }
  }
  if (/%(?:25|2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/iu.test(decoded) || /^[\/]{2}|[\\\u0000-\u0020\u007f]/u.test(decoded)) return false;
  try { return new URL(value, 'https://nihongo.invalid').origin === 'https://nihongo.invalid'; }
  catch { return false; }
}

/** Keep whole completed exchanges; failed/pending turns are never claimed as answered. */
export function assistantHistory(turns: AssistantTurn[]): AssistantHistoryMessage[] {
  const pairs = turns.filter(turn => turn.state === 'done' && turn.reply).slice(-5)
    .map(turn => [{ role: 'user' as const, content: turn.request.message }, { role: 'assistant' as const, content: turn.reply!.text }]);
  let total = pairs.reduce((sum, pair) => sum + pair[0].content.length + pair[1].content.length, 0);
  while (pairs.length && total > 16000) {
    const removed = pairs.shift()!;
    total -= removed[0].content.length + removed[1].content.length;
  }
  return pairs.flat();
}

export function retainAssistantRequest(status: number, code: string) {
  return status === 0 || code === 'AI_BUSY';
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function validateAssistantResponse(value: unknown, userId: string, requestId: string): AssistantResponse {
  if (!record(value) || value.userId !== userId || value.id !== requestId || typeof value.cached !== 'boolean' || !record(value.reply)) {
    throw new Error('Phản hồi không khớp tài khoản hoặc câu hỏi. Câu hỏi của bạn vẫn được giữ.');
  }
  const reply = value.reply;
  if (typeof reply.text !== 'string' || !reply.text.trim() || reply.text.length > 4000 || !Array.isArray(reply.sources) || reply.sources.length > 6 ||
      reply.sources.some(source => !record(source) || typeof source.id !== 'string' || typeof source.title !== 'string' || !source.title.trim() || !isInternalAssistantUrl(source.url))) {
    throw new Error('Phản hồi của trợ lý không hợp lệ. Bạn có thể thử lại câu hỏi.');
  }
  return value as AssistantResponse;
}

export function canSubmitAssistantOnEnter(event: { key: string; isComposing: boolean; keyCode?: number; shiftKey?: boolean }) {
  return event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && !event.shiftKey;
}
