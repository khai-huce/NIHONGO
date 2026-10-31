import { Router, json } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import { handwritingInput } from './handwriting.input.js';
import { recognize } from './handwriting.service.js';
import { loadKanjiCatalog } from '../content/content.service.js';
export function handwritingRoutes(db: PrismaClient) {
  const router=Router();
  router.use(rateLimit({windowMs:60000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,
    message:{error:{code:'RATE_LIMITED',message:'Bạn tra quá nhanh. Vui lòng chờ một phút.'}}}));
  router.use(json({limit:'180kb'}));
  router.post('/recognize',async(req,res) => {
    res.set('Cache-Control','no-store');
    const {strokes}=handwritingInput.parse(req.body);
    const candidates=await recognize(strokes);
    const catalog=await loadKanjiCatalog(db);
    res.json({candidates:candidates.map(candidate => ({...candidate,item:catalog.find(k => k.kanji===candidate.character) ?? null}))});
  });
  return router;
}
