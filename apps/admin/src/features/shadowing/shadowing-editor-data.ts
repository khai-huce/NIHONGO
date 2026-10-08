import type { ShadowingContent, ShadowingDraftInput, ShadowingVideo } from '@nihongo/shared/contracts/shadowing';
import { parseShadowingSubtitles, parseYouTubeUrl, validateShadowingCues } from '@nihongo/shared/study/shadowing-media';

export type ShadowingForm = ShadowingDraftInput & { sourceId: string | null; transcriptReviewed: boolean };
export const shadowingForm = (video?: ShadowingVideo): ShadowingForm => ({
  url: video ? `https://www.youtube.com/watch?v=${video.youtubeId}` : '',
  level: video?.content.level ?? null, description: video?.content.description ?? '',
  sourceId: video?.sourceId ?? null, transcriptReviewed: false,
  sentences: video?.content.sentences.map(({ id, startMs, endMs, text, translationVi }) => ({ id, startMs, endMs, text, translationVi })) ?? [],
});

export function contentToShadowingForm(content: ShadowingContent, sourceId: string | null): ShadowingForm {
  return { url: `https://www.youtube.com/watch?v=${content.youtubeId}`, level: content.level,
    description: content.description, sourceId, transcriptReviewed: false,
    sentences: content.sentences.map(({ id, startMs, endMs, text, translationVi }) => ({ id, startMs, endMs, text, translationVi })) };
}

/** Subtitle import never copies server-owned metadata, permissions, or source attribution. */
export function parseTranscriptImport(text: string, format: 'json' | 'srt' | 'vtt' | 'auto', makeId = () => crypto.randomUUID()): ShadowingDraftInput['sentences'] {
  if (new TextEncoder().encode(text).length > 1024 * 1024) throw new Error('Tệp quá lớn (tối đa 1 MiB).');
  if (format !== 'json') return parseShadowingSubtitles(text, format).cues.map(cue => ({ ...cue, id: makeId(), translationVi: '' }));
  let parsed: unknown;
  try { parsed = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('JSON không hợp lệ.'); }
  const rows: unknown = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && 'sentences' in parsed ? parsed.sentences : null;
  if (!Array.isArray(rows)) throw new Error('JSON cần là danh sách câu hoặc đối tượng có trường sentences.');
  const prepared = rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Câu ${index + 1} không hợp lệ.`);
    const item = row as Record<string, unknown>;
    if (item.translationVi !== undefined && (typeof item.translationVi !== 'string' || Array.from(item.translationVi).length > 2000)) throw new Error(`Bản dịch câu ${index + 1} phải là văn bản, tối đa 2000 ký tự.`);
    return { id: makeId(), startMs: item.startMs as number, endMs: item.endMs as number, text: item.text as string,
      translationVi: typeof item.translationVi === 'string' ? item.translationVi.normalize('NFC').trim() : '' };
  });
  const cues = validateShadowingCues(prepared);
  return cues.map((cue, index) => ({ ...cue, translationVi: prepared[index].translationVi }));
}

export function shadowingBody(form: ShadowingForm) {
  const { url } = parseYouTubeUrl(form.url);
  const cues = form.sentences.length ? validateShadowingCues(form.sentences.map(row => ({ ...row, id: row.id ?? crypto.randomUUID() }))) : [];
  return { ...form, url, description: form.description.trim(), sentences: cues.map((row, index) => ({ ...row, translationVi: form.sentences[index].translationVi?.trim() ?? '' })) };
}

export function formatShadowingTime(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
