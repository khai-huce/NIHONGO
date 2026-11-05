import { z } from 'zod';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@nihongo/shared/contracts/auth-policy';

const email = z.string().trim().toLowerCase().max(254).email('Email không hợp lệ.');
const password = z.string().max(PASSWORD_MAX_LENGTH, `Mật khẩu tối đa ${PASSWORD_MAX_LENGTH} ký tự.`);

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên.').max(100, 'Tên tối đa 100 ký tự.'),
  email,
  password: password.min(PASSWORD_MIN_LENGTH, `Mật khẩu cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`),
}).strict();

export const loginSchema = z.object({
  email,
  password: password.min(1, 'Vui lòng nhập mật khẩu.'),
}).strict();

export const googleSchema = z.object({ credential: z.string().min(1).max(10000) }).strict();
