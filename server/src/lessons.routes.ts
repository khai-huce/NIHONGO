import { Router, json } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from './errors.js';
import { lockVocabChanges, syncLessonReview } from './vocab-review.js';

const name = z.string().trim().min(1,'Vui lòng nhập tên bài.').max(100,'Tên bài tối đa 100 ký tự.');
const identity = { id: z.string().uuid(), expectedUserId: z.string().uuid() };
const word = z.object({ id: z.string().uuid(), word: z.string().trim().min(1,'Từ vựng không được để trống.').max(500),
  reading: z.string().max(500), hanViet: z.string().max(200), meaning: z.string().trim().min(1,'Nghĩa của từ không được để trống.').max(2000),
}).strict();
const words = z.array(word).max(500,'Mỗi bài tối đa 500 từ.').refine(items => new Set(items.map(w=>w.id)).size === items.length,'ID từ bị trùng trong bài.');
const createInput = z.object({...identity,name}).strict();
const updateInput = z.object({...identity,version:z.number().int().nonnegative(),name:name.optional(),words:words.optional()}).strict()
  .refine(input=>input.name !== undefined || input.words !== undefined,'Chưa có nội dung cần lưu.');
const deleteInput = z.object({...identity,version:z.number().int().nonnegative()}).strict();
const importWord = word.extend({reading:z.string().trim().max(500),hanViet:z.string().trim().max(200)});
const importInput = z.object({...identity,version:z.number().int().nonnegative(),
  words:z.array(importWord).min(1,'Chưa có từ cần nhập.').max(500,'Mỗi lần nhập tối đa 500 từ.')
    .refine(items=>new Set(items.map(item=>item.id)).size===items.length,'ID từ bị trùng trong lần nhập.'),
}).strict();
type LessonWord = z.infer<typeof word>;
const contentKey = (item:LessonWord) => JSON.stringify([item.word.trim(),item.reading.trim(),item.hanViet.trim(),item.meaning.trim()]);
const changed = () => new HttpError(409,'LESSON_CHANGED','Bài học đã thay đổi ở phiên khác. Tải lại trang trước khi sửa tiếp; nội dung bạn đang nhập chưa được lưu.');
const select = {id:true,name:true,words:true,version:true} as const;

export function lessonRoutes(db: PrismaClient) {
  const router = Router();
  router.use(async (req,res,next) => {
    res.set('Cache-Control','no-store');
    if (!req.session.userId || !await db.user.findUnique({where:{id:req.session.userId},select:{id:true}})) throw new HttpError(401,'UNAUTHENTICATED','Vui lòng đăng nhập để lưu bài học.');
    next();
  });
  router.use(rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-8',legacyHeaders:false,
    message:{error:{code:'RATE_LIMITED',message:'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.'}},
  }));
  router.use(json({limit:'512kb'}));
  router.get('/',async (req,res)=>{
    const userId=req.session.userId!;
    res.json({userId,lessons:await db.vocabLesson.findMany({where:{userId},select,orderBy:[{createdAt:'asc'},{id:'asc'}]})});
  });
  router.use((req,_res,next)=>{
    if (req.body?.expectedUserId !== req.session.userId) throw new HttpError(409,'ACCOUNT_CHANGED','Tài khoản đã đổi. Vui lòng tải lại trang.');
    next();
  });
  router.post('/',async (req,res)=>{
    const input=createInput.parse(req.body),userId=req.session.userId!;
    // A stable client-generated UUID makes retrying an uncertain creation safe.
    const result=await db.vocabLesson.createMany({data:[{id:input.id,userId,name:input.name}],skipDuplicates:true});
    const lesson=await db.vocabLesson.findFirst({where:{id:input.id,userId},select});
    if (!lesson) throw changed();
    res.status(result.count ? 201 : 200).json({userId,lesson});
  });
  router.post('/update',async (req,res)=>{
    const input=updateInput.parse(req.body),userId=req.session.userId!;
    const lesson=await db.$transaction(async tx=>{
      await lockVocabChanges(tx,userId);
      const before=await tx.vocabLesson.findFirst({where:{id:input.id,userId},select:{id:true,words:true}});
      if (!before) throw new HttpError(404,'NOT_FOUND','Không tìm thấy bài học.');
      const updated=await tx.vocabLesson.updateMany({where:{id:input.id,userId,version:input.version},
        data:{name:input.name,words:input.words,version:{increment:1}}});
      if (!updated.count) throw changed();
      if (input.words) await syncLessonReview(tx,userId,input.id,before.words,input.words);
      return tx.vocabLesson.findUniqueOrThrow({where:{id:input.id},select});
    });
    res.json({userId,lesson});
  });
  router.post('/import',async (req,res)=>{
    const input=importInput.parse(req.body),userId=req.session.userId!;
    const result=await db.$transaction(async tx=>{
      await lockVocabChanges(tx,userId);
      const before=await tx.vocabLesson.findFirst({where:{id:input.id,userId},select});
      if (!before) throw new HttpError(404,'NOT_FOUND','Không tìm thấy bài học.');
      const existing=before.words as LessonWord[];
      const keys=new Set(existing.map(contentKey));
      const ids=new Map(existing.map(item=>[item.id,contentKey(item)]));
      const additions:LessonWord[]=[];
      for (const item of input.words) {
        const key=contentKey(item);
        if (ids.has(item.id) && ids.get(item.id)!==key) {
          throw new HttpError(409,'WORD_ID_EXISTS','ID từ đã được dùng cho nội dung khác. Vui lòng tải lại và nhập từ mới.');
        }
        if (keys.has(key)) continue;
        keys.add(key);
        additions.push(item);
      }
      const duplicateCount=input.words.length-additions.length;
      // A retry after a lost success response only reads the current lesson.
      if (!additions.length) return {lesson:before,importedCount:0,duplicateCount};
      if (before.version!==input.version) throw changed();
      if (existing.length+additions.length>500) {
        throw new HttpError(400,'LESSON_LIMIT','Mỗi bài tối đa 500 từ. Chưa có từ nào trong lần nhập này được lưu.');
      }
      const combined=[...existing,...additions];
      const updated=await tx.vocabLesson.updateMany({where:{id:input.id,userId,version:input.version},
        data:{words:combined,version:{increment:1}}});
      if (!updated.count) throw changed();
      await syncLessonReview(tx,userId,input.id,before.words,combined);
      const lesson=await tx.vocabLesson.findUniqueOrThrow({where:{id:input.id},select});
      return {lesson,importedCount:additions.length,duplicateCount};
    });
    res.json({userId,...result});
  });
  router.post('/delete',async (req,res)=>{
    const input=deleteInput.parse(req.body),userId=req.session.userId!;
    await db.$transaction(async tx=>{
      await lockVocabChanges(tx,userId);
      const deleted=await tx.vocabLesson.deleteMany({where:{id:input.id,userId,version:input.version}});
      if (!deleted.count && await tx.vocabLesson.findFirst({where:{id:input.id,userId},select:{id:true}})) throw changed();
    });
    // Deleting a lesson does not mutate independent starred review snapshots/history.
    res.json({userId,id:input.id});
  });
  return router;
}
