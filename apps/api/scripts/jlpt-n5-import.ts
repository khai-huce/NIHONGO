/** Authorized, repeatable editorial import. Preview by default; never resets or overwrites an existing edition. */
import { createHash } from 'node:crypto';
import { readFile, mkdir, copyFile, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { PrismaClient, Prisma, type ReadingArticle } from '@prisma/client';
import { readConfig } from '../src/config/env.js';
import { curriculumDraftSchema } from '../src/modules/curriculum/curriculum.schema.js';
import { createCurriculum, publishCurriculum } from '../src/modules/curriculum/curriculum.service.js';
import { grammarDraftSchema } from '../src/modules/grammar/grammar.schema.js';
import { createGrammar, publishGrammar } from '../src/modules/grammar/grammar.service.js';
import { createJlpt, publishJlpt, previewJlpt, adminRoadmap } from '../src/modules/jlpt/jlpt.service.js';
import { parseJlptDraft, jlptId, jlptLevel } from '../src/modules/jlpt/jlpt.schema.js';
import { contentSourceSchema } from '../src/modules/content/content.schema.js';
import { makeReadingContent, type ReadingContent } from '../src/modules/reading/reading-content.js';
import { defaultReadingStorage, READING_VOICE, readingMediaSchema } from '../src/modules/reading/reading-tts.js';

const args=process.argv.slice(2);
if(args.some(a=>!['--commit'].includes(a)&&!/^--(hash|database|owner-email)=/.test(a)))throw new Error('Use [--commit --hash=SHA256] [--database=local_name_test] [--owner-email=registered_admin]');
const option=(name:string)=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const commit=args.includes('--commit'),config=readConfig(),url=new URL(config.DATABASE_URL);
if(option('database')){if(!['localhost','127.0.0.1'].includes(url.hostname)||!/^nihongo_[a-z0-9_]+_test$/.test(option('database')!))throw new Error('Only a named local test database override is permitted');url.pathname='/'+option('database');}
const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
const bundleText=await readFile(new URL('../content/jlpt-n5/bundle.json',import.meta.url),'utf8');
const hash=createHash('sha256').update(bundleText).digest('hex');
if(commit&&option('hash')!==hash)throw new Error('Run preview, review bundle, then pass the exact --hash before importing.');
const raw=JSON.parse(bundleText);
const vocab={id:jlptId.parse(raw.vocabulary.id),slug:String(raw.vocabulary.slug),draft:curriculumDraftSchema.parse(raw.vocabulary.draft)};
const grammar={id:jlptId.parse(raw.grammar.id),slug:String(raw.grammar.slug),draft:grammarDraftSchema.parse(raw.grammar.draft)};
const roadmap={id:jlptId.parse(raw.roadmap.id),level:jlptLevel.parse(raw.roadmap.level),draft:parseJlptDraft(raw.roadmap.draft)};
const sources: Array<ReturnType<typeof contentSourceSchema.parse>>=raw.sources.map((s:unknown)=>contentSourceSchema.parse(s));
const base=fileURLToPath(new URL('../../../.artifacts/j02/audio/',import.meta.url));
const storage=resolve(config.TTS_STORAGE_DIR??defaultReadingStorage);
const uuid=(value:string)=>{const b=createHash('sha256').update(value).digest();b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex').slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
// PostgreSQL JSONB round-trips can differ at the last floating-point digit.
const comparableSegments=(segments:unknown)=>readingMediaSchema.shape.segments.parse(segments).map(s=>({...s,durationSec:Math.round(s.durationSec*1e6),offsetSec:Math.round(s.offsetSec*1e6)}));
const articles:Array<{id:string;sourceId:string;content:ReadingContent;contentHash:string;directory:string;media:ReturnType<typeof readingMediaSchema.parse>}> = [];
const observedReadingVersions=new Map<string,number|null>();
function assertEdition(row:{version:number;publishedVersion:number|null;archivedAt:Date|string|null},label:string,requirePublished=false){
  if(row.archivedAt||(row.publishedVersion!==null&&row.publishedVersion!==row.version)||(requirePublished&&row.publishedVersion===null))throw new Error(`Existing edition has unpublished changes or is unavailable: ${label}`);
}
function assertReading(row:ReadingArticle,article:typeof articles[number],ownerId:string,requirePublished=false){
  assertEdition(row,article.id,requirePublished);
  if(row.userId!==ownerId||row.scope!=='library'||row.sourceId!==article.sourceId||!isDeepStrictEqual(row.content,article.content)
    ||(row.publishedVersion!==null&&(row.publishedSourceId!==article.sourceId||!isDeepStrictEqual(row.publishedContent,article.content))))throw new Error(`Existing reading differs: ${article.id}`);
}
try {
  const owner=await db.user.findUnique({where:{email:option('owner-email')??'nvk05032005@gmail.com'},select:{id:true,role:true}});
  if(!owner||owner.role!=='admin')throw new Error('An existing admin owner is required; importer never grants roles.');
  for(const article of raw.articles){
    const c=article.content as ReadingContent;
    const content=makeReadingContent({title:c.title,subtitle:c.subtitle,text:c.text,annotations:c.paragraphs.flatMap(p=>p.sentences.map(s=>({sentenceId:s.id,japanese:s.japanese,translation:s.translation,ruby:s.ruby}))),vocabList:c.vocabList,grammarList:c.grammarList,quizList:c.quizList},true);
    const contentHash=createHash('sha256').update(JSON.stringify({text:content.text,voice:READING_VOICE,format:'sentence-mp3-v1'})).digest('hex');
    const directory=resolve(base,article.id,contentHash),saved=JSON.parse(await readFile(resolve(directory,'media.json'),'utf8'));
    if(saved.contentHash!==contentHash||saved.voice!==READING_VOICE)throw new Error('Audio hash/voice mismatch');
    const media=readingMediaSchema.parse(saved.media),sentences=content.paragraphs.flatMap(p=>p.sentences);let offset=0;
    if(media.segments.length!==sentences.length)throw new Error('Incomplete audio');
    for(const [i,s] of media.segments.entries()){const file=await stat(resolve(directory,s.fileName));if(s.sentenceId!==sentences[i].id||s.fileName!==`${i}.mp3`||Math.abs(s.offsetSec-offset)>.01||!file.isFile()||!file.size||file.size>20_000_000)throw new Error('Invalid audio metadata/file');offset+=s.durationSec;}
    if(Math.abs(offset-media.totalSeconds)>.01)throw new Error('Invalid audio total');
    articles.push({id:article.id,sourceId:article.sourceId,content,contentHash,directory,media});
  }
  for(const source of sources){const prior=await db.contentSource.findUnique({where:{id:source.id}});if(prior&&!isDeepStrictEqual(prior,source))throw new Error(`Immutable source differs: ${source.id}`);}
  const existingRoadmap=await db.jlptRoadmap.findUnique({where:{level:'N5'}});
  if(existingRoadmap)assertEdition(existingRoadmap,roadmap.id);
  if(existingRoadmap&&(existingRoadmap.id!==roadmap.id||existingRoadmap.archivedAt||!isDeepStrictEqual((await db.$transaction(tx=>adminRoadmap(tx,existingRoadmap))).draft,roadmap.draft)))throw new Error('Existing N5 roadmap differs; no overwrite performed.');
  for(const [model,payload] of [[db.curriculumCourse,vocab],[db.grammarCourse,grammar]] as const){
    const prior=await (model as typeof db.curriculumCourse).findFirst({where:{OR:[{id:payload.id},{slug:payload.slug}]}});
    if(prior)assertEdition(prior,payload.slug);
    if(prior&&(prior.id!==payload.id||prior.slug!==payload.slug||prior.archivedAt||!isDeepStrictEqual(prior.draft,payload.draft)))throw new Error(`Existing course differs: ${payload.slug}`);
  }
  for(const article of articles){const prior=await db.readingArticle.findUnique({where:{id:article.id}});if(prior)assertReading(prior,article,owner.id);observedReadingVersions.set(article.id,prior?.version??null);}
  const kanjiIds=[...new Set(roadmap.draft.sessions.flatMap(s=>s.resources.filter(r=>r.kind==='kanji').map(r=>r.targetId)))];
  const kanji=await db.kanjiContent.count({where:{id:{in:kanjiIds},status:'published'}});
  if(kanji!==103)throw new Error(`Need103published Kanji, found${kanji}`);
  const report={mode:commit?'commit':'preview',database:url.pathname.slice(1),sha256:hash,roadmapId:roadmap.id,sessions:roadmap.draft.sessions.length,words:vocab.draft.topics.flatMap(t=>t.lessons).reduce((n,l)=>n+l.words.length,0),kanji,grammarPatterns:grammar.draft.lessons.flatMap(l=>l.patterns).length,readingArticles:articles.length,audioFiles:articles.reduce((n,a)=>n+a.media.segments.length,0),audioSeconds:articles.reduce((n,a)=>n+a.media.totalSeconds,0),examQuestions:roadmap.draft.sessions.reduce((n,s)=>n+(s.questions?.length??0),0)};
  console.log(report);
  if(commit){
    for(const source of sources){const saved=await db.contentSource.upsert({where:{id:source.id},create:source,update:{}});if(!isDeepStrictEqual(saved,source))throw new Error(`Immutable source changed during import: ${source.id}`);}
    const cv=await createCurriculum(db,vocab);assertEdition(cv.course,vocab.slug);if(cv.course.publishedVersion===null)await publishCurriculum(db,cv.course.id,cv.course.version);
    const cg=await createGrammar(db,grammar);assertEdition(cg.course,grammar.slug);if(cg.course.publishedVersion===null)await publishGrammar(db,cg.course.id,cg.course.version);
    for(const article of articles){
      const audioId=uuid(`nihongo-n5-audio:${article.id}:${article.contentHash}`),claimToken=uuid(`nihongo-n5-audio-claim:${article.id}:${article.contentHash}`),destination=resolve(storage,audioId,claimToken);
      await mkdir(destination,{recursive:true});
      for(const s of article.media.segments){const from=resolve(article.directory,s.fileName),to=resolve(destination,s.fileName);try{await copyFile(from,to,constants.COPYFILE_EXCL);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;if(!isDeepStrictEqual(await readFile(from),await readFile(to)))throw new Error('Existing audio file differs');}}
      await db.$transaction(async tx=>{
        await tx.$queryRaw`SELECT id FROM reading_articles WHERE id=${article.id}::uuid FOR UPDATE`;
        const prior=await tx.readingArticle.findUnique({where:{id:article.id}});
        if((prior?.version??null)!==observedReadingVersions.get(article.id))throw new Error('Reading version changed during import');
        if(prior)assertReading(prior,article,owner.id);
        const current=prior??await tx.readingArticle.create({data:{id:article.id,userId:owner.id,scope:'library',content:article.content as unknown as Prisma.InputJsonValue,sourceId:article.sourceId}});
        const audio=await tx.readingAudio.findUnique({where:{id:audioId}});
        if(audio&&(audio.articleId!==article.id||audio.contentHash!==article.contentHash||audio.voice!==READING_VOICE||audio.claimToken!==claimToken||audio.status!=='ready'||!isDeepStrictEqual(comparableSegments(audio.segments),comparableSegments(article.media.segments))))throw new Error('Audio record differs');
        if(!audio)await tx.readingAudio.create({data:{id:audioId,articleId:article.id,articleVersion:current.version,contentHash:article.contentHash,voice:READING_VOICE,status:'ready',claimToken,leaseUntil:new Date(0),segments:article.media.segments,durationSec:article.media.totalSeconds,characterCount:Array.from(article.content.text).length}});
        if(current.publishedVersion===null){
          const saved=await tx.readingArticle.updateMany({where:{id:article.id,userId:owner.id,scope:'library',version:current.version,archivedAt:null,publishedVersion:null},data:{publishedContent:article.content as unknown as Prisma.InputJsonValue,publishedSourceId:article.sourceId,publishedVersion:current.version+1,version:{increment:1}}});
          if(saved.count!==1)throw new Error('Reading changed before publication');
        }
      });
    }
    const created=await createJlpt(db,roadmap);
    const preview=await db.$transaction(tx=>previewJlpt(tx,roadmap.draft));
    if(preview.issues.length)throw new Error(preview.issues.join('\n'));
    assertEdition(created.roadmap,roadmap.id);
    if(created.roadmap.publishedVersion===null)await publishJlpt(db,created.roadmap.id,created.roadmap.version);
    // Verify a stable final snapshot before claiming success; never republish an admin's newer draft.
    await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM jlpt_roadmaps WHERE id=${roadmap.id}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM curriculum_courses WHERE id=${vocab.id}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM grammar_courses WHERE id=${grammar.id}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM reading_articles WHERE id IN (${Prisma.join(articles.map(a=>Prisma.sql`${a.id}::uuid`))}) ORDER BY id FOR SHARE`;
      const finalRoadmap=await tx.jlptRoadmap.findUniqueOrThrow({where:{id:roadmap.id}});assertEdition(finalRoadmap,roadmap.id,true);
      if(!isDeepStrictEqual((await adminRoadmap(tx,finalRoadmap)).draft,roadmap.draft))throw new Error('Roadmap changed during import');
      for(const [model,payload] of [[tx.curriculumCourse,vocab],[tx.grammarCourse,grammar]] as const){
        const course=await (model as typeof tx.curriculumCourse).findUniqueOrThrow({where:{id:payload.id}});assertEdition(course,payload.slug,true);
        if(course.slug!==payload.slug||!isDeepStrictEqual(course.draft,payload.draft))throw new Error(`Course changed during import: ${payload.slug}`);
      }
      for(const article of articles)assertReading(await tx.readingArticle.findUniqueOrThrow({where:{id:article.id}}),article,owner.id,true);
    });
    const artifact=fileURLToPath(new URL('../../../.artifacts/j02/',import.meta.url));await mkdir(artifact,{recursive:true});
    await writeFile(resolve(artifact,`import-${url.pathname.slice(1)}.json`),JSON.stringify({...report,completedAt:new Date().toISOString(),links:preview.resourceCount},null,2));
    console.log('Published validated edition. Existing study history, stars, XP and legacy n5-v1 were not modified.');
  }
}finally{await db.$disconnect();}
