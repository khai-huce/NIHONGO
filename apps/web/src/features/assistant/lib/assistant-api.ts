import { ApiError } from '@nihongo/client/api';
import { validateAssistantResponse, type AssistantRequest } from './assistant-chat';

export async function requestAssistant(request: AssistantRequest, signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch('/api/assistant/chat', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request), signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Chưa nhận được phản hồi. Câu hỏi vẫn được giữ; bấm Thử lại để kiểm tra lượt này.');
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = data as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(response.status, body?.error?.code ?? 'SERVER_ERROR', body?.error?.message ?? 'Trợ lý chưa trả lời được. Vui lòng thử lại.');
  }
  return validateAssistantResponse(data, request.expectedUserId, request.id);
}
