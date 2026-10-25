import assert from 'node:assert/strict';
import test from 'node:test';
import { getConsecutiveStreakLength, getRewardCandidates } from '../src/rewards.js';

test('streak length counts only consecutive dates ending today', () => {
  assert.equal(getConsecutiveStreakLength([
    '2026-10-21', '2026-10-22', '2026-10-24', '2026-10-25',
  ], '2026-10-25'), 2);
  assert.equal(getConsecutiveStreakLength(['2026-10-18', '2026-10-19'], '2026-10-25'), 0);
  assert.throws(() => getConsecutiveStreakLength([], '2026-02-30'), RangeError);
});

test('streak milestones create deterministic one-time event keys', () => {
  const candidates = getRewardCandidates({
    learningDates: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'],
    completedLessonIds: [],
    dailyActivity: null,
  }, '2026-10-25');
  assert.deepEqual(candidates, [{
    sourceType: 'streak',
    sourceId: '7:2026-10-25',
    idempotencyKey: 'streak:7:2026-10-25',
    xpAmount: 100,
  }]);
});

test('daily quest reward requires two lessons and a high score on the same date', () => {
  const base = {
    learningDates: ['2026-10-25'],
    completedLessonIds: [1, 2],
  };
  assert.equal(getRewardCandidates({
    ...base,
    dailyActivity: { date: '2026-10-25', completedLessonIds: [1], highScoreLessonIds: [1] },
  }, '2026-10-25').some((reward) => reward.sourceType === 'daily_quest'), false);
  assert.equal(getRewardCandidates({
    ...base,
    dailyActivity: { date: '2026-10-25', completedLessonIds: [1, 2], highScoreLessonIds: [2] },
  }, '2026-10-25').some((reward) => reward.sourceType === 'daily_quest'), true);
});

test('chapter reward requires all four chapter lessons', () => {
  const partial = getRewardCandidates({
    learningDates: ['2026-10-25'],
    completedLessonIds: [1, 2, 3],
    dailyActivity: null,
  }, '2026-10-25');
  assert.equal(partial.some((reward) => reward.sourceType === 'chapter'), false);

  const complete = getRewardCandidates({
    learningDates: ['2026-10-25'],
    completedLessonIds: [1, 2, 3, 4],
    dailyActivity: null,
  }, '2026-10-25');
  assert.deepEqual(complete.filter((reward) => reward.sourceType === 'chapter'), [{
    sourceType: 'chapter',
    sourceId: 'chapter-1',
    idempotencyKey: 'chapter:chapter-1',
    xpAmount: 200,
  }]);
});
