import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cancelJapaneseSpeech, setDefaultSpeechRate, speakJapanese, subscribeSpeechErrors } from '../src/shared/audio/speech.ts';

const japanese = { lang: 'ja-JP', name: 'Japanese', default: false };
let synthesis;
let previousWindow;
let previousUtterance;

beforeEach(() => {
  previousWindow = globalThis.window;
  previousUtterance = globalThis.SpeechSynthesisUtterance;
  const listeners = new Set();
  synthesis = {
    voices: [japanese], spoken: [], cancellations: 0, listeners,
    getVoices() { return this.voices; },
    speak(utterance) { this.spoken.push(utterance); },
    cancel() { this.cancellations++; },
    addEventListener(event, callback) { assert.equal(event, 'voiceschanged'); listeners.add(callback); },
    removeEventListener(event, callback) { assert.equal(event, 'voiceschanged'); listeners.delete(callback); },
    voicesChanged() { for (const listener of [...listeners]) listener(); },
  };
  globalThis.window = { speechSynthesis: synthesis };
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) { this.text = text; }
  };
  setDefaultSpeechRate(0.9);
});

afterEach(() => {
  cancelJapaneseSpeech();
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
  if (previousUtterance === undefined) delete globalThis.SpeechSynthesisUtterance;
  else globalThis.SpeechSynthesisUtterance = previousUtterance;
});

test('uses the configured rate, preserves sentence punctuation and permits a local override', () => {
  setDefaultSpeechRate(0.7);
  speakJapanese('  日本語 (にほんご) / 文です。 次です！  ');
  assert.equal(synthesis.spoken[0].text, '日本語 (にほんご) / 文です。 次です！');
  assert.equal(synthesis.spoken[0].rate, 0.7);
  assert.equal(synthesis.spoken[0].lang, 'ja-JP');
  assert.equal(synthesis.spoken[0].voice, japanese);
  speakJapanese('次', 1.3);
  assert.equal(synthesis.spoken[1].rate, 1.3);
  speakJapanese('次', Number.NaN);
  assert.equal(synthesis.spoken[2].rate, 0.7);
});

test('waits for Japanese voices, speaks once, and clears its pending listener', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  synthesis.voices = [];
  speakJapanese('日本語');
  assert.equal(synthesis.spoken.length, 0);
  synthesis.voicesChanged();
  assert.equal(synthesis.spoken.length, 0);
  synthesis.voices = [japanese];
  synthesis.voicesChanged();
  synthesis.voicesChanged();
  t.mock.timers.tick(1000);
  assert.equal(synthesis.spoken.length, 1);
  assert.equal(synthesis.listeners.size, 0);
});

test('reports missing voices once after the bounded wait and never plays when voices arrive later', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  synthesis.voices = [];
  const errors = [];
  speakJapanese('日本語', undefined, { onError: message => errors.push(message) });
  t.mock.timers.tick(999);
  assert.equal(errors.length, 0);
  t.mock.timers.tick(1);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /chưa có giọng đọc tiếng Nhật/);
  synthesis.voices = [japanese];
  synthesis.voicesChanged();
  assert.equal(synthesis.spoken.length, 0);
  assert.equal(synthesis.listeners.size, 0);
});

test('never substitutes a non-Japanese voice even when its name mentions Japanese', () => {
  synthesis.voices = [{ lang: 'en-US', name: 'Japanese example', default: true }];
  const errors = [];
  const unsubscribe = subscribeSpeechErrors(message => errors.push(message));
  try {
    speakJapanese('日本語');
    assert.equal(synthesis.spoken.length, 0);
    assert.match(errors[0], /chưa có giọng đọc tiếng Nhật/);
    unsubscribe();
    speakJapanese('日本語');
    assert.equal(errors.length, 1);
  } finally { unsubscribe(); }
});

test('cancelling or replacing a pending request prevents delayed playback', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  synthesis.voices = [];
  let errors = 0;
  const cancelFirst = speakJapanese('一', undefined, { onError: () => errors++ });
  speakJapanese('二');
  cancelFirst();
  synthesis.voices = [japanese];
  synthesis.voicesChanged();
  assert.deepEqual(synthesis.spoken.map(utterance => utterance.text), ['二']);
  cancelJapaneseSpeech();
  synthesis.voices = [];
  const cancelThird = speakJapanese('三', undefined, { onError: () => errors++ });
  cancelThird();
  synthesis.voices = [japanese];
  synthesis.voicesChanged();
  t.mock.timers.tick(1000);
  assert.equal(synthesis.spoken.length, 1);
  assert.equal(errors, 0);
});

test('ignores replaced callbacks and old cleanup cannot cancel a newer utterance', () => {
  const callbacks = [];
  const cancelFirst = speakJapanese('一', undefined, {
    onStart: () => callbacks.push('old start'), onEnd: () => callbacks.push('old end'),
    onError: () => callbacks.push('old error'),
  });
  const oldStart = synthesis.spoken[0].onstart;
  const oldEnd = synthesis.spoken[0].onend;
  const oldError = synthesis.spoken[0].onerror;
  speakJapanese('二', undefined, { onStart: () => callbacks.push('start'), onEnd: () => callbacks.push('end') });
  const cancellations = synthesis.cancellations;
  cancelFirst();
  oldStart(); oldEnd(); oldError({ error: 'canceled' });
  assert.equal(synthesis.cancellations, cancellations);
  synthesis.spoken[1].onstart();
  synthesis.spoken[1].onend();
  assert.deepEqual(callbacks, ['start', 'end']);
});

test('reports unavailable speech support through global and local error handlers', () => {
  delete globalThis.window.speechSynthesis;
  const globalErrors = [];
  const localErrors = [];
  const unsubscribe = subscribeSpeechErrors(message => globalErrors.push(message));
  try {
    const cancel = speakJapanese('日本語', undefined, { onError: message => localErrors.push(message) });
    assert.equal(typeof cancel, 'function');
    cancel();
    assert.deepEqual(localErrors, globalErrors);
    assert.match(localErrors[0], /chưa hỗ trợ phát âm/);
  } finally { unsubscribe(); }
});

test('playback errors settle once without firing completion', () => {
  const errors = [];
  let ended = false;
  speakJapanese('日本語', undefined, { onError: message => errors.push(message), onEnd: () => { ended = true; } });
  const utterance = synthesis.spoken[0];
  const lateEnd = utterance.onend;
  const fail = utterance.onerror;
  fail({ error: 'not-allowed' });
  fail({ error: 'synthesis-failed' });
  lateEnd();
  assert.equal(errors.length, 1);
  assert.match(errors[0], /chưa cho phép phát âm/);
  assert.equal(ended, false);
});

test('global cancellation also clears the voice loading request', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  synthesis.voices = [];
  speakJapanese('日本語');
  cancelJapaneseSpeech();
  synthesis.voices = [japanese];
  synthesis.voicesChanged();
  t.mock.timers.tick(1000);
  assert.equal(synthesis.spoken.length, 0);
  assert.equal(synthesis.listeners.size, 0);
});
