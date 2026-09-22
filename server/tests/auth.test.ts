import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { KANJI_IDS } from '../src/kanji-ids.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';

const databaseUrl = process.env.TEST_DATABASE_URL!;
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1))) throw new Error('Refusing to clean a non-test database.');
const config: Config = {
  NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
};
const password = 'a long test passphrase 123';
const userInput = { email: 'learner@example.com', name: 'Học viên', password };
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
let api: ReturnType<typeof createApp>;
const cookie = (response: request.Response) => (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

function post(path: string, body: Record<string, unknown> = {}) {
  return request(api.app).post(`/api/auth${path}`).set('Origin', config.APP_ORIGIN).send(body);
}
function googleToken(nonce: string, overrides: Record<string, unknown> = {}, wrongSignature = false) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'local-test-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: config.GOOGLE_CLIENT_ID,
    sub: 'google-user-1', email: 'google@example.com', email_verified: true, name: 'Google Học viên',
    iat: now - 1, exp: now + 3600, nonce, ...overrides,
  })).toString('base64url');
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), wrongSignature ? otherKeys.privateKey : keys.privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}
async function googleAttempt(overrides: Record<string, unknown> = {}, wrongSignature = false) {
  const nonceResponse = await post('/google/nonce').expect(200);
  return post('/google', { credential: googleToken(nonceResponse.body.nonce, overrides, wrongSignature) }).set('Cookie', cookie(nonceResponse));
}

beforeEach(async () => {
  api = createApp(config);
  await api.db.session.deleteMany();
  await api.db.user.deleteMany();
  // Replace only Google's certificate fetch. The library still verifies real RSA signatures and claims.
  vi.spyOn(OAuth2Client.prototype, 'getFederatedSignonCertsAsync').mockResolvedValue({
    certs: { 'local-test-key': keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() },
    format: 'PEM' as Awaited<ReturnType<OAuth2Client['getFederatedSignonCertsAsync']>>['format'],
  });
});
afterEach(async () => { vi.restoreAllMocks(); await api.close(); });

