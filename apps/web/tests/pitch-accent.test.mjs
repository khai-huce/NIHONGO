import test from 'node:test';
import assert from 'node:assert/strict';
import { createPitchSearch, fetchPitchSearch } from '../src/features/pitch-accent/utils/pitchSearch.ts';

function harness(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [], states = [];
  const fetcher = (query, offset, signal) => new Promise((resolve, reject) => calls.push({ query, offset, signal, resolve, reject }));
  const controller = createPitchSearch(fetcher, state => states.push(state));
  t.after(() => controller.dispose());
  return { calls, states, controller, tick: ms => t.mock.timers.tick(ms), latest: () => states.at(-1) };
}
const result = (query, offset = 0) => ({ query, offset, limit: 20, total: 55, hasMore: offset < 40, catalogReady: true, items: [{ id: 'test-result' }] });

test('pitch lookup starts empty, debounces typing and waits for IME composition to finish', async t => {
  const { controller, tick, calls, latest } = harness(t);
  tick(1000);
  assert.equal(calls.length, 0);
  controller.search('   '); tick(1000);
  assert.equal(calls.length, 0);
  controller.search('ka', true); tick(1000);
  controller.search('か', true); tick(1000);
  assert.equal(calls.length, 0);
  assert.equal(latest().loading, false);
  controller.search('  かう  ');
  tick(299); assert.equal(calls.length, 0);
  tick(1); assert.equal(calls.length, 1);
  assert.equal(calls[0].query, 'かう');
  calls[0].resolve(result('かう'));
  await Promise.resolve();
  assert.equal(latest().response.query, 'かう');
  assert.equal(latest().loading, false);
});

test('rapid input coalesces to one request and duplicate composition-end input does not restart it', t => {
  const { controller, tick, calls } = harness(t);
  controller.search('k'); tick(150);
  controller.search('ka'); tick(150);
  controller.search('かう'); tick(250);
  controller.search('かう'); tick(50);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].query, 'かう');
});

test('A → B → A invalidates the first A even when an aborted request resolves later', async t => {
  const { controller, tick, calls, latest } = harness(t);
  controller.search('あめ'); tick(300);
  controller.search('はし'); tick(300);
  controller.search('あめ'); tick(300);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(calls[1].signal.aborted, true);
  calls[2].resolve({ ...result('あめ'), total: 7 }); await Promise.resolve();
  calls[0].resolve({ ...result('あめ'), total: 100 }); await Promise.resolve();
  calls[1].reject(new Error('old failure')); await Promise.resolve();
  assert.equal(latest().response.total, 7);
  assert.equal(latest().error, '');
});

test('a failed page retries that same page; a new query resets pagination', async t => {
  const { controller, tick, calls, latest } = harness(t);
  controller.search('k'); tick(300);
  calls[0].resolve(result('k')); await Promise.resolve();
  controller.page(20);
  controller.page(20); // Repeated clicks while loading do not issue another request.
  assert.equal(calls.length, 2);
  calls[1].reject(new Error('network unavailable')); await Promise.resolve();
  assert.equal(latest().error, 'network unavailable');
  controller.retry();
  assert.equal(calls[2].offset, 20);
  calls[2].resolve(result('k', 20)); await Promise.resolve();
  assert.equal(latest().response.offset, 20);
  assert.equal(latest().error, '');
  controller.search('ame'); tick(300);
  assert.equal(calls[3].offset, 0);
});

test('clearing input aborts in-flight work and does not resurrect its error or results', async t => {
  const { controller, tick, calls, latest } = harness(t);
  controller.search('あめ'); tick(300);
  controller.search('');
  calls[0].reject(new Error('delayed error')); await Promise.resolve();
  assert.equal(calls[0].signal.aborted, true);
  assert.deepEqual(latest(), { query: '', response: null, loading: false, error: '' });
  controller.retry(); tick(500);
  assert.equal(calls.length, 1);
});

test('a page removed by a catalog change offers a retry from the first page', async t => {
  const { controller, tick, calls, latest } = harness(t);
  controller.search('k'); tick(300);
  calls[0].resolve(result('k')); await Promise.resolve();
  controller.page(20);
  calls[1].resolve({ ...result('k', 20), total: 5, items: [], hasMore: false }); await Promise.resolve();
  assert.equal(latest().response, null);
  assert.match(latest().error, /Kết quả đã thay đổi/);
  controller.retry();
  assert.equal(calls[2].offset, 0);
  calls[2].resolve({ ...result('k'), total: 5, hasMore: false }); await Promise.resolve();
  assert.equal(latest().response.offset, 0);
});

test('disposal cancels scheduled work and rejects stale responses after remount', async t => {
  const { controller, tick, calls, states, latest } = harness(t);
  controller.search('あめ'); controller.dispose(); tick(300);
  assert.equal(calls.length, 0);
  controller.mount(); controller.search('はし'); tick(300);
  const count = states.length;
  controller.dispose(); calls[0].resolve(result('はし')); await Promise.resolve();
  assert.equal(states.length, count);
  controller.mount(); controller.search('あめ'); tick(300);
  calls[1].resolve(result('あめ')); await Promise.resolve();
  assert.equal(latest().response.query, 'あめ');
});

test('catalog not imported and no matching results remain different server states', async t => {
  const { controller, tick, calls, latest } = harness(t);
  controller.search('あめ'); tick(300);
  calls[0].resolve({ ...result('あめ'), total: 0, catalogReady: false, items: [] }); await Promise.resolve();
  assert.equal(latest().response.catalogReady, false);
  controller.retry();
  calls[1].resolve({ ...result('あめ'), total: 0, catalogReady: true, items: [] }); await Promise.resolve();
  assert.equal(latest().response.catalogReady, true);
  assert.equal(latest().response.total, 0);
});

test('pitch API encodes query parameters and surfaces server or malformed-response errors', async t => {
  const abort = new AbortController();
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    const parsed = new URL(url, 'http://localhost');
    assert.equal(parsed.pathname, '/api/pitch-accent');
    assert.equal(parsed.searchParams.get('q'), '雨&雪');
    assert.equal(parsed.searchParams.get('offset'), '20');
    assert.equal(parsed.searchParams.get('limit'), '20');
    assert.equal(options.credentials, 'same-origin');
    assert.ok(options.signal);
    return { ok: true, json: async () => result('雨&雪', 20) };
  });
  assert.equal((await fetchPitchSearch('雨&雪', 20, abort.signal)).offset, 20);
  fetchMock.mock.mockImplementation(async () => ({ ok: false, json: async () => ({ error: { message: 'Hãy thử lại sau.' } }) }));
  await assert.rejects(() => fetchPitchSearch('a', 0, abort.signal), /Hãy thử lại sau/);
  fetchMock.mock.mockImplementation(async () => ({ ok: true, json: async () => null }));
  await assert.rejects(() => fetchPitchSearch('a', 0, abort.signal), /không hợp lệ/);
  fetchMock.mock.mockImplementation(async () => { throw new Error('offline'); });
  await assert.rejects(() => fetchPitchSearch('a', 0, abort.signal), /Không kết nối được máy chủ/);
});
