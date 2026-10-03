import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGrammarJson, grammarCounts, grammarRemoved, moveGrammarItem } from '../src/admin/grammar-editor-data.ts';
test('grammar import allocates missing identities once and preserves existing IDs', () => {
  let calls = 0;
  const parsed = parseGrammarJson(JSON.stringify({title:'Test',lessons:[{id:'old',patterns:[{examples:[{}],exercises:[{}]}]}]}), () => `id-${++calls}`);
  assert.equal(parsed.lessons[0].id,'old'); assert.equal(calls,3);
  assert.equal(parsed.lessons[0].patterns[0].exercises[0].id,'id-3');
  assert.throws(() => parseGrammarJson('[]')); assert.throws(() => parseGrammarJson('broken'));
});
test('grammar reorder/removal reflects child content without mutating saved draft', () => {
  const draft={lessons:[{id:'l',patterns:[{id:'p',examples:[{id:'e'}],exercises:[{id:'q'}]}]}]};
  assert.deepEqual(grammarCounts(draft),{lessons:1,patterns:1,examples:1,exercises:1});
  assert.deepEqual(grammarRemoved(draft,{lessons:[]}),{lessons:1,patterns:1,examples:1,exercises:1});
  const items=[1,2,3];assert.deepEqual(moveGrammarItem(items,0,1),[2,1,3]);assert.deepEqual(items,[1,2,3]);
});
