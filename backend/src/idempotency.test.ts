import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decideExistingAttemptAction,
  fingerprintAttempt,
  type SubmittedAnswer,
} from './idempotency.js';

const answers: SubmittedAnswer[] = [
  { questionId: 'q1', selectedOptionId: '1' },
  { questionId: 'q2', selectedOptionId: '2' },
  { questionId: 'q3', selectedOptionId: '0' },
];

test('same quiz and answers produce the same fingerprint regardless of answer order', () => {
  const reversed = [...answers].reverse();

  assert.equal(fingerprintAttempt(1, answers), fingerprintAttempt(1, reversed));
});

test('same attempt payload is classified as replay', () => {
  const fingerprint = fingerprintAttempt(1, answers);

  assert.equal(decideExistingAttemptAction(fingerprint, fingerprint), 'replay');
});

test('reusing an attempt ID with a different answer payload is a conflict', () => {
  const originalFingerprint = fingerprintAttempt(1, answers);
  const changedAnswers = answers.map((answer) =>
    answer.questionId === 'q2'
      ? { ...answer, selectedOptionId: '1' }
      : answer,
  );
  const changedFingerprint = fingerprintAttempt(1, changedAnswers);

  assert.notEqual(originalFingerprint, changedFingerprint);
  assert.equal(
    decideExistingAttemptAction(originalFingerprint, changedFingerprint),
    'conflict',
  );
});

test('reusing an attempt ID for a different quiz is a conflict', () => {
  const lessonOneFingerprint = fingerprintAttempt(1, answers);
  const lessonTwoFingerprint = fingerprintAttempt(2, answers);

  assert.notEqual(lessonOneFingerprint, lessonTwoFingerprint);
  assert.equal(
    decideExistingAttemptAction(lessonOneFingerprint, lessonTwoFingerprint),
    'conflict',
  );
});

test('legacy attempts without a fingerprint remain replayable', () => {
  const incomingFingerprint = fingerprintAttempt(1, answers);

  assert.equal(decideExistingAttemptAction(undefined, incomingFingerprint), 'replay');
  assert.equal(decideExistingAttemptAction(null, incomingFingerprint), 'replay');
});
