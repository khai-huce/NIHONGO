import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config/env.js';
import type { CurriculumDraft } from '../src/modules/curriculum/curriculum.schema.js';

const databaseUrl=process.env.TEST_DATABASE_URL!;
const url=new URL(databaseUrl);
if(!['localhost','127.0.0.1'].includes(url.hostname)||!/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1)))throw new Error('Refusing non-test database');
const config:Config={NODE_ENV:'test',PORT:3001,APP_ORIGIN:'http://localhost:3000',ADMIN_ORIGIN:'http://localhost:3002',DATABASE_URL:databaseUrl,SESSION_SECRET:'test-only-secret-at-least-thirty-two-characters',GOOGLE_CLIENT_ID:'test-client.apps.googleusercontent.com'};
let api:ReturnType<typeof createApp>,courseIds:string[],userIds:string[],sourceId:string;
type User={id:string;cookie:string};
type Course={id:string;slug:string;version:number;draft:CurriculumDraft};
async function register(admin=false):Promise<User>{
  const result=await request(api.app).post('/api/auth/register').set('Origin',config.APP_ORIGIN).send({email:`c02-${randomUUID()}@example.test`,name:'C02 QA',password:'c02-test-password-12345'}).expect(201);
  const id=result.body.user.id;userIds.push(id);if(admin)await api.db.user.update({where:{id},data:{role:'admin'}});
  return {id,cookie:(result.headers['set-cookie'] as unknown as string[])[0].split(';')[0]};
}
const write=(user:User,path:string,body:object,method:'post'|'patch'='post')=>request(api.app)[method](path).set('Cookie',user.cookie).set('Origin',config.ADMIN_ORIGIN!).send({expectedUserId:user.id,...body});
const get=(path:string,user?:User)=>{const req=request(api.app).get(path);return user?req.set('Cookie',user.cookie):req;};
const endpoint='/api/admin/curriculum/courses';
function draft():CurriculumDraft{return {title:'C02 giáo trình kiểm thử',subtitle:'',description:'',level:'N5',style:'custom',sourceId,topics:[{id:randomUUID(),title:'Món ăn',japanese:'食べ物',lessons:[{id:randomUUID(),title:'Bài 1',words:[
  {id:randomUUID(),word:'水',reading:'みず',hanViet:'THỦY',meaning:'Nước'},
  {id:randomUUID(),word:'山',reading:'やま',hanViet:'SƠN',meaning:'Núi'},
  {id:randomUUID(),word:'学校',reading:'がっこう',hanViet:'HỌC HIỆU',meaning:'Trường học'},
].map(word=>({...word,romaji:'',partOfSpeech:[],exampleJp:'',exampleVi:'',ruby:[]}))}]}]};}
async function create(admin:User,content=draft(),publish=true):Promise<Course>{
  const id=randomUUID(),slug=`c02-test-${id}`;courseIds.push(id);
  const response=await write(admin,endpoint,{id,slug,draft:content}).expect(201);
  return publish?(await write(admin,`${endpoint}/${id}/publish`,{version:response.body.course.version}).expect(200)).body.course:response.body.course;
}
const lesson=(course:Course)=>course.draft.topics[0].lessons[0];
const context=(course:Course,user:User)=>({expectedUserId:user.id,lessonId:lesson(course).id,lessonVersion:course.version});
const rate=(course:Course,user:User,index:number,version:number,memorized=false)=>write(user,'/api/curriculum/progress/rate',{...context(course,user),progressVersion:version,wordId:lesson(course).words[index].id,memorized});
const answers=(course:Course)=>lesson(course).words.map(word=>({wordId:word.id,answer:word.reading}));
const resultBody=(course:Course)=>({id:randomUUID(),lessonId:lesson(course).id,lessonVersion:course.version,kind:'quiz',mode:'reading',answers:answers(course)});

beforeEach(async()=>{
  api=createApp(config);courseIds=[];userIds=[];sourceId=`c02-test-${randomUUID()}`;
  await api.db.contentSource.create({data:{id:sourceId,name:'C02 test only',url:'urn:nihongo:c02-test',license:'Disposable test fixture',licenseUrl:'urn:nihongo:c02-test-permission',version:'1',checksum:'',attribution:'C02 tests',notes:''}});
});
afterEach(async()=>{
  await api.db.user.deleteMany({where:{id:{in:userIds}}});
  await api.db.curriculumLesson.deleteMany({where:{courseId:{in:courseIds}}});
  await api.db.curriculumTopic.deleteMany({where:{courseId:{in:courseIds}}});
  await api.db.curriculumCourse.deleteMany({where:{id:{in:courseIds}}});
  await api.db.contentSource.delete({where:{id:sourceId}});
  await api.close();
});

