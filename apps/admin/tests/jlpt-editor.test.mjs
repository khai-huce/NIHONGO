import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { appendJlptResource, copyJlptDraft, emptyJlptDraft, jlptDraftCounts, jlptPreviewSections, jlptStatus, moveJlptItem } from '../src/features/jlpt/jlpt-editor-data.ts';

const option = { kind: 'kanji', targetId: 'k-1', title: '一', subtitle: 'NHẤT · Một', level: 'N5', available: true, href: '/kanji/1' };
const session = { id: 'session-1', title: 'Buổi 1', description: '', estimatedMinutes: 30, resources: [] };

test('selecting catalog content allocates only an occurrence identity and never copies authored knowledge', () => {
  let calls = 0;
  const uuid = () => `occurrence-${++calls}`;
  const selected = appendJlptResource(session, option, uuid);
  assert.deepEqual(selected.resources, [{ id: 'occurrence-1', kind: 'kanji', targetId: 'k-1' }]);
  assert.deepEqual(session.resources, []);
  assert.equal(appendJlptResource(selected, option, uuid), selected);
  assert.equal(appendJlptResource(session, { ...option, available: false }, uuid), session);
  assert.equal(calls, 1);
  const secondSession = appendJlptResource({ ...session, id: 'session-2' }, option, uuid);
  assert.equal(secondSession.resources[0].targetId, selected.resources[0].targetId);
  assert.notEqual(secondSession.resources[0].id, selected.resources[0].id);
});

test('reordering and draft edits preserve IDs, links, and the saved baseline', () => {
  const one = appendJlptResource(session, option, () => 'stable-reference');
  const two = { ...session, id: 'session-2', title: 'Buổi 2', estimatedMinutes: 45 };
  const record = { draft: { ...emptyJlptDraft(), title: 'Lộ trình N5', sessions: [one, two] } };
  const draft = copyJlptDraft(record);
  draft.sessions = moveJlptItem(draft.sessions, 1, -1);
  draft.sessions[1].title = 'Đã đổi tên';
  assert.equal(record.draft.sessions[0].title, 'Buổi 1');
  assert.equal(record.draft.sessions[0].resources[0].id, 'stable-reference');
  assert.equal(draft.sessions[1].id, 'session-1');
  assert.equal(draft.sessions[1].resources[0].id, 'stable-reference');
  assert.deepEqual(jlptDraftCounts(draft), { sessions: 2, resources: 1, minutes: 75 });
  assert.equal(moveJlptItem(draft.sessions, 0, -1), draft.sessions);
  assert.equal(moveJlptItem(draft.sessions, 2, -1), draft.sessions);
});

test('catalog status distinguishes saved unpublished changes and archived content', () => {
  assert.equal(jlptStatus({ archivedAt: null, version: 1, publishedVersion: null }), 'Bản nháp');
  assert.equal(jlptStatus({ archivedAt: null, version: 4, publishedVersion: 4 }), 'Đã xuất bản');
  assert.equal(jlptStatus({ archivedAt: null, version: 5, publishedVersion: 4 }), 'Có thay đổi nháp');
  assert.equal(jlptStatus({ archivedAt: '2026-10-24', version: 6, publishedVersion: 4 }), 'Đã lưu trữ');
});

test('admin test preview matches answer keys by session ID after reordering, preserving passage and explanation', () => {
  const question = { id: 'question-1', prompt: 'Câu hỏi thật', passage: 'Đoạn văn thật', options: ['一', '二', '三', '四'], correctIndex: 2, explanation: 'Giải thích thật' };
  const preview = { draft: { passPercent: 85, sessions: [{ id: 'one', questions: [question] }, { id: 'two', questions: [{ ...question, id: 'question-2', correctIndex: 0 }] }] }, sessions: [{ id: 'two', questionCount: 1, resources: [] }, { id: 'one', questionCount: 1, resources: [] }] };
  const sections = jlptPreviewSections(preview);
  assert.equal(sections[0].questions[0].id, 'question-2');
  assert.equal(sections[0].questions[0].correctIndex, 0);
  assert.deepEqual(sections[1].questions, [question]);
  assert.equal(preview.draft.passPercent, 85);
  assert.equal(preview.draft.sessions[0].id, 'one');
});

test('legacy sessions without a question bank remain empty rather than inheriting another session test', () => {
  const preview = { draft: { sessions: [{ id: 'legacy' }] }, sessions: [{ id: 'legacy', resources: [] }, { id: 'other', resources: [] }] };
  assert.deepEqual(jlptPreviewSections(preview).map(row => row.questions), [[], []]);
  assert.equal(emptyJlptDraft().passPercent, 80);
});

const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64')}`;
const base = moduleUrl(readFileSync(new URL('../../../packages/client/src/api.ts', import.meta.url), 'utf8'));
const code = readFileSync(new URL('../src/shared/api.ts', import.meta.url), 'utf8').replace('@nihongo/client/api', base);
const { createAdminRequest } = await import(moduleUrl(code));

test('JLPT picker, preview and lifecycle writes are scoped to the active administrator', async () => {
  const calls = [];
  const scope = createAdminRequest('admin-a', { isCurrent: () => true, fetcher: async (url, options) => { calls.push({ url, ...options }); return Response.json({ userId: 'admin-a', items: [] }); } });
  await scope.request('/admin/jlpt/resources?kind=kanji&q=%E4%B8%80&level=N5&page=1');
  await scope.request('/admin/jlpt/roadmaps');
  for (const path of ['/admin/jlpt/roadmaps/preview', '/admin/jlpt/roadmaps', '/admin/jlpt/roadmaps/id/publish', '/admin/jlpt/roadmaps/id/archive', '/admin/jlpt/roadmaps/id/restore']) {
    await scope.request(path, { body: { expectedUserId: 'wrong-user', version: 3 } });
  }
  assert.ok(calls.slice(2).every(call => JSON.parse(call.body).expectedUserId === 'admin-a'));
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].body, undefined);
  await assert.rejects(scope.request('/admin/jlpt/resources-fake'), /Unsupported admin endpoint/);
  await assert.rejects(scope.request('/jlpt/roadmaps/N5'), /Unsupported admin endpoint/);
  scope.dispose();
});

test('JLPT read results from another login and late writes cannot populate the old editor', async () => {
  let refreshes = 0;
  const mismatch = createAdminRequest('admin-a', { isCurrent: () => true, onAccessDenied: () => refreshes++, fetcher: async () => Response.json({ userId: 'admin-b', items: ['private-draft'] }) });
  await assert.rejects(mismatch.request('/admin/jlpt/roadmaps'), { code: 'ACCOUNT_CHANGED' });
  assert.equal(refreshes, 1);
  let resolve;
  const scope = createAdminRequest('admin-a', { isCurrent: () => true, fetcher: () => new Promise(done => { resolve = done; }) });
  const pending = scope.request('/admin/jlpt/roadmaps/id', { method: 'PATCH', body: { version: 1 } });
  scope.dispose(); scope.activate();
  resolve(Response.json({ userId: 'admin-a', roadmap: { version: 2 } }));
  await assert.rejects(pending, { code: 'ACCOUNT_CHANGED' });
});
