import React from 'react';
import { X, Type, Volume2, Eye } from 'lucide-react';
import { UserSettings } from '../types';
import { JAPANESE_FONTS } from '../utils/learning-settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6"
        role="dialog"
        aria-modal="true"
        aria-label="Cài đặt giao diện & học tập"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            ⚙️ Cài đặt giao diện & học tập
          </h3>
          <button
            aria-label="Đóng cài đặt"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Font Picker */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Type className="w-4 h-4 text-blue-500" />
            Font chữ tiếng Nhật hiển thị
          </label>
          <div className="grid grid-cols-2 gap-2">
            {JAPANESE_FONTS.map((f) => (
              <button
                key={f.id}
                aria-pressed={settings.fontFamily === f.id}
                onClick={() => setSettings(prev => ({ ...prev, fontFamily: f.id }))}
                className={`p-3 rounded-xl text-xs font-semibold border text-left transition-all ${
                  settings.fontFamily === f.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Furigana Display */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-emerald-500" />
            Chế độ hiển thị Furigana
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
            {[
              { id: 'always', label: 'Luôn hiện' },
              { id: 'hover', label: 'Rê chuột hiện' },
              { id: 'never', label: 'Ẩn Furigana' }
            ].map((opt) => (
              <button
                key={opt.id}
                aria-pressed={settings.showFurigana === opt.id}
                onClick={() => setSettings(prev => ({ ...prev, showFurigana: opt.id as UserSettings['showFurigana'] }))}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  settings.showFurigana === opt.id
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Speech Speed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-amber-500" />
              Tốc độ phát âm giọng đọc ({settings.audioSpeed}x)
            </label>
          </div>
          <input
            aria-label="Tốc độ phát âm giọng đọc"
            type="range"
            min="0.6"
            max="1.3"
            step="0.1"
            value={settings.audioSpeed}
            onChange={(e) => setSettings(prev => ({ ...prev, audioSpeed: Number(e.target.value) }))}
            className="w-full accent-blue-600"
          />
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all"
        >
          Lưu cài đặt
        </button>

      </div>
    </div>
  );
};
