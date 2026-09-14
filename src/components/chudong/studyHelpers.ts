// Sound effects using Web Audio API
export const playCorrectSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return () => {};
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.35);
    osc.onended = () => { void ctx.close().catch(() => {}); };
    return () => { try { osc.stop(); } catch { /* Already stopped. */ } void ctx.close().catch(() => {}); };
  } catch { return () => {}; }
};

export const playWrongSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return () => {};
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(220, now); // A3
    osc.frequency.setValueAtTime(174.61, now + 0.12); // F3
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.start(now);
    osc.stop(now + 0.28);
    osc.onended = () => { void ctx.close().catch(() => {}); };
    return () => { try { osc.stop(); } catch { /* Already stopped. */ } void ctx.close().catch(() => {}); };
  } catch { return () => {}; }
};

export { romajiToHiragana, normalizeText, normalizeVietnamese } from '../../../shared/vocab-study.mjs';
