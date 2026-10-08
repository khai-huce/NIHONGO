import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const database = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(database.pathname.slice(1))) throw new Error('Refusing a non-test database.');
const config: Config = {
  NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', ADMIN_ORIGIN: 'http://localhost:3002',
  DATABASE_URL: databaseUrl, SESSION_SECRET: 'origin-test-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: '',
};
let api: ReturnType<typeof createApp>;
let userId: string | undefined;
beforeEach(() => { api = createApp(config); userId = undefined; });
afterEach(async () => {
  if (userId) {
    await api.pool.query("DELETE FROM sessions WHERE sess->>'userId' = $1", [userId]);
    await api.db.user.delete({ where: { id: userId } });
  }
  await api.close();
});

describe('separate admin origin and shared server session', () => {
  it('allows both configured origins but still requires live admin rights', async () => {
    const registered = await request(api.app).post('/api/auth/register').set('Origin', config.APP_ORIGIN)
      .send({ name: 'Origin QA', email: `origin-${randomUUID()}@example.test`, password: 'a long local QA password 123' }).expect(201);
    userId = registered.body.user.id;
    const cookie = (registered.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    await request(api.app).get('/api/admin/content/sources').set('Cookie', cookie).expect(403);
    await api.db.user.update({ where: { id: userId }, data: { role: 'admin' } });
    const me = await request(api.app).get('/api/auth/me').set('Origin', config.ADMIN_ORIGIN!).set('Cookie', cookie).expect(200);
    expect(me.body.user.role).toBe('admin');
    await request(api.app).get('/api/admin/content/sources').set('Cookie', cookie).expect(200);
    await request(api.app).post('/api/auth/logout').set('Origin', config.ADMIN_ORIGIN!).set('Cookie', cookie).send({}).expect(204);
    await request(api.app).get('/api/auth/me').set('Cookie', cookie).expect(401);
  });

  it('rejects missing, unconfigured and lookalike origins before processing writes', async () => {
    for (const origin of ['', 'http://localhost:3003', 'http://localhost:3002.evil.test', 'null']) {
      const call = request(api.app).post('/api/auth/logout');
      if (origin) call.set('Origin', origin);
      const response = await call.send({}).expect(403);
      expect(response.body.error.code).toBe('INVALID_ORIGIN');
    }
    await request(api.app).post('/api/admin/content/sources').set('Origin', config.ADMIN_ORIGIN!).send({}).expect(401);
  });
});
