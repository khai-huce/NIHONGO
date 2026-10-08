import type { LeaderboardEntry } from '@nihongo/shared/contracts/leaderboard';

const compactXp = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const formatXp = (xp: number) => compactXp.format(xp).toLowerCase();
/** Display slots are positional; ranks always come from the server, including ties. */
export function leaderboardSlots(entries: LeaderboardEntry[]) {
  return { topThree: [entries[1], entries[0], entries[2]], rankList: entries.slice(3) };
}
