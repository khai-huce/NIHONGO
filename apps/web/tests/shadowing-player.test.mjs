import test from 'node:test';
import assert from 'node:assert/strict';
import { YouTubePlayer, loadYouTubeApi, cueAtTime, crossedCueEnd } from '../src/features/shadowing/player/youtube-player.ts';

class Timers {
  id = 0; intervals = new Map(); timeouts = new Map();
  setInterval = callback => { const id = ++this.id; this.intervals.set(id, callback); return id; };
  clearInterval = id => this.intervals.delete(id);
  setTimeout = callback => { const id = ++this.id; this.timeouts.set(id, callback); return id; };
  clearTimeout = id => this.timeouts.delete(id);
  tick() { for (const callback of [...this.intervals.values()]) callback(); }
  expire() { const callbacks = [...this.timeouts.values()]; this.timeouts.clear(); for (const callback of callbacks) callback(); }
}
class Element extends EventTarget {
  style = {}; children = []; parent = null; src = '';
  constructor(document) { super(); this.ownerDocument = document; }
  append(child) { this.children.push(child); child.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(item => item !== this); this.parent = null; }
}
function browser() {
  const timers = new Timers();
  const document = new EventTarget();
  document.visibilityState = 'visible';
  document.createElement = () => new Element(document);
  document.head = new Element(document);
  document.querySelector = () => document.head.children.find(item => item.src === 'https://www.youtube.com/iframe_api') ?? null;
  const scope = { document, location: { origin: 'http://localhost:3000' }, ...timers };
  document.defaultView = scope;
  const host = new Element(document);
  return { timers, document, scope, host };
}
function fakeApi() {
  const instances = [];
  class Media {
    currentTime = 0; duration = 60; rate = 1; rates = [0.5, 1, 1.5, 2]; status = -1;
    playCalls = 0; pauseCalls = 0; destroyCalls = 0; seekCalls = []; requestedRate = 1;
    constructor(element, options) { this.element = element; this.events = options.events; instances.push(this); }
    ready() { this.events.onReady({ target: this }); }
    state(status) { this.status = status; this.events.onStateChange({ target: this, data: status }); }
    changeRate(rate) { this.rate = rate; this.events.onPlaybackRateChange({ target: this, data: rate }); }
    error(code) { this.events.onError({ target: this, data: code }); }
    playVideo() { this.playCalls++; }
    pauseVideo() { this.pauseCalls++; }
    seekTo(seconds, ahead) { this.seekCalls.push([seconds, ahead]); }
    setPlaybackRate(rate) { this.requestedRate = rate; }
    getCurrentTime() { return this.currentTime; }
    getDuration() { return this.duration; }
    getPlaybackRate() { return this.rate; }
    getAvailablePlaybackRates() { return this.rates; }
    getPlayerState() { return this.status; }
    destroy() { this.destroyCalls++; }
  }
  return { api: { Player: Media }, instances };
}
async function setup({ videoId = 'abcdefghijk', deferred } = {}) {
  const environment = browser(), sdk = fakeApi(), states = [];
  const player = new YouTubePlayer(environment.host, videoId, state => states.push(state), {
    loadApi: () => deferred ?? Promise.resolve(sdk.api), timers: environment.timers,
  });
  await Promise.resolve(); await Promise.resolve();
  return { ...environment, ...sdk, states, player, get media() { return sdk.instances[0]; }, get state() { return states.at(-1); } };
}

test('SDK loader loads once, preserves the previous callback and can retry a failed load', async () => {
  const { scope, document } = browser();
  let previousCalls = 0;
  const previous = () => { previousCalls++; };
  scope.onYouTubeIframeAPIReady = previous;
  const first = loadYouTubeApi(scope), second = loadYouTubeApi(scope);
  assert.equal(first, second); assert.equal(document.head.children.length, 1);
  scope.YT = fakeApi().api;
  scope.onYouTubeIframeAPIReady();
  assert.equal(await first, scope.YT); assert.equal(previousCalls, 1);
  assert.equal(scope.onYouTubeIframeAPIReady, previous);

  const broken = browser();
  const failure = loadYouTubeApi(broken.scope);
  broken.document.head.children[0].dispatchEvent(new Event('error'));
  await assert.rejects(failure, /Không tải được/);
  assert.equal(broken.document.head.children.length, 0);
  const retry = loadYouTubeApi(broken.scope);
  broken.scope.YT = fakeApi().api;
  broken.scope.onYouTubeIframeAPIReady();
  assert.equal(await retry, broken.scope.YT);
});

test('native iframe retains controls and origin/referrer, and playback state uses measured media only', async () => {
  const s = await setup();
  const iframe = s.host.children[0];
  assert.equal(new URL(iframe.src).searchParams.get('origin'), 'http://localhost:3000');
  assert.equal(new URL(iframe.src).searchParams.get('controls'), '1');
  assert.equal(iframe.referrerPolicy, 'strict-origin-when-cross-origin');
  assert.equal(iframe.style.minHeight, '200px');
  assert.equal(s.player.play(), false);
  s.media.ready();
  assert.equal(s.state.ready, true); assert.equal(s.state.durationMs, 60000);
  s.player.play(); assert.equal(s.media.playCalls, 1); assert.equal(s.state.status, 'unstarted');
  s.media.state(1); s.media.currentTime = 1.237; s.timers.tick();
  assert.equal(s.state.currentTimeMs, 1237); assert.equal(s.state.status, 'playing');
  s.timers.tick(); s.timers.tick(); assert.equal(s.state.currentTimeMs, 1237);
  s.player.pause(); s.media.state(2); assert.equal(s.state.status, 'paused');
  s.player.dispose();
});

