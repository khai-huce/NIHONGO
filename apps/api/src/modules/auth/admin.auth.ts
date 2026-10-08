import type { RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { HttpError } from '../../common/errors.js';

// Never trust a role cached in a session or sent by the browser.
export function requireAdmin(db: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const user = req.session.userId
      ? await db.user.findUnique({ where: { id: req.session.userId }, select: { id: true, role: true } }) : null;
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập.');
    if (user.role !== 'admin') throw new HttpError(403, 'ADMIN_REQUIRED', 'Chỉ quản trị viên được sửa kho nội dung.');
    next();
  };
}
