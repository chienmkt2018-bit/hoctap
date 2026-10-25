import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_TIME_ZONE, getLearningDate, isValidTimeZone } from '../src/learningDate.js';

test('uses the saved account timezone instead of the server timezone', () => {
  const instant = new Date('2026-10-24T17:30:00.000Z');
  assert.equal(getLearningDate('Asia/Ho_Chi_Minh', instant), '2026-10-25');
  assert.equal(getLearningDate('America/Los_Angeles', instant), '2026-10-24');
});

test('handles year boundaries in the account timezone', () => {
  assert.equal(getLearningDate('America/New_York', new Date('2026-01-01T02:00:00.000Z')), '2025-12-31');
});

test('validates IANA timezone identifiers', () => {
  assert.equal(isValidTimeZone('Asia/Ho_Chi_Minh'), true);
  assert.equal(isValidTimeZone('Not/A_Real_Zone'), false);
  assert.equal(isValidTimeZone(null), false);
  assert.equal(DEFAULT_TIME_ZONE, 'Asia/Ho_Chi_Minh');
});

test('rejects invalid timezones and timestamps', () => {
  assert.throws(() => getLearningDate('Not/A_Real_Zone', new Date()), RangeError);
  assert.throws(() => getLearningDate('UTC', new Date('invalid')), RangeError);
});
