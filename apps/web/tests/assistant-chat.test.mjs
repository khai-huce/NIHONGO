import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assistantHistory, isInternalAssistantUrl, validateAssistantResponse, retainAssistantRequest, canSubmitAssistantOnEnter } from '../src/features/assistant/lib/assistant-chat.ts';

const turn = (id, overrides={}) => ({ id, state:'done', request:{message:`Câu ${id}`, expectedUserId:'a',id,currentRoute:'/kanji',history:[]}, reply:{text:`Đáp ${id}`,sources:[]},...overrides });
const response = () => ({userId:'a',id:'request',cached:false,reply:{text:'Hãy bấm ngôi sao.',sources:[{id:'help:review',title:'Ôn tập',url:'/ca-nhan/on-tap'}]}});

test('assistant history retains complete answered exchanges only, within both bounds',()=>{
  const turns=Array.from({length:10},(_,i)=>turn(`${i}`));
  turns.push(turn('pending',{state:'pending'}),turn('failed',{state:'failed'}));
  const history=assistantHistory(turns);
  assert.equal(history.length,10);assert.equal(history[0].content,'Câu 5');
  assert.deepEqual(history.map(x=>x.role),Array.from({length:5},()=>['user','assistant']).flat());
  const long=Array.from({length:5},(_,i)=>turn(`${i}`,{request:{message:'a'.repeat(1000)},reply:{text:'b'.repeat(4000),sources:[]}}));
  assert.equal(assistantHistory(long).length,6);
  assert.ok(assistantHistory(long).reduce((s,x)=>s+x.content.length,0)<=16000);
});
test('assistant links remain internal even with encoded or malformed schemes',()=>{
  for(const value of ['/kanji/k-1','/ca-nhan/on-tap?type=grammar','/tron-doi/jlpt?level=N5']) assert.equal(isInternalAssistantUrl(value),true);
  for(const value of ['https://evil.test','//evil.test','/\\evil.test','/%2f%2fevil.test','/%252f%252fevil.test','/%00x','/kanji\n','javascript:alert(1)',null,'/%zz']) assert.equal(isInternalAssistantUrl(value),false);
});
test('responses bind the account and request and reject malformed or unsafe citations',()=>{
  assert.deepEqual(validateAssistantResponse(response(),'a','request'),response());
  for(const payload of [null,{...response(),userId:'b'},{...response(),id:'other'},{...response(),cached:null},
    {...response(),reply:{text:'',sources:[]}}, {...response(),reply:{text:'a'.repeat(4001),sources:[]}},
    {...response(),reply:{text:'hello',sources:[{id:'x',title:'x',url:'//evil.test'}]}}]){
    assert.throws(()=>validateAssistantResponse(payload,'a','request'));
  }
});
test('network uncertainty and pending responses reuse the request; terminal errors require a new request',()=>{
  assert.equal(retainAssistantRequest(0,'NETWORK_ERROR'),true);
  assert.equal(retainAssistantRequest(409,'AI_BUSY'),true);
  for(const [status,code] of [[503,'AI_RETRY_NEW'],[409,'AI_CONTEXT_CHANGED'],[429,'AI_QUOTA'],[401,'UNAUTHENTICATED']]) assert.equal(retainAssistantRequest(status,code),false);
});
test('Japanese IME composition and shift Enter never submit a chat message',()=>{
  assert.equal(canSubmitAssistantOnEnter({key:'Enter',isComposing:false}),true);
  for(const event of [{key:'Enter',isComposing:true},{key:'Enter',isComposing:false,keyCode:229},{key:'Enter',isComposing:false,shiftKey:true},{key:'a',isComposing:false}]) assert.equal(canSubmitAssistantOnEnter(event),false);
});