describe('C02 catalog, account study and curriculum stars',()=>{
  it('keeps public reads guest-accessible and protects writes by role/origin/account',async()=>{
    await get('/api/curriculum/courses').expect(200);
    await get(endpoint).expect(401);await get('/api/curriculum/progress').expect(401);
    const user=await register(),admin=await register(true);
    await write(user,endpoint,{id:randomUUID(),slug:'blocked',draft:draft()}).expect(403);
    await request(api.app).post(endpoint).set('Cookie',admin.cookie).set('Origin','https://wrong.test').send({}).expect(403);
    await write(admin,endpoint,{id:randomUUID(),slug:'blocked',draft:draft(),expectedUserId:user.id}).expect(409);
    await request(api.app).post('/api/auth/login').set('Origin',config.APP_ORIGIN).send({padding:'x'.repeat(17000)}).expect(413);
  });
  it('previews without writes, hides drafts and publishes exact hierarchy/counts',async()=>{
    const admin=await register(true),content=draft();
    const preview=await write(admin,`${endpoint}/preview`,{draft:content}).expect(200);
    expect(preview.body.counts).toEqual({topicCount:1,lessonCount:1,wordCount:3});
    expect(await api.db.curriculumCourse.count({where:{sourceId}})).toBe(0);
    const course=await create(admin,content,false);
    await get(`/api/curriculum/courses/${course.slug}`).expect(404);
    await write(admin,`${endpoint}/${course.id}/publish`,{version:0}).expect(200);
    const outline=(await get(`/api/curriculum/courses/${course.slug}`).expect(200)).body.course;
    expect([outline.topicCount,outline.lessonCount,outline.wordCount]).toEqual([1,1,3]);
    const loaded=(await get(`/api/curriculum/courses/${course.slug}/lessons/${lesson(course).id}`).expect(200)).body.lesson;
    expect(loaded.words).toEqual(content.topics[0].lessons[0].words);
    expect((await get(endpoint,admin).expect(200)).body.items.find((item:Course)=>item.id===course.id).draft).toBeUndefined();
  });
  it('requires real source and nonempty topics/lessons to publish',async()=>{
    const admin=await register(true),content=draft();content.sourceId=null;
    const course=await create(admin,content,false);
    await write(admin,`${endpoint}/${course.id}/publish`,{version:0}).expect(400);
    content.sourceId=sourceId;content.topics[0].lessons[0].words=[];
    await write(admin,`${endpoint}/${course.id}`,{version:0,draft:content},'patch').expect(200);
    await write(admin,`${endpoint}/${course.id}/publish`,{version:1}).expect(400);
    content.sourceId='not-a-real-source';
    await write(admin,`${endpoint}/${course.id}`,{version:1,draft:content},'patch').expect(400);
  });
  it('validates duplicate IDs, ruby mapping, word bounds and immutable slug',async()=>{
    const admin=await register(true),content=draft();content.topics[0].lessons[0].words[1].id=content.topics[0].lessons[0].words[0].id;
    const invalid=await write(admin,`${endpoint}/preview`,{draft:content}).expect(400);expect(invalid.body.error.issues.length).toBeGreaterThan(0);
    const other=draft();other.topics[0].lessons[0].words[0].ruby=[{text:'違う',reading:'ちがう'}];
    await write(admin,`${endpoint}/preview`,{draft:other}).expect(400);
    const course=await create(admin);
    await write(admin,`${endpoint}/${course.id}`,{version:course.version,draft:course.draft,slug:'changed'},'patch').expect(400);
  });
  it('keeps create retries idempotent and rejects simultaneous stale saves',async()=>{
    const admin=await register(true),course=await create(admin,draft(),false);
    await write(admin,endpoint,{id:course.id,slug:course.slug,draft:course.draft}).expect(200);
    const results=await Promise.all([write(admin,`${endpoint}/${course.id}`,{version:0,draft:{...course.draft,title:'A'}},'patch'),write(admin,`${endpoint}/${course.id}`,{version:0,draft:{...course.draft,title:'B'}},'patch')]);
    expect(results.map(row=>row.status).sort()).toEqual([200,409]);
  });
  it('reserves IDs across drafts, parent moves and removed word identities',async()=>{
    const admin=await register(true),course=await create(admin),other=draft();other.topics[0].lessons[0].words[0].id=lesson(course).words[0].id;
    const id=randomUUID();courseIds.push(id);
    await write(admin,endpoint,{id,slug:`c02-test-${id}`,draft:other}).expect(409);
    const changed=structuredClone(course.draft);changed.topics[0].id=randomUUID();
    await write(admin,`${endpoint}/${course.id}`,{version:course.version,draft:changed},'patch').expect(409);
    const removed=structuredClone(course.draft);removed.topics[0].lessons[0].words.shift();
    await write(admin,`${endpoint}/${course.id}`,{version:course.version,draft:removed},'patch').expect(200);
    await write(admin,endpoint,{id,slug:`c02-test-${id}`,draft:other}).expect(409);
  });
  it('keeps public content unchanged while draft changes; rejects wrong course links',async()=>{
    const admin=await register(true),course=await create(admin),changed=structuredClone(course.draft);changed.topics[0].lessons[0].words[0].meaning='Nghĩa mới';
    await write(admin,`${endpoint}/${course.id}`,{version:course.version,draft:changed},'patch').expect(200);
    const path=`/api/curriculum/courses/${course.slug}/lessons/${lesson(course).id}`;
    expect((await get(path).expect(200)).body.lesson.words[0].meaning).toBe('Nước');
    await get(`/api/curriculum/courses/other-course/lessons/${lesson(course).id}`).expect(404);
    const published=await write(admin,`${endpoint}/${course.id}/publish`,{version:2}).expect(200);
    expect(published.body.course.version).toBe(3);expect((await get(path)).body.lesson.words[0].meaning).toBe('Nghĩa mới');
  });
  it('counts false assessments, completes only after all words and keeps completion on replay',async()=>{
    const admin=await register(true),user=await register(),course=await create(admin);
    const path=`/api/curriculum/progress/course?courseId=${course.id}`;
    await rate(course,user,0,0).expect(200);expect((await get(path,user)).body.completedLessonIds).toEqual([]);
    await rate(course,user,1,1,true).expect(200);await rate(course,user,2,2).expect(200);
    expect((await get(path,user)).body.completedLessonIds).toEqual([lesson(course).id]);
    const reset=await write(user,'/api/curriculum/progress/reset',{...context(course,user),progressVersion:3,confirmedCount:3}).expect(200);
    expect(reset.body.progress).toEqual([]);expect(reset.body.completedAt).toBeTruthy();
    expect((await get(path,user)).body.completedLessonIds).toHaveLength(1);
    expect(await api.db.reviewCard.count({where:{userId:user.id}})).toBe(0);
  });
  it('rejects duplicate concurrent ratings and stale screens after reset or publish',async()=>{
    const admin=await register(true),user=await register(),course=await create(admin);
    const pair=await Promise.all([rate(course,user,0,0),rate(course,user,1,0)]);expect(pair.map(row=>row.status).sort()).toEqual([200,409]);
    await write(user,'/api/curriculum/progress/reset',{...context(course,user),progressVersion:1,confirmedCount:1}).expect(200);
    await rate(course,user,0,1).expect(409);
    await write(admin,`${endpoint}/${course.id}/publish`,{version:course.version}).expect(200);
    await rate(course,user,0,2).expect(409);
  });
  it('separates accounts and never exposes personal lesson progress',async()=>{
    const admin=await register(true),a=await register(),b=await register(),course=await create(admin);
    await rate(course,a,0,0,true).expect(200);
    expect((await get(`/api/curriculum/progress?lessonId=${lesson(course).id}`,b)).body.progress).toEqual([]);
    await write(b,'/api/curriculum/progress/rate',{...context(course,a),progressVersion:0,wordId:lesson(course).words[0].id,memorized:true}).expect(409);
    await get(`/api/vocab/progress?lessonId=${lesson(course).id}`,a).expect(404);
  });
  it.each(['quiz','cram'])('server scores completed %s rounds, retries once and keeps latest result',async(kind)=>{
    const admin=await register(true),user=await register(),course=await create(admin),body={...resultBody(course),kind};body.answers[0].answer='sai';
    const result=await write(user,'/api/curriculum/results',body).expect(201);
    expect(result.body.result.correct).toBe(2);expect(result.body.result.total).toBe(3);
    expect((await api.db.xpEvent.aggregate({where:{userId:user.id},_sum:{points:true}}))._sum.points).toBe(2);
    await write(user,'/api/curriculum/results',body).expect(200);
    expect(await api.db.curriculumStudyResult.count({where:{userId:user.id}})).toBe(1);
    expect((await api.db.xpEvent.aggregate({where:{userId:user.id},_sum:{points:true}}))._sum.points).toBe(2);
    expect((await get(`/api/curriculum/progress/course?courseId=${course.id}`,user)).body.completedLessonIds).toHaveLength(1);
    expect((await get(`/api/curriculum/results?lessonId=${lesson(course).id}&kind=${kind}`,user)).body.result.id).toBe(body.id);
    expect(await api.db.reviewCard.count({where:{userId:user.id}})).toBe(0);
  });
  it('rejects partial, duplicate, fabricated scores and conflicting result retries',async()=>{
    const admin=await register(true),user=await register(),course=await create(admin),body=resultBody(course);
    await write(user,'/api/curriculum/results',{...body,answers:body.answers.slice(1)}).expect(400);
    await write(user,'/api/curriculum/results',{...body,answers:[...body.answers,body.answers[0]]}).expect(400);
    await write(user,'/api/curriculum/results',{...body,correct:500}).expect(400);
    await write(user,'/api/curriculum/results',body).expect(201);
    await write(user,'/api/curriculum/results',{...body,answers:body.answers.map(answer=>({...answer,answer:'sai'}))}).expect(409);
  });
  it('skips missing readings and refuses modes with no eligible words',async()=>{
    const admin=await register(true),user=await register(),content=draft();content.topics[0].lessons[0].words[0].reading='';
    const course=await create(admin,content),body=resultBody(course);body.answers=body.answers.slice(1);
    expect((await write(user,'/api/curriculum/results',body).expect(201)).body.result.total).toBe(2);
    const empty=draft();empty.topics[0].lessons[0].words.forEach(word=>{word.reading='';});const another=await create(admin,empty);
    await write(user,'/api/curriculum/results',resultBody(another)).expect(400);
  });
  it('bulk stars explicitly add all words once and retain schedules on repeated add',async()=>{
    const admin=await register(true),user=await register(),course=await create(admin);
    await write(user,'/api/curriculum/star-lesson',context(course,user)).expect(200);
    const cards=await api.db.reviewCard.findMany({where:{userId:user.id}});expect(cards).toHaveLength(3);
    const first=cards[0],dueAt=new Date(Date.now()+86400000);await api.db.reviewCard.update({where:{id:first.id},data:{dueAt,intervalSeconds:86400,reviewCount:2,active:false}});
    await write(user,'/api/curriculum/star-lesson',context(course,user)).expect(200);
    const after=await api.db.reviewCard.findUniqueOrThrow({where:{id:first.id}});expect(after.active).toBe(true);expect(after.dueAt).toEqual(dueAt);expect(after.intervalSeconds).toBe(86400);
    expect(await api.db.reviewCard.count({where:{userId:user.id}})).toBe(3);
  });
  it('server owns starred text; publish syncs snapshots while retaining history and due date',async()=>{
    const admin=await register(true),user=await register(),course=await create(admin),word=lesson(course).words[0];
    const starBody={category:'vocab',sourceId:`curriculum:${word.id}`,front:'forged',back:'forged',reading:'forged',active:true};
    const star=await write(user,'/api/review/star',starBody).expect(200);expect(star.body.card.front).toBe(word.word);
    await write(user,'/api/review/rate',{id:star.body.card.id,version:star.body.card.version,rating:'good',elapsedMs:1500}).expect(200);
    const before=await api.db.reviewCard.findUniqueOrThrow({where:{id:star.body.card.id}}),changed=structuredClone(course.draft);changed.topics[0].lessons[0].words[0].meaning='Nghĩa đã biên tập';
    await write(admin,`${endpoint}/${course.id}`,{version:1,draft:changed},'patch').expect(200);
    expect((await api.db.reviewCard.findUniqueOrThrow({where:{id:before.id}})).back).toBe('Nước');
    await write(admin,`${endpoint}/${course.id}/publish`,{version:2}).expect(200);
    const after=await api.db.reviewCard.findUniqueOrThrow({where:{id:before.id}});expect(after.back).toBe('Nghĩa đã biên tập');expect(after.dueAt).toEqual(before.dueAt);expect(after.reviewCount).toBe(before.reviewCount);
    expect(await api.db.reviewEvent.count({where:{cardId:before.id}})).toBe(1);
    await write(user,'/api/review/star',{...starBody,active:false}).expect(200);await write(user,'/api/review/star',starBody).expect(200);
    expect((await api.db.reviewCard.findUniqueOrThrow({where:{id:before.id}})).dueAt).toEqual(before.dueAt);
  });
  it('archive/restoredraft hide catalog, preserve results/stars and prevent new stars',async()=>{
    const admin=await register(true),user=await register(),other=await register(),course=await create(admin);
    await write(user,'/api/curriculum/results',resultBody(course)).expect(201);
    await write(user,'/api/curriculum/star-lesson',context(course,user)).expect(200);
    await write(admin,`${endpoint}/${course.id}/archive`,{version:1}).expect(200);
    await get(`/api/curriculum/courses/${course.slug}`).expect(404);
    await get(`/api/curriculum/progress?lessonId=${lesson(course).id}`,user).expect(404);
    const word=lesson(course).words[0],body={category:'vocab',sourceId:`curriculum:${word.id}`,front:word.word,back:word.meaning,active:true};
    await write(other,'/api/review/star',body).expect(404);
    await write(user,'/api/review/star',{...body,active:false}).expect(200);
    await write(admin,`${endpoint}/${course.id}/restore`,{version:2}).expect(200);
    await get(`/api/curriculum/courses/${course.slug}`).expect(404);
    await write(admin,`${endpoint}/${course.id}/publish`,{version:3}).expect(200);
    expect((await get(`/api/curriculum/progress/course?courseId=${course.id}`,user)).body.completedLessonIds).toHaveLength(1);
    expect(await api.db.curriculumStudyResult.count({where:{userId:user.id}})).toBe(1);
  });
  it('rechecks admin role from database instead of trusting the session',async()=>{
    const admin=await register(true),course=await create(admin);
    await api.db.user.update({where:{id:admin.id},data:{role:'user'}});
    await write(admin,`${endpoint}/${course.id}/publish`,{version:course.version}).expect(403);
    await get(`${endpoint}/${course.id}`,admin).expect(403);
  });
});

