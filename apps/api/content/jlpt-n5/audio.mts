import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { edgeReadingTts, READING_VOICE, readingMediaSchema } from '../../src/modules/reading/reading-tts.js';

const bundle=JSON.parse(await readFile(new URL('bundle.json',import.meta.url),'utf8'));
const base=fileURLToPath(new URL('../../../../.artifacts/j02/audio/',import.meta.url));
const synthesize=edgeReadingTts();
for(const [i,article] of bundle.articles.entries()){
  const hash=createHash('sha256').update(JSON.stringify({text:article.content.text,voice:READING_VOICE,format:'sentence-mp3-v1'})).digest('hex');
  const directory=resolve(base,article.id,hash);await mkdir(directory,{recursive:true});
  let media;
  try {const saved=JSON.parse(await readFile(resolve(directory,'media.json'),'utf8'));if(saved.contentHash!==hash)throw new Error('Hash mismatch');media=readingMediaSchema.parse(saved.media);for(const s of media.segments){if(!(await stat(resolve(directory,s.fileName))).size)throw new Error('Empty MP3');}}catch{media=undefined;}
  if(!media){
    const sentences=article.content.paragraphs.flatMap((p:any)=>p.sentences).map((s:any)=>({id:s.id,text:s.japanese}));
    media=await synthesize({directory,voice:READING_VOICE,sentences});
    if(media.segments.length!==sentences.length||media.segments.some((s,i)=>s.sentenceId!==sentences[i].id||s.fileName!==`${i}.mp3`))throw new Error('Audio sentence mismatch');
    await writeFile(resolve(directory,'media.json'),JSON.stringify({contentHash:hash,voice:READING_VOICE,media},null,2),'utf8');
  }
  console.log(`${i+1}/${bundle.articles.length} ${article.content.title}: ${media.segments.length} MP3, ${media.totalSeconds.toFixed(1)}s`);
}
