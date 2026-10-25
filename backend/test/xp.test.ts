import assert from 'node:assert/strict';
import test from 'node:test';
import {
  baseXpForDifficulty,
  calculateQuizXp,
  getLevelProgress,
  totalXpAtLevel,
  xpRequiredForNextLevel,
} from '../src/xp.js';

test('level thresholds follow the cumulative 100 * level^1.5 curve', () => {
  assert.equal(totalXpAtLevel(1), 0);
  assert.equal(totalXpAtLevel(2), 100);
  assert.equal(totalXpAtLevel(3), 383);
  assert.equal(totalXpAtLevel(4), 903);
  assert.equal(totalXpAtLevel(5), 1703);
  assert.equal(totalXpAtLevel(6), 2821);
});

test('level progress is correct immediately before and at thresholds', () => {
  assert.deepEqual(getLevelProgress(0), {
    level: 1, totalXp: 0, xpIntoCurrentLevel: 0, xpForNextLevel: 100, nextLevelTotalXp: 100,
  });
  assert.equal(getLevelProgress(99).level, 1);
  assert.equal(getLevelProgress(99).xpIntoCurrentLevel, 99);
  assert.equal(getLevelProgress(100).level, 2);
  assert.equal(getLevelProgress(100).xpIntoCurrentLevel, 0);
  assert.equal(getLevelProgress(382).level, 2);
  assert.equal(getLevelProgress(382).xpIntoCurrentLevel, 282);
  assert.equal(getLevelProgress(383).level, 3);
  assert.equal(getLevelProgress(903).level, 4);
  assert.equal(getLevelProgress(1703).level, 5);
  assert.equal(getLevelProgress(2821).level, 6);
});

test('level progress handles multiple levels crossed in one award', () => {
  assert.equal(getLevelProgress(5000).level, 7);
  assert.equal(getLevelProgress(5000).xpIntoCurrentLevel, 61);
});

test('rejects invalid XP and level values', () => {
  for (const xp of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => getLevelProgress(xp), RangeError);
  }
  assert.throws(() => xpRequiredForNextLevel(0), RangeError);
  assert.throws(() => totalXpAtLevel(1.5), RangeError);
});

test('difficulty base XP values are stable', () => {
  assert.equal(baseXpForDifficulty('easy'), 10);
  assert.equal(baseXpForDifficulty('medium'), 20);
  assert.equal(baseXpForDifficulty('hard'), 35);
});

test('quiz XP follows difficulty, accuracy, and first-completion multipliers', () => {
  assert.equal(calculateQuizXp('easy', 90, true), 18);
  assert.equal(calculateQuizXp('medium', 70, true), 24);
  assert.equal(calculateQuizXp('hard', 90, true), 63);
  assert.equal(calculateQuizXp('hard', 40, true), 21);
  assert.equal(calculateQuizXp('hard', 90, false), 53);
  assert.equal(calculateQuizXp('easy', 0, true), 6);
  assert.throws(() => calculateQuizXp('hard', 101, true), RangeError);
});
