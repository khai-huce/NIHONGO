import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewGroups, StudyTimer } from '../src/features/review/lib/review.ts';

test('groups have exact 6 minute and 21 day boundaries, exclude inactive cards and restart after reset', () => {
  const card = (seconds,reviewCount=1,active=true)=>({intervalSeconds:seconds,reviewCount,active});
  assert.deepEqual(reviewGroups([card(0,0),card(359),card(360),card(21*86400-1),card(21*86400),card(365*86400),card(0,0,false)]),{new:1,learning:1,short:2,long:2});
  assert.deepEqual(reviewGroups([card(0,0)]),{new:1,learning:0,short:0,long:0});
});
test('study time excludes hidden tabs and request/retry waits', () => {
  const timer = new StudyTimer();
  timer.resume(100); timer.resume(200); timer.pause(1100);
  timer.pause(5000); // Still hidden: do not count a second time.
  timer.resume(10000); timer.pause(12000); // Submit after 2 more seconds.
  assert.equal(timer.elapsed,3000);
  timer.resume(20000); timer.pause(21000); // Network failure, then user retries.
  assert.equal(timer.elapsed,4000);
  timer.reset(); timer.resume(30000); timer.pause(31000);
  assert.equal(timer.elapsed,1000);
});
