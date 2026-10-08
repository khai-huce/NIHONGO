import { ApiError } from '@nihongo/client/api';

/** AI can take longer than the shared client's 15 second read timeout. */
export async function sentenceApi<T>(path: 'analyze' | 'ai', body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/sentence-analysis/${path}`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(path === 'ai' ? 60000 : 30000),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Chưa nhận được phản hồi. Kiểm tra kết nối rồi bấm thử lại.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.error?.code ?? 'SERVER_ERROR', data?.error?.message ?? 'Máy chủ chưa sẵn sàng. Vui lòng thử lại.');
  if (!data) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi máy chủ không hợp lệ. Vui lòng thử lại.');
  return data as T;
}