describe('email login and PostgreSQL sessions', () => {
  it('reports DB health and creates only a hashed, non-premium account', async () => {
    await request(api.app).get('/api/health').expect(200);
    const response = await post('/register', { ...userInput, email: '  Learner@Example.COM  ' }).expect(201);
    expect(response.body.user).toMatchObject({ name: userInput.name, email: userInput.email, isPremium: false, role: 'user' });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body.user).not.toHaveProperty('googleSub');
    const user = await api.db.user.findUniqueOrThrow({ where: { id: response.body.user.id } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(user.passwordHash!, password)).toBe(true);
    expect((response.headers['set-cookie'] as unknown as string[])[0]).toMatch(/HttpOnly/);
    expect((response.headers['set-cookie'] as unknown as string[])[0]).toMatch(/SameSite=Lax/);
    const me = await request(api.app).get('/api/auth/me').set('Cookie', cookie(response)).expect(200);
    expect(me.body.user.id).toBe(user.id);
  });
  it('rejects password policy violations, extra privilege fields and malformed JSON', async () => {
    await post('/register', { ...userInput, password: 'short' }).expect(400);
    await post('/register', { ...userInput, isPremium: true }).expect(400);
    await post('/register', { ...userInput, role: 'admin' }).expect(400);
    await post('/register', { ...userInput, name: '  ' }).expect(400);
    await request(api.app).post('/api/auth/login').set('Origin', config.APP_ORIGIN).set('Content-Type', 'application/json').send('{').expect(400);
    expect(await api.db.user.count()).toBe(0);
  });
  it('handles concurrent case-insensitive duplicate email registration', async () => {
    const responses = await Promise.all([post('/register', userInput), post('/register', { ...userInput, email: 'LEARNER@example.com' })]);
    expect(responses.map(value => value.status).sort()).toEqual([201, 409]);
    expect(await api.db.user.count()).toBe(1);
  });
  it('uses the same failure response for unknown accounts and wrong passwords', async () => {
    await post('/register', userInput).expect(201);
    const wrong = await post('/login', { email: userInput.email, password: 'wrong password' }).expect(401);
    const missing = await post('/login', { email: 'missing@example.com', password }).expect(401);
    expect(wrong.body).toEqual(missing.body);
    expect(wrong.headers['set-cookie']).toBeUndefined();
  });
  it('keeps sessions across an API restart and rotates their ID on login', async () => {
    const response = await post('/register', userInput).expect(201);
    const oldCookie = cookie(response);
    await api.close();
    api = createApp(config);
    await request(api.app).get('/api/auth/me').set('Cookie', oldCookie).expect(200);
    const signedIn = await post('/login', { email: userInput.email, password }).set('Cookie', oldCookie).expect(200);
    expect(cookie(signedIn)).not.toBe(oldCookie);
    await request(api.app).get('/api/auth/me').set('Cookie', oldCookie).expect(401);
    await request(api.app).get('/api/auth/me').set('Cookie', cookie(signedIn)).expect(200);
  });
  it('revokes logout sessions and rejects forged or expired cookies', async () => {
    const response = await post('/register', userInput).expect(201);
    const authCookie = cookie(response);
    await post('/logout').set('Cookie', authCookie).expect(204);
    await request(api.app).get('/api/auth/me').set('Cookie', authCookie).expect(401);
    await post('/logout').expect(204);
    await request(api.app).get('/api/auth/me').set('Cookie', 'nihongo.sid=forged').expect(401);
    const login = await post('/login', { email: userInput.email, password }).expect(200);
    await api.db.session.updateMany({ data: { expire: new Date(Date.now() - 60000) } });
    await request(api.app).get('/api/auth/me').set('Cookie', cookie(login)).expect(401);
  });
  it('keeps accounts isolated and gets current privileges from the database', async () => {
    const a = await post('/register', userInput).expect(201);
    const b = await post('/register', { ...userInput, email: 'second@example.com' }).expect(201);
    await api.db.user.update({ where: { id: a.body.user.id }, data: { isPremium: true, role: 'admin' } });
    const meA = await request(api.app).get('/api/auth/me').set('Cookie', cookie(a)).expect(200);
    const meB = await request(api.app).get('/api/auth/me').set('Cookie', cookie(b)).expect(200);
    expect(meA.body.user).toMatchObject({ id: a.body.user.id, isPremium: true, role: 'admin' });
    expect(meB.body.user).toMatchObject({ id: b.body.user.id, isPremium: false, role: 'user' });
    const login = await post('/login', { email: userInput.email, password }).expect(200);
    expect(login.body.user.role).toBe('admin');
    await post('/login', { email: userInput.email, password, role: 'admin' }).expect(400);
    await api.db.user.update({ where: { id: a.body.user.id }, data: { role: 'user' } });
    expect((await request(api.app).get('/api/auth/me').set('Cookie', cookie(a)).expect(200)).body.user.role).toBe('user');
    expect((await request(api.app).get('/api/auth/me').set('Cookie', cookie(login)).expect(200)).body.user.role).toBe('user');
    await api.db.user.delete({ where: { id: a.body.user.id } });
    await request(api.app).get('/api/auth/me').set('Cookie', cookie(a)).expect(401);
  });
  it('rejects cross-origin, missing-origin and non-JSON mutations', async () => {
    await request(api.app).post('/api/auth/register').set('Origin', 'http://attacker.example').send(userInput).expect(403);
    await request(api.app).post('/api/auth/register').send(userInput).expect(403);
    await request(api.app).post('/api/auth/logout').set('Origin', config.APP_ORIGIN).type('form').send({}).expect(415);
  });
  it('limits repeated attempts by normalized email', async () => {
    for (let i = 0; i < 15; i++) await post('/login', { email: i % 2 ? 'BAD@EXAMPLE.COM' : 'bad@example.com', password }).expect(401);
    await post('/login', { email: 'bad@example.com', password }).expect(429);
  });
  it('reports infrastructure errors as 503, without disclosing secrets', async () => {
    const registered = await post('/register', userInput).expect(201);
    vi.spyOn(api.db.user, 'findUnique').mockRejectedValueOnce(new Error('private-database-password'));
    const response = await request(api.app).get('/api/auth/me').set('Cookie', cookie(registered)).expect(503);
    expect(JSON.stringify(response.body)).not.toContain('private-database-password');
  });
});

