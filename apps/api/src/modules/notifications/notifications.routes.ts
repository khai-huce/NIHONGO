import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '@prisma/client';
import { HttpError } from '../../common/errors.js';
export const vietnamDay = (now: Date) => new Date(now.getTime()+7*3600000).toISOString().slice(0,10);
const category=z.enum(['kanji','vocab','grammar']);
const identity=z.object({expectedUserId:z.string().uuid()}).strict();
const markInput=identity.extend({day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),categories:z.array(category).min(1).max(3)}).strict();
const labels={kanji:'Kanji',vocab:'Từ vựng',grammar:'Ngữ pháp'};
export function notificationRoutes(db:PrismaClient){
 const router=Router();
 router.use(async(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(!req.session.userId || !await db.user.findUnique({where:{id:req.session.userId},select:{id:true}}))throw new HttpError(401,'UNAUTHENTICATED','Vui lòng đăng nhập để xem thông báo.');
  next();
 });
 router.use(rateLimit({windowMs:60000,limit:180,standardHeaders:'draft-8',legacyHeaders:false,message:{error:{code:'RATE_LIMITED',message:'Bạn thao tác quá nhanh. Vui lòng đợi một phút.'}}}));
 router.get('/',async(req,res)=>{
  const input=identity.parse(req.query),userId=req.session.userId!;
  if(input.expectedUserId!==userId)throw new HttpError(409,'ACCOUNT_CHANGED','Tài khoản đã đổi. Vui lòng tải lại trang.');
  const now=new Date(),day=vietnamDay(now);
  const result=await db.$transaction(async tx=>{
   const groups=await tx.reviewCard.groupBy({by:['category'],where:{userId,active:true,dueAt:{lte:now},category:{in:['kanji','vocab','grammar']}},_count:{_all:true}});
   const reads=await tx.notificationRead.findMany({where:{userId,readDay:day}});
   const next=await tx.reviewCard.findFirst({where:{userId,active:true,dueAt:{gt:now}},orderBy:{dueAt:'asc'},select:{dueAt:true}});
   return {items:['kanji','vocab','grammar'].flatMap(type=>{
    const group=groups.find(g=>g.category===type);if(!group)return [];
    return [{category:type,label:labels[type as keyof typeof labels],count:group._count._all,read:reads.some(r=>r.category===type)}];
   }),nextDueAt:next?.dueAt.toISOString()??null};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  res.json({userId,day,serverNow:now.toISOString(),...result});
 });
 router.post('/read',async(req,res)=>{
  const input=markInput.parse(req.body),userId=req.session.userId!;
  if(input.expectedUserId!==userId)throw new HttpError(409,'ACCOUNT_CHANGED','Tài khoản đã đổi. Vui lòng tải lại trang.');
  const now=new Date(),day=vietnamDay(now);
  if(input.day!==day)throw new HttpError(409,'DAY_CHANGED','Đã sang ngày mới. Vui lòng tải lại thông báo.');
  await db.$transaction(async tx=>{
   const due=await tx.reviewCard.groupBy({by:['category'],where:{userId,active:true,dueAt:{lte:now},category:{in:input.categories}}});
   for(const item of due)await tx.notificationRead.upsert({where:{userId_category:{userId,category:item.category}},create:{userId,category:item.category,readDay:day,readAt:now},update:{readDay:day,readAt:now}});
  });
  res.json({userId,day});
 });
 return router;
}
