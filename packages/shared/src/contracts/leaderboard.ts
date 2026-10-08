export type LeaderboardPeriod = 'all' | 'month';
export type LeaderboardEntry = {
  userId: string;
  rank: number | null;
  name: string;
  avatarUrl: string | null;
  isPremium: boolean;
  xp: number;
  flashcards: number;
  roadmapDays: number;
};
export type LeaderboardResponse = {
  userId: string | null;
  period: LeaderboardPeriod;
  generatedAt: string;
  entries: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
};
