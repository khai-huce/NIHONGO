import type { ReadingEvidence, ReadingSupplementCatalog } from '@nihongo/shared/contracts/reading-supplements';

export type ReadingSentence = { id: string; japanese: string; ruby?: { text: string; reading?: string }[]; translation?: string };
export type ReadingAudio = {
  id: string; articleId: string; version: number; voice: string; totalSeconds: number;
  segments: { sentenceId: string; url: string; durationSec: number; offsetSec: number }[];
};
export type ReadingArticle = {
  id: string; title: string; subtitle: string; text: string; version: number;
  visibility: 'private' | 'public'; createdAt: string; audio: ReadingAudio | null;
  paragraphs: { id: string; sentences: ReadingSentence[] }[];
  vocabList: { word: string; reading: string; hanViet: string; meaning: string; aiEvidence?: ReadingEvidence[] }[];
  grammarList: { pattern: string; jlptLevel: string; meaning: string; exampleJp: string; exampleVi: string; aiEvidence?: ReadingEvidence[] }[];
  quizList: { id: number; question: string; options: string[]; correctIndex: number; explanation: string; aiEvidence?: ReadingEvidence[] }[];
  supplementCatalog?: ReadingSupplementCatalog;
};
export const READING_LIMIT = 3000;
export const GUEST_READINGS_KEY = 'nhai_kanji_user_reading_articles';
export const readingLength = (text: string) => Array.from(text).length;
export const formatReadingTime = (seconds: number) => Number.isFinite(seconds) && seconds >= 0
  ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '--:--';

export function guestReading(text: string, id: string, createdAt = new Date().toISOString()): ReadingArticle {
  const clean = text.trim();
  if (!clean || readingLength(clean) > READING_LIMIT) throw new Error('Bài đọc cần từ 1 đến 3000 ký tự.');
  return {
    id, title: Array.from(clean.split('\n')[0]).slice(0, 32).join(''), subtitle: '', text: clean,
    version: 1, visibility: 'private', createdAt, audio: null,
    paragraphs: clean.split(/\n+/u).filter(Boolean).map((paragraph, p) => ({ id: `p${p + 1}`,
      sentences: (paragraph.match(/[^。！？!?]+[。！？!?]*|[。！？!?]+/gu) ?? [paragraph]).map((japanese, s) => ({
        id: `p${p + 1}-s${s + 1}`, japanese,
      })),
    })), vocabList: [], grammarList: [], quizList: [],
  };
}

// Legacy guest articles contained generated placeholder analysis. Preserve their
// source text and ID, but never present those placeholders as verified content.
export function readGuestReadings(raw: string | null): ReadingArticle[] {
  try {
    const data: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(data)) return [];
    return data.flatMap(value => {
      if (!value || typeof value !== 'object' || typeof value.id !== 'string') return [];
      const text = typeof value.text === 'string' ? value.text : Array.isArray(value.paragraphs)
        ? value.paragraphs.map((p: { sentences?: { japanese?: unknown }[] }) => Array.isArray(p?.sentences)
          ? p.sentences.map(s => typeof s?.japanese === 'string' ? s.japanese : '').join('') : '').join('\n') : '';
      try {
        const article = guestReading(text, value.id, typeof value.createdAt === 'string' ? value.createdAt : '');
        if (typeof value.title === 'string') article.title = value.title;
        return [article];
      } catch { return []; }
    });
  } catch { return []; }
}

export function audioPosition(audio: ReadingAudio, seconds: number) {
  const time = Math.max(0, Math.min(Number.isFinite(seconds) ? seconds : 0, audio.totalSeconds));
  const index = Math.max(0, audio.segments.findIndex((segment, i) =>
    time < segment.offsetSec + segment.durationSec || i === audio.segments.length - 1));
  const segment = audio.segments[index];
  return { index, seconds: segment ? Math.max(0, Math.min(time - segment.offsetSec, segment.durationSec)) : 0 };
}

export function validateReadingAudio(audio: ReadingAudio, article: ReadingArticle): ReadingAudio {
  const sentences = article.paragraphs.flatMap(p => p.sentences);
  if (!audio || audio.articleId !== article.id || audio.version !== article.version
    || !Number.isFinite(audio.totalSeconds) || audio.totalSeconds <= 0 || audio.segments.length !== sentences.length) {
    throw new Error('Audio không khớp phiên bản bài đọc. Vui lòng tải lại bài.');
  }
  let offset = 0;
  for (let i = 0; i < audio.segments.length; i++) {
    const segment = audio.segments[i];
    if (segment.sentenceId !== sentences[i].id || !Number.isFinite(segment.durationSec) || segment.durationSec <= 0
      || !Number.isFinite(segment.offsetSec) || Math.abs(segment.offsetSec - offset) > 0.05
      || !segment.url.startsWith(`/api/reading/articles/${encodeURIComponent(article.id)}/audio/`)
      || segment.url.includes('..') || segment.url.includes('?') || segment.url.includes('#')) {
      throw new Error('Dữ liệu audio không hợp lệ. Vui lòng tải lại bài.');
    }
    offset += segment.durationSec;
  }
  if (Math.abs(offset - audio.totalSeconds) > 0.1) throw new Error('Thời lượng audio không hợp lệ.');
  return audio;
}
