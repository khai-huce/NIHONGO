import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

export const XP_DAILY_CAP = 200;
export const XP_POINTS = { review: 2, roadmap: 10, vocab: 1, kana: 1, grammar: 1 } as const;
export type XpGrant = { kind: keyof typeof XP_POINTS; sourceKey: string };
export type LeaderboardPeriod = 'all' | 'month';
export type LeaderboardEntry = {
  userId: string; rank: number | null; name: string; avatarUrl: string | null; isPremium: boolean;
  xp: number; flashcards: number; roadmapDays: number;
};

const vietnamDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
});
export function xpStudyDate(at: Date): string {
  const parts = vietnamDayFormatter.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Call last in the learning transaction, after the server accepted the activity. */
export async function awardLearningXp(tx: Prisma.TransactionClient, userId: string, grants: XpGrant[], at = new Date()) {
  if (!grants.length) return { awarded: 0, claimed: 0 };
  const day = xpStudyDate(at);
  const studyDate = new Date(`${day}T00:00:00.000Z`);
  const unique = new Map<string, XpGrant>();
  for (const grant of grants) {
    if (!Object.hasOwn(XP_POINTS, grant.kind) || !grant.sourceKey || grant.sourceKey.length > 300) throw new Error('Invalid internal XP grant');
    const dedupeKey = createHash('sha256').update(JSON.stringify([grant.kind, grant.sourceKey, grant.kind === 'roadmap' ? 'lifetime' : day])).digest('hex');
    unique.set(dedupeKey, grant);
  }
  // A separate account-wide XP lock makes rewards from different modules share one daily cap.
  // Keep this after the caller's content/progress locks; do not acquire more of those afterwards.
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`xp:${userId}`}, 0))`;
  const [existing, daily] = await Promise.all([
    tx.xpEvent.findMany({ where: { userId, dedupeKey: { in: [...unique.keys()] } }, select: { dedupeKey: true } }),
    tx.xpEvent.aggregate({ where: { userId, studyDate }, _sum: { points: true } }),
  ]);
  for (const row of existing) unique.delete(row.dedupeKey);
  let remaining = Math.max(0, XP_DAILY_CAP - (daily._sum.points ?? 0));
  let awarded = 0;
  const claims = [...unique].map(([dedupeKey, grant]) => {
    const points = Math.min(remaining, XP_POINTS[grant.kind]);
    remaining -= points;
    awarded += points;
    // Zero-point claims at the cap are intentional, including lifetime roadmap milestones.
    return { userId, kind: grant.kind, sourceKey: grant.sourceKey, dedupeKey, studyDate, points, createdAt: at };
  });
  for (let start = 0; start < claims.length; start += 250) await tx.xpEvent.createMany({ data: claims.slice(start, start + 250) });
  return { awarded, claimed: claims.length };
}

/** One query reads rankings, current account and lifetime display metrics from the same snapshot. */
export async function readLeaderboard(db: PrismaClient, period: LeaderboardPeriod, sessionUserId: string | null, at = new Date()) {
  const day = xpStudyDate(at);
  const monthStart = `${day.slice(0, 7)}-01`;
  const nextMonth = new Date(`${monthStart}T00:00:00.000Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const periodWhere = period === 'month'
    ? Prisma.sql`WHERE e.study_date >= ${monthStart}::date AND e.study_date < ${nextMonth.toISOString().slice(0, 10)}::date`
    : Prisma.empty;
  type Row = LeaderboardEntry & { top: boolean; current: boolean };
  const rows = await db.$queryRaw<Row[]>(Prisma.sql`
    WITH totals AS (
      SELECT e.user_id, SUM(e.points)::double precision AS xp
      FROM xp_events e ${periodWhere} GROUP BY e.user_id HAVING SUM(e.points) > 0
    ), ranked AS (
      SELECT u.id AS "userId", u.name, u.avatar_url AS "avatarUrl", u.is_premium AS "isPremium", t.xp,
        RANK() OVER (ORDER BY t.xp DESC)::integer AS rank,
        ROW_NUMBER() OVER (ORDER BY t.xp DESC, u.created_at, u.id) AS position
      FROM totals t JOIN users u ON u.id = t.user_id
    ), selected AS (
      SELECT r."userId", r.name, r."avatarUrl", r."isPremium", r.xp, r.rank, r.position,
        r.position <= 10 AS top, r."userId" = ${sessionUserId}::uuid AS current
      FROM ranked r WHERE r.position <= 10 OR r."userId" = ${sessionUserId}::uuid
      UNION ALL
      SELECT u.id, u.name, u.avatar_url, u.is_premium, 0::double precision, NULL::integer,
        NULL::bigint, false, true
      FROM users u WHERE u.id = ${sessionUserId}::uuid AND NOT EXISTS (SELECT 1 FROM ranked r WHERE r."userId" = u.id)
    )
    SELECT s."userId", s.name, s."avatarUrl", s."isPremium", s.xp, s.rank, s.top, COALESCE(s.current, false) AS current,
      (SELECT COUNT(*)::integer FROM review_cards c WHERE c.user_id = s."userId" AND c.active = true) AS flashcards,
      ((SELECT COALESCE(SUM(cardinality(p.completed_days)), 0) FROM personal_roadmaps p WHERE p.user_id = s."userId") +
       (SELECT COALESCE(SUM(cardinality(d.completed_days)), 0) FROM default_roadmap_progress d WHERE d.user_id = s."userId"))::integer AS "roadmapDays"
    FROM selected s ORDER BY s.position NULLS LAST
  `);
  const entry = ({ top: _top, current: _current, ...value }: Row): LeaderboardEntry => value;
  const currentUser = rows.find(row => row.current);
  return { userId: currentUser?.userId ?? null, period, generatedAt: at.toISOString(),
    entries: rows.filter(row => row.top).map(entry), currentUser: currentUser ? entry(currentUser) : null };
}
