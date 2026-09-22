import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { hasUnpublishedDraft, filterKanji } from '../src/admin/catalog.ts';

const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64')}`;
const base = moduleUrl(readFileSync(new URL('../src/utils/api.ts', import.meta.url), 'utf8'));
const code = readFileSync(new URL('../src/admin/api.ts', import.meta.url), 'utf8').replace('../utils/api.ts', base);
const { createAdminRequest, AdminApiError } = await import(moduleUrl(code));

test('admin writes bind the mounted account even if a child supplies another owner', async () => {
  let captured;
  const scope = createAdminRequest('owner-a', { isCurrent: () => true, fetcher: async (url, options) => {
    captured = {url,...options}; return Response.json({item:{id:'k-1'}});
  }});
  const result = await scope.request('/admin/content/kanji/k-1', {method:'PUT',body:{expectedUserId:'owner-b',expectedVersion:2}});
  assert.equal(result.item.id,'k-1');
  assert.equal(captured.credentials,'same-origin');
  assert.deepEqual(JSON.parse(captured.body),{expectedUserId:'owner-a',expectedVersion:2});
  scope.dispose();
});

test('late responses from an old account or disposed StrictMode generation cannot reach the editor', async () => {
  let resolve;
  let active = true;
  const scope = createAdminRequest('owner-a', {isCurrent:()=>active,fetcher:()=>new Promise(done=>{resolve=done;})});
  const pending = scope.request('/admin/content/kanji');
  scope.dispose(); scope.activate();
  resolve(Response.json({items:['old']}));
  await assert.rejects(pending,{code:'ACCOUNT_CHANGED'});
  active=false;
  await assert.rejects(scope.request('/admin/content/kanji'),{code:'ACCOUNT_CHANGED'});
});

test('admin validation retains nested field paths; lost privileges trigger fresh account verification', async () => {
  let refresh=0;
  const scope=createAdminRequest('owner-a',{isCurrent:()=>true,onAccessDenied:()=>refresh++,fetcher:async()=>Response.json({error:{code:'VALIDATION_ERROR',message:'Invalid',issues:[{path:['input','entries',0,'data','meaning'],message:'Required'}]}},{status:400})});
  await assert.rejects(scope.request('/admin/content/imports/preview',{body:{}}),error=>error instanceof AdminApiError && error.issues[0].path[2]===0);
  assert.equal(refresh,0);
  const denied=createAdminRequest('owner-a',{isCurrent:()=>true,onAccessDenied:()=>refresh++,fetcher:async()=>Response.json({error:{code:'ADMIN_REQUIRED',message:'Denied'}},{status:403})});
  await assert.rejects(denied.request('/admin/content/kanji'),{status:403});
  assert.equal(refresh,1);
});

test('uncertain network writes remain errors rather than reporting a saved draft',async()=>{
  const scope=createAdminRequest('owner-a',{isCurrent:()=>true,fetcher:async()=>{throw new Error('offline');}});
  await assert.rejects(scope.request('/admin/content/kanji/k-1',{method:'PUT',body:{}}),{code:'NETWORK_ERROR'});
});

test('reading draft writes use the admin scope and stop on session disposal during audio', async () => {
  let captured, done;
  const scope = createAdminRequest('owner-a', { isCurrent: () => true, fetcher: async (url, options) => {
    captured = {url,...options};
    if (url.endsWith('/audio')) return new Promise(resolve => { done=resolve; });
    return Response.json({article:{version:3}});
  }});
  await scope.request('/admin/reading/articles/one',{method:'PATCH',body:{version:2}});
  assert.equal(captured.method,'PATCH');
  assert.equal(JSON.parse(captured.body).expectedUserId,'owner-a');
  await assert.rejects(scope.request('/reading/articles/one'),/Unsupported admin endpoint/);
  const pending=scope.request('/admin/reading/articles/one/audio',{body:{version:3},timeoutMs:210000});
  scope.dispose();
  assert.equal(captured.signal.aborted,true);
  done(Response.json({audio:{id:'stale'}}));
  await assert.rejects(pending,{code:'ACCOUNT_CHANGED'});
});

test('draft indicators compare source and content without confusing JSONB key order',()=>{
  const draft={id:'k-1',kanji:'一',hanViet:'NHẤT',meaning:'Một',level:'N5',onyomi:['イチ'],kunyomi:[]};
  const item={id:'k-1',status:'published',draft,published:Object.fromEntries(Object.entries(draft).reverse()),sourceId:'a',draftSourceId:'a'};
  assert.equal(hasUnpublishedDraft(item),false);
  assert.equal(hasUnpublishedDraft({...item,draftSourceId:'b'}),true);
  assert.equal(hasUnpublishedDraft({...item,draft:{...draft,meaning:'Số một'}}),true);
  assert.equal(filterKanji([item],'nhat','N5','published').length,1);
  assert.equal(filterKanji([item],'イチ','','').length,1);
  assert.equal(filterKanji([item],'','N4','').length,0);
  assert.equal(filterKanji([item],'','','changed').length,0);
});
