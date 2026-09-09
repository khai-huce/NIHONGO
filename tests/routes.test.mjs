import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pagePaths, pathForTab, tabForPath, kanjiPath, grammarPath } from '../src/routes.ts';

test('every sidebar destination has a unique URL and resolves to the active tab', () => {
  assert.equal(new Set(Object.values(pagePaths)).size,Object.keys(pagePaths).length);
  for (const [tab,path] of Object.entries(pagePaths)) {
    assert.equal(pathForTab(tab),path);
    assert.equal(tabForPath(path),tab);
    assert.equal(tabForPath(path+'/'),tab);
  }
});
test('detail URLs retain the correct sidebar section and encode identifiers', () => {
  assert.equal(tabForPath(kanjiPath('k-1')),'kanji');
  assert.equal(tabForPath(grammarPath('s-ka')),'bunpo');
  assert.equal(grammarPath('a/b'),'/ngu-phap/a%2Fb');
  assert.equal(tabForPath('/missing'),'');
  assert.equal(pathForTab('personal'),'/ca-nhan/lo-trinh');
});
