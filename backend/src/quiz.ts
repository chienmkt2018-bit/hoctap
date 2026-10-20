import { Router, type Response } from 'express';
import { ProgressModel } from './models/Progress.js';
import { QuizAttemptModel } from './models/QuizAttempt.js';
import { getDatabaseStatus } from './database.js';
import { requireAuthentication } from './auth.js';

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

const lessonXp: Record<number, number> = {
  1: 30, 2: 40, 3: 50, 4: 100,
  5: 35, 6: 55, 7: 40, 8: 75,
};

type AttemptResult = {
  attemptId: string;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  xpAwarded: number;
  totalXp: number;
  replayed: boolean;
};

function resultFromAttempt(attempt: {
  idempotencyKey: string;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  xpAwarded: number;
  totalXpAfter: number;
}, replayed: boolean): AttemptResult {
  return {
    attemptId: attempt.idempotencyKey,
    correctCount: attempt.correctCount,
    totalQuestions: attempt.totalQuestions,
    percentage: attempt.percentage,
    xpAwarded: attempt.xpAwarded,
    totalXp: attempt.totalXpAfter,
    replayed,
  };
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
    if (!Number.isSafeInteger(lessonId) || !correctIndexes || !lessonXp[lessonId]) {
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
    // JavaScript's getTimezoneOffset is UTC minus local time. The offset only selects
    // the user's calendar date; the activity timestamp is always server-generated.
    const timezoneOffsetMinutes = (body.timezoneOffsetMinutes as number | undefined) ?? 0;
    const learningDate = new Date(Date.now() - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
    const answers = body.answers as SubmittedAnswer[];
    const correctCount = correctIndexes.reduce((count, correctIndex, index) => {
      const answer = answers.find((item) => item.questionId === `q${index + 1}`);
      return count + (Number(answer?.selectedOptionId) === correctIndex ? 1 : 0);
    }, 0);
    const totalQuestions = correctIndexes.length;
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    const calculatedXp = Math.round((lessonXp[lessonId] * correctCount) / totalQuestions);
    const resultHolder: { value: AttemptResult | null } = { value: null };

    await session.withTransaction(async () => {
      const existing = await QuizAttemptModel.findOne({
        learnerId,
        idempotencyKey: body.attemptId as string,
      }).session(session);
      if (existing) {
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
      const xpAwarded = Math.max(0, calculatedXp - previousBest);
      progress.totalXp += xpAwarded;
      progress.bestXpByLesson.set(lessonKey, Math.max(previousBest, calculatedXp));
      progress.completedLessonIds = [...new Set([...progress.completedLessonIds, lessonId])];
      progress.learningDates = [...new Set([...(progress.learningDates ?? []), learningDate])].sort();
      await progress.save({ session });

      const [attempt] = await QuizAttemptModel.create([{
        learnerId,
        idempotencyKey: body.attemptId,
        lessonId,
        correctCount,
        totalQuestions,
        percentage,
        calculatedXp,
        xpAwarded,
        totalXpAfter: progress.totalXp,
      }], { session });
      if (!attempt) throw new Error('Could not save quiz attempt.');
      resultHolder.value = resultFromAttempt(attempt, false);
    });

    const result = resultHolder.value;
    if (!result) throw new Error('Quiz attempt did not produce a result.');
    response.status(result.replayed ? 200 : 201).json(result);
  } catch (error) {
    if (isRecord(error) && error.code === 11000) {
      const body = request.body as { attemptId?: string } | undefined;
      const existing = await QuizAttemptModel.findOne({
        learnerId: response.locals.userId,
        idempotencyKey: body?.attemptId,
      });
      if (existing) {
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
