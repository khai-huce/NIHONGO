import { Prisma, type PrismaClient } from '@prisma/client';
import type { ReadingSupplementCatalog } from '@nihongo/shared/contracts/reading-supplements';
import { matchSentencePatterns } from '../sentence-analysis/sentence-catalog.js';
import { normalizeReading } from '../sentence-analysis/sentence-tokenizer.js';

type Lists = { vocabList: { word: string; reading: string }[]; grammarList: { pattern: string }[] };
type Definition = { word: string; reading: string; meaning: string; source: string };
const norm = (value: string) => value.normalize('NFKC').trim();
/** Catalog membership is read live, never accepted from Gemini or a browser payload. */
export async function readingSupplementCatalog(db: PrismaClient, lists: Lists): Promise<ReadingSupplementCatalog> {
  const words = [...new Set(lists.vocabList.map(v => norm(v.word)))];
  const [definitions, patterns] = await Promise.all([
    words.length ? db.$queryRaw<Definition[]>(Prisma.sql`
      SELECT DISTINCT item->>'word' AS word, item->>'reading' AS reading, item->>'meaning' AS meaning, source.name AS source
      FROM curriculum_lessons lesson JOIN curriculum_topics topic ON topic.id=lesson.topic_id
      JOIN curriculum_courses course ON course.id=lesson.course_id JOIN content_sources source ON source.id=course.published_source_id
      CROSS JOIN LATERAL jsonb_array_elements(lesson.words) item
      WHERE lesson.active=true AND topic.active=true AND course.archived_at IS NULL AND course.published_version IS NOT NULL
        AND normalize(item->>'word', NFKC) IN (${Prisma.join(words)})
      UNION
      SELECT DISTINCT item->>'word', item->>'reading', item->>'meaning', source.name
      FROM kanji_content kanji JOIN content_sources source ON source.id=kanji.source_id
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(kanji.published->'examples','[]'::jsonb)) item
      WHERE kanji.status='published' AND kanji.published IS NOT NULL AND normalize(item->>'word', NFKC) IN (${Prisma.join(words)})
      LIMIT 1000
    `) : [],
    matchSentencePatterns(db, lists.grammarList.map(g => ({ pattern: g.pattern, meaning: '', evidence: '' }))),
  ]);
  return {
    vocab: lists.vocabList.map(v => {
      const matches = definitions.filter(d => d.word && d.reading && d.meaning && d.source && norm(d.word) === norm(v.word) && normalizeReading(d.reading) === normalizeReading(v.reading));
      return matches.length ? { word: v.word, reading: v.reading, definitions: matches.slice(0, 8).map(d => ({ meaning: d.meaning, source: d.source })) } : null;
    }),
    grammar: patterns.map(p => p.match ? { ...p.match, href: '/ngu-phap/mau/' + p.match.id } : null),
  };
}
