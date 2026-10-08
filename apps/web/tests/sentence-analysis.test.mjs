import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSentenceRequestSession, normalizeSentenceInput } from '../src/features/grammar/utils/sentenceRequests.ts';

test('sentence input normalization keeps entered content and normalizes NFC', () => {
  assert.equal(normalizeSentenceInput('  は\u3099す\n日本語  '), 'ばす\n日本語');
  assert.equal(normalizeSentenceInput('   '), '');
});

test('an input edit discards a delayed result even when input is changed back', async () => {
  const session = createSentenceRequestSession();
  const firstRevision = session.sync('account-a:sentence-a');
  const old = session.begin('analyze');
  session.sync('account-a:sentence-b');
  assert.notEqual(session.sync('account-a:sentence-a'), firstRevision);
  let accepted = false;
  await Promise.resolve().then(() => { if (old.current()) accepted = true; });
  assert.equal(accepted, false);
});

test('double click and simultaneous dictionary/AI requests cannot overlap', () => {
  const session = createSentenceRequestSession();
  session.sync('account-a:sentence');
  const request = session.begin('analyze');
  assert.equal(session.begin('analyze'), null);
  assert.equal(session.begin('ai'), null);
  request.finish();
  assert.ok(session.begin('ai'));
});

test('finishing an obsolete request does not unlock the current request', () => {
  const session = createSentenceRequestSession();
  session.sync('one');
  const old = session.begin('ai');
  session.sync('two');
  const current = session.begin('ai');
  old.finish();
  assert.equal(old.current(), false);
  assert.equal(current.current(), true);
  assert.equal(session.begin('ai'), null);
  current.finish();
  assert.ok(session.begin('ai'));
});

test('AI retries reuse their UUID after network loss or busy and renew only when requested', () => {
  const session = createSentenceRequestSession();
  session.sync('account-a:sentence');
  const id = session.aiId();
  session.retryAi('NETWORK_ERROR');
  assert.equal(session.aiId(), id);
  session.retryAi('AI_BUSY');
  assert.equal(session.aiId(), id);
  session.retryAi('AI_RETRY_NEW');
  assert.notEqual(session.aiId(), id);
});

test('terminal provider errors allow a fresh retry immediately; uncertain errors recover the existing request', () => {
  const session = createSentenceRequestSession();
  session.sync('account-a:sentence');
  for (const code of ['AI_UNAVAILABLE', 'AI_INVALID_RESPONSE', 'AI_QUOTA']) {
    const id = session.aiId();
    session.retryAi(code);
    assert.notEqual(session.aiId(), id, `${code} must start a fresh request on the next click`);
  }
  for (const code of ['NETWORK_ERROR', 'AI_BUSY', 'SERVER_ERROR', 'UNKNOWN_ERROR']) {
    const id = session.aiId();
    session.retryAi(code);
    assert.equal(session.aiId(), id, `${code} must preserve the request for recovery`);
  }
});

test('account and input changes invalidate private AI results and request IDs', () => {
  const session = createSentenceRequestSession();
  const firstRevision = session.sync('account-a:sentence');
  const old = session.begin('ai'), id = session.aiId();
  session.sync('guest:sentence');
  assert.equal(old.current(), false);
  assert.notEqual(session.aiId(), id);
  assert.notEqual(session.sync('account-a:sentence'), firstRevision);
  assert.notEqual(session.aiId(), id);
});

test('unmount prevents responses and remount cannot revive an old response', () => {
  const session = createSentenceRequestSession();
  session.sync('account-a:sentence');
  const request = session.begin('ai');
  session.unmount();
  assert.equal(request.current(), false);
  assert.equal(session.begin('analyze'), null);
  session.mount();
  assert.equal(request.current(), false);
  assert.ok(session.begin('analyze'));
});
