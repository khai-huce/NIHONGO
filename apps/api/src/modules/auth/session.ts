import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type { Pool } from 'pg';
import type { Request, Response } from 'express';
import type { Config } from '../../config/env.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    googleNonce?: { value: string; expiresAt: number };
  }
}

export const SESSION_NAME = 'nihongo.sid';
export const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
export const NONCE_AGE = 10 * 60 * 1000;

export function createSession(config: Config, pool: Pool) {
  const Store = connectPgSimple(session);
  const store = new Store({ pool, tableName: 'sessions', createTableIfMissing: false });
  store.on('error', () => console.error('Session store unavailable'));
  const middleware = session({
    name: SESSION_NAME,
    secret: config.SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.NODE_ENV === 'production', maxAge: NONCE_AGE, path: '/' },
  });
  return { middleware, store };
}

export async function signIn(req: Request, userId: string) {
  await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.userId = userId;
  req.session.cookie.maxAge = SESSION_AGE;
  await saveSession(req);
}

export function saveSession(req: Request) {
  return new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
}

export async function signOut(req: Request, res: Response, config: Config) {
  await new Promise<void>((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
  res.clearCookie(SESSION_NAME, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.NODE_ENV === 'production' });
}
