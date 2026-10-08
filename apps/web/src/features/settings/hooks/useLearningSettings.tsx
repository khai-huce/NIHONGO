import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import type { UserSettings } from '@nihongo/shared/contracts/core';
import { DEFAULT_SETTINGS, SETTINGS_KEY, japaneseFontFamily, normalizeSettings } from '../lib/learning-settings';
import { setDefaultSpeechRate } from '../../../shared/audio/speech';

export const LearningSettingsContext = createContext<UserSettings>(DEFAULT_SETTINGS);
export const useLearningSettings = () => useContext(LearningSettingsContext);

export function useDeviceSettings() {
  const [settings, setSettings] = useState<UserSettings>(() => {
    try { return normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')); }
    catch { return { ...DEFAULT_SETTINGS }; }
  });
  const [storageError, setStorageError] = useState<string | null>(null);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
    document.documentElement.style.setProperty('--font-japanese', japaneseFontFamily(settings.fontFamily));
    setDefaultSpeechRate(settings.audioSpeed);
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setStorageError(null);
    } catch {
      setStorageError('Trình duyệt không lưu được cài đặt trên thiết bị. Lựa chọn vẫn có hiệu lực trong lần mở này.');
    }
  }, [settings]);

  return { settings, setSettings, storageError };
}
