import type { JlptLevel, JlptResourceKind, JlptResourceView, JlptRoadmapSummary } from '@nihongo/shared/contracts/jlpt';

export const JLPT_LEVEL_PRESENTATION: { id: JlptLevel; name: string; kanjiBadge: string; badgeBg: string }[] = [
  { id: 'N5', name: 'Sơ cấp', kanjiBadge: '初級', badgeBg: 'bg-[#16a34a]' },
  { id: 'N4', name: 'Sơ trung cấp', kanjiBadge: '初中級', badgeBg: 'bg-[#0284c7]' },
  { id: 'N3', name: 'Trung cấp', kanjiBadge: '中級', badgeBg: 'bg-[#9333ea]' },
  { id: 'N2', name: 'Trung cao cấp', kanjiBadge: '中上級', badgeBg: 'bg-[#e11d48]' },
  { id: 'N1', name: 'Cao cấp', kanjiBadge: '上級', badgeBg: 'bg-[#dc2626]' },
];

export const JLPT_RESOURCE_LABELS: Record<JlptResourceKind, string> = {
  kanji: 'Kanji', vocabulary: 'Từ vựng', grammar: 'Ngữ pháp',
  reading: 'Đọc hiểu', shadowing: 'Nghe hiểu', kana: 'Bảng chữ',
};

export function parseJlptLevel(value: string | null): JlptLevel | null {
  return JLPT_LEVEL_PRESENTATION.find(item => item.id === value)?.id ?? null;
}

export function jlptLevelQuery(current: URLSearchParams, level: JlptLevel | null): URLSearchParams {
  const next = new URLSearchParams(current);
  next.delete('session');
  next.delete('attempt');
  next.delete('view');
  if (level) next.set('level', level);
  else next.delete('level');
  return next;
}

export function jlptPercent(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
}

export function parseJlptId(value: string | null): string | null {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null;
}

export function roadmapForLevel(items: JlptRoadmapSummary[], level: JlptLevel) {
  return items.find(item => item.level === level) ?? null;
}

export function formatJlptMinutes(minutes: number): string {
  if (!Number.isSafeInteger(minutes) || minutes <= 0) return 'Chưa có thời lượng';
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours ? `${hours} giờ${rest ? ` ${rest} phút` : ''}` : `${rest} phút`;
}

/** Targets are built by the API. Never turn an unavailable target into a fallback lesson. */
export function jlptResourceHref(resource: Pick<JlptResourceView, 'available' | 'href'>): string | null {
  return resource.available && resource.href?.startsWith('/') && !resource.href.startsWith('//') ? resource.href : null;
}

export function sourceWebUrl(value: string): string | null {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
