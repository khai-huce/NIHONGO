import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createJlpt, publishJlpt, saveJlpt, changeJlptStatus } from '../src/modules/jlpt/jlpt.service.js';
import { parseJlptDraft } from '../src/modules/jlpt/jlpt.schema.js';
const databaseUrl = process.env.TEST_DATABASE_URL!;
if (!new URL(databaseUrl).pathname.endsWith('_test')) throw new Error('Test DB required');
const config = { NODE_ENV: 'test' as const, PORT: 3001, APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: databaseUrl, SESSION_SECRET: 'jlpt-study-only-test-secret-123456789', GOOGLE_CLIENT_ID: '' };
let api: ReturnType<typeof createApp>, users: Array<{id: string; cookie: string}>, roadmap: Awaited<ReturnType<typeof publishJlpt>>, source: string;
const root = '/api/jlpt/study';
const post = (path: string, body: object = {}, user = users[0]) => request(api.app).post(root + path).set('Origin',config.APP_ORIGIN).set('Cookie', user.cookie).send({expectedUserId:user.id,...body});
const get = (path: string, user = users[0]) => request(api.app).get(root+path).set('Cookie',user.cookie);
const questions = () => Array.from({length:5}, (_, i)=>({id:randomUUID(),prompt:`Chọn đáp án ${i}`,passage:'',options:['A','B','C','D'],correctIndex:i%4,explanation:'Đáp án đã biên soạn.'}));
const sid = (i=0) => roadmap.draft.sessions[i].id;
const start = async (i=0, user=users[0]) => (await post(`/roadmaps/N5/sessions/${sid(i)}/attempts`,{id:randomUUID(),publishedVersion:roadmap.publishedVersion},user).expect(200)).body.attempt;
const answers = (i=0, right=5) => Object.fromEntries(roadmap.draft.sessions[i].questions!.map((q,n)=>[q.id,n<right?q.correctIndex:(q.correctIndex+1)%4]));
beforeEach(async()=>{
  api=createApp(config); users=[];
  for(let i=0;i<2;i++) { const r=await request(api.app).post('/api/auth/register').set('Origin',config.APP_ORIGIN).send({name:'J02 QA',email:`j02-${randomUUID()}@example.test`,password:'J02-test-password-12345'}).expect(201);users.push({id:r.body.user.id,cookie:(r.headers['set-cookie'] as unknown as string[])[0].split(';')[0]}); }
  source=`j02-${randomUUID()}`;
  await api.db.contentSource.create({data:{id:source,name:'Disposable test',url:'urn:test',license:'Test',licenseUrl:'urn:test',version:'1',checksum:'',attribution:'Test',notes:''}});
  const draft=parseJlptDraft({title:'J02 tests',sourceId:source,passPercent:80,sessions:[0,1].map(i=>({id:randomUUID(),title:`Buổi ${i+1}`,estimatedMinutes:30,resources:[{id:randomUUID(),kind:'kana',targetId:i?'katakana':'hiragana'}],questions:questions()}))});
  const created=await createJlpt(api.db,{id:randomUUID(),level:'N5',draft});roadmap=await publishJlpt(api.db,created.roadmap.id,created.roadmap.version);
});
afterEach(async()=>{
  await api.db.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
  if(roadmap){await api.db.jlptResource.deleteMany({where:{session:{roadmapId:roadmap.id}}});await api.db.jlptSession.deleteMany({where:{roadmapId:roadmap.id}});await api.db.jlptRoadmap.delete({where:{id:roadmap.id}});}
  await api.db.contentSource.deleteMany({where:{id:source}});await api.close();
});
describe('J02/J03 account study and authoritative exams',()=>{
  it('waits for an editorial lock longer than the default transaction timeout without losing a study read',async()=>{
    let ready!:()=>void;const held=new Promise<void>(resolve=>{ready=resolve;});
    const editor=api.db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM jlpt_roadmaps WHERE id=${roadmap.id}::uuid FOR UPDATE`;ready();await tx.$executeRaw`SELECT pg_sleep(6)`;},{timeout:15000});
    await held;
    const [catalog,study]=await Promise.all([request(api.app).get('/api/jlpt/roadmaps/N5'),get('/roadmaps/N5'),editor]);
    expect(catalog.status).toBe(200);expect(study.status).toBe(200);expect(study.body.completedCount).toBe(0);
  });
  it('requires session, same origin and matching account; public catalog never leaks answer keys',async()=>{
    await request(api.app).get(root+'/roadmaps/N5').expect(401);
    await post(`/roadmaps/N5/sessions/${sid()}/open`,{publishedVersion:roadmap.publishedVersion,expectedUserId:users[1].id}).expect(409);
    await request(api.app).post(root+`/roadmaps/N5/sessions/${sid()}/open`).set('Cookie',users[0].cookie).send({expectedUserId:users[0].id,publishedVersion:1}).expect(403);
    const publicBody=(await request(api.app).get('/api/jlpt/roadmaps/N5').expect(200)).body;
    expect(JSON.stringify(publicBody)).not.toMatch(/correctIndex|explanation|Chọn đáp án/);
    expect(publicBody.roadmap.sessions[0].questionCount).toBe(5);
  });
  it('opening and reading never completes or earns XP; locked sessions reject direct starts',async()=>{
    const state=(await get('/roadmaps/N5').expect(200)).body;expect(state.percent).toBe(0);expect(state.sessions[1].unlocked).toBe(false);
    expect(await api.db.jlptEnrollment.count({where:{userId:users[0].id}})).toBe(0);
    await post(`/roadmaps/N5/sessions/${sid()}/open`,{publishedVersion:roadmap.publishedVersion}).expect(200);
    await post(`/roadmaps/N5/sessions/${sid(1)}/attempts`,{id:randomUUID(),publishedVersion:roadmap.publishedVersion}).expect(403);
    expect((await get('/roadmaps/N5')).body.completedCount).toBe(0);
    expect(await api.db.xpEvent.count({where:{userId:users[0].id}})).toBe(0);
  });
  it('persists partial answers and resumes one active attempt without exposing the key',async()=>{
    const a=await start(), b=await start();expect(a.id).toBe(b.id);expect(JSON.stringify(a)).not.toMatch(/correctIndex|explanation/);
    const partial=Object.fromEntries(Object.entries(answers()).slice(0,2));
    const saved=(await post(`/attempts/${a.id}/save`,{version:a.version,answers:partial}).expect(200)).body.attempt;
    expect((await get(`/attempts/${a.id}`)).body.attempt.answers).toEqual(partial);
    await post(`/attempts/${a.id}/submit`,{version:saved.version,answers:partial}).expect(400);
    await get(`/attempts/${a.id}`,users[1]).expect(404);
    await post(`/attempts/${a.id}/submit`,{version:saved.version,answers:answers()},users[1]).expect(404);
  });
  it('scores below and exactly 80%, unlocks sequentially and preserves high score and completion on replay',async()=>{
    let a=await start();let result=(await post(`/attempts/${a.id}/submit`,{version:0,answers:answers(0,3)}).expect(200)).body.attempt;
    expect(result.passed).toBe(false);expect(result.score).toBe(60);expect((await get('/roadmaps/N5')).body.sessions[1].unlocked).toBe(false);
    a=await start();result=(await post(`/attempts/${a.id}/submit`,{version:0,answers:answers(0,4)})).body.attempt;
    expect(result.passed).toBe(true);expect(result.questions[0].correctIndex).toBe(0);
    const state=(await get('/roadmaps/N5')).body;expect(state.completedCount).toBe(1);expect(state.sessions[1].unlocked).toBe(true);expect(state.streak).toBe(1);
    a=await start();await post(`/attempts/${a.id}/submit`,{version:0,answers:answers(0,0)}).expect(200);
    const after=(await get('/roadmaps/N5')).body;expect(after.sessions[0].bestScore).toBe(80);expect(after.sessions[0].completedAt).toBe(state.sessions[0].completedAt);expect(after.sessions[0].attempts).toBe(3);
  });
  it('serializes double submission, prevents stale saves and does not award SRS/XP',async()=>{
    const a=await start(); const body={version:0,answers:answers()};
    const results=await Promise.all([post(`/attempts/${a.id}/submit`,body),post(`/attempts/${a.id}/submit`,body)]);expect(results.map(r=>r.status)).toEqual([200,200]);
    expect((await get('/roadmaps/N5')).body.sessions[0].attempts).toBe(1);
    await post(`/attempts/${a.id}/save`,{version:0,answers:answers(0,0)}).expect(409);
    expect(await api.db.reviewCard.count({where:{userId:users[0].id}})).toBe(0);expect(await api.db.xpEvent.count({where:{userId:users[0].id}})).toBe(0);
  });
  it('invalidates unfinished old exams on publication, uses configured percentage, keeps historical snapshots',async()=>{
    const stale=await start();const completed=await start(0,users[1]);await post(`/attempts/${completed.id}/submit`,{version:0,answers:answers()},users[1]).expect(200);
    const draft={...roadmap.draft,passPercent:100};draft.sessions[0].questions![0].prompt='Đề đã sửa';
    const saved=await saveJlpt(api.db,roadmap.id,roadmap.version,draft);roadmap=await publishJlpt(api.db,saved.id,saved.version);
    await post(`/attempts/${stale.id}/submit`,{version:0,answers:answers()}).expect(409);
    const a=await start();expect(a.passPercent).toBe(100);expect((await post(`/attempts/${a.id}/submit`,{version:0,answers:answers(0,4)})).body.attempt.passed).toBe(false);
    expect((await get(`/attempts/${completed.id}`,users[1])).body.attempt.questions[0].prompt).toBe('Chọn đáp án 0');
    expect((await get('/roadmaps/N5',users[1])).body.completedCount).toBe(1);
  });
  it('keeps results after archive and preserves Vietnamese study dates',async()=>{
    const a=await start();await post(`/attempts/${a.id}/submit`,{version:0,answers:answers()});
    await changeJlptStatus(api.db,roadmap.id,roadmap.version,'archive');
    await get('/roadmaps/N5').expect(404);expect((await get(`/attempts/${a.id}`)).body.attempt.score).toBe(100);
    const history=(await get(`/sessions/${sid()}/attempts`)).body;expect(history.total).toBe(1);expect(history.items[0].id).toBe(a.id);
  });
  it('rejects reusing an obsolete attempt id and isolates simultaneous UUID collisions',async()=>{
    const id=randomUUID();
    const results=await Promise.all(users.map(user=>post(`/roadmaps/N5/sessions/${sid()}/attempts`,{id,publishedVersion:roadmap.publishedVersion},user)));
    expect(results.map(r=>r.status).sort()).toEqual([200,404]);
    const owner=users[results.findIndex(r=>r.status===200)];
    const saved=await saveJlpt(api.db,roadmap.id,roadmap.version,{...roadmap.draft,passPercent:90});
    roadmap=await publishJlpt(api.db,saved.id,saved.version);
    await post(`/roadmaps/N5/sessions/${sid()}/attempts`,{id,publishedVersion:roadmap.publishedVersion},owner).expect(409);
  });
  it('keeps completed sessions accessible after reorder but requires every predecessor for new sessions',async()=>{
    const a=await start();await post(`/attempts/${a.id}/submit`,{version:0,answers:answers()}).expect(200);
    const third={id:randomUUID(),title:'Buổi ba',description:'',estimatedMinutes:20,resources:[{id:randomUUID(),kind:'kana' as const,targetId:'hiragana'}],questions:questions()};
    const saved=await saveJlpt(api.db,roadmap.id,roadmap.version,{...roadmap.draft,sessions:[roadmap.draft.sessions[1],roadmap.draft.sessions[0],third]});
    roadmap=await publishJlpt(api.db,saved.id,saved.version);
    const state=(await get('/roadmaps/N5')).body;
    expect(state.sessions.map((s:{unlocked:boolean})=>s.unlocked)).toEqual([true,true,false]);
    expect(state.completedCount).toBe(1);
    await post(`/roadmaps/N5/sessions/${third.id}/attempts`,{id:randomUUID(),publishedVersion:roadmap.publishedVersion}).expect(403);
  });
});
