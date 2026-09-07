import { PitchAccentItem } from '../types';

export const PITCH_ACCENT_DATABASE: PitchAccentItem[] = [
  {
    id: 'p-1',
    word: '雨',
    reading: 'あめ (ame)',
    pitchType: 'Atamadaka',
    pitchNumber: 1,
    meaning: 'Cơn mưa',
    pattern: ['H', 'L']
  },
  {
    id: 'p-2',
    word: '飴',
    reading: 'あめ (ame)',
    pitchType: 'Heiban',
    pitchNumber: 0,
    meaning: 'Kẹo ngọt',
    pattern: ['L', 'H']
  },
  {
    id: 'p-3',
    word: '箸',
    reading: 'はし (hashi)',
    pitchType: 'Atamadaka',
    pitchNumber: 1,
    meaning: 'Đôi đũa',
    pattern: ['H', 'L']
  },
  {
    id: 'p-4',
    word: '橋',
    reading: 'はし (hashi)',
    pitchType: 'Odaka',
    pitchNumber: 2,
    meaning: 'Cây cầu',
    pattern: ['L', 'H']
  },
  {
    id: 'p-5',
    word: '端',
    reading: 'はし (hashi)',
    pitchType: 'Heiban',
    pitchNumber: 0,
    meaning: 'Bờ, mép, góc rìa',
    pattern: ['L', 'H']
  },
  {
    id: 'p-6',
    word: '桜',
    reading: 'さくら (sakura)',
    pitchType: 'Heiban',
    pitchNumber: 0,
    meaning: 'Hoa anh đào',
    pattern: ['L', 'H', 'H']
  },
  {
    id: 'p-7',
    word: '日本語',
    reading: 'にほんご (nihongo)',
    pitchType: 'Heiban',
    pitchNumber: 0,
    meaning: 'Tiếng Nhật',
    pattern: ['L', 'H', 'H', 'H']
  },
  {
    id: 'p-8',
    word: '先生',
    reading: 'せんせい (sensei)',
    pitchType: 'Nakadaka',
    pitchNumber: 3,
    meaning: 'Thầy cô giáo',
    pattern: ['L', 'H', 'H', 'L']
  }
];
