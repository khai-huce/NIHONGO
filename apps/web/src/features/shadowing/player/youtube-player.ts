export interface YouTubePlayerState {
  ready: boolean;
  status: 'loading' | 'unstarted' | 'cued' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number;
  availablePlaybackRates: number[];
  autoplayBlocked: boolean;
  error: string;
}

export interface YouTubeMedia {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlaybackRate(): number;
  getAvailablePlaybackRates(): number[];
  getPlayerState(): number;
  destroy(): void;
}

interface PlayerEvent { target: YouTubeMedia; data?: number }
export interface YouTubeNamespace {
  Player: new (element: HTMLIFrameElement, options: {
    events: {
      onReady(event: PlayerEvent): void;
      onStateChange(event: PlayerEvent): void;
      onPlaybackRateChange(event: PlayerEvent): void;
      onError(event: PlayerEvent): void;
      onAutoplayBlocked(event: PlayerEvent): void;
    };
  }) => YouTubeMedia;
}

type YouTubeWindow = Window & {
  YT?: YouTubeNamespace;
  onYouTubeIframeAPIReady?: () => void;
};

const sdkLoads = new WeakMap<Window, Promise<YouTubeNamespace>>();

/** One SDK load per window; the page can retry after a failed load. */
export function loadYouTubeApi(scope: Window = window): Promise<YouTubeNamespace> {
  const owner = scope as YouTubeWindow;
  if (owner.YT?.Player) return Promise.resolve(owner.YT);
  const current = sdkLoads.get(scope);
  if (current) return current;

  const promise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previous = owner.onYouTubeIframeAPIReady;
    const existing = owner.document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    const script = existing ?? owner.document.createElement('script');
    let finished = false;
    const cleanup = () => {
      owner.clearTimeout(timeout);
      script.removeEventListener('error', failed);
      if (owner.onYouTubeIframeAPIReady === ready) owner.onYouTubeIframeAPIReady = previous;
    };
    const failed = () => {
      if (finished) return;
      finished = true;
      cleanup();
      if (!existing) script.remove();
      reject(new Error('Không tải được trình phát YouTube. Hãy kiểm tra mạng rồi thử lại.'));
    };
    const ready = () => {
      try { previous?.call(owner); } finally {
        if (!finished) {
          if (!owner.YT?.Player) { failed(); return; }
          finished = true;
          cleanup();
          resolve(owner.YT);
        }
      }
    };
    const timeout = owner.setTimeout(failed, 15_000);
    owner.onYouTubeIframeAPIReady = ready;
    script.addEventListener('error', failed, { once: true });
    if (!existing) {
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      owner.document.head.append(script);
    }
  });
  sdkLoads.set(scope, promise);
  void promise.catch(() => {
    if (sdkLoads.get(scope) === promise) sdkLoads.delete(scope);
  });
  return promise;
}

export function youtubeErrorMessage(code?: number): string {
  switch (code) {
    case 2: return 'Liên kết video YouTube không hợp lệ.';
    case 100: return 'Video không còn tồn tại hoặc đã chuyển sang riêng tư.';
    case 101:
    case 150: return 'Chủ video không cho phép phát trên website khác. Bạn có thể mở video trên YouTube.';
    case 153: return 'YouTube không nhận được thông tin website. Hãy mở trang bằng trình duyệt hoặc kiểm tra thiết lập quyền riêng tư.';
    default: return 'Không phát được video YouTube. Hãy kiểm tra mạng rồi thử lại.';
  }
}

const statuses: Record<number, YouTubePlayerState['status']> = {
  [-1]: 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued',
};
const initialState = (): YouTubePlayerState => ({
  ready: false, status: 'loading', currentTimeMs: 0, durationMs: 0,
  playbackRate: 1, availablePlaybackRates: [1], autoplayBlocked: false, error: '',
});
const milliseconds = (seconds: number) => Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : 0;

