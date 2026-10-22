import { createHash } from 'node:crypto';

export type SubmittedAnswer = {
  questionId: string;
  selectedOptionId: string;
};

export type ExistingAttemptAction = 'replay' | 'conflict';

export function fingerprintAttempt(lessonId: number, answers: SubmittedAnswer[]): string {
  const canonicalAnswers = [...answers]
    .sort((left, right) => left.questionId.localeCompare(right.questionId))
    .map(({ questionId, selectedOptionId }) => [questionId, selectedOptionId]);

  return createHash('sha256')
    .update(JSON.stringify({ lessonId, answers: canonicalAnswers }))
    .digest('hex');
}

/**
 * Legacy attempts without a fingerprint remain replayable for compatibility.
 * A fingerprinted attempt may only be replayed for the same request payload.
 */
export function decideExistingAttemptAction(
  storedFingerprint: string | null | undefined,
  incomingFingerprint: string,
): ExistingAttemptAction {
  return storedFingerprint && storedFingerprint !== incomingFingerprint
    ? 'conflict'
    : 'replay';
}
