import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leaderboardSlots, formatXp } from '../src/features/leaderboard/utils/display.ts';

test('podium handles zero, one and two real users without synthesizing rows', () => {
  assert.deepEqual(leaderboardSlots([]), { topThree: [undefined, undefined, undefined], rankList: [] });
  const first = { userId: 'a', rank: 1 }, second = { userId: 'b', rank: 2 };
  assert.deepEqual(leaderboardSlots([first]).topThree, [undefined, first, undefined]);
  assert.deepEqual(leaderboardSlots([first, second]).topThree, [second, first, undefined]);
});
test('ties and server order remain intact while placing second-first-third', () => {
  const entries = [1, 1, 3, 4, 4].map((rank, index) => ({ userId: String(index), rank }));
  const slots = leaderboardSlots(entries);
  assert.deepEqual(slots.topThree.map(row => row.userId), ['1', '0', '2']);
  assert.deepEqual(slots.rankList.map(row => row.rank), [4, 4]);
});
test('XP formatting preserves the current compact presentation', () => {
  assert.equal(formatXp(0), '0'); assert.equal(formatXp(7), '7'); assert.equal(formatXp(44900), '44.9k');
});