// Review combines published source words while retaining a separate account milestone.
const reviewBase='/api/curriculum/review-sets';
async function reviewSet(course:Course,user:User,ids=course.draft.topics.flatMap(topic=>topic.lessons.map(lesson=>lesson.id))){return (await write(user,reviewBase,{courseId:course.id,lessonIds:ids}).expect(200)).body.reviewSet;}
function twoLessons(){const content=draft();content.topics[0].lessons.push({id:randomUUID(),title:'Bài 2',words:[{...content.topics[0].lessons[0].words[0],id:randomUUID(),meaning:'Nước ở bài thứ hai'}]});return content;}
describe('C02 selected-lesson Review',()=>{
  it('guest preview only reads published content, has no writes and enforces origin',async()=>{
    const admin=await register(true),course=await create(admin,twoLessons()),lessonIds=course.draft.topics[0].lessons.map(item=>item.id);
    const path=`/api/curriculum/courses/${course.slug}/review-preview`;
    const response=await request(api.app).post(path).set('Origin',config.APP_ORIGIN).send({lessonIds:[...lessonIds,lessonIds[0]]}).expect(200);
    expect(response.body.userId).toBeNull();expect(response.body.reviewSet.id).toBe('guest');expect(response.body.reviewSet.words).toHaveLength(4);
    expect(await api.db.curriculumReviewSet.count()).toBe(0);
    await request(api.app).post(path).set('Origin','https://wrong.test').send({lessonIds}).expect(403);
    await request(api.app).post(reviewBase).set('Origin',config.APP_ORIGIN).send({courseId:course.id,lessonIds}).expect(401);
  });
  it('normalizes selection idempotently and keeps different source word IDs with same spelling',async()=>{
    const user=await register(true),course=await create(user,twoLessons()),ids=course.draft.topics[0].lessons.map(item=>item.id);
    const first=await reviewSet(course,user,[...ids].reverse()),again=await reviewSet(course,user,[...ids,ids[0]]);
    expect(again.id).toBe(first.id);expect(first.lessonIds).toEqual(ids);expect(first.words).toHaveLength(4);
    expect(first.words.filter((word:{word:string})=>word.word==='水')).toHaveLength(2);
    const [a,b]=await Promise.all([reviewSet(course,user,ids),reviewSet(course,user,ids)]);expect(a.id).toBe(b.id);
    const subset=await reviewSet(course,user,[ids[0]]);expect(subset.id).not.toBe(first.id);
    const other=await register();expect((await reviewSet(course,other,ids)).id).not.toBe(first.id);
  });
  it('validates selection and prevents account leakage on read/rate/result/star',async()=>{
    const user=await register(true),other=await register(),course=await create(user),set=await reviewSet(course,user);
    await write(user,reviewBase,{courseId:course.id,lessonIds:[]}).expect(400);
    await write(user,reviewBase,{courseId:course.id,lessonIds:[randomUUID()]}).expect(409);
    const foreign=await create(user);await write(user,reviewBase,{courseId:course.id,lessonIds:[lesson(foreign).id]}).expect(409);
    await get(`${reviewBase}/${set.id}`,other).expect(404);
    await get(`${reviewBase}/progress?lessonId=${set.id}`,other).expect(404);
    await get(`${reviewBase}/results?lessonId=${set.id}&kind=quiz`,other).expect(404);
    await write(other,`${reviewBase}/progress/rate`,{lessonId:set.id,lessonVersion:set.version,progressVersion:0,wordId:set.words[0].id,memorized:true}).expect(404);
    await write(other,`${reviewBase}/star-lesson`,{lessonId:set.id,lessonVersion:set.version}).expect(404);
    await write(user,reviewBase,{courseId:course.id,lessonIds:[lesson(course).id],expectedUserId:other.id}).expect(409);
  });
  it('saves all false flashcard assessments separately, resumes and resets without changing source completion',async()=>{
    const user=await register(true),course=await create(user),set=await reviewSet(course,user);
    for(let i=0;i<set.words.length;i++)await write(user,`${reviewBase}/progress/rate`,{lessonId:set.id,lessonVersion:set.version,progressVersion:i,wordId:set.words[i].id,memorized:false}).expect(200);
    const saved=(await get(`${reviewBase}/progress?lessonId=${set.id}`,user).expect(200)).body;expect(saved.completedAt).not.toBeNull();expect(saved.progress).toHaveLength(3);
    expect(await api.db.curriculumProgress.count({where:{userId:user.id}})).toBe(0);expect(await api.db.reviewCard.count({where:{userId:user.id}})).toBe(0);
    const reset=(await write(user,`${reviewBase}/progress/reset`,{lessonId:set.id,lessonVersion:set.version,progressVersion:3,confirmedCount:3}).expect(200)).body;
    expect(reset.progress).toEqual([]);expect(reset.completedAt).toBe(saved.completedAt);
    await write(user,`${reviewBase}/progress/rate`,{lessonId:set.id,lessonVersion:set.version,progressVersion:0,wordId:set.words[0].id,memorized:true}).expect(409);
  });
  it.each(['quiz','cram'])('server grades %s, retries safely and never completes source lessons',async(kind)=>{
    const user=await register(true),course=await create(user,twoLessons()),set=await reviewSet(course,user);
    const body={id:randomUUID(),lessonId:set.id,lessonVersion:set.version,kind,mode:'reading',answers:set.words.map((word:{id:string;reading:string},i:number)=>({wordId:word.id,answer:i===0?'wrong':word.reading}))};
    const saved=await write(user,`${reviewBase}/results`,body).expect(201);expect(saved.body.result.correct).toBe(3);expect(saved.body.result.lessonId).toBe(set.id);
    await write(user,`${reviewBase}/results`,body).expect(200);
    await write(user,`${reviewBase}/results`,{...body,answers:body.answers.slice(1),id:randomUUID()}).expect(400);
    const latest=(await get(`${reviewBase}/results?lessonId=${set.id}&kind=${kind}`,user).expect(200)).body;expect(latest.result.id).toBe(body.id);
    expect(await api.db.curriculumReviewResult.count({where:{userId:user.id}})).toBe(1);expect(await api.db.curriculumStudyResult.count({where:{userId:user.id}})).toBe(0);
    expect(await api.db.curriculumProgress.count({where:{userId:user.id}})).toBe(0);
    expect((await api.db.xpEvent.aggregate({where:{userId:user.id},_sum:{points:true}}))._sum.points).toBe(3);
    // A source lesson shares word reward identities with its grouped Review.
    await write(user,'/api/curriculum/results',{...resultBody(course),kind}).expect(201);
    expect((await api.db.xpEvent.aggregate({where:{userId:user.id},_sum:{points:true}}))._sum.points).toBe(4);
  });
  it('rejects stale publish/rating and removed selection while preserving saved review history',async()=>{
    const user=await register(true),course=await create(user,twoLessons()),set=await reviewSet(course,user);
    await write(user,`${reviewBase}/progress/rate`,{lessonId:set.id,lessonVersion:set.version,progressVersion:0,wordId:set.words[0].id,memorized:true}).expect(200);
    const edited=structuredClone(course.draft);edited.topics[0].lessons[0].words[0].meaning='Nước đã sửa';
    const next=(await write(user,`${endpoint}/${course.id}`,{version:course.version,draft:edited},'patch').expect(200)).body.course;
    await write(user,`${endpoint}/${course.id}/publish`,{version:next.version}).expect(200);
    await write(user,`${reviewBase}/progress/rate`,{lessonId:set.id,lessonVersion:set.version,progressVersion:1,wordId:set.words[1].id,memorized:true}).expect(409);
    const fresh=(await get(`${reviewBase}/${set.id}`,user).expect(200)).body.reviewSet;expect(fresh.words[0].meaning).toBe('Nước đã sửa');
    const current=(await get(`${endpoint}/${course.id}`,user)).body.course;current.draft.topics[0].lessons.pop();
    const reduced=(await write(user,`${endpoint}/${course.id}`,{version:current.version,draft:current.draft},'patch')).body.course;
    await write(user,`${endpoint}/${course.id}/publish`,{version:reduced.version}).expect(200);
    await get(`${reviewBase}/${set.id}`,user).expect(409);expect(await api.db.curriculumReviewSet.count({where:{id:set.id}})).toBe(1);
  });
  it('bulk stars preserve source identities and old schedules; archive hides only content',async()=>{
    const user=await register(true),course=await create(user,twoLessons()),set=await reviewSet(course,user);
    await write(user,`${reviewBase}/star-lesson`,{lessonId:set.id,lessonVersion:set.version}).expect(200);
    const card=await api.db.reviewCard.findFirstOrThrow({where:{userId:user.id}}),dueAt=new Date('2030-01-01T00:00:00Z');
    await api.db.reviewCard.update({where:{id:card.id},data:{active:false,dueAt,intervalSeconds:86400}});
    await write(user,`${reviewBase}/star-lesson`,{lessonId:set.id,lessonVersion:set.version}).expect(200);
    const after=await api.db.reviewCard.findUniqueOrThrow({where:{id:card.id}});expect(after.active).toBe(true);expect(after.dueAt).toEqual(dueAt);expect(after.intervalSeconds).toBe(86400);
    expect(await api.db.reviewCard.count({where:{userId:user.id}})).toBe(4);
    await write(user,`${endpoint}/${course.id}/archive`,{version:course.version}).expect(200);
    await get(`${reviewBase}/${set.id}`,user).expect(404);expect(await api.db.curriculumReviewSet.count({where:{id:set.id}})).toBe(1);
  });
  it('supports more than 500 combined words and long meaning answers without raising limits for a single lesson',async()=>{
    const user=await register(true),content=twoLessons();
    const word=content.topics[0].lessons[0].words[0];content.topics[0].lessons[0].words=Array.from({length:500},()=>({...word,id:randomUUID(),meaning:'x'.repeat(600)}));
    content.topics[0].lessons[1].words[0].meaning='x'.repeat(600);
    const course=await create(user,content),set=await reviewSet(course,user);expect(set.words).toHaveLength(501);
    await write(user,`${reviewBase}/results`,{id:randomUUID(),lessonId:set.id,lessonVersion:set.version,kind:'quiz',mode:'meaning',answers:set.words.map((item:{id:string;meaning:string})=>({wordId:item.id,answer:item.meaning}))}).expect(201);
  });
});
