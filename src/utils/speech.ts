export type SpeechOptions = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
};

type SpeechRequest = {
  synthesis: SpeechSynthesis;
  utterance: SpeechSynthesisUtterance | null;
  timer: ReturnType<typeof setTimeout> | null;
  voicesChanged: (() => void) | null;
};

const INITIAL_RATE = 0.9;
const VOICE_WAIT_MS = 1000;
let defaultRate = INITIAL_RATE;
let activeRequest: SpeechRequest | null = null;
const errorListeners = new Set<(message: string) => void>();

function validRate(rate: number): boolean {
  return Number.isFinite(rate) && rate >= 0.1 && rate <= 10;
}

export function setDefaultSpeechRate(rate: number): void {
  defaultRate = validRate(rate) ? rate : INITIAL_RATE;
}

export function subscribeSpeechErrors(listener: (message: string) => void): () => void {
  errorListeners.add(listener);
  return () => { errorListeners.delete(listener); };
}

function clearVoiceWait(request: SpeechRequest): void {
  if (request.timer !== null) clearTimeout(request.timer);
  request.timer = null;
  if (request.voicesChanged) {
    request.synthesis.removeEventListener('voiceschanged', request.voicesChanged);
    request.voicesChanged = null;
  }
}

function release(request: SpeechRequest): void {
  clearVoiceWait(request);
  if (request.utterance) {
    request.utterance.onstart = null;
    request.utterance.onend = null;
    request.utterance.onerror = null;
  }
  if (activeRequest === request) activeRequest = null;
}

function cancelRequest(request: SpeechRequest): void {
  // An old component's cleanup must not stop a newer component's speech.
  if (activeRequest !== request) return;
  release(request);
  request.synthesis.cancel();
}

export function cancelJapaneseSpeech(): void {
  if (activeRequest) cancelRequest(activeRequest);
  else if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
}

function reportError(message: string, options: SpeechOptions): void {
  for (const listener of errorListeners) listener(message);
  options.onError?.(message);
}

/** Returns a cleanup function that cancels only this request, including voice loading. */
export function speakJapanese(text: string, rate?: number, options: SpeechOptions = {}): () => void {
  const content = text.trim();
  if (!content) return () => {};

  cancelJapaneseSpeech();
  if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
    reportError('Trình duyệt này chưa hỗ trợ phát âm.', options);
    return () => {};
  }

  const request: SpeechRequest = {
    synthesis: window.speechSynthesis,
    utterance: null,
    timer: null,
    voicesChanged: null,
  };
  activeRequest = request;
  const speechRate = rate !== undefined && validRate(rate) ? rate : defaultRate;

  const fail = (message: string) => {
    if (activeRequest !== request) return;
    release(request);
    reportError(message, options);
  };

  const trySpeak = (waitForVoices: boolean) => {
    if (activeRequest !== request || request.utterance) return;
    try {
      const voices = request.synthesis.getVoices();
      const japaneseVoices = voices.filter(voice => /^ja(?:[-_]|$)/i.test(voice.lang));
      const voice = japaneseVoices.find(candidate => candidate.default) ?? japaneseVoices[0];
      if (!voice) {
        if (waitForVoices && voices.length === 0) return;
        fail('Thiết bị chưa có giọng đọc tiếng Nhật. Hãy cài giọng tiếng Nhật rồi thử lại.');
        return;
      }

      clearVoiceWait(request);
      const utterance = new SpeechSynthesisUtterance(content);
      request.utterance = utterance;
      utterance.lang = 'ja-JP';
      utterance.voice = voice;
      utterance.rate = speechRate;
      utterance.onstart = () => {
        if (activeRequest === request) options.onStart?.();
      };
      utterance.onend = () => {
        if (activeRequest !== request) return;
        release(request);
        options.onEnd?.();
      };
      utterance.onerror = event => {
        if (activeRequest !== request) return;
        fail(event.error === 'not-allowed'
          ? 'Trình duyệt chưa cho phép phát âm. Hãy bấm nút phát âm để thử lại.'
          : 'Không thể phát âm lúc này. Vui lòng thử lại.');
      };
      request.synthesis.speak(utterance);
    } catch {
      fail('Không thể phát âm lúc này. Vui lòng thử lại.');
    }
  };

  // Some browsers populate voices asynchronously on their first speech request.
  request.voicesChanged = () => { trySpeak(true); };
  request.synthesis.addEventListener('voiceschanged', request.voicesChanged);
  request.timer = setTimeout(() => { trySpeak(false); }, VOICE_WAIT_MS);
  trySpeak(true);

  return () => { cancelRequest(request); };
}
