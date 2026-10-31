import { randomUUID } from 'node:crypto';
import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest';
import request from 'supertest';
import {createApp} from '../src/app.js';
import {vietnamDay} from '../src/modules/notifications/notifications.routes.js';
const databaseUrl=process.env.TEST_DATABASE_URL!;
if(!new URL(databaseUrl).pathname.endsWith('_test'))throw new Error('Test database required');
const config={NODE_ENV:'test' as const,PORT:3001,APP_ORIGIN:'http://localhost:3000',DATABASE_URL:databaseUrl,SESSION_SECRET:'notification-test-secret-at-least-thirty-two-characters',GOOGLE_CLIENT_ID:''};
let api:ReturnType<typeof createApp>;
const users:{id:string;cookie:string}[]=[];
beforeAll(async()=>{
 api=createApp(config);
 for(let i=0;i<2;i++){
  const result=await request(api.app).post('/api/auth/register').set('Origin',config.APP_ORIGIN).send({name:'Notification QA',email:`notify-${randomUUID()}@example.test`,password:'Notification QA only password 123'}).expect(201);
  users.push({id:result.body.user.id,cookie:result.headers['set-cookie'][0].split(';')[0]});
 }
});
afterAll(async()=>{vi.useRealTimers();for(const u of users){await api.pool.query("DELETE FROM sessions WHERE sess->>'userId'=$1",[u.id]);await api.db.user.delete({where:{id:u.id}});}await api.close();});
const get=(user=users[0])=>request(api.app).get(`/api/notifications?expectedUserId=${user.id}`).set('Cookie',user.cookie);
const mark=(day:string,categories=['kanji'],user=users[0])=>request(api.app).post('/api/notifications/read').set('Origin',config.APP_ORIGIN).set('Cookie',user.cookie).send({expectedUserId:user.id,day,categories});
describe('O01 review notifications',()=>{
 it('requires session, matching account and same-origin JSON',async()=>{
  await request(api.app).get(`/api/notifications?expectedUserId=${users[0].id}`).expect(401);
  await request(api.app).get(`/api/notifications?expectedUserId=${users[1].id}`).set('Cookie',users[0].cookie).expect(409);
  await request(api.app).post('/api/notifications/read').set('Cookie',users[0].cookie).send({}).expect(403);
  await request(api.app).post('/api/notifications/read').set('Origin',config.APP_ORIGIN).set('Cookie',users[0].cookie).send({expectedUserId:users[1].id,day:vietnamDay(new Date()),categories:['kanji']}).expect(409);
 });
 it('starts empty and groups only own active due cards',async()=>{
  expect((await get().expect(200)).body.items).toEqual([]);
  const now=Date.now();
  await api.db.reviewCard.createMany({data:[
   {userId:users[0].id,category:'kanji',sourceId:'notify-one',front:'一',back:'one',dueAt:new Date(now-1000)},
   {userId:users[0].id,category:'vocab',sourceId:'notify-two',front:'二',back:'two',dueAt:new Date(now-1000)},
   {userId:users[0].id,category:'grammar',sourceId:'notify-future',front:'も',back:'also',dueAt:new Date(now+3600000)},
   {userId:users[0].id,category:'kanji',sourceId:'notify-inactive',front:'三',back:'three',active:false},
   {userId:users[1].id,category:'kanji',sourceId:'other-user',front:'四',back:'four'},
  ]});
  const result=await get().expect(200);expect(result.body.items.map((i:any)=>[i.category,i.count,i.read])).toEqual([['kanji',1,false],['vocab',1,false]]);expect(result.body.nextDueAt).toBeTruthy();expect(result.headers['cache-control']).toBe('no-store');
 });
 it('read survives GET, repeat clicks and additional due cards in same day',async()=>{
  const day=(await get()).body.day;
  await Promise.all([mark(day).expect(200),mark(day).expect(200)]);
  await api.db.reviewCard.create({data:{userId:users[0].id,category:'kanji',sourceId:'notify-extra',front:'五',back:'five'}});
  const result=(await get()).body;expect(result.items[0]).toMatchObject({count:2,read:true});expect(result.items[1].read).toBe(false);
  expect((await get(users[1])).body.items[0].read).toBe(false);
  expect(await api.db.notificationRead.count({where:{userId:users[0].id,category:'kanji'}})).toBe(1);
 });
 it('marks all visible groups but not future groups and disappears when no longer due',async()=>{
  const day=(await get()).body.day;await mark(day,['kanji','vocab','grammar']).expect(200);
  expect(await api.db.notificationRead.count({where:{userId:users[0].id,category:'grammar'}})).toBe(0);
  await api.db.reviewCard.updateMany({where:{userId:users[0].id,category:'kanji'},data:{active:false}});
  await api.db.reviewCard.updateMany({where:{userId:users[0].id,category:'vocab'},data:{dueAt:new Date(Date.now()+3600000)}});
  expect((await get()).body.items).toEqual([]);
  await api.db.reviewCard.updateMany({where:{userId:users[0].id,sourceId:'notify-one'},data:{active:true}});
  expect((await get()).body.items[0].read).toBe(true);
 });
 it('uses Vietnam midnight, renews unread next day and rejects stale-day writes',async()=>{
  const oldDay=(await get()).body.day;
  const boundary=new Date(Date.parse(`${oldDay}T00:00:00+07:00`)+86400000);
  expect(vietnamDay(new Date(boundary.getTime()-1))).toBe(oldDay);
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(boundary);
  const result=(await get()).body;expect(result.day).not.toBe(oldDay);expect(result.items[0].read).toBe(false);
  await mark(oldDay).expect(409);await mark(result.day).expect(200);expect((await get()).body.items[0].read).toBe(true);
  vi.useRealTimers();
 });
});
