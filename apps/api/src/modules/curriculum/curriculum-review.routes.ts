import { createHash } from 'node:crypto';
import { Router, json } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { CurriculumReviewResult, Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../../common/errors.js';
import { curriculumSlug } from './curriculum.schema.js';
import type { CurriculumWord } from './curriculum.schema.js';
import { lockVocabChanges } from '../vocabulary/vocab-review.js';
import { authenticatedCurriculumRouter, checkStudyOwner, curriculumStudyEngine, studyUuid, type CurriculumStudyStore } from './curriculum-study.engine.js';

const selection = z.array(studyUuid).min(1,'Chọn ít nhất một bài.').max(500).transform(ids=>[...new Set(ids)].sort());
const missing = () => new HttpError(404,'REVIEW_SET_NOT_FOUND','Không tìm thấy bài Review của tài khoản này.');

async function selectedContent(tx:Prisma.TransactionClient, courseId:string, lessonIds:string[]) {
  await tx.$queryRaw`SELECT id FROM curriculum_courses WHERE id=${courseId}::uuid FOR SHARE`;
  const course=await tx.curriculumCourse.findUnique({where:{id:courseId}});
  if(!course||course.archivedAt||course.publishedVersion===null)throw new HttpError(404,'CURRICULUM_NOT_FOUND','Giáo trình chưa được xuất bản hoặc đã lưu trữ.');
  const topics=await tx.curriculumTopic.findMany({where:{courseId,active:true},orderBy:[{sortOrder:'asc'},{id:'asc'}],select:{lessons:{where:{id:{in:lessonIds},active:true},orderBy:[{sortOrder:'asc'},{id:'asc'}],select:{id:true,words:true}}}});
  const lessons=topics.flatMap(topic=>topic.lessons);
  if(lessons.length!==lessonIds.length)throw new HttpError(409,'REVIEW_SELECTION_CHANGED','Một bài đã bị gỡ hoặc không thuộc giáo trình. Quay lại và chọn các bài cần ôn.');
  const byId=new Map<string,CurriculumWord>();
  for(const lesson of lessons)for(const word of lesson.words as CurriculumWord[])if(!byId.has(word.id))byId.set(word.id,word);
  const words=[...byId.values()];
  if(!words.length||words.length>5000)throw new HttpError(400,'REVIEW_SIZE','Bài Review cần từ 1 đến 5.000 mục từ.');
  return {courseId,lessonIds:lessons.map(lesson=>lesson.id),lessonCount:lessons.length,name:`${course.title} - Review · ${lessons.length} bài`,version:course.publishedVersion,words};
}

async function ownedReview(tx:Prisma.TransactionClient,userId:string,id:string) {
  const set=await tx.curriculumReviewSet.findFirst({where:{id,userId}});
  if(!set)throw missing();
  // Course lock always precedes account lock, matching catalog publish / star operations.
  return {id,...await selectedContent(tx,set.courseId,set.lessonIds)};
}
const progressRow=(row:{progress:Prisma.JsonValue;progressVersion:number;completedAt:Date|null}|null)=>row?{progress:row.progress,version:row.progressVersion,completedAt:row.completedAt}:null;
const resultRow=(row:CurriculumReviewResult|null)=>row?{...row,lessonId:row.reviewSetId}:null;
const store:CurriculumStudyStore={
  maxWords:5000,
  async load(tx,userId,id){const unit=await ownedReview(tx,userId,id);return {id:unit.id,title:unit.name,version:unit.version,words:unit.words};},
  async progress(tx,userId,id){return progressRow(await tx.curriculumReviewSet.findFirst({where:{id,userId}}));},
  async saveProgress(tx,userId,id,progress,completedAt){return progressRow(await tx.curriculumReviewSet.update({where:{id,userId},data:{progress,progressVersion:{increment:1},completedAt}}))!;},
  async complete(tx,userId,id,at){await tx.curriculumReviewSet.updateMany({where:{id,userId,completedAt:null},data:{completedAt:at}});},
  async latest(tx,userId,id,kind){return resultRow(await tx.curriculumReviewResult.findFirst({where:{userId,reviewSetId:id,kind},orderBy:[{completedAt:'desc'},{id:'desc'}]}));},
  async result(tx,id){return resultRow(await tx.curriculumReviewResult.findUnique({where:{id}}));},
  async createResult(tx,data){const {lessonId,...rest}=data;return !!(await tx.curriculumReviewResult.createMany({data:[{...rest,reviewSetId:lessonId}],skipDuplicates:true})).count;},
};

export function curriculumReviewRoutes(db:PrismaClient){
  const router=authenticatedCurriculumRouter(db,'4mb');
  router.post('/',async(req,res)=>{
    const userId=req.session.userId!;checkStudyOwner(userId,req.body?.expectedUserId);
    const input=z.object({expectedUserId:studyUuid,courseId:studyUuid,lessonIds:selection}).strict().parse(req.body);
    const data=await db.$transaction(async tx=>{
      const content=await selectedContent(tx,input.courseId,input.lessonIds);await lockVocabChanges(tx,userId);
      const selectionHash=createHash('sha256').update(JSON.stringify(input.lessonIds)).digest('hex');
      const set=await tx.curriculumReviewSet.upsert({where:{userId_courseId_selectionHash:{userId,courseId:input.courseId,selectionHash}},create:{userId,courseId:input.courseId,lessonIds:input.lessonIds,selectionHash},update:{}});
      return {id:set.id,...content};
    });res.json({userId,reviewSet:data});
  });
  router.use(curriculumStudyEngine(db,store));
  router.get('/:id',async(req,res)=>{
    const id=studyUuid.parse(req.params.id),userId=req.session.userId!;
    const reviewSet=await db.$transaction(tx=>ownedReview(tx,userId,id));
    res.json({userId,reviewSet});
  });
  return router;
}

export function curriculumReviewPreviewRoutes(db:PrismaClient){
  const router=Router();
  router.post('/:slug/review-preview',rateLimit({windowMs:60000,limit:60,standardHeaders:'draft-8',legacyHeaders:false}),json({limit:'512kb'}),async(req,res)=>{
    res.set('Cache-Control','no-store');
    const slug=curriculumSlug.parse(req.params.slug),input=z.object({lessonIds:selection}).strict().parse(req.body);
    const reviewSet=await db.$transaction(async tx=>{
      const course=await tx.curriculumCourse.findUnique({where:{slug},select:{id:true}});
      if(!course)throw new HttpError(404,'CURRICULUM_NOT_FOUND','Không tìm thấy giáo trình.');
      return {id:'guest',...await selectedContent(tx,course.id,input.lessonIds)};
    });
    const userId=req.session.userId&&await db.user.findUnique({where:{id:req.session.userId},select:{id:true}})?req.session.userId:null;
    res.json({userId,reviewSet});
  });
  return router;
}
