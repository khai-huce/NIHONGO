import test from 'node:test';
import assert from 'node:assert/strict';
import { ReadingPlayer } from '../src/utils/reading-player.ts';
import { audioPosition, guestReading, readGuestReadings, readingLength, validateReadingAudio } from '../src/utils/reading.ts';

const article = guestReading('一。\n二。', 'article-1');
const manifest = { id: 'audio-1', articleId: article.id, version: 1, voice: 'ja-JP-NanamiNeural', totalSeconds: 7,
  segments: [
    { sentenceId: 'p1-s1', offsetSec: 0, durationSec: 3, url: '/api/reading/articles/article-1/audio/audio-1/0.mp3' },
    { sentenceId: 'p2-s1', offsetSec: 3, durationSec: 4, url: '/api/reading/articles/article-1/audio/audio-1/1.mp3' },
  ] };
class Media extends EventTarget {
  readyState = 0; currentTime = 0; duration = 0; playbackRate = 1; paused = true; src = ''; error = null;
  playCalls = 0; loadCalls = 0; deferredPlay = null;
  load() { this.loadCalls++; this.readyState = 0; this.currentTime = 0; }
  metadata(duration) { this.duration = duration; this.readyState = 1; this.dispatchEvent(new Event('loadedmetadata')); }
  play() { this.playCalls++; this.paused = false; this.dispatchEvent(new Event('playing')); return this.deferredPlay ?? Promise.resolve(); }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  time(time) { this.currentTime = time; this.dispatchEvent(new Event('timeupdate')); }
  end() { this.currentTime = this.duration; this.dispatchEvent(new Event('ended')); }
}
function setup() {
  const media = new Media(), states = [];
  const player = new ReadingPlayer(media, manifest, state => states.push(state));
  return { media, player, states, get state() { return states.at(-1); } };
}

test('uses measured media time and pause/resume keeps the same source and position', () => {
  const s = setup(); s.player.play(); s.media.metadata(3); s.media.time(1.25);
  assert.equal(s.state.currentTime, 1.25); assert.equal(s.state.playing, true);
  const loads = s.media.loadCalls;
  s.player.pause(); assert.equal(s.state.playing, false);
  s.player.play(); assert.equal(s.media.currentTime, 1.25); assert.equal(s.media.loadCalls, loads);
  s.player.setRate(1.5); assert.equal(s.media.playbackRate, 1.5); assert.equal(s.media.currentTime, 1.25);
  s.player.dispose();
});

test('sentence transition, full timeline seek and previous use measured segment offsets', () => {
  const s = setup(); s.player.play(); s.media.metadata(3); s.media.end();
  assert.equal(s.state.sentenceId, 'p2-s1'); assert.equal(s.state.currentTime, 3);
  s.media.metadata(4); s.media.time(1); assert.equal(s.state.currentTime, 4);
  s.player.seek(5.5); assert.equal(s.media.currentTime, 2.5); assert.equal(s.state.currentTime, 5.5);
  s.player.previous(); s.media.metadata(3); assert.equal(s.state.sentenceId, 'p1-s1');
  assert.equal(s.media.paused, false); s.player.dispose();
});

test('loop stays on the chosen sentence; last sentence stops and replay starts at the beginning', () => {
  const s = setup(); s.player.sentence('p2-s1'); s.media.metadata(4); s.player.setLoop(true); s.media.end();
  assert.equal(s.state.sentenceId, 'p2-s1'); assert.equal(s.media.currentTime, 0);
  s.player.setLoop(false); s.media.end(); assert.equal(s.state.playing, false); assert.equal(s.state.currentTime, 7);
  s.player.play(); assert.equal(s.state.sentenceId, 'p1-s1'); s.player.dispose();
});

test('seeking while paused does not start playback and seeks apply after metadata arrives', () => {
  const s = setup(); s.player.seek(5); assert.equal(s.media.playCalls, 0);
  s.media.metadata(4); assert.equal(s.media.currentTime, 2); assert.equal(s.media.playCalls, 0);
  s.player.next(); assert.equal(s.state.playing, false); s.player.dispose();
});

