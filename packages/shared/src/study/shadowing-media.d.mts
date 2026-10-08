export const SHADOWING_MAX_DURATION_MS: number;
export const SHADOWING_MAX_CUES: number;
export type ShadowingCue = { id: string; startMs: number; endMs: number; text: string };
export type SubtitleFormat = 'srt' | 'vtt';
export class ShadowingMediaError extends Error {
  code: string;
  /** One-based source line, when the error comes from an imported file. */
  line?: number;
  constructor(code: string, message: string, line?: number);
}
/** HTTP/HTTPS links from exact supported YouTube hosts only; strips unrelated query/hash data. */
export function parseYouTubeUrl(input: string): { videoId: string; url: string };
/** SRT HH:MM:SS,mmm or VTT [HH:]MM:SS.mmm, bounded to 30 minutes. */
export function parseSubtitleTimestamp(input: string, format?: SubtitleFormat): number;
/** At most 500 ordered, nonoverlapping, plain-text cues. No markup, guessed timing, or translation. */
export function validateShadowingCues(cues: readonly ShadowingCue[]): ShadowingCue[];
/**
 * Plain text SRT/WebVTT import; preserve inner whitespace/newlines, normalize NFC and trim outer text.
 * Supports optional VTT cue identifiers and NOTE blocks. Rejects HTML/ruby/inline timestamps,
 * cue layout settings, STYLE/REGION, and extended header metadata with actionable errors.
 * Input is bounded to 1 MiB UTF-8 and each cue to 300 Unicode characters.
 * IDs must be unique. Explicit IDs are preserved; VTT anonymous IDs use cue-<ordinal>.
 * endMs is the last transcript endpoint, NOT the duration of the video.
 */
export function parseShadowingSubtitles(input: string, format?: SubtitleFormat | 'auto'): {
  format: SubtitleFormat; cues: ShadowingCue[]; endMs: number;
};
