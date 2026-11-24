import type { ShadowingSentence } from '@nihongo/shared/contracts/shadowing';

// Existing transcripts have cue boundaries. Estimate each word's share from its spoken reading.
export function shadowingTokenAtTime(cue: ShadowingSentence, timeMs: number): number {
  if (timeMs < cue.startMs || timeMs >= cue.endMs) return -1;
  const weights = cue.tokens.map(token => {
    const reading = (token.reading || token.text).normalize('NFKC');
    const sounds = reading.replace(/[\p{P}\p{Z}\sゃゅょャュョぁぃぅぇぉァィゥェォ]/gu, '');
    return Array.from(sounds).length;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const position = total * (timeMs - cue.startMs) / (cue.endMs - cue.startMs);
  let end = 0;
  return weights.findIndex(weight => { end += weight; return position < end; });
}
