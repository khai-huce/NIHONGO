import { z } from 'zod';

const email = z.string().trim().toLowerCase().max(254).email('Email không hợp lệ.');
const password = z.string().max(128, 'Mật khẩu tối đa 128 ký tự.');

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên.').max(100, 'Tên tối đa 100 ký tự.'),
  email,
  password: password.min(12, 'Mật khẩu cần ít nhất 12 ký tự.'),
}).strict();

export const loginSchema = z.object({
  email,
  password: password.min(1, 'Vui lòng nhập mật khẩu.'),
}).strict();

export const googleSchema = z.object({ credential: z.string().min(1).max(10000) }).strict();
