import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { tokenizeSentence } from '../src/modules/sentence-analysis/sentence-tokenizer.js';
import { analyzeSentence, matchSentencePatterns } from '../src/modules/sentence-analysis/sentence-catalog.js';

describe('A03 dictionary tokenizer', () => {
  it('analyzes new sentences independently, using dictionary readings and lemmas', async () => {
    const [first, second] = await Promise.all([tokenizeSentence('友達と京都まで行きます。'), tokenizeSentence('コーヒーを飲みませんか。')]);
    expect(first.tokens.map(token => token.text).join('')).toBe(first.sentence);
    expect(second.tokens.map(token => token.text).join('')).toBe(second.sentence);
    expect(first.tokens.find(token => token.text === '京都')).toMatchObject({ reading: 'きょうと', type: 'noun' });
    expect(first.tokens.find(token => token.text === '行き')).toMatchObject({ reading: 'いき', baseForm: '行く', type: 'verb' });
    expect(second.tokens.find(token => token.text === '飲み')).toMatchObject({ reading: 'のみ', baseForm: '飲む', type: 'verb' });
    expect(first.tokens.some(token => token.text === '今夜')).toBe(false);
    expect(second.tokens.some(token => token.text === '京都')).toBe(false);
  });

  it('preserves whitespace, punctuation and surrogate-pair characters with exact source offsets', async () => {
    const sentence = '  猫が\t魚を食べました。\r\n😀 𠮷野家ABCxyz　。犬もいる。';
    const { tokens } = await tokenizeSentence(sentence);
    expect(tokens.map(token => token.text).join('')).toBe(sentence);
    tokens.forEach((token, index) => {
      expect(token.index).toBe(index);
      expect(token.start).toBe(index === 0 ? 0 : tokens[index - 1].end);
      expect(sentence.slice(token.start, token.end)).toBe(token.text);
    });
    expect(tokens.at(-1)?.end).toBe(sentence.length);
    expect(tokens.find(token => token.text === '😀')).toMatchObject({ reading: null });
    expect(tokens.filter(token => /^\s+$/u.test(token.text)).every(token => token.type === 'other' && token.reading === null)).toBe(true);
  });

  it('marks unrecognized content without invented reading, POS or definition', async () => {
    const { tokens } = await tokenizeSentence('qzxv987 𠮷');
    const unknown = tokens.filter(token => !/^\s+$/u.test(token.text));
    expect(unknown.length).toBeGreaterThan(0);
    for (const token of unknown) expect(token).toMatchObject({ type: 'unknown', reading: null, definitions: [], grammaticalTerms: '' });
  });

  it('keeps Kuromoji inflection segmentation and never substitutes a sentence for empty input', async () => {
    const result = await tokenizeSentence('パンを買いました。');
    expect(result.tokens.map(token => token.text)).toEqual(['パン', 'を', '買い', 'まし', 'た', '。']);
    expect(result.tokens[0].reading).toBe('ぱん');
    expect(result.tokens.at(-1)?.reading).toBeNull();
    expect(await tokenizeSentence('')).toEqual({ sentence: '', engine: 'kuromoji-ipadic', tokens: [] });
  });
});

describe('A03 catalog enrichment without a database connection', () => {
  it('requires word and reading together, keeps sources and conservatively matches inflected lemmas', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([
        { word: '京都', reading: 'キョウト', meaning: 'Kyoto', source: 'Nguồn giáo trình' },
        { word: '京都', reading: 'みやこ', meaning: 'Không được chọn nghĩa khác cách đọc', source: 'Nguồn khác' },
        { word: '飲む', reading: 'のむ', meaning: 'uống', source: 'Nguồn giáo trình' },
        { word: '飲む', reading: 'のみ', meaning: 'Không được chọn cách đọc sai', source: 'Nguồn khác' },
      ])
      .mockResolvedValueOnce([{ word: '京都', reading: 'きょうと', meaning: 'thành phố Kyoto', source: 'Ví dụ Kanji' }]);
    const db = { $queryRaw: query, kanjiContent: { findMany: vi.fn().mockResolvedValue([{ published: {
      id: 'k-kyou', kanji: '京', hanViet: 'KINH', meaning: 'kinh đô', level: 'N5', strokeCount: 8,
      radicals: [], radicalParts: [], mnemonic: '', onyomi: ['キョウ'], kunyomi: [], examples: [],
    } }]) } } as unknown as PrismaClient;
    const result = await analyzeSentence(db, '京都で水を飲みます。');
    expect(result.tokens.find(token => token.text === '京都')).toMatchObject({
      hanVietList: [{ kanji: '京', hanViet: 'KINH', meaning: 'kinh đô' }],
      definitions: [{ meaning: 'Kyoto', reading: 'きょうと', source: 'Nguồn giáo trình' }, { meaning: 'thành phố Kyoto', reading: 'きょうと', source: 'Ví dụ Kanji' }],
    });
    expect(result.tokens.find(token => token.text === '飲み')?.definitions).toEqual([{ meaning: 'uống', reading: 'のむ', source: 'Nguồn giáo trình' }]);
    expect(result.tokens.find(token => token.text === '水')?.definitions).toEqual([]);
  });

  it('only links unique exact normalized titles, while preserving AI evidence and meaning', async () => {
    const rows = [
      { id: 'unique', pattern: 'N まで', meaning: 'nghĩa catalog', level: 'N5' },
      { id: 'ambiguous-a', pattern: 'V て', meaning: 'thứ nhất', level: 'N5' },
      { id: 'ambiguous-b', pattern: 'Vて', meaning: 'thứ hai', level: 'N4' },
    ];
    const db = { $queryRaw: vi.fn().mockResolvedValue(rows) } as unknown as PrismaClient;
    const result = await matchSentencePatterns(db, [
      { pattern: 'Ｎ　まで', meaning: 'nghĩa theo câu', evidence: '京都まで' },
      { pattern: 'Vて', meaning: 'mơ hồ', evidence: '食べて' },
      { pattern: 'Nまでです', meaning: 'không khớp chính xác', evidence: '京都までです' },
    ]);
    expect(result[0]).toEqual({ pattern: 'Ｎ　まで', meaning: 'nghĩa theo câu', evidence: '京都まで', match: rows[0] });
    expect(result[1].match).toBeNull();
    expect(result[2].match).toBeNull();
  });
});
