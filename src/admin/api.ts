import { ApiError } from '../utils/api.ts';
import type { AdminRequest } from './types.ts';

export class AdminApiError extends ApiError {
  issues: { path: (string | number)[]; message: string }[];
  constructor(status: number, code: string, message: string, issues: unknown = []) {
    super(status, code, message);
    this.issues = Array.isArray(issues) ? issues.filter(item => item && Array.isArray(item.path) && typeof item.message === 'string') : [];
  }
}

/** One request scope per mounted account; disposing it also cancels in-flight responses. */
export function createAdminRequest(userId: string, options: {
  isCurrent: () => boolean;
  onAccessDenied?: () => void;
  fetcher?: typeof fetch;
}) {
  const controllers = new Set<AbortController>();
  let disposed = false;
  let generation = 0;
  const current = () => !disposed && options.isCurrent();
  const changed = () => new AdminApiError(409, 'ACCOUNT_CHANGED', 'Phiên quản trị đã thay đổi. Vui lòng tải lại tài khoản.');
  const request: AdminRequest = async <T>(path: string, input: Parameters<AdminRequest>[1] = {}) => {
    if (!current()) throw changed();
    const requestGeneration = generation;
    const requestCurrent = () => current() && requestGeneration === generation;
    if (!path.startsWith('/admin/content/') && !/^\/admin\/reading\/articles(?:\/|$)/.test(path)) throw new Error('Unsupported admin endpoint');
    const method = input.method ?? (input.body ? 'POST' : 'GET');
    const controller = new AbortController();
    controllers.add(controller);
    try {
      const signals = [controller.signal, AbortSignal.timeout(input.timeoutMs ?? 45000), ...(input.signal ? [input.signal] : [])];
      const response = await (options.fetcher ?? fetch)(`/api${path}`, {
        method, credentials: 'same-origin', signal: AbortSignal.any(signals),
        headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify({ ...input.body, expectedUserId: userId }),
      });
      const data = await response.json().catch(() => null);
      if (!requestCurrent()) throw changed();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403 || data?.error?.code === 'ACCOUNT_CHANGED') options.onAccessDenied?.();
        throw new AdminApiError(response.status, data?.error?.code ?? 'SERVER_ERROR', data?.error?.message ?? 'Máy chủ chưa sẵn sàng. Vui lòng thử lại.', data?.error?.issues);
      }
      if (!data) throw new AdminApiError(502, 'INVALID_RESPONSE', 'Phản hồi máy chủ không hợp lệ.');
      return data as T;
    } catch (error) {
      if (!requestCurrent()) throw changed();
      if (error instanceof ApiError) throw error;
      if (input.signal?.aborted || controller.signal.aborted) throw new AdminApiError(0, 'CANCELLED', 'Đã dừng yêu cầu.');
      throw new AdminApiError(0, 'NETWORK_ERROR', 'Chưa nhận được xác nhận từ máy chủ. Dữ liệu đang nhập vẫn được giữ; hãy kiểm tra kết nối và thử lại.');
    } finally { controllers.delete(controller); }
  };
  return { request, activate() { disposed = false; }, dispose() { disposed = true; generation++; controllers.forEach(controller => controller.abort()); controllers.clear(); } };
}
