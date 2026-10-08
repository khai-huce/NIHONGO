import { ApiError } from '@nihongo/client/api';

export async function shadowingApi<T>(path: string, body?: unknown, method = 'POST', signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/shadowing${path}`, {
      method: body === undefined ? 'GET' : method, credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(20000),
    });
  } catch { throw new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ. Nội dung đang nhập vẫn được giữ để thử lại.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.error?.code ?? 'SERVER_ERROR', data?.error?.message ?? 'Máy chủ chưa sẵn sàng.');
  if (!data) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi máy chủ chưa hợp lệ.');
  return data as T;
}

export function formatShadowingTime(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function shuffledIndices(length: number, random = Math.random) {
  const indices = Array.from({ length }, (_, index) => index);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}
