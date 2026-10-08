import { Prisma, type PrismaClient } from '@prisma/client';
import type { SentenceAnalysis, SentenceToken, SentenceAiContent, SentenceAiAnalysis } from '@nihongo/shared/contracts/sentence-analysis';
import { kanjiContentSchema } from '../content/content.schema.js';
import { normalizeReading, tokenizeSentence } from './sentence-tokenizer.js';

type Lookup = { word: string; reading: string };
type DefinitionRow = Lookup & { meaning: string; source: string };
type PatternRow = { id: string; pattern: string; meaning: string; level: string };
const normalizeWord = (word: string) => word.normalize('NFKC').trim();
const normalizePattern = (pattern: string) => pattern.normalize('NFKC').replace(/\s+/gu, '');
// Match ECMAScript \s exactly in PostgreSQL too, including non-breaking spaces
// and BOM. A second title containing one of these must still count as ambiguous.
const patternWhitespace = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';

function lookupForms(token: SentenceToken): Lookup[] {
  if (!token.reading || ['unknown', 'punct', 'other'].includes(token.type)) return [];
  const word = normalizeWord(token.text), reading = normalizeReading(token.reading), base = normalizeWord(token.baseForm);
  const forms = [{ word, reading }];
  if (!base || base === word) return forms;
  // Retain the dictionary reading of the stem; change only visible kana endings.
  // Irregular Kanji readings (e.g. 来/き -> 来る/くる) deliberately remain unmatched.
  // A surface-only match must never select a different reading of a homograph.
  if (/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(base)) {
    forms.push({ word: base, reading: normalizeReading(base) });
  } else {
    const surfaceCharacters = Array.from(word), baseCharacters = Array.from(base);
    let common = 0;
    while (common < surfaceCharacters.length && surfaceCharacters[common] === baseCharacters[common]) common++;
    const surfaceEnding = normalizeReading(surfaceCharacters.slice(common).join(''));
    const baseEnding = normalizeReading(baseCharacters.slice(common).join(''));
    if (common > 0 && /^[\p{Script=Hiragana}ー]*$/u.test(surfaceEnding) && /^[\p{Script=Hiragana}ー]*$/u.test(baseEnding) && reading.endsWith(surfaceEnding)) {
      const stem = surfaceEnding ? reading.slice(0, -surfaceEnding.length) : reading;
      if (stem) forms.push({ word: base, reading: stem + baseEnding });
    }
  }
  return forms;
}

export async function analyzeSentence(db: PrismaClient, sentence: string): Promise<SentenceAnalysis> {
  const analysis = await tokenizeSentence(sentence);
  const characters = [...new Set(Array.from(sentence).filter(character => /\p{Script=Han}/u.test(character)))];
  const forms = analysis.tokens.map(lookupForms);
  const words = [...new Set(forms.flat().map(form => form.word))];
  const [kanjiRows, curriculumDefinitions, exampleDefinitions] = await Promise.all([
    characters.length ? db.kanjiContent.findMany({ where: { status: 'published', character: { in: characters }, published: { not: Prisma.DbNull } }, select: { published: true } }) : [],
    words.length ? db.$queryRaw<DefinitionRow[]>(Prisma.sql`
      SELECT DISTINCT item->>'word' AS word, item->>'reading' AS reading, item->>'meaning' AS meaning, source.name AS source
      FROM curriculum_lessons lesson
      JOIN curriculum_topics topic ON topic.id = lesson.topic_id
      JOIN curriculum_courses course ON course.id = lesson.course_id
      JOIN content_sources source ON source.id = course.published_source_id
      CROSS JOIN LATERAL jsonb_array_elements(lesson.words) item
      WHERE lesson.active = true AND topic.active = true AND course.archived_at IS NULL AND course.published_version IS NOT NULL
        AND normalize(item->>'word', NFKC) IN (${Prisma.join(words)})
      ORDER BY word, reading, source, meaning LIMIT 1000
    `) : [],
    words.length ? db.$queryRaw<DefinitionRow[]>(Prisma.sql`
      SELECT DISTINCT item->>'word' AS word, item->>'reading' AS reading, item->>'meaning' AS meaning, source.name AS source
      FROM kanji_content kanji
      JOIN content_sources source ON source.id = kanji.source_id
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(kanji.published->'examples', '[]'::jsonb)) item
      WHERE kanji.status = 'published' AND kanji.published IS NOT NULL
        AND normalize(item->>'word', NFKC) IN (${Prisma.join(words)})
      ORDER BY word, reading, source, meaning LIMIT 1000
    `) : [],
  ]);
  const kanjiByCharacter = new Map(kanjiRows.map(row => { const item = kanjiContentSchema.parse(row.published); return [item.kanji, item]; }));
  const definitionMap = new Map<string, SentenceToken['definitions']>();
  for (const row of [...curriculumDefinitions, ...exampleDefinitions]) {
    if (!row.word || !row.reading || !row.meaning || !row.source) continue;
    const key = `${normalizeWord(row.word)}\u0000${normalizeReading(row.reading)}`;
    const items = definitionMap.get(key) ?? [];
    if (!items.some(item => item.meaning === row.meaning && item.source === row.source)) items.push({ meaning: row.meaning, reading: normalizeReading(row.reading), source: row.source });
    definitionMap.set(key, items);
  }
  for (const token of analysis.tokens) {
    token.hanVietList = [...new Set(Array.from(token.text))].flatMap(character => {
      const item = kanjiByCharacter.get(character);
      return item ? [{ kanji: character, hanViet: item.hanViet, meaning: item.meaning }] : [];
    });
    token.definitions = forms[token.index].flatMap(form => definitionMap.get(`${form.word}\u0000${form.reading}`) ?? [])
      .filter((definition, index, all) => all.findIndex(item => item.meaning === definition.meaning && item.reading === definition.reading && item.source === definition.source) === index).slice(0, 8);
  }
  return analysis;
}

export async function matchSentencePatterns(db: PrismaClient, patterns: SentenceAiContent['patterns']): Promise<SentenceAiAnalysis['patterns']> {
  const names = [...new Set(patterns.map(item => normalizePattern(item.pattern)).filter(Boolean))];
  if (!names.length) return patterns.map(pattern => ({ ...pattern, match: null }));
  const rows = await db.$queryRaw<PatternRow[]>(Prisma.sql`
    SELECT pattern.id, pattern.content->>'pattern' AS pattern, pattern.content->>'meaning' AS meaning, course.level
    FROM grammar_patterns pattern
    JOIN grammar_lessons lesson ON lesson.id = pattern.lesson_id
    JOIN grammar_courses course ON course.id = lesson.course_id
    WHERE pattern.active = true AND lesson.active = true AND course.archived_at IS NULL AND course.published_version IS NOT NULL
      AND translate(normalize(pattern.content->>'pattern', NFKC), ${patternWhitespace}, '') IN (${Prisma.join(names)})
  `);
  const byName = new Map<string, PatternRow[]>();
  for (const row of rows) {
    const key = normalizePattern(row.pattern), existing = byName.get(key) ?? [];
    existing.push(row); byName.set(key, existing);
  }
  return patterns.map(pattern => {
    const matches = byName.get(normalizePattern(pattern.pattern)) ?? [];
    return { ...pattern, match: matches.length === 1 ? matches[0] : null };
  });
}
