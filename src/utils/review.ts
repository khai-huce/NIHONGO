type ScheduledCard = { active: boolean; reviewCount: number; intervalSeconds: number };

export function reviewGroups(cards: ScheduledCard[]) {
  const groups = { new: 0, learning: 0, short: 0, long: 0 };
  for (const card of cards) {
    if (!card.active) continue;
    if (card.reviewCount === 0) groups.new++;
    else if (card.intervalSeconds < 360) groups.learning++;
    else if (card.intervalSeconds < 21*86400) groups.short++;
    else groups.long++;
  }
  return groups;
}

// The caller runs this only while a card is visible and no request is pending.
export class StudyTimer {
  elapsed = 0;
  started: number | null = null;
  reset() { this.elapsed = 0; this.started = null; }
  resume(now: number) { if (this.started === null) this.started = now; }
  pause(now: number) {
    if (this.started !== null) this.elapsed += Math.max(0,now-this.started);
    this.started = null;
  }
}
