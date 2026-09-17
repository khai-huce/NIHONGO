import type { UserSettings } from '../types/index.ts';

export const SETTINGS_KEY = 'nhai_kanji_settings';
export const DEFAULT_SETTINGS: UserSettings = {
  darkMode: false,
  fontFamily: 'Zen Maru Gothic',
  showFurigana: 'always',
  audioSpeed: 0.9,
};

export const JAPANESE_FONTS = [
  { id: 'Zen Maru Gothic', name: 'Zen Maru Gothic (Tròn, Đẹp)' },
  { id: 'Klee One', name: 'Klee One (Nét viết tay)' },
  { id: 'Noto Sans JP', name: 'Noto Sans JP (Chuẩn)' },
  { id: 'sans-serif', name: 'Mặc định hệ thống' },
] as const;

// Older device settings may be incomplete, or refer to the former UI/font defaults.
export function normalizeSettings(value: unknown): UserSettings {
  const saved = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const font = saved.fontFamily === 'UD Digi Kyokasho' ? 'Klee One' : saved.fontFamily;
  return {
    darkMode: typeof saved.darkMode === 'boolean' ? saved.darkMode : DEFAULT_SETTINGS.darkMode,
    fontFamily: JAPANESE_FONTS.some(item => item.id === font) ? font as string : DEFAULT_SETTINGS.fontFamily,
    showFurigana: saved.showFurigana === 'always' || saved.showFurigana === 'hover' || saved.showFurigana === 'never'
      ? saved.showFurigana : DEFAULT_SETTINGS.showFurigana,
    audioSpeed: typeof saved.audioSpeed === 'number' && Number.isFinite(saved.audioSpeed)
      ? Math.round(Math.max(0.6, Math.min(1.3, saved.audioSpeed)) * 10) / 10 : DEFAULT_SETTINGS.audioSpeed,
  };
}

export function japaneseFontFamily(font: string): string {
  const selected = normalizeSettings({ fontFamily: font }).fontFamily;
  return selected === 'sans-serif'
    ? 'sans-serif'
    : `"${selected}", "Yu Gothic", "Meiryo", sans-serif`;
}
