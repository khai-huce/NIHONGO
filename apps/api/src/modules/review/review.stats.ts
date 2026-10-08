export type DailyReview = { category: string; day: string; rating: string; count: number; elapsed: number };
export const localDay = (date: Date) => new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10);
const shift = (day: string, offset: number) => new Date(Date.parse(day) + offset * 86400000).toISOString().slice(0, 10);

export function reviewStats(rows: DailyReview[], now = new Date()) {
  const today = localDay(now);
  const weekday = new Date(today).getUTCDay();
  const monday = shift(today, -(weekday + 6) % 7);
  return ['kanji','vocab','grammar'].map(category => {
    const selected = rows.filter(row => row.category === category && row.day <= today);
    const days = new Map<string, number>();
    const distribution = { again: 0, hard: 0, good: 0, easy: 0 };
    let total = 0, elapsed = 0, week = 0, month = 0;
    for (const row of selected) {
      total += row.count; elapsed += row.elapsed;
      days.set(row.day, (days.get(row.day) ?? 0) + row.count);
      if (row.day >= monday) week += row.count;
      if (row.day.slice(0,7) === today.slice(0,7)) month += row.count;
      if (row.rating in distribution) distribution[row.rating as keyof typeof distribution] += row.count;
    }
    let streak = 0, cursor = days.has(today) ? today : shift(today,-1);
    while (days.has(cursor)) { streak++; cursor = shift(cursor,-1); }
    return { category, total, today: days.get(today) ?? 0, week, month, streak,
      averagePerDay: days.size ? total / days.size : 0, averageMs: total ? elapsed / total : 0,
      distribution, daily: Array.from({length:7}, (_,index) => {
        const day = shift(today,index-6); return { day, count: days.get(day) ?? 0 };
      }),
    };
  });
}
