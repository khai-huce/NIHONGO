import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { analyzeRoadmapKanji } from '@nihongo/shared/study/roadmap';
import { assessRoadmapKanji, roadmapProgress } from '@nihongo/shared/study/roadmap-study';
import { DEFAULT_ROADMAP } from '@nihongo/shared/study/default-roadmap';

const source = readFileSync(new URL('../src/features/content/lib/content-catalog.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { validateContentCatalog } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const fixture = JSON.parse(readFileSync(new URL('../../api/content/catalog-initial.json', import.meta.url), 'utf8'));
const catalog = { kanji: fixture.kanji.map(item => item.data), archivedKanji: [], radicals: fixture.radicals.map(item => item.data), roadmaps: fixture.roadmaps };

test('published database catalog expands study without changing n5-v1 identities or days', () => {
  const data = validateContentCatalog(catalog), pairs = data.kanji.map(item => [item.id, item.kanji]);
  assert.equal(data.kanji.length, 111);
  assert.deepEqual(data.roadmaps[0].kanjiList, DEFAULT_ROADMAP.kanjiList);
  assert.equal(data.roadmaps[0].perDay, 10);
  const newItem = data.kanji.find(item => item.kanji === '安');
  assert.ok(newItem.id.startsWith('k-u'));
  assert.deepEqual(analyzeRoadmapKanji('安一安', pairs), { kanjiList: ['安', '一'], unsupported: [] });
  let progress = assessRoadmapKanji(['安', '一'], 2, {}, [], 1, newItem.id, false, pairs);
  assert.deepEqual(progress.completedDays, []);
  progress = assessRoadmapKanji(['安', '一'], 2, progress.assessments, [], 1, 'k-1', true, pairs);
  assert.deepEqual(progress.completedDays, [1]);
  assert.deepEqual(roadmapProgress(['安', '一'], 2, progress.assessments, progress.completedDays, pairs), progress);
});

test('archived Kanji remain resolvable for old study while creation rejects them', () => {
  const archived = catalog.kanji[0];
  const data = validateContentCatalog({ ...catalog, kanji: catalog.kanji.slice(1), archivedKanji: [archived] });
  assert.deepEqual(analyzeRoadmapKanji('一', data.kanji.map(item => [item.id, item.kanji])).unsupported, ['一']);
  const pairs = [...data.kanji, ...data.archivedKanji].map(item => [item.id, item.kanji]);
  assert.deepEqual(assessRoadmapKanji(['一'], 1, {}, [], 1, archived.id, true, pairs).completedDays, [1]);
});

test('malformed catalog identities or unresolved roadmap entries fail before rendering study', () => {
  assert.throws(() => validateContentCatalog({ ...catalog, kanji: [...catalog.kanji, catalog.kanji[0]] }));
  assert.throws(() => validateContentCatalog({ ...catalog, kanji: catalog.kanji.slice(1) }));
  assert.throws(() => validateContentCatalog({ ...catalog, roadmaps: [{ ...catalog.roadmaps[0], kanjiIds: ['missing'] }] }));
  assert.throws(() => validateContentCatalog({ ...catalog, kanji: [{ ...catalog.kanji[0], onyomi: null }] }));
  assert.deepEqual(validateContentCatalog({ kanji: [], archivedKanji: [], radicals: [], roadmaps: [] }).kanji, []);
});