export interface YouTubePlayerOptions {
  loadApi?: () => Promise<YouTubeNamespace>;
  timers?: Pick<Window, 'setInterval' | 'clearInterval' | 'setTimeout' | 'clearTimeout'>;
}

/** Owns one iframe. All displayed timing comes from the actual YouTube player. */
export class YouTubePlayer {
  private media: YouTubeMedia | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private value = initialState();
  private disposed = false;
  private visible = true;
  private poll: number | null = null;
  private timeout: number | null = null;
  private readonly host: HTMLElement;
  private readonly onState: (state: YouTubePlayerState) => void;
  private readonly timers: NonNullable<YouTubePlayerOptions['timers']>;

  constructor(host: HTMLElement, videoId: string, onState: (state: YouTubePlayerState) => void, options: YouTubePlayerOptions = {}) {
    this.host = host;
    this.onState = onState;
    const scope = host.ownerDocument.defaultView;
    if (!scope) throw new Error('Không tìm thấy cửa sổ trình duyệt.');
    this.timers = options.timers ?? scope;
    host.ownerDocument.addEventListener('visibilitychange', this.onVisibility);
    this.emit();
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) { this.fail(youtubeErrorMessage(2)); return; }
    void (options.loadApi ?? (() => loadYouTubeApi(scope)))().then(api => {
      if (this.disposed) return;
      const iframe = host.ownerDocument.createElement('iframe');
      const query = new URLSearchParams({ enablejsapi: '1', origin: scope.location.origin, playsinline: '1', controls: '1' });
      iframe.src = `https://www.youtube.com/embed/${videoId}?${query}`;
      iframe.title = 'Video YouTube luyện nghe';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.minWidth = '200px';
      iframe.style.minHeight = '200px';
      iframe.style.border = '0';
      this.iframe = iframe;
      host.append(iframe);
      this.timeout = this.timers.setTimeout(() => this.fail('Trình phát YouTube chưa sẵn sàng. Hãy kiểm tra mạng rồi thử lại.'), 20_000);
      this.media = new api.Player(iframe, { events: {
        onReady: event => {
          if (this.disposed || this.value.ready || this.value.status === 'error') return;
          this.media = event.target;
          if (this.timeout !== null) this.timers.clearTimeout(this.timeout);
          this.timeout = null;
          this.value.ready = true;
          this.sample();
          if (!this.value.ready || this.disposed) return;
          this.poll = this.timers.setInterval(() => this.sample(), 100);
          if (!this.visible || host.ownerDocument.visibilityState === 'hidden') this.pause();
        },
        onStateChange: event => {
          if (this.disposed || !this.value.ready) return;
          if (event.data === 1) this.value.autoplayBlocked = false;
          this.sample();
          if (event.data === 1 && (!this.visible || host.ownerDocument.visibilityState === 'hidden')) this.pause();
        },
        onPlaybackRateChange: () => this.sample(),
        onError: event => this.fail(youtubeErrorMessage(event.data)),
        onAutoplayBlocked: () => {
          if (this.disposed) return;
          this.value.autoplayBlocked = true;
          this.emit();
        },
      } });
    }).catch(error => {
      this.fail(error instanceof Error ? error.message : youtubeErrorMessage());
    });
  }

  get state(): YouTubePlayerState { return { ...this.value, availablePlaybackRates: [...this.value.availablePlaybackRates] }; }

  private emit() { if (!this.disposed) this.onState(this.state); }

  private fail(message: string) {
    if (this.disposed) return;
    this.clearTimers();
    this.value = { ...this.value, ready: false, status: 'error', error: message };
    try { this.media?.pauseVideo(); } catch { /* The iframe may have failed before becoming ready. */ }
    this.emit();
  }

  private sample() {
    if (this.disposed || !this.media || !this.value.ready) return;
    try {
      const rates = this.media.getAvailablePlaybackRates().filter(rate => Number.isFinite(rate) && rate > 0);
      const next: YouTubePlayerState = {
        ...this.value,
        status: statuses[this.media.getPlayerState()] ?? 'unstarted',
        currentTimeMs: milliseconds(this.media.getCurrentTime()),
        durationMs: milliseconds(this.media.getDuration()),
        playbackRate: this.media.getPlaybackRate() || 1,
        availablePlaybackRates: [...new Set([1, ...rates])].sort((a, b) => a - b),
      };
      if (JSON.stringify(next) !== JSON.stringify(this.value)) { this.value = next; this.emit(); }
      // The initial onReady must be observable even if the video remains unstarted.
      else if (this.poll === null) this.emit();
    } catch { this.fail(youtubeErrorMessage()); }
  }

  play(): boolean {
    if (!this.usable() || !this.visible || this.host.ownerDocument.visibilityState === 'hidden') return false;
    return this.command(() => this.media!.playVideo());
  }

  pause(): boolean {
    if (!this.usable()) return false;
    return this.command(() => { this.media!.pauseVideo(); this.sample(); });
  }

  seek(timeMs: number, options: { play?: boolean } = {}): boolean {
    if (!this.usable() || !Number.isFinite(timeMs)) return false;
    const shouldPlay = options.play ?? ['playing', 'buffering'].includes(this.value.status);
    const end = this.value.durationMs > 0 ? this.value.durationMs : Infinity;
    return this.command(() => {
      this.media!.seekTo(Math.max(0, Math.min(timeMs, end)) / 1000, true);
      if (shouldPlay && this.visible && this.host.ownerDocument.visibilityState !== 'hidden') this.media!.playVideo();
      else this.media!.pauseVideo();
      this.sample();
    });
  }

  setRate(rate: number): boolean {
    if (!this.usable() || !this.value.availablePlaybackRates.includes(rate)) return false;
    return this.command(() => { this.media!.setPlaybackRate(rate); this.sample(); });
  }

  /** Call before hiding the player. Showing it never starts playback automatically. */
  setVisible(visible: boolean) {
    this.visible = visible;
    if (!visible) this.pause();
  }

  private usable() { return !this.disposed && this.value.ready && this.media !== null; }
  private command(action: () => void): boolean {
    try { action(); return this.value.ready; }
    catch { this.fail(youtubeErrorMessage()); return false; }
  }
  private onVisibility = () => { if (this.host.ownerDocument.visibilityState === 'hidden') this.pause(); };
  private clearTimers() {
    if (this.poll !== null) this.timers.clearInterval(this.poll);
    if (this.timeout !== null) this.timers.clearTimeout(this.timeout);
    this.poll = null;
    this.timeout = null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearTimers();
    this.host.ownerDocument.removeEventListener('visibilitychange', this.onVisibility);
    try { this.media?.destroy(); } catch { /* Already removed by navigation. */ }
    this.media = null;
    this.iframe?.remove();
    this.iframe = null;
  }
}

export interface TimedCue { startMs: number; endMs: number }

/** Sorted, non-overlapping cues; gaps and the exact end of a cue have no active cue. */
export function cueAtTime(cues: readonly TimedCue[], timeMs: number): number {
  if (!Number.isFinite(timeMs) || timeMs < 0) return -1;
  let low = 0, high = cues.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const cue = cues[middle];
    if (timeMs < cue.startMs) high = middle - 1;
    else if (timeMs >= cue.endMs) low = middle + 1;
    else return middle;
  }
  return -1;
}

/** For continuous playback only. Reset the previous position after explicit seeks. */
export function crossedCueEnd(cues: readonly TimedCue[], previousMs: number, currentMs: number): number {
  if (!Number.isFinite(previousMs) || !Number.isFinite(currentMs) || currentMs <= previousMs) return -1;
  return cues.findIndex(cue => previousMs < cue.endMs && currentMs >= cue.endMs);
}
