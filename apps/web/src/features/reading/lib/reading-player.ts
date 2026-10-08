import { audioPosition, type ReadingAudio } from '@nihongo/client/reading';

export type ReadingPlayerState = { playing: boolean; currentTime: number; sentenceId: string | null; error: string };
/** A single media element owns playback. UI time always comes from media events. */
export class ReadingPlayer {
  private audio: HTMLAudioElement;
  private manifest: ReadingAudio;
  private notify: (state: ReadingPlayerState) => void;
  private index = 0;
  private wantedPlay = false;
  private pendingTime: number | null = null;
  private disposed = false;
  private epoch = 0;
  private loadedIndex = -1;
  private rate = 1;
  private looping = false;
  private state: ReadingPlayerState;
  private events: [string, EventListener][];

  constructor(audio: HTMLAudioElement, manifest: ReadingAudio, notify: (state: ReadingPlayerState) => void) {
    this.audio = audio; this.manifest = manifest; this.notify = notify;
    this.state = { playing: false, currentTime: 0, sentenceId: manifest.segments[0]?.sentenceId ?? null, error: '' };
    this.events = [
      ['timeupdate', () => this.updateTime()], ['seeked', () => this.updateTime()],
      ['loadedmetadata', () => {
        if (this.disposed || this.loadedIndex !== this.index) return;
        if (this.pendingTime !== null) {
          this.audio.currentTime = Math.max(0, Math.min(this.pendingTime, this.audio.duration || this.pendingTime));
          this.pendingTime = null;
        }
        this.audio.playbackRate = this.rate; this.updateTime();
        if (this.wantedPlay) void this.startMedia();
      }],
      ['playing', () => { if (this.wantedPlay) this.emit({ playing: true, error: '' }); }],
      ['pause', () => { this.emit({ playing: false }); }],
      ['ended', () => {
        if (!this.wantedPlay || this.disposed) return;
        if (this.looping) this.select(this.index, 0, true);
        else if (this.index + 1 < this.manifest.segments.length) this.select(this.index + 1, 0, true);
        else { this.wantedPlay = false; this.emit({ playing: false, currentTime: this.manifest.totalSeconds }); }
      }],
      ['error', () => { this.wantedPlay = false; this.emit({ playing: false, error: 'Không tải được audio. Bấm phát để thử lại.' }); }],
    ];
    for (const [event, listener] of this.events) audio.addEventListener(event, listener);
    audio.preload = 'metadata'; this.emit({});
  }
  private emit(patch: Partial<ReadingPlayerState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch }; this.notify(this.state);
  }
  private updateTime() {
    const segment = this.manifest.segments[this.index];
    if (!segment || this.pendingTime !== null || this.disposed) return;
    this.emit({ currentTime: segment.offsetSec + Math.min(Math.max(0, this.audio.currentTime), segment.durationSec), sentenceId: segment.sentenceId });
  }
  private async startMedia() {
    const epoch = this.epoch;
    try {
      await this.audio.play();
      if (this.disposed || !this.wantedPlay) this.audio.pause();
    }
    catch {
      if (!this.disposed && epoch === this.epoch && this.wantedPlay) {
        this.wantedPlay = false;
        this.emit({ playing: false, error: 'Chưa phát được audio. Bấm phát để thử lại.' });
      }
    }
  }
  private select(index: number, seconds: number, play: boolean) {
    if (this.disposed || !this.manifest.segments[index]) return;
    this.epoch++; this.wantedPlay = play; this.audio.pause();
    this.index = index;
    const segment = this.manifest.segments[index];
    this.emit({ sentenceId: segment.sentenceId, currentTime: segment.offsetSec + seconds, playing: false, error: '' });
    if (this.loadedIndex !== index || this.audio.error) {
      this.pendingTime = seconds; this.loadedIndex = index;
      this.audio.src = segment.url; this.audio.load();
    } else if (this.audio.readyState >= 1) {
      this.pendingTime = null; this.audio.currentTime = seconds; this.audio.playbackRate = this.rate;
      if (play) void this.startMedia();
    } else this.pendingTime = seconds;
  }
  play() {
    if (this.disposed) return;
    if (this.state.currentTime >= this.manifest.totalSeconds) this.select(0, 0, true);
    else if (this.loadedIndex !== this.index || this.audio.error) {
      this.select(this.index, this.state.currentTime - this.manifest.segments[this.index].offsetSec, true);
    } else { this.wantedPlay = true; if (this.audio.readyState >= 1) void this.startMedia(); }
  }
  pause() { this.wantedPlay = false; this.epoch++; this.audio.pause(); this.emit({ playing: false }); }
  seek(seconds: number) { const target = audioPosition(this.manifest, seconds); this.select(target.index, target.seconds, this.wantedPlay); }
  sentence(id: string, play = true) { const index = this.manifest.segments.findIndex(segment => segment.sentenceId === id); if (index >= 0) this.select(index, 0, play); }
  previous() { this.select(Math.max(0, this.index - 1), 0, this.wantedPlay); }
  next() {
    if (this.index + 1 < this.manifest.segments.length) this.select(this.index + 1, 0, this.wantedPlay);
    else this.pause();
  }
  setRate(rate: number) { if (Number.isFinite(rate) && rate > 0) { this.rate = rate; this.audio.playbackRate = rate; } }
  setLoop(loop: boolean) { this.looping = loop; }
  dispose() {
    this.disposed = true; this.wantedPlay = false; this.epoch++;
    for (const [event, listener] of this.events) this.audio.removeEventListener(event, listener);
    this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load();
  }
}