describe('Google token verification', () => {
  it('creates a user from a signed token and reuses the Google subject on later login', async () => {
    const first = await googleAttempt({ role: 'admin' });
    expect(first.status).toBe(200);
    expect(first.body.user.role).toBe('user');
    const second = await googleAttempt();
    expect(second.status).toBe(200);
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(await api.db.user.count()).toBe(1);
    await request(api.app).get('/api/auth/me').set('Cookie', cookie(first)).expect(200);
  });
  it.each([
    ['wrong audience', { aud: 'someone-else.apps.googleusercontent.com' }],
    ['wrong issuer', { iss: 'https://attacker.example' }],
    ['expired', { exp: Math.floor(Date.now() / 1000) - 30 }],
    ['wrong nonce', { nonce: 'wrong' }],
    ['unverified email', { email_verified: false }],
  ])('rejects %s', async (_label, overrides) => {
    expect((await googleAttempt(overrides)).status).toBe(401);
    expect(await api.db.user.count()).toBe(0);
  });
  it('rejects an invalid RSA signature', async () => { expect((await googleAttempt({}, true)).status).toBe(401); });
  it('does not silently link an existing email account', async () => {
    await post('/register', { ...userInput, email: 'google@example.com' }).expect(201);
    expect((await googleAttempt()).status).toBe(409);
    expect(await api.db.user.count()).toBe(1);
    expect((await api.db.user.findFirstOrThrow()).googleSub).toBeNull();
  });
  it('does not allow email registration to replace a Google account', async () => {
    expect((await googleAttempt()).status).toBe(200);
    await post('/register', { ...userInput, email: 'google@example.com' }).expect(409);
    await post('/login', { email: 'google@example.com', password }).expect(401);
  });
  it('consumes each nonce once, even for concurrent requests', async () => {
    const nonce = await post('/google/nonce').expect(200);
    const credential = googleToken(nonce.body.nonce);
    const responses = await Promise.all([post('/google', { credential }).set('Cookie', cookie(nonce)), post('/google', { credential }).set('Cookie', cookie(nonce))]);
    expect(responses.map(value => value.status).sort()).toEqual([200, 401]);
    await post('/google', { credential }).set('Cookie', cookie(nonce)).expect(401);
  });
  it('fails clearly when Google is not configured while email remains available', async () => {
    await api.close();
    api = createApp({ ...config, GOOGLE_CLIENT_ID: '' });
    const response = await post('/google/nonce').expect(503);
    expect(response.body.error.code).toBe('GOOGLE_NOT_CONFIGURED');
    await post('/register', userInput).expect(201);
  });
});

