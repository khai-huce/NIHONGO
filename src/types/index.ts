export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface CompoundExample {
  word: string;
  reading: string;
  furigana?: string;
  meaning: string;
  level?: JLPTLevel;
}

export interface RadicalPart {
  radical: string;
  hanViet: string;
  meaning: string;
}

export interface KanjiItem {
  id: string;
  kanji: string;
  hanViet: string;
  meaning: string;
  level: JLPTLevel;
  strokeCount: number;
  radicals: string[]; // e.g. ["亻", "木"]
  radicalParts: RadicalPart[];
  mnemonic: string; // Câu chuyện chiết tự
  onyomi: string[]; // e.g. ["キュウ"]
  kunyomi: string[]; // e.g. ["やす.む", "やす.まる"]
  examples: CompoundExample[];
  strokePaths?: string[]; // SVG paths for animated stroke order
  frequency?: number;
}

export interface RadicalItem {
  number: number;
  radical: string;
  variants?: string[];
  strokes: number;
  hanViet: string;
  meaning: string;
  pinyin?: string;
  examples: string[];
}

export interface GrammarItem {
  id: string;
  pattern: string;
  meaning: string;
  level: JLPTLevel;
  usage: string;
  explanation: string;
  examples: {
    japanese: string;
    furigana?: string;
    vietnamese: string;
  }[];
}

export interface PitchAccentItem {
  id: string;
  word: string;
  reading: string;
  pitchType: 'Heiban' | 'Atamadaka' | 'Nakadaka' | 'Odaka';
  pitchNumber: number; // 0, 1, 2, 3...
  meaning: string;
  pattern: ('H' | 'L')[]; // High/Low per mora
  audioUrl?: string;
}

export interface UserSettings {
  darkMode: boolean;
  fontFamily: string;
  showFurigana: 'always' | 'hover' | 'never';
  audioSpeed: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isPremium?: boolean;
}
