import test from 'node:test';
import assert from 'node:assert/strict';
import { readingEditorForm, reconcileReading, readingEditorBody, validAdminReadingAudio } from '../src/admin/reading-editor-data.ts';

const content = (text, sentences) => ({ title: 'Bài đọc', subtitle: '', text, paragraphs: [{id:'p1',sentences}], vocabList:[], grammarList:[], quizList:[] });
const old = content('学校。日本。', [{id:'p1-s1',japanese:'学校。',translation:'Trường học.',ruby:[{text:'学校',reading:'がっこう'},{text:'。'}]}, {id:'p1-s2',japanese:'日本。',translation:'Nhật Bản.'}]);
const article = { ...old, id:'a',version:2,sourceId:'source-v1',publishedSourceId:null,publishedVersion:null,archived:false,audio:null };

test('sentence translations follow unique exact Japanese text instead of positional IDs', () => {
  const next = content('新しい。学校。', [{id:'p1-s1',japanese:'新しい。',translation:''},{id:'p1-s2',japanese:'学校。',translation:''}]);
  const result = reconcileReading(old,next);
  assert.equal(result.content.paragraphs[0].sentences[0].translation,'');
  assert.equal(result.content.paragraphs[0].sentences[1].translation,'Trường học.');
  assert.deepEqual(result.content.paragraphs[0].sentences[1].ruby,old.paragraphs[0].sentences[0].ruby);
  assert.equal(result.kept,1); assert.equal(result.removedTranslations,1);
  assert.equal(old.paragraphs[0].sentences[1].translation,'Nhật Bản.');
});

test('ambiguous repeated sentences never silently inherit a translation', () => {
  const next = content('学校。学校。',[{id:'p1-s1',japanese:'学校。',translation:''},{id:'p1-s2',japanese:'学校。',translation:''}]);
  const result = reconcileReading(old,next);
  assert.deepEqual(result.content.paragraphs[0].sentences.map(s=>s.translation),['','']);
  assert.equal(result.removedTranslations,2); assert.equal(result.removedRuby,1);
});

test('same-text editing preserves rich content; changing Japanese counts invalidated analysis', () => {
  const rich = {...old,vocabList:[{word:'学校'}],grammarList:[{pattern:'です'}],quizList:[{id:1}]};
  assert.deepEqual(reconcileReading(rich,{...old,title:'New title'}).content.vocabList,rich.vocabList);
  const result=reconcileReading(rich,content('新しい。',[{id:'p1-s1',japanese:'新しい。',translation:''}]));
  assert.equal(result.removedRich,3);
  assert.deepEqual(result.content.vocabList,[]); assert.deepEqual(result.content.grammarList,[]); assert.deepEqual(result.content.quizList,[]);
});

test('save binds translations to sentence text and requires splitting/review after edits', () => {
  const form=readingEditorForm(article), body=readingEditorBody(form,article);
  assert.equal(body.annotations[0].japanese,'学校。'); assert.equal(body.sourceId,'source-v1');
  form.text='別の文。';
  assert.throws(()=>readingEditorBody(form,article),/tách câu/);
  form.content=content(form.text,[{id:'p1-s1',japanese:form.text,translation:''}]);
  assert.throws(()=>readingEditorBody(form,article),/xác nhận/);
  form.translationsReviewed=true; form.sourceId='';
  assert.equal(readingEditorBody(form,article).translationsReviewed,true);
  assert.equal(readingEditorBody(form,article).sourceId,null);
});

test('preview rejects foreign, stale, incomplete or mismatched audio manifests', () => {
  const audio={id:'audio-id',articleId:'a',version:2,voice:'ja-JP-NanamiNeural',totalSeconds:4,segments:old.paragraphs[0].sentences.map((s,i)=>({sentenceId:s.id,durationSec:2,offsetSec:i*2,url:`/api/admin/reading/articles/a/audio/audio-id/${i}.mp3`}))};
  assert.equal(validAdminReadingAudio(audio,article),true);
  assert.equal(validAdminReadingAudio({...audio,version:1},article),false);
  assert.equal(validAdminReadingAudio({...audio,articleId:'b'},article),false);
  assert.equal(validAdminReadingAudio({...audio,segments:audio.segments.slice(0,1)},article),false);
  assert.equal(validAdminReadingAudio({...audio,segments:[{...audio.segments[0],url:'https://other.test/file.mp3'},audio.segments[1]]},article),false);
  assert.equal(validAdminReadingAudio({...audio,totalSeconds:5},article),false);
});
