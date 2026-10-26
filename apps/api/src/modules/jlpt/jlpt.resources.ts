import { Prisma } from '@prisma/client';
import type { JlptResourceInput, JlptResourceKind, JlptResourceOption, JlptResourceSearch, JlptResourceView } from '@nihongo/shared/contracts/jlpt';

// Read only the published side of each existing catalog. Private rows never enter this projection.
const publishedResources = Prisma.sql`
  SELECT 'kanji'::text AS kind, k.id AS "targetId", k.character AS title,
    concat_ws(' · ', k.han_viet, k.meaning) AS subtitle, k.level AS level,
    '/kanji/' || k.id AS href
  FROM kanji_content k WHERE k.status = 'published' AND k.published IS NOT NULL
  UNION ALL
  SELECT 'vocabulary', l.id::text, l.title, c.title || ' · ' || t.title, c.level,
    '/tu-vung/giao-trinh/' || c.slug || '/bai/' || l.id::text
  FROM curriculum_lessons l JOIN curriculum_topics t ON t.id=l.topic_id
    JOIN curriculum_courses c ON c.id=l.course_id
  WHERE l.active AND t.active AND c.archived_at IS NULL AND c.published_version IS NOT NULL
  UNION ALL
  SELECT 'grammar', p.id::text, p.content->>'pattern', concat_ws(' · ', c.title, l.title, p.content->>'meaning'), c.level,
    '/ngu-phap/mau/' || p.id::text
  FROM grammar_patterns p JOIN grammar_lessons l ON l.id=p.lesson_id JOIN grammar_courses c ON c.id=l.course_id
  WHERE p.active AND l.active AND c.archived_at IS NULL AND c.published_version IS NOT NULL
  UNION ALL
  SELECT 'reading', a.id::text, a.published_content->>'title', '', a.published_content->>'level',
    '/tron-doi/doc-hieu/' || a.id::text
  FROM reading_articles a WHERE a.scope='library' AND a.archived_at IS NULL
    AND a.published_version IS NOT NULL AND a.published_content IS NOT NULL
  UNION ALL
  SELECT 'shadowing', v.id::text, v.published_content->>'title', v.published_content->>'channel', v.published_content->>'level',
    '/tron-doi/shadowing/' || v.id::text
  FROM shadowing_videos v WHERE v.scope='library' AND v.archived_at IS NULL
    AND v.published_version IS NOT NULL AND v.published_content IS NOT NULL
  UNION ALL
  SELECT 'kana', 'hiragana', 'Hiragana', 'Bảng chữ cái Hiragana', 'N5', '/tu-vung/bang-chu-cai?script=hiragana'
  UNION ALL
  SELECT 'kana', 'katakana', 'Katakana', 'Bảng chữ cái Katakana', 'N5', '/tu-vung/bang-chu-cai?script=katakana'
`;
type Row = { kind: JlptResourceKind; targetId: string; title: string | null; subtitle: string | null; level: string | null; href: string };
const option = (row: Row): JlptResourceOption => ({ ...row, title: row.title ?? '', subtitle: row.subtitle ?? '', available: true });
export async function resolveResources(tx: Prisma.TransactionClient, inputs: JlptResourceInput[]): Promise<JlptResourceView[]> {
  if (!inputs.length) return [];
  const keys = [...new Set(inputs.map(item => `${item.kind}:${item.targetId}`))];
  const rows = await tx.$queryRaw<Row[]>(Prisma.sql`SELECT * FROM (${publishedResources}) r WHERE r.kind || ':' || r."targetId" IN (${Prisma.join(keys)})`);
  const byTarget = new Map(rows.map(row => [`${row.kind}:${row.targetId}`, option(row)]));
  return inputs.map(item => ({ ...item, ...(byTarget.get(`${item.kind}:${item.targetId}`) ?? {
    available: false, title: 'Nội dung hiện không khả dụng', subtitle: '', level: null, href: null,
  }) }));
}
export async function searchResources(tx: Prisma.TransactionClient, input: { kind: JlptResourceKind; q: string; level?: string; page: number }): Promise<JlptResourceSearch> {
  const filter = Prisma.sql`r.kind = ${input.kind}
    AND (${input.level ?? null}::text IS NULL OR r.level = ${input.level ?? null})
    AND (strpos(lower(coalesce(r.title, '') || ' ' || coalesce(r.subtitle, '') || ' ' || r."targetId"), lower(${input.q})) > 0)`;
  const count = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT count(*) FROM (${publishedResources}) r WHERE ${filter}`);
  const rows = await tx.$queryRaw<Row[]>(Prisma.sql`SELECT * FROM (${publishedResources}) r WHERE ${filter} ORDER BY r.title, r."targetId" LIMIT 25 OFFSET ${(input.page - 1) * 25}`);
  return { items: rows.map(option), total: Number(count[0].count), page: input.page, pageSize: 25 };
}

/** Lock existing parent rows before checking visibility, so archive/publish cannot race our publish. */
export async function lockResourceTargets(tx: Prisma.TransactionClient, resources: JlptResourceInput[]) {
  const ids = (kind: JlptResourceKind) => resources.filter(item => item.kind === kind).map(item => item.targetId);
  const lock = async (kind: JlptResourceKind, query: (values: string[]) => Prisma.Sql) => {
    const values = ids(kind); if (values.length) await tx.$queryRaw(query(values));
  };
  await lock('kanji', values => Prisma.sql`SELECT id FROM kanji_content WHERE id IN (${Prisma.join(values)}) ORDER BY id FOR SHARE`);
  await lock('vocabulary', values => Prisma.sql`SELECT c.id FROM curriculum_courses c JOIN curriculum_lessons l ON l.course_id=c.id WHERE l.id::text IN (${Prisma.join(values)}) ORDER BY c.id FOR SHARE OF c`);
  await lock('grammar', values => Prisma.sql`SELECT c.id FROM grammar_courses c JOIN grammar_lessons l ON l.course_id=c.id JOIN grammar_patterns p ON p.lesson_id=l.id WHERE p.id::text IN (${Prisma.join(values)}) ORDER BY c.id FOR SHARE OF c`);
  await lock('reading', values => Prisma.sql`SELECT id FROM reading_articles WHERE id::text IN (${Prisma.join(values)}) ORDER BY id FOR SHARE`);
  await lock('shadowing', values => Prisma.sql`SELECT id FROM shadowing_videos WHERE id::text IN (${Prisma.join(values)}) ORDER BY id FOR SHARE`);
}
