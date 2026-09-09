import { describe, expect, it } from 'vitest';
import { localDay, reviewStats, type DailyReview } from '../src/review.stats.js';
import { reviewInterval } from '../src/review.routes.js';

const row = (day: string, count = 1, rating = 'good', category = 'kanji'): DailyReview => ({ day, count, rating, category, elapsed: count*2000 });
describe('Vietnam review calendar and historical statistics', () => {
  it('changes dates exactly at midnight Vietnam time', () => {
    expect(localDay(new Date('2026-08-31T16:59:59.999Z'))).toBe('2026-08-31');
    expect(localDay(new Date('2026-08-31T17:00:00Z'))).toBe('2026-09-01');
  });
  it('counts Monday weeks, calendar months, all history, distinct study days and zero chart days', () => {
    const rows = [row('2026-08-30',2,'again'),row('2026-08-31',3,'hard'),row('2026-09-01',1),row('2026-09-01',2,'easy'),row('2026-09-01',99,'good','vocab')];
    const stats = reviewStats(rows,new Date('2026-08-31T17:00:00Z'))[0];
    expect(stats).toMatchObject({total:8,today:3,week:6,month:3,streak:3,averagePerDay:8/3,averageMs:2000,distribution:{again:2,hard:3,good:1,easy:2}});
    expect(stats.daily.map(d=>d.count)).toEqual([0,0,0,0,2,3,3]);
    expect(stats.daily[0].day).toBe('2026-08-26');
  });
  it('starts a new week on Monday and keeps yesterday streak until a full missed day', () => {
    const rows = [row('2026-09-05'),row('2026-09-06')];
    expect(reviewStats(rows,new Date('2026-09-06T16:59:59Z'))[0]).toMatchObject({streak:2,week:2,today:1});
    expect(reviewStats(rows,new Date('2026-09-06T17:00:00Z'))[0]).toMatchObject({streak:2,week:0,today:0});
    expect(reviewStats(rows,new Date('2026-09-07T17:00:00Z'))[0].streak).toBe(0);
  });
  it('returns zero statistics for all categories without sample data', () => {
    for (const stats of reviewStats([],new Date('2026-01-01T00:00:00Z'))) {
      expect(stats).toMatchObject({total:0,today:0,week:0,month:0,streak:0,averageMs:0,averagePerDay:0});
      expect(stats.daily).toHaveLength(7);
      expect(stats.daily.every(d=>d.count===0)).toBe(true);
    }
  });
  it('uses the agreed scheduling steps and caps at 365 days', () => {
    expect(reviewInterval(0,'again')).toBe(60);
    expect(reviewInterval(0,'hard')).toBe(360);
    expect(reviewInterval(60,'good')).toBe(86400);
    expect(reviewInterval(86400,'good')).toBe(172800);
    expect(reviewInterval(86400,'easy')).toBe(345600);
    expect(reviewInterval(2*86400,'easy')).toBe(6*86400);
    expect(reviewInterval(200*86400,'good')).toBe(365*86400);
    expect(reviewInterval(200*86400,'easy')).toBe(365*86400);
  });
});
