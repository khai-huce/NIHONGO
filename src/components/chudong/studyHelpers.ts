// Sound effects using Web Audio API
export const playCorrectSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
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
  } catch {}
};

export const playWrongSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
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
  } catch {}
};

// Romaji to Hiragana conversion mapping
const ROMAJI_MAP: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ',
  ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  wa: 'わ', wo: 'を', n: 'ん', nn: 'ん',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ'
};

/**
 * Converts a romaji string to hiragana
 */
export const romajiToHiragana = (input: string): string => {
  let text = input.toLowerCase();
  let result = '';
  let i = 0;

  while (i < text.length) {
    // Check for double consonants (small tsu っ)
    if (i + 1 < text.length && text[i] === text[i + 1] && /[bcdfghjklmpqrstvwxyz]/.test(text[i]) && text[i] !== 'n') {
      result += 'っ';
      i++;
      continue;
    }

    // Check 3-letter combos (kya, sha, etc.)
    if (i + 3 <= text.length) {
      const sub3 = text.slice(i, i + 3);
      if (ROMAJI_MAP[sub3]) {
        result += ROMAJI_MAP[sub3];
        i += 3;
        continue;
      }
    }

    // Check 2-letter combos (ka, ki, etc.)
    if (i + 2 <= text.length) {
      const sub2 = text.slice(i, i + 2);
      if (ROMAJI_MAP[sub2]) {
        result += ROMAJI_MAP[sub2];
        i += 2;
        continue;
      }
    }

    // Check 1-letter vowels
    const sub1 = text[i];
    if (ROMAJI_MAP[sub1]) {
      result += ROMAJI_MAP[sub1];
      i += 1;
      continue;
    }

    // Keep other characters as-is
    result += sub1;
    i++;
  }

  return result;
};

/**
 * Normalizes strings for comparison:
 * Removes spaces, punctuation, lowercases
 */
export const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics for flexible matching if needed
    .replace(/[\s\-_.,/()[\]]/g, '')
    .trim();
};

/**
 * Normalizes Vietnamese string (keeps accents, lowers case, trims spaces)
 */
export const normalizeVietnamese = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};
