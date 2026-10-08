import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { parseTranscriptImport, shadowingBody, shadowingForm, contentToShadowingForm } from '../src/features/shadowing/shadowing-editor-data.ts';

const ids = () => { let index = 0; return () => `00000000-0000-4000-8000-${String(++index).padStart(12, '0')}`; };
const sourceText = '学校へ行きます。';
const row = { id: 'source-import-id', startMs: 0, endMs: 2100, text: sourceText, translationVi: 'Tôi đi học.' };

test('JSON import copies only reviewed transcript fields, creates new occurrence IDs, and never trusts metadata or tokenization', () => {
  const result = parseTranscriptImport(JSON.stringify({ userId: 'other', title: 'fake', sourceId: 'fake', durationMs: 100,
    sentences: [{ ...row, tokens: [{ text: 'fake' }], correct: true, published: true }] }), 'json', ids());
  assert.deepEqual(result, [{ ...row, id: '00000000-0000-4000-8000-000000000001' }]);
  assert.equal('sourceId' in result[0], false);
  assert.equal('tokens' in result[0], false);
});

test('SRT/VTT import preserves millisecond boundaries but does not invent translations', () => {
  const srt = parseTranscriptImport(`1\n00:00:01,250 --> 00:00:02,501\n${sourceText}\n`, 'srt', ids());
  const vtt = parseTranscriptImport(`WEBVTT\n\n00:01.250 --> 00:02.501\n${sourceText}\n`, 'vtt', ids());
  assert.deepEqual(vtt, srt);
  assert.deepEqual(srt[0], { id: '00000000-0000-4000-8000-000000000001', startMs: 1250, endMs: 2501, text: sourceText, translationVi: '' });
});

test('rejects malformed or overlapping imports atomically, including unsupported translation shapes', () => {
  assert.throws(() => parseTranscriptImport('{', 'json'), /JSON không hợp lệ/);
  assert.throws(() => parseTranscriptImport('null', 'json'), /danh sách câu/);
  assert.throws(() => parseTranscriptImport(JSON.stringify([row, { ...row, startMs: 2000, endMs: 3000 }]), 'json', ids()), /chồng lấn/);
  assert.throws(() => parseTranscriptImport(JSON.stringify([{ ...row, translationVi: {} }]), 'json', ids()), /Bản dịch câu 1/);
  assert.throws(() => parseTranscriptImport(JSON.stringify([{ ...row, text: '<b>文</b>' }]), 'json', ids()), /văn bản thuần/);
  assert.throws(() => parseTranscriptImport(JSON.stringify([{ ...row, endMs: 0 }]), 'json', ids()), /bắt đầu nhỏ hơn/);
});

test('subtitle import enforces file and cue count limits before it can replace a draft', () => {
  assert.throws(() => parseTranscriptImport('あ'.repeat(400000), 'json'), /1 MiB/);
  const many = Array.from({ length: 501 }, (_, i) => ({ ...row, startMs: i * 2500, endMs: i * 2500 + 2000 }));
  assert.throws(() => parseTranscriptImport(JSON.stringify(many), 'json', ids()), /500 câu/);
});

const content = { youtubeId: 'abcdefghijk', title: 'Tên từ YouTube', channel: 'Kênh thật', durationMs: 3000, level: 'N5', description: 'Mô tả', sentences: [{ ...row, id: '00000000-0000-4000-8000-000000000001', tokens: [{ text: sourceText, reading: null }] }] };
const video = { id: 'video', sourceId: 'source-1', content, ...content };
test('loading or applying AI content requires fresh review and retains selected source separately', () => {
  const form = shadowingForm(video);
  assert.equal(form.transcriptReviewed, false);
  assert.equal(form.sourceId, 'source-1');
  assert.equal(form.sentences[0].id, content.sentences[0].id);
  const ai = contentToShadowingForm(content, 'editor-choice');
  assert.equal(ai.sourceId, 'editor-choice');
  assert.equal(ai.transcriptReviewed, false);
  assert.equal('tokens' in ai.sentences[0], false);
});

test('draft body canonicalizes URLs and preserves cue UUIDs; metadata is never client writable', () => {
  const form = shadowingForm(video);
  const result = shadowingBody({ ...form, url: 'https://youtu.be/abcdefghijk?t=2', transcriptReviewed: true });
  assert.equal(result.url, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(result.sentences[0].id, content.sentences[0].id);
  assert.equal(result.transcriptReviewed, true);
  assert.equal('title' in result, false);
  assert.throws(() => shadowingBody({ ...form, url: 'https://localhost/video' }), /youtube.com/);
});

const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64')}`;
const base = moduleUrl(readFileSync(new URL('../../../packages/client/src/api.ts', import.meta.url), 'utf8'));
const code = readFileSync(new URL('../src/shared/api.ts', import.meta.url), 'utf8').replace('@nihongo/client/api', base);
const { createAdminRequest } = await import(moduleUrl(code));
test('admin Shadowing and AI use the mounted account, while unrelated learner writes remain disallowed', async () => {
  const calls = [];
  const scope = createAdminRequest('owner-a', { isCurrent: () => true, fetcher: async (url, options) => { calls.push({ url, ...options }); return Response.json({ userId: 'owner-a' }); } });
  const requestId = '00000000-0000-4000-8000-000000000001';
  for (const path of ['/admin/shadowing/videos/prepare', '/admin/shadowing/videos', '/admin/shadowing/videos/video/publish', '/shadowing/ai']) await scope.request(path, { body: { expectedUserId: 'owner-b' } });
  await scope.request(`/shadowing/ai/${requestId}`);
  assert.equal(calls.length, 5);
  assert.ok(calls.slice(0, 4).every(call => JSON.parse(call.body).expectedUserId === 'owner-a'));
  await assert.rejects(scope.request('/shadowing/videos/video/grade', { body: {} }), /Unsupported/);
  await assert.rejects(scope.request('/shadowing/ai/anything'), /Unsupported/);
  scope.dispose();
});

test('server-side account change and late AI responses cannot populate the prior editor', async () => {
  let refreshes = 0, done;
  const mismatch = createAdminRequest('owner-a', { isCurrent: () => true, onAccessDenied: () => refreshes++, fetcher: async () => Response.json({ userId: 'owner-b', items: [] }) });
  await assert.rejects(mismatch.request('/admin/shadowing/videos'), { code: 'ACCOUNT_CHANGED' });
  assert.equal(refreshes, 1);
  const scope = createAdminRequest('owner-a', { isCurrent: () => true, fetcher: () => new Promise(resolve => { done = resolve; }) });
  const pending = scope.request('/shadowing/ai', { body: {} });
  scope.dispose();
  done(Response.json({ userId: 'owner-a', request: { status: 'ready' } }));
  await assert.rejects(pending, { code: 'ACCOUNT_CHANGED' });
});
