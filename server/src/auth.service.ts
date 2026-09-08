import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { Prisma, type PrismaClient, type User } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { HttpError } from './errors.js';

const hashOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
// Same password-verification work for unknown accounts; one hash per process.
let dummyHash: Promise<string> | undefined;

export function publicUser(user: User) {
  return { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? undefined, isPremium: user.isPremium };
}

export async function register(db: PrismaClient, input: { name: string; email: string; password: string }) {
  const passwordHash = await argon2.hash(input.password, hashOptions);
  return db.user.create({ data: { name: input.name, email: input.email, passwordHash } });
}

export async function login(db: PrismaClient, input: { email: string; password: string }) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  dummyHash ??= argon2.hash(randomBytes(32).toString('hex'), hashOptions);
  const valid = await argon2.verify(user?.passwordHash ?? await dummyHash, input.password);
  if (!user?.passwordHash || !valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  return user;
}

export async function googleLogin(db: PrismaClient, clientId: string, credential: string, nonce: string) {
  let payload;
  try {
    const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'].includes(String(error.code))) {
      throw new HttpError(503, 'GOOGLE_UNAVAILABLE', 'Chưa kết nối được Google. Vui lòng thử lại.');
    }
    throw new HttpError(401, 'INVALID_GOOGLE_TOKEN', 'Đăng nhập Google không hợp lệ. Vui lòng thử lại.');
  }
  const tokenNonce = (payload as { nonce?: string } | undefined)?.nonce;
  if (!payload?.sub || !payload.email || !payload.email_verified || tokenNonce !== nonce || payload.exp * 1000 <= Date.now()) {
    throw new HttpError(401, 'INVALID_GOOGLE_TOKEN', 'Đăng nhập Google không hợp lệ hoặc đã hết hạn.');
  }
  const existing = await db.user.findUnique({ where: { googleSub: payload.sub } });
  if (existing) return existing;
  const email = payload.email.trim().toLowerCase();
  try {
    return await db.user.create({ data: {
      googleSub: payload.sub,
      email,
      name: (payload.name?.trim() || email.split('@')[0]).slice(0, 100),
      avatarUrl: payload.picture?.startsWith('https://') ? payload.picture : null,
    } });
  } catch (error) {
    // Two first logins for the same subject can race. Never merge by email.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const sameGoogleUser = await db.user.findUnique({ where: { googleSub: payload.sub } });
      if (sameGoogleUser) return sameGoogleUser;
    }
    throw error;
  }
}
