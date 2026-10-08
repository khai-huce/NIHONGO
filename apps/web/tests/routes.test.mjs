import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pagePaths, pathForTab, tabForPath, kanjiPath, grammarPath } from '../src/app/routes.ts';

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
  assert.equal(tabForPath('/tu-vung/giao-trinh/nihongo-n5/bai/lesson-id'),'vocab-giao-trinh');
  assert.equal(tabForPath('/tu-vung/giao-trinh/nihongo-n5'),'vocab-giao-trinh');
  assert.equal(grammarPath('a/b'),'/ngu-phap/mau/a%2Fb');
  assert.equal(grammarPath('grammar:6b2d5975-b9a6-42aa-a13c-70706b50b792'),'/ngu-phap/mau/6b2d5975-b9a6-42aa-a13c-70706b50b792');
  assert.equal(tabForPath('/ngu-phap/giao-trinh/n5/bai/lesson-id'),'bunpo');
  assert.equal(tabForPath('/ngu-phap/mau/pattern-id/bai-tap'),'bunpo');
  assert.equal(tabForPath('/missing'),'');
  assert.equal(pathForTab('personal'),'/ca-nhan/lo-trinh');
});
