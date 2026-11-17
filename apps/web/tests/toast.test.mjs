import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createToastStore, TOAST_LIMIT } from '../../../packages/client/src/toast/store.ts';

test('repeated feedback does not flood the viewport, but a dismissed action can notify again', () => {
  const store = createToastStore();
  const id = store.error('Không kết nối được máy chủ.');
  for (let i = 0; i < 20; i++) store.error('Không kết nối được máy chủ.');
  assert.equal(store.getSnapshot().length, 1);
  store.dismiss(id);
  assert.notEqual(store.error('Không kết nối được máy chủ.'), id);
  assert.equal(store.getSnapshot().length, 1);
});

test('a burst stays bounded and prioritizes the latest feedback', () => {
  const store = createToastStore();
  for (let i = 0; i < 20; i++) store.info(`Thao tác ${i}`);
  assert.equal(store.getSnapshot().length, TOAST_LIMIT);
  assert.equal(store.getSnapshot().at(-1).message, 'Thao tác 19');
  store.success('  ');
  assert.equal(store.getSnapshot().length, TOAST_LIMIT);
});

test('late feedback from an old account stays out of the new account store', () => {
  const oldAccount = createToastStore(), currentAccount = createToastStore();
  const lateSave = () => oldAccount.success('Đã lưu bài.');
  currentAccount.info('Đã đăng xuất.');
  lateSave();
  assert.deepEqual(currentAccount.getSnapshot().map(x => x.message), ['Đã đăng xuất.']);
});

test('subscribers receive updates without mutation of earlier snapshots and can unsubscribe', () => {
  const store = createToastStore(), before = store.getSnapshot();
  let renders = 0;
  const off = store.subscribe(() => renders++);
  const id = store.warning('Kiểm tra nội dung trước khi lưu.');
  assert.equal(renders, 1);
  assert.equal(before.length, 0);
  off();
  store.dismiss(id);
  assert.equal(renders, 1);
  assert.equal(store.getSnapshot().length, 0);
});