test('seeks clamp to the media duration, retain paused intent and never invent a new media position', async () => {
  const s = await setup(); s.media.ready(); s.media.state(2); s.media.currentTime = 2; s.timers.tick();
  s.player.seek(12000);
  assert.deepEqual(s.media.seekCalls.at(-1), [12, true]);
  assert.equal(s.media.playCalls, 0); assert.equal(s.media.pauseCalls, 1);
  assert.equal(s.state.currentTimeMs, 2000);
  s.player.seek(100000, { play: true }); assert.deepEqual(s.media.seekCalls.at(-1), [60, true]);
  assert.equal(s.media.playCalls, 1);
  s.player.seek(-100); assert.deepEqual(s.media.seekCalls.at(-1), [0, true]);
  assert.equal(s.player.seek(NaN), false); s.player.dispose();
});

test('speed reflects the actual rate event and only offers supported rates', async () => {
  const s = await setup(); s.media.rates = [1, 0.5, NaN, 1, 2]; s.media.ready();
  assert.deepEqual(s.state.availablePlaybackRates, [0.5, 1, 2]);
  assert.equal(s.player.setRate(1.25), false);
  assert.equal(s.player.setRate(0.5), true); assert.equal(s.media.requestedRate, 0.5);
  assert.equal(s.state.playbackRate, 1);
  s.media.changeRate(0.5); assert.equal(s.state.playbackRate, 0.5); s.player.dispose();
});

test('hiding the player or browser tab pauses it; showing it does not restart playback', async () => {
  const s = await setup(); s.media.ready(); s.media.state(1);
  s.player.setVisible(false); assert.equal(s.media.pauseCalls, 1); assert.equal(s.player.play(), false);
  s.player.seek(1000, { play: true }); assert.equal(s.media.playCalls, 0);
  s.player.setVisible(true); assert.equal(s.media.playCalls, 0);
  s.document.visibilityState = 'hidden'; s.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(s.media.pauseCalls, 3); assert.equal(s.player.play(), false);
  s.media.state(1); assert.equal(s.media.pauseCalls, 4);
  s.player.dispose();
});

test('blocked autoplay and embedding errors are visible, and disposal ignores late callbacks', async () => {
  const s = await setup(); s.media.ready();
  s.media.events.onAutoplayBlocked({ target: s.media }); assert.equal(s.state.autoplayBlocked, true);
  s.media.state(1); assert.equal(s.state.autoplayBlocked, false);
  s.media.error(101); assert.match(s.state.error, /không cho phép/); assert.equal(s.state.ready, false);
  assert.equal(s.timers.intervals.size, 0); assert.equal(s.player.play(), false);
  s.player.dispose(); const count = s.states.length;
  s.media.events.onReady({ target: s.media }); s.media.error(100); s.media.state(1); s.timers.tick();
  assert.equal(s.states.length, count); assert.equal(s.media.destroyCalls, 1);
  assert.equal(s.host.children.length, 0); assert.equal(s.timers.timeouts.size, 0);
});

test('unmount before the SDK resolves creates no iframe; invalid IDs never create a player', async () => {
  let resolve;
  const deferred = new Promise(done => { resolve = done; });
  const s = await setup({ deferred }); s.player.dispose(); resolve(s.api);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(s.host.children.length, 0); assert.equal(s.instances.length, 0);
  const invalid = await setup({ videoId: 'x" onload="bad' });
  assert.match(invalid.state.error, /không hợp lệ/); assert.equal(invalid.instances.length, 0);
  invalid.player.dispose();
});

test('player initialization timeout is visible and a late ready cannot revive it', async () => {
  const s = await setup(); s.timers.expire();
  assert.match(s.state.error, /chưa sẵn sàng/);
  s.media.ready(); assert.equal(s.state.ready, false); assert.equal(s.timers.intervals.size, 0);
  s.player.dispose();
});

test('duplicate ready and iframe failures cannot leak polling timers or throw from controls', async () => {
  const s = await setup(); s.media.ready(); s.media.ready();
  assert.equal(s.timers.intervals.size, 1);
  s.media.playVideo = () => { throw new Error('iframe gone'); };
  assert.equal(s.player.play(), false); assert.match(s.state.error, /Không phát được/);
  assert.equal(s.timers.intervals.size, 0); s.player.dispose();
  const broken = await setup();
  broken.media.getDuration = () => { throw new Error('unavailable'); };
  broken.media.ready();
  assert.equal(broken.state.status, 'error'); assert.equal(broken.timers.intervals.size, 0);
  broken.player.dispose();
});

test('cue helpers treat gaps and exact boundaries correctly without simulating playback', () => {
  const cues = [{ startMs: 500, endMs: 1500 }, { startMs: 2000, endMs: 3000 }, { startMs: 3000, endMs: 3500 }];
  assert.equal(cueAtTime(cues, 0), -1); assert.equal(cueAtTime(cues, 500), 0);
  assert.equal(cueAtTime(cues, 1499), 0); assert.equal(cueAtTime(cues, 1500), -1);
  assert.equal(cueAtTime(cues, 3000), 2); assert.equal(cueAtTime(cues, 3500), -1);
  assert.equal(cueAtTime(cues, NaN), -1); assert.equal(cueAtTime([], 500), -1);
  assert.equal(crossedCueEnd(cues, 1450, 1520), 0);
  assert.equal(crossedCueEnd(cues, 1520, 1900), -1);
  assert.equal(crossedCueEnd(cues, 2900, 3000), 1);
  assert.equal(crossedCueEnd(cues, 3000, 1000), -1);
  assert.equal(crossedCueEnd(cues, 0, 3600), 0);
});