test('media failure is visible, retry reloads one source, disposal removes events and media', () => {
  const s = setup(); s.player.play(); s.media.metadata(3); s.media.error = { code: 2 };
  s.media.dispatchEvent(new Event('error')); assert.match(s.state.error, /Không tải được/);
  s.media.error = null;
  // Browser error remains present until a new source loads; retain it for retry.
  s.media.error = { code: 2 }; const loads = s.media.loadCalls;
  s.player.play(); assert.equal(s.media.loadCalls, loads + 1); s.media.error = null; s.media.metadata(3);
  s.player.dispose(); const count = s.states.length;
  s.media.time(2); s.media.end(); assert.equal(s.states.length, count); assert.equal(s.media.src, ''); assert.equal(s.media.paused, true);
});

test('late rejected playback from an old sentence or disposed route cannot change current state', async () => {
  const s = setup(); let reject;
  s.media.deferredPlay = new Promise((_, fail) => { reject = fail; });
  s.player.play(); s.media.metadata(3);
  s.player.pause(); reject(new Error('interrupted')); await Promise.resolve(); await Promise.resolve();
  assert.equal(s.state.error, ''); assert.equal(s.state.playing, false); s.player.dispose();
});

test('manifest rejects stale versions, wrong order, untrusted URLs and fabricated timing', () => {
  assert.equal(validateReadingAudio(manifest, article), manifest);
  for (const change of [
    { version: 2 }, { articleId: 'other' }, { totalSeconds: 9 },
    { segments: [...manifest.segments].reverse() },
    { segments: [{ ...manifest.segments[0], url: 'https://example.com/audio.mp3' }, manifest.segments[1]] },
    { segments: [{ ...manifest.segments[0], durationSec: 0 }, manifest.segments[1]] },
  ]) assert.throws(() => validateReadingAudio({ ...manifest, ...change }, article));
  assert.deepEqual(audioPosition(manifest, 3), { index: 1, seconds: 0 });
  assert.deepEqual(audioPosition(manifest, 100), { index: 1, seconds: 4 });
  assert.deepEqual(audioPosition(manifest, -2), { index: 0, seconds: 0 });
});

test('guest text keeps punctuation and Unicode without inventing translations, HTML, audio or quiz', () => {
  const value = guestReading('<img src=x onerror=alert(1)>。\n日本！次？𠮷', 'guest-id');
  assert.equal(value.paragraphs[0].sentences[0].japanese, '<img src=x onerror=alert(1)>。');
  assert.equal(value.paragraphs[1].sentences.at(-1).japanese, '𠮷');
  assert.equal(value.audio, null); assert.deepEqual(value.quizList, []); assert.deepEqual(value.vocabList, []);
  assert.equal(value.paragraphs[0].sentences[0].translation, undefined);
  assert.equal(readingLength('𠮷'), 1);
  assert.doesNotThrow(() => guestReading('𠮷'.repeat(3000), 'guest-id'));
  assert.throws(() => guestReading('𠮷'.repeat(3001), 'guest-id'));
});

test('legacy guest records preserve source/ID while excluding placeholder analysis and never parse HTML', () => {
  const legacy = { id: 'user-123', title: 'Old title', createdAt: '2026-01-01',
    paragraphs: [{ sentences: [{ japanese: '日本。', furiganaHtml: '<script>evil()</script>', translation: 'Fake' }] }],
    quizList: [{ correctIndex: 0 }], vocabList: [{ word: 'Fake' }], durationText: '3:43' };
  const [value] = readGuestReadings(JSON.stringify([legacy]));
  assert.equal(value.id, 'user-123'); assert.equal(value.title, 'Old title'); assert.equal(value.text, '日本。');
  assert.deepEqual(value.quizList, []); assert.equal(value.audio, null); assert.equal(value.paragraphs[0].sentences[0].ruby, undefined);
  assert.deepEqual(readGuestReadings('{broken'), []);
});
