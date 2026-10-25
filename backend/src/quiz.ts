import { createHash } from 'node:crypto';
import { Router, type Response } from 'express';
import { ProgressModel } from './models/Progress.js';
import { QuizAttemptModel } from './models/QuizAttempt.js';
import { getDatabaseStatus } from './database.js';
import { requireAuthentication } from './auth.js';
import { DEFAULT_TIME_ZONE, getLearningDate } from './learningDate.js';
import { UserModel } from './models/User.js';
import { calculateQuizXp, type QuizDifficulty } from './xp.js';
import { RewardLedgerModel } from './models/RewardLedger.js';
import { getRewardCandidates } from './rewards.js';

const router = Router();

type SubmittedAnswer = { questionId: string; selectedOptionId: string };

// Correct option indexes stay on the server. These values match the current sample quiz bank.
const quizAnswerIndexes: Record<number, number[]> = {
  1: [1, 0, 2],
  2: [1, 2, 0],
  3: [0, 1, 2],
  4: [0, 1, 2],
  5: [1, 0, 2],
  6: [0, 1, 2],
  7: [1, 0, 2],
  8: [0, 1, 2],
};

// Keep difficulty aligned with the lesson catalog; score and XP are still computed server-side.
const lessonDifficulty: Record<number, QuizDifficulty> = {
  1: 'easy', 2: 'easy', 3: 'medium', 4: 'hard',
  5: 'easy', 6: 'medium', 7: 'easy', 8: 'hard',
};

type AttemptResult = {
  attemptId: string;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  xpAwarded: number;
  bonusXpAwarded: number;
  totalXp: number;
  replayed: boolean;
};

type StoredAttempt = {
  idempotencyKey: string;
  requestFingerprint?: string | null;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  xpAwarded: number;
  bonusXpAwarded?: number;
  totalXpAfter: number;
};

function resultFromAttempt(attempt: StoredAttempt, replayed: boolean): AttemptResult {
  return {
    attemptId: attempt.idempotencyKey,
    correctCount: attempt.correctCount,
    totalQuestions: attempt.totalQuestions,
    percentage: attempt.percentage,
    xpAwarded: attempt.xpAwarded,
    bonusXpAwarded: attempt.bonusXpAwarded ?? 0,
    totalXp: attempt.totalXpAfter,
    replayed,
  };
}

function fingerprintAttempt(lessonId: number, answers: SubmittedAnswer[]): string {
  const canonicalAnswers = [...answers]
    .sort((left, right) => left.questionId.localeCompare(right.questionId))
    .map(({ questionId, selectedOptionId }) => [questionId, selectedOptionId]);
  return createHash('sha256')
    .update(JSON.stringify({ lessonId, answers: canonicalAnswers }))
    .digest('hex');
}

