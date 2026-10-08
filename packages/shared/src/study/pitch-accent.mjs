const SMALL_KANA = new Set(['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゎ']);
const KANA = /^[ぁ-ゔ]$/u;

export function normalizePitchReading(input) {
  if (typeof input !== 'string') throw new TypeError('Pitch reading must be a string.');
  return input.normalize('NFKC').trim().replace(/[ァ-ヴ]/gu, character => (
    String.fromCodePoint(character.codePointAt(0) - 0x60)
  ));
}

export function splitMoras(input) {
  const reading = normalizePitchReading(input);
  if (!reading) throw new RangeError('Pitch reading must not be empty.');
  const moras = [];

  for (const character of reading) {
    if (character === 'ー') {
      if (!moras.length) throw new RangeError('A pitch reading cannot begin with a long vowel mark.');
      moras.push(character);
      continue;
    }
    if (!KANA.test(character)) throw new RangeError('Pitch reading must contain kana only.');
    if (SMALL_KANA.has(character)) {
      const previous = moras.at(-1);
      // Contracted sounds occupy one mora. っ, ん and ー always occupy their own.
      if (!previous || previous.length !== 1 || ['っ', 'ん', 'ー'].includes(previous) || SMALL_KANA.has(previous)) {
        throw new RangeError('Small kana must follow a full-size kana in the same mora.');
      }
      moras[moras.length - 1] += character;
    } else {
      moras.push(character);
    }
  }
  return moras;
}

export function getPitchContour(reading, accent) {
  const moras = splitMoras(reading);
  if (!Number.isInteger(accent) || accent < 0 || accent > moras.length) {
    throw new RangeError('Pitch accent must be an integer between zero and the mora count.');
  }

  // Render an attested accent position; this function never predicts an accent.
  return {
    moras: moras.map((text, index) => ({
      text,
      high: accent === 1 ? index === 0 : index > 0 && (accent === 0 || index < accent),
      drop: accent !== 0 && index === accent - 1,
    })),
    particleHigh: accent === 0,
    type: accent === 0 ? 'heiban' : accent === 1 ? 'atamadaka' : accent === moras.length ? 'odaka' : 'nakadaka',
  };
}