describe('account Kanji progress', () => {
  const read = (sid: string) => request(api.app).get('/api/progress/kanji').set('Cookie', sid);
  const save = (sid: string, expectedUserId: string, extra: Record<string, unknown> = {}) => request(api.app)
    .post('/api/progress/kanji').set('Origin', config.APP_ORIGIN).set('Cookie', sid)
    .send({ kanjiId: 'k-1', memorized: true, expectedUserId, ...extra });

  it('keeps the accepted IDs in sync with the frontend catalog', () => {
    const source = readFileSync(new URL('../../src/data/kanjiData.ts', import.meta.url), 'utf8');
    const ids = [...source.matchAll(/id:\s*"(k-\d+)"/g)].map(match => match[1]);
    expect(KANJI_IDS).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('requires a live session for reads and writes', async () => {
    await request(api.app).get('/api/progress/kanji').expect(401);
    const registered = await post('/register', userInput).expect(201);
    const sid = cookie(registered);
    await post('/logout').set('Cookie', sid).expect(204);
    await read(sid).expect(401);
    await save(sid, registered.body.user.id).expect(401);
    expect(await api.db.kanjiProgress.count()).toBe(0);
  });
  it('persists ratings across restart and another login, without duplicate rows', async () => {
    const registered = await post('/register', userInput).expect(201);
    const sid = cookie(registered), id = registered.body.user.id;
    expect((await read(sid).expect(200)).body.progress).toEqual([]);
    await Promise.all([save(sid, id).expect(200), save(sid, id).expect(200)]);
    expect(await api.db.kanjiProgress.count()).toBe(1);
    await api.close(); api = createApp(config);
    const anotherLogin = await post('/login', { email: userInput.email, password }).expect(200);
    const result = await read(cookie(anotherLogin)).expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).toMatchObject({ userId: id, progress: [{ kanjiId: 'k-1', memorized: true }] });
    expect(result.body.progress[0]).not.toHaveProperty('userId');
    await save(cookie(anotherLogin), id, { memorized: false }).expect(200);
    expect((await read(sid)).body.progress[0].memorized).toBe(false);
    expect(await api.db.kanjiProgress.count()).toBe(1);
  });
  it('isolates accounts and rejects a stale page after another tab switches accounts', async () => {
    const first = await post('/register', userInput).expect(201);
    const second = await post('/register', { ...userInput, email: 'second@example.com' }).expect(201);
    await save(cookie(first), first.body.user.id).expect(200);
    expect((await read(cookie(second))).body.progress).toEqual([]);
    await save(cookie(second), first.body.user.id).expect(409);
    await save(cookie(second), second.body.user.id, { memorized: false }).expect(200);
    expect((await read(cookie(first))).body.progress[0].memorized).toBe(true);
    expect((await read(cookie(second))).body.progress[0].memorized).toBe(false);
    await api.db.user.delete({ where: { id: first.body.user.id } });
    await read(cookie(first)).expect(401);
    expect(await api.db.kanjiProgress.count()).toBe(1);
  });
  it('rejects unknown cards, spoofed ownership, invalid ratings and foreign origins', async () => {
    const registered = await post('/register', userInput).expect(201);
    const sid = cookie(registered), id = registered.body.user.id;
    await save(sid, id, { kanjiId: 'k-99999' }).expect(400);
    await save(sid, id, { memorized: 'true' }).expect(400);
    await save(sid, id, { userId: id }).expect(400);
    await request(api.app).post('/api/progress/kanji').set('Cookie', sid)
      .set('Origin', 'https://example.com').send({ kanjiId: 'k-1', memorized: true, expectedUserId: id }).expect(403);
    expect(await api.db.kanjiProgress.count()).toBe(0);
  });
  it('returns a retryable error when saving fails and leaves progress unchanged', async () => {
    const registered = await post('/register', userInput).expect(201);
    vi.spyOn(api.db.kanjiProgress, 'upsert').mockRejectedValueOnce(new Error('private connection details'));
    const response = await save(cookie(registered), registered.body.user.id).expect(503);
    expect(JSON.stringify(response.body)).not.toContain('private connection details');
    expect(await api.db.kanjiProgress.count()).toBe(0);
    // Reconnect with a real Prisma client after the simulated outage.
    await api.close(); api = createApp(config);
    await save(cookie(registered), registered.body.user.id).expect(200);
    expect(await api.db.kanjiProgress.count()).toBe(1);
  });
});

describe('starred review decks and preserved history', () => {
  const reset = (sid: string, id: string, category='kanji', expectedCount=1) => request(api.app).post('/api/review/reset').set('Origin',config.APP_ORIGIN).set('Cookie',sid).send({expectedUserId:id,category,expectedCount});
  const star = (sid: string, id: string, overrides: Record<string, unknown> = {}) => request(api.app).post('/api/review/star').set('Origin', config.APP_ORIGIN).set('Cookie', sid).send({expectedUserId:id,category:'kanji',sourceId:'k-1',front:'一',back:'Một',active:true,...overrides});
  const rate = (sid: string, id: string, card: {id:string;version:number}, rating='good') => request(api.app).post('/api/review/rate').set('Origin',config.APP_ORIGIN).set('Cookie',sid).send({expectedUserId:id,id:card.id,version:card.version,rating,elapsedMs:2500});
  const list = (sid: string) => request(api.app).get('/api/review').set('Cookie',sid);
  it('resets only active cards of the chosen category and owner, preserves history and rejects old review screens', async () => {
    const user=await post('/register',userInput), other=await post('/register',{...userInput,email:'reset-other@example.com'});
    const sid=cookie(user),id=user.body.user.id;
    for (const category of ['kanji','vocab','grammar']) {
      const card=(await star(sid,id,{category})).body.card;
      await rate(sid,id,card).expect(200);
    }
    const paused=(await star(sid,id,{sourceId:'k-2'})).body.card;
    await rate(sid,id,paused).expect(200);
    await star(sid,id,{sourceId:'k-2',active:false});
    await star(cookie(other),other.body.user.id);
    const before=await api.db.reviewCard.findMany({orderBy:{id:'asc'}});
    const events=await api.db.reviewEvent.findMany({orderBy:{id:'asc'}});
    const old=before.find(c=>c.userId===id && c.category==='kanji' && c.active)!;
    await reset(sid,id).expect(200,{count:1});
    const after=await api.db.reviewCard.findMany({orderBy:{id:'asc'}});
    expect(after.filter(c=>c.id!==old.id)).toEqual(before.filter(c=>c.id!==old.id));
    expect(after.find(c=>c.id===old.id)).toMatchObject({reviewCount:0,intervalSeconds:0,version:old.version+1});
    expect(after.find(c=>c.id===old.id)!.dueAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(await api.db.reviewEvent.findMany({orderBy:{id:'asc'}})).toEqual(events);
    await rate(sid,id,old).expect(409);
    const stats=(await list(sid)).body.stats[0];
    expect(stats).toMatchObject({total:2,averageMs:2500,averagePerDay:2,distribution:{good:2}});
    const fresh=after.find(c=>c.id===old.id)!;
    await rate(sid,id,fresh).expect(200);
    expect(await api.db.reviewEvent.count()).toBe(5);
  });
  it('guards reset session, origin, changed account and confirmation count', async () => {
    await request(api.app).post('/api/review/reset').set('Origin',config.APP_ORIGIN).send({}).expect(401);
    const user=await post('/register',userInput),other=await post('/register',{...userInput,email:'reset-other@example.com'});
    const sid=cookie(user),id=user.body.user.id;
    const card=(await star(sid,id)).body.card;
    await reset(sid,other.body.user.id).expect(409);
    await reset(sid,id,'kanji',2).expect(409);
    await reset(sid,id,'invalid').expect(400);
    await request(api.app).post('/api/review/reset').set('Cookie',sid).set('Origin','https://example.com').send({}).expect(403);
    expect((await list(sid)).body.cards[0]).toEqual(card);
    await reset(sid,id,'vocab',0).expect(200,{count:0});
  });
  it.each(['kanji','vocab','grammar'])('preserves %s history across remove, re-add and reset', async category => {
    const user=await post('/register',userInput),sid=cookie(user),id=user.body.user.id;
    const card=(await star(sid,id,{category})).body.card;
    const rated=(await rate(sid,id,card,'hard').expect(200)).body.card;
    await star(sid,id,{category,active:false}).expect(200);
    const resumed=(await star(sid,id,{category})).body.card;
    expect(resumed).toMatchObject({dueAt:rated.dueAt,intervalSeconds:360,reviewCount:1});
    await reset(sid,id,category).expect(200);
    expect((await list(sid)).body.stats.find((s:any)=>s.category===category)).toMatchObject({total:1,distribution:{hard:1}});
  });
  it('rolls back a failed save and permits retry without a duplicate event', async () => {
    const user=await post('/register',userInput),sid=cookie(user),id=user.body.user.id;
    const card=(await star(sid,id)).body.card;
    vi.spyOn(api.db,'$transaction').mockRejectedValueOnce(new Error('simulated outage'));
    await rate(sid,id,card).expect(503);
    expect((await list(sid)).body.cards[0]).toEqual(card);
    expect(await api.db.reviewEvent.count()).toBe(0);
    await api.close(); api=createApp(config);
    await rate(sid,id,card).expect(200);
    await rate(sid,id,card).expect(409);
    expect(await api.db.reviewEvent.count()).toBe(1);
  });
  it('requires login and rejects foreign origins and unexpected fields', async () => {
    await request(api.app).get('/api/review').expect(401);
    const user=await post('/register',userInput);const sid=cookie(user),id=user.body.user.id;
    await star(sid,id,{userId:id}).expect(400);
    await star(sid,id,{category:'admin'}).expect(400);
    await star(sid,id,{front:''}).expect(400);
    await request(api.app).post('/api/review/star').set('Cookie',sid).set('Origin','https://example.com').send({}).expect(403);
    expect(await api.db.reviewCard.count()).toBe(0);
  });
  it('creates one due card per source/category/account and separates all three categories', async () => {
    const user=await post('/register',userInput);const sid=cookie(user),id=user.body.user.id;
    await Promise.all([star(sid,id).expect(200),star(sid,id).expect(200)]);
    await star(sid,id,{category:'vocab'}).expect(200);
    await star(sid,id,{category:'grammar'}).expect(200);
    const result=await list(sid).expect(200);
    expect(result.body.cards).toHaveLength(3);
    expect(result.body.cards.every((c:any)=>c.active && c.reviewCount===0 && new Date(c.dueAt)<=new Date())).toBe(true);
    expect(result.body.cards[0]).not.toHaveProperty('userId');
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it('preserves history, due date and interval on unstar/re-star, including after restart', async () => {
    const user=await post('/register',userInput);const sid=cookie(user),id=user.body.user.id;
    const created=await star(sid,id);
    const rated=await rate(sid,id,created.body.card).expect(200);
    const paused=await star(sid,id,{active:false}).expect(200);
    expect(paused.body.card).toMatchObject({active:false,reviewCount:1,intervalSeconds:86400,dueAt:rated.body.card.dueAt});
    await rate(sid,id,paused.body.card).expect(409);
    await api.close();api=createApp(config);
    const resumed=await star(sid,id).expect(200);
    expect(resumed.body.card).toMatchObject({active:true,reviewCount:1,dueAt:rated.body.card.dueAt});
    await rate(sid,id,resumed.body.card).expect(409);
    expect(await api.db.reviewEvent.count()).toBe(1);
    expect((await list(sid)).body.stats[0]).toMatchObject({category:'kanji',total:1,today:1,week:1,averageMs:2500});
  });
  it('makes an overdue reactivated card available immediately and expands a good interval', async () => {
    const user=await post('/register',userInput);const sid=cookie(user),id=user.body.user.id;
    const card=(await star(sid,id)).body.card;
    await rate(sid,id,card).expect(200);
    await star(sid,id,{active:false});
    await api.db.reviewCard.update({where:{id:card.id},data:{dueAt:new Date(Date.now()-1000)}});
    const resumed=(await star(sid,id)).body.card;
    expect(new Date(resumed.dueAt).getTime()).toBeLessThan(Date.now());
    const next=await rate(sid,id,resumed).expect(200);
    expect(next.body.card.intervalSeconds).toBe(172800);
    expect(next.body.card.reviewCount).toBe(2);
  });
  it('records exactly one event for concurrent repeated ratings', async () => {
    const user=await post('/register',userInput);const sid=cookie(user),id=user.body.user.id;
    const card=(await star(sid,id)).body.card;
    const results=await Promise.all([rate(sid,id,card,'again'),rate(sid,id,card,'again')]);
    expect(results.map(r=>r.status).sort()).toEqual([200,409]);
    expect(await api.db.reviewEvent.count()).toBe(1);
    expect((await list(sid)).body.cards[0].intervalSeconds).toBe(60);
  });
  it('blocks access across users and stale account writes', async () => {
    const first=await post('/register',userInput),second=await post('/register',{...userInput,email:'other-review@example.com'});
    const sid=cookie(first),otherSid=cookie(second),id=first.body.user.id,otherId=second.body.user.id;
    const card=(await star(sid,id)).body.card;
    expect((await list(otherSid)).body.cards).toEqual([]);
    await rate(otherSid,otherId,card).expect(404);
    await star(otherSid,id).expect(409);
    expect(await api.db.reviewEvent.count()).toBe(0);
  });
  it('saves the hard and easy schedules and allows removal without erasing events', async () => {
    const user=await post('/register',userInput);const sid=cookie(user),id=user.body.user.id;
    for(const [rating,seconds,sourceId] of [['hard',360,'k-1'],['easy',345600,'k-2']] as const){
      const card=(await star(sid,id,{sourceId}).expect(200)).body.card;
      expect((await rate(sid,id,card,rating).expect(200)).body.card.intervalSeconds).toBe(seconds);
      await star(sid,id,{sourceId,active:false}).expect(200);
    }
    expect(await api.db.reviewEvent.count()).toBe(2);
    expect((await list(sid)).body.cards.every((c:any)=>!c.active)).toBe(true);
  });
});
