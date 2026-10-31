import {describe,it,expect,afterAll} from 'vitest';
import express from 'express';
import request from 'supertest';
import {PrismaClient} from '@prisma/client';
import {handwritingInput,rasterize,type Strokes} from '../src/modules/handwriting/handwriting.input.js';
import {recognize} from '../src/modules/handwriting/handwriting.service.js';
import {handwritingRoutes} from '../src/modules/handwriting/handwriting.routes.js';
import {errorHandler} from '../src/common/errors.js';
const line:Strokes=[[[.2,.5],[.8,.5]]];
const cross:Strokes=[...line,[[.5,.2],[.5,.8]]];
const mouth:Strokes=[[[.2,.3],[.2,.7]],[[.2,.3],[.8,.3],[.8,.7]],[[.2,.7],[.8,.7]]];
const db=new PrismaClient({datasources:{db:{url:process.env.TEST_DATABASE_URL}}});
afterAll(()=>db.$disconnect());
describe('handwriting actual pinned model',()=>{
 it('rejects empty, out-of-range, oversized and extra fields',()=>{
  for(const value of [{strokes:[]},{strokes:[[[2,0]]]},{strokes:[Array(513).fill([.5,.5])]},{strokes:Array(41).fill([[.1,.1]])},{strokes:line,url:'https://example.com'}])expect(handwritingInput.safeParse(value).success).toBe(false);
 });
 it('centers strokes preserving geometry and polarity',()=>{
  const image=rasterize(line);expect(image.length).toBe(4096);expect(image[0]).toBe(0);expect(image[32*64+32]).toBeGreaterThan(200);
  const other=rasterize([[[.1,.3],[.4,.3]]]);expect(Math.max(...image.map((v,i)=>Math.abs(v-other[i])))).toBeLessThan(.001);
 });
 it.each([['一',line],['十',cross],['口',mouth]])('recognizes %s without mock',async(character,strokes)=>{
  const result=await recognize(strokes as Strokes);expect(result.slice(0,3).map(c=>c.character)).toContain(character);expect(result.length).toBeLessThanOrEqual(8);
 });
 it('guest API returns only published matches',async()=>{
  const app=express();app.use('/handwriting',handwritingRoutes(db));app.use(errorHandler);
  await request(app).post('/handwriting/recognize').send({strokes:[]}).expect(400);
  const result=await request(app).post('/handwriting/recognize').send({strokes:cross}).expect(200);
  expect(result.body.candidates[0].character).toBe('十');
  for(const c of result.body.candidates)if(c.item){const row=await db.kanjiContent.findUnique({where:{id:c.item.id}});expect(row?.status).toBe('published');expect(c.item.kanji).toBe(c.character);}else expect(c.item).toBeNull();
  expect(result.headers['cache-control']).toBe('no-store');
 });
});
