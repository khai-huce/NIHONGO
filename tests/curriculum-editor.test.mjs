import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCurriculumJson, curriculumRemoved, curriculumCounts, curriculumStatus } from '../src/admin/curriculum-editor-data.ts';

test('JSON import preserves existing identities and assigns only missing nested IDs', () => {
  let n=0;
  const parsed=parseCurriculumJson(JSON.stringify({title:'Nội dung của tôi',level:'N5',sourceId:'my-source',topics:[{id:'topic-old',title:'Chủ đề',lessons:[{title:'Bài',words:[{id:'word-old',word:'水',meaning:'Nước'},{word:'山',meaning:'Núi'}]}]}]}),()=>`new-${++n}`);
  assert.equal(parsed.sourceId,'my-source');
  assert.equal(parsed.topics[0].id,'topic-old');
  assert.equal(parsed.topics[0].lessons[0].id,'new-1');
  assert.deepEqual(parsed.topics[0].lessons[0].words.map(word=>word.id),['word-old','new-2']);
  assert.equal(n,2);
  assert.deepEqual(curriculumCounts(parsed),{topics:1,lessons:1,words:2});
});

test('import rejects wrong roots and leaves invalid content for server validation',()=>{
  for(const value of ['null','[]','"text"','broken'])assert.throws(()=>parseCurriculumJson(value));
  const parsed=parseCurriculumJson('{"topics":[{"id":"bad-id","lessons":[{"words":[{"id":null}]}]}]}',()=> 'new');
  assert.equal(parsed.topics[0].id,'bad-id');
  assert.equal(parsed.topics[0].lessons[0].words[0].id,null);
});

test('preview removal counts use stable IDs rather than text or ordering',()=>{
  const before={topics:[{id:'t1',lessons:[{id:'l1',words:[{id:'w1',word:'水'},{id:'w2'}]}]},{id:'t2',lessons:[{id:'l2',words:[{id:'w3'}]}]}]};
  const after={topics:[{id:'t1',lessons:[{id:'l1',words:[{id:'w2'},{id:'w1',word:'更新'}]}]}]};
  assert.deepEqual(curriculumRemoved(before,after),{topics:1,lessons:1,words:1});
});

test('admin status distinguishes unpublished edits, published and archived records',()=>{
  assert.equal(curriculumStatus({version:0,publishedVersion:null,archivedAt:null}),'Bản nháp');
  assert.equal(curriculumStatus({version:1,publishedVersion:1,archivedAt:null}),'Đã xuất bản');
  assert.equal(curriculumStatus({version:2,publishedVersion:1,archivedAt:null}),'Có thay đổi nháp');
  assert.equal(curriculumStatus({version:2,publishedVersion:1,archivedAt:'2026-09-29'}),'Đã lưu trữ');
});
