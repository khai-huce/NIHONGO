import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (res.headersSent) return _next(error);
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' } });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    res.status(409).json({ error: { code: 'ACCOUNT_EXISTS', message: 'Tài khoản đã tồn tại. Vui lòng dùng cách đăng nhập đã đăng ký.' } });
    return;
  }
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Dữ liệu JSON không hợp lệ.' } });
    return;
  }
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'Dữ liệu gửi lên quá lớn.' } });
    return;
  }
  console.error('API request failed:', error instanceof Error ? error.name : 'UnknownError');
  res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Máy chủ tạm thời không sẵn sàng. Vui lòng thử lại.' } });
};