function idempotencyConflict(response: Response): void {
  response.status(409).json({
    error: {
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'This attemptId was already used for a different quiz submission. Start a new attempt.',
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSubmittedAnswerArray(value: unknown, expectedCount: number): value is SubmittedAnswer[] {
  if (!Array.isArray(value) || value.length !== expectedCount) return false;
  if (!value.every((answer) => isRecord(answer) &&
      Object.keys(answer).length === 2 &&
      Object.keys(answer).every((key) => ['questionId', 'selectedOptionId'].includes(key)) &&
      typeof answer.questionId === 'string' &&
      typeof answer.selectedOptionId === 'string')) return false;

  const answers = value as SubmittedAnswer[];
  return new Set(answers.map((answer) => answer.questionId)).size === expectedCount &&
    answers.every((answer) => /^q[1-3]$/.test(answer.questionId) &&
      /^[0-2]$/.test(answer.selectedOptionId)) &&
    Array.from({ length: expectedCount }, (_, index) => `q${index + 1}`)
      .every((questionId) => answers.some((answer) => answer.questionId === questionId));
}

function databaseUnavailable(response: Response): void {
  response.status(503).json({
    error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is not available. Try again later.' },
  });
}

router.post('/quizzes/:quizId/attempts', requireAuthentication, async (request, response, next) => {
  const session = await ProgressModel.db.startSession();
  try {
    if (getDatabaseStatus() !== 'connected') {
      databaseUnavailable(response);
      return;
    }

    const lessonId = Number(request.params.quizId);
    const correctIndexes = quizAnswerIndexes[lessonId];
    if (!Number.isSafeInteger(lessonId) || !correctIndexes || !lessonDifficulty[lessonId]) {
      response.status(404).json({
        error: { code: 'QUIZ_NOT_FOUND', message: 'This quiz is not available.' },
      });
      return;
    }

    const body: unknown = request.body;
    if (!isRecord(body) ||
        Object.keys(body).some((key) => !['attemptId', 'answers', 'timezoneOffsetMinutes'].includes(key)) ||
        typeof body.attemptId !== 'string' ||
        !/^[a-zA-Z0-9_-]{16,128}$/.test(body.attemptId) ||
        !isSubmittedAnswerArray(body.answers, correctIndexes.length) ||
        (body.timezoneOffsetMinutes !== undefined &&
          (!Number.isSafeInteger(body.timezoneOffsetMinutes) ||
            (body.timezoneOffsetMinutes as number) < -840 ||
            (body.timezoneOffsetMinutes as number) > 840))) {
      response.status(400).json({
        error: {
          code: 'INVALID_QUIZ_ATTEMPT',
          message: 'Provide a unique attemptId and one selected option for each question.',
        },
      });
      return;
    }

    const learnerId = response.locals.userId as string;
    const attemptId = body.attemptId as string;
    const answers = body.answers as SubmittedAnswer[];
    const requestFingerprint = fingerprintAttempt(lessonId, answers);
    // Saved account timezone is authoritative. A legacy client offset is accepted for
    // compatibility but deliberately ignored; clients cannot choose the activity date.
    const learner = await UserModel.findById(learnerId).select('timezone');
    if (!learner) {
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'The account for this token no longer exists.' } });
      return;
    }
    const learningDate = getLearningDate(learner.timezone || DEFAULT_TIME_ZONE, new Date());
    const correctCount = correctIndexes.reduce((count, correctIndex, index) => {
      const answer = answers.find((item) => item.questionId === `q${index + 1}`);
      return count + (Number(answer?.selectedOptionId) === correctIndex ? 1 : 0);
    }, 0);
    const totalQuestions = correctIndexes.length;
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    const resultHolder: { value: AttemptResult | null } = { value: null };
    const conflictHolder = { value: false };

    await session.withTransaction(async () => {
      const existing = await QuizAttemptModel.findOne({
        learnerId,
        idempotencyKey: attemptId,
      }).session(session);
      if (existing) {
        // Older records do not have a fingerprint; keep their retry behavior intact.
        if (existing.requestFingerprint && existing.requestFingerprint !== requestFingerprint) {
          conflictHolder.value = true;
          return;
        }
        resultHolder.value = resultFromAttempt(existing, true);
        return;
      }

      let progress = await ProgressModel.findOne({ learnerId }).session(session);
      if (!progress) {
        const created = await ProgressModel.create([{ learnerId }], { session });
        progress = created[0] ?? null;
      }
      if (!progress) throw new Error('Could not initialize learner progress.');

      const lessonKey = String(lessonId);
      const previousBest = progress.bestXpByLesson.get(lessonKey) ?? 0;
      const calculatedXp = calculateQuizXp(lessonDifficulty[lessonId], percentage, previousBest === 0);
      const quizXpAwarded = Math.max(0, calculatedXp - previousBest);
      progress.totalXp += quizXpAwarded;
      progress.bestXpByLesson.set(lessonKey, Math.max(previousBest, calculatedXp));
      progress.completedLessonIds = [...new Set([...progress.completedLessonIds, lessonId])];
      progress.learningDates = [...new Set([...(progress.learningDates ?? []), learningDate])].sort();
      const currentDailyActivity = progress.dailyActivity?.date === learningDate
        ? progress.dailyActivity
        : { date: learningDate, completedLessonIds: [], highScoreLessonIds: [] };
      progress.dailyActivity = {
        date: learningDate,
        completedLessonIds: [...new Set([...currentDailyActivity.completedLessonIds, lessonId])],
        highScoreLessonIds: percentage >= 80
          ? [...new Set([...currentDailyActivity.highScoreLessonIds, lessonId])]
          : [...new Set(currentDailyActivity.highScoreLessonIds)],
      };

      let bonusXpAwarded = 0;
      const rewardCandidates = getRewardCandidates({
        learningDates: progress.learningDates,
        completedLessonIds: progress.completedLessonIds,
        dailyActivity: progress.dailyActivity,
      }, learningDate);
      for (const reward of rewardCandidates) {
        const alreadyGranted = await RewardLedgerModel.findOne({
          learnerId,
          idempotencyKey: reward.idempotencyKey,
        }).session(session);
        if (alreadyGranted) continue;

        await RewardLedgerModel.create([{
          learnerId,
          sourceType: reward.sourceType,
          sourceId: reward.sourceId,
          idempotencyKey: reward.idempotencyKey,
          xpAmount: reward.xpAmount,
        }], { session });
        bonusXpAwarded += reward.xpAmount;
      }

      progress.totalXp += bonusXpAwarded;
      await progress.save({ session });

      const [attempt] = await QuizAttemptModel.create([{
        learnerId,
        idempotencyKey: attemptId,
        requestFingerprint,
        lessonId,
        correctCount,
        totalQuestions,
        percentage,
        calculatedXp,
        xpAwarded: quizXpAwarded + bonusXpAwarded,
        bonusXpAwarded,
        totalXpAfter: progress.totalXp,
      }], { session });
      if (!attempt) throw new Error('Could not save quiz attempt.');
      resultHolder.value = resultFromAttempt(attempt, false);
    });

    if (conflictHolder.value) {
      idempotencyConflict(response);
      return;
    }
    const result = resultHolder.value;
    if (!result) throw new Error('Quiz attempt did not produce a result.');
    response.status(result.replayed ? 200 : 201).json(result);
  } catch (error) {
    if (isRecord(error) && error.code === 11000) {
      const body: unknown = request.body;
      const attemptId = isRecord(body) && typeof body.attemptId === 'string'
        ? body.attemptId
        : undefined;
      const existing = await QuizAttemptModel.findOne({
        learnerId: response.locals.userId,
        idempotencyKey: attemptId,
      });
      if (existing) {
        const answers = isRecord(body) && isSubmittedAnswerArray(body.answers, 3)
          ? body.answers
          : null;
        const lessonId = Number(request.params.quizId);
        const requestFingerprint = answers && Number.isSafeInteger(lessonId)
          ? fingerprintAttempt(lessonId, answers)
          : null;
        if (existing.requestFingerprint && requestFingerprint &&
            existing.requestFingerprint !== requestFingerprint) {
          idempotencyConflict(response);
          return;
        }
        response.status(200).json(resultFromAttempt(existing, true));
        return;
      }
    }
    next(error);
  } finally {
    await session.endSession();
  }
});

export default router;
