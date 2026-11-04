import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import mongoose from 'mongoose';
import test from 'node:test';
import { request as playwrightRequest, type APIRequestContext } from 'playwright';
import { ProgressModel } from '../src/models/Progress.js';
import { QuizAttemptModel } from '../src/models/QuizAttempt.js';
import { RewardLedgerModel } from '../src/models/RewardLedger.js';
import { UserModel } from '../src/models/User.js';

const configuredTestUri = process.env.MONGODB_TEST_URI;
const enabled = Boolean(configuredTestUri);

// Keep this API suite isolated from the reward-ledger suite and any non-test database.
if (enabled && !/\/hoctap_xp_test(?:\?|$)/.test(configuredTestUri ?? '')) {
  throw new Error('MONGODB_TEST_URI must target the isolated hoctap_xp_test database.');
}
const quizTestUri = configuredTestUri;

async function getFreePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not allocate a local test port.');
  }
  const port = address.port;
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => error ? reject(error) : resolveClose());
  });
  return port;
}

type ApiResponse = {
  status: number;
  body: Record<string, any>;
};

async function requestJson(
  api: APIRequestContext,
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<ApiResponse> {
  const url = new URL(path, baseUrl).toString();
  const headers = options.token ? { authorization: `Bearer ${options.token}` } : {};
  const response = options.method === 'POST'
    ? await api.post(url, {
        headers,
        ...(options.body === undefined ? {} : { data: options.body }),
      })
    : await api.get(url, { headers });
  return { status: response.status(), body: await response.json() as Record<string, any> };
}

async function waitForApi(
  child: ChildProcess,
  api: APIRequestContext,
  baseUrl: string,
  output: () => string,
): Promise<void> {
  let lastHealth = 'No response received yet.';
  for (let attempt = 0; attempt < 75; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Test API process exited before becoming ready. Health: ${lastHealth}. Output: ${output().slice(-3000)}`);
    }
    try {
      const health = await requestJson(api, baseUrl, '/api/v1/health');
      lastHealth = `HTTP ${health.status}, database=${String(health.body.database)}`;
      if (health.status === 200 && health.body.database === 'connected') return;
    } catch (error) {
      lastHealth = error instanceof Error ? error.message : String(error);
    }
    await delay(200);
  }
  throw new Error(`Test API did not become ready with the isolated database. Last health check: ${lastHealth}. Output: ${output().slice(-3000)}`);
}

async function stopApi(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) return;
  const exited = new Promise<void>((resolveExit) => child.once('exit', () => resolveExit()));
  child.kill('SIGTERM');
  await Promise.race([exited, delay(5000)]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await Promise.race([exited, delay(1000)]);
  }
}

test('quiz HTTP API enforces authentication, server scoring, and attempt idempotency', { skip: !enabled }, async () => {
  assert.ok(quizTestUri, 'The isolated quiz API test URI must be configured.');

  // Use only the explicitly authorized QA database. Never drop the database: cleanup
  // below is scoped to the unique account created by this test run.
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const testSecret = 'local-quiz-api-test-secret-not-for-production-2026';
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: backendDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: testSecret,
      MONGODB_URI: quizTestUri,
      NODE_ENV: 'test',
      CORS_ORIGIN: 'http://localhost:5173',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let processOutput = '';
  const api = await playwrightRequest.newContext();
  const registeredEmail = `quiz-api-${randomUUID()}@example.test`;
  const concurrentRegisteredEmail = `quiz-api-race-${randomUUID()}@example.test`;
  child.stdout?.on('data', (chunk: Buffer) => { processOutput += chunk.toString(); });
  child.stderr?.on('data', (chunk: Buffer) => { processOutput += chunk.toString(); });

  try {
    await waitForApi(child, api, baseUrl, () => processOutput);

    const attemptId = `quiz-test-${randomUUID()}`;
    const validAnswers = [
      { questionId: 'q1', selectedOptionId: '1' },
      { questionId: 'q2', selectedOptionId: '0' },
      { questionId: 'q3', selectedOptionId: '2' },
    ];

    const unauthenticated = await requestJson(api, baseUrl, '/api/v1/quizzes/1/attempts', {
      method: 'POST',
      body: { attemptId, answers: validAnswers },
    });
    assert.equal(unauthenticated.status, 401, 'Quiz attempts must require authentication.');

    const registered = await requestJson(api, baseUrl, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        email: registeredEmail,
        password: 'OnlyForTests_12345',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    });
    assert.equal(registered.status, 201, 'A fresh test account should register in the isolated database.');
    assert.equal(typeof registered.body.token, 'string');
    const token = registered.body.token as string;

    const forgedScore = await requestJson(api, baseUrl, '/api/v1/quizzes/1/attempts', {
      method: 'POST',
      token,
      body: { attemptId: `forged-${randomUUID()}`, answers: validAnswers, xp: 99999, score: 100 },
    });
    assert.equal(forgedScore.status, 400, 'Client-supplied XP/score fields must not be accepted.');

    const first = await requestJson(api, baseUrl, '/api/v1/quizzes/1/attempts', {
      method: 'POST',
      token,
      body: { attemptId, answers: validAnswers },
    });
    assert.equal(first.status, 201);
    assert.equal(first.body.correctCount, 3, 'The server must score the submitted answers.');
    assert.equal(first.body.totalQuestions, 3);
    assert.equal(first.body.percentage, 100);
    assert.equal(first.body.xpAwarded, 18, 'Easy first-completion XP must be calculated by the server.');
    assert.equal(first.body.totalXp, 18);
    assert.equal(first.body.replayed, false);

    const replay = await requestJson(api, baseUrl, '/api/v1/quizzes/1/attempts', {
      method: 'POST',
      token,
      body: { attemptId, answers: validAnswers },
    });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replayed, true);
    assert.equal(replay.body.xpAwarded, first.body.xpAwarded);
    assert.equal(replay.body.totalXp, first.body.totalXp);

    const changedPayload = await requestJson(api, baseUrl, '/api/v1/quizzes/1/attempts', {
      method: 'POST',
      token,
      body: {
        attemptId,
        answers: [
          { questionId: 'q1', selectedOptionId: '0' },
          { questionId: 'q2', selectedOptionId: '0' },
          { questionId: 'q3', selectedOptionId: '2' },
        ],
      },
    });
    assert.equal(changedPayload.status, 409);
    assert.equal(changedPayload.body.error?.code, 'IDEMPOTENCY_KEY_REUSED');

    // Use a separate learner so the concurrency case races on the first completion
    // of lesson 2, rather than replaying after the same lesson was already completed.
    const concurrentRegistered = await requestJson(api, baseUrl, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        email: concurrentRegisteredEmail,
        password: 'OnlyForTests_12345',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    });
    assert.equal(concurrentRegistered.status, 201);
    assert.equal(typeof concurrentRegistered.body.token, 'string');
    const concurrentToken = concurrentRegistered.body.token as string;

    const seedAttempt = await requestJson(api, baseUrl, '/api/v1/quizzes/1/attempts', {
      method: 'POST',
      token: concurrentToken,
      body: { attemptId: `quiz-seed-${randomUUID()}`, answers: validAnswers },
    });
    assert.equal(seedAttempt.status, 201);
    assert.equal(seedAttempt.body.xpAwarded, 18);
    assert.equal(seedAttempt.body.totalXp, 18);

    const lessonTwoAnswers = [
      { questionId: 'q1', selectedOptionId: '1' },
      { questionId: 'q2', selectedOptionId: '2' },
      { questionId: 'q3', selectedOptionId: '0' },
    ];
    const concurrentAttemptId = `quiz-race-${randomUUID()}`;
    const concurrentRequestCount = 10;
    const concurrentResults = await Promise.all(
      Array.from({ length: concurrentRequestCount }, () =>
        requestJson(api, baseUrl, '/api/v1/quizzes/2/attempts', {
          method: 'POST',
          token: concurrentToken,
          body: { attemptId: concurrentAttemptId, answers: lessonTwoAnswers },
        }),
      ),
    );
    assert.deepEqual(
      concurrentResults.map((result) => result.status).sort((a, b) => a - b),
      [...Array(concurrentRequestCount - 1).fill(200), 201],
      'Ten concurrent first-completion requests should create one attempt and replay nine times.',
    );
    assert.equal(concurrentResults.filter((result) => result.body.replayed === false).length, 1);
    assert.equal(concurrentResults.filter((result) => result.body.replayed === true).length, concurrentRequestCount - 1);
    assert.ok(concurrentResults.every((result) => result.body.totalXp === 86));
    assert.ok(concurrentResults.every((result) => result.body.xpAwarded === 68));

    const concurrentProgress = await requestJson(api, baseUrl, '/api/v1/progress', {
      token: concurrentToken,
    });
    assert.equal(concurrentProgress.status, 200);
    assert.equal(concurrentProgress.body.progress.totalXp, 86,
      'Two first completions and one daily quest reward must be counted exactly once.');
    assert.deepEqual(concurrentProgress.body.progress.completedLessonIds, [1, 2]);
    assert.equal(concurrentProgress.body.progress.bestXpByLesson['1'], 18);
    assert.equal(concurrentProgress.body.progress.bestXpByLesson['2'], 18);

    // Verify both persistence invariants directly in the isolated database.
    await mongoose.connect(quizTestUri, { serverSelectionTimeoutMS: 5000 });
    try {
      // Verify retry idempotency against persisted MongoDB documents, not only API responses.
      const idempotencyUser = await UserModel.findOne({
        email: registeredEmail,
      }).select('_id');
      assert.ok(idempotencyUser, 'The isolated idempotency test account should exist.');
      const idempotencyLearnerId = String(idempotencyUser._id);
      const idempotencyAttemptCount = await QuizAttemptModel.countDocuments({
        learnerId: idempotencyLearnerId,
        idempotencyKey: attemptId,
      });
      assert.equal(idempotencyAttemptCount, 1,
        'The first submission and identical retry must persist exactly one quiz attempt.');
      const idempotencyAttempt = await QuizAttemptModel.findOne({
        learnerId: idempotencyLearnerId,
        idempotencyKey: attemptId,
      }).select('xpAwarded bonusXpAwarded totalXpAfter');
      assert.equal(idempotencyAttempt?.xpAwarded, 18,
        'The persisted idempotent attempt must retain the server-calculated XP.');
      assert.equal(idempotencyAttempt?.bonusXpAwarded, 0,
        'The persisted first-lesson attempt must not include a daily quest bonus.');
      assert.equal(idempotencyAttempt?.totalXpAfter, 18,
        'The persisted attempt must retain the post-award XP total.');
      const idempotencyProgress = await ProgressModel.findOne({
        learnerId: idempotencyLearnerId,
      });
      assert.ok(idempotencyProgress, 'The idempotency learner progress must be persisted.');
      assert.equal(idempotencyProgress.totalXp, 18,
        'The idempotency learner progress must persist exactly 18 XP after retry.');
      assert.deepEqual(idempotencyProgress.completedLessonIds, [1],
        'The idempotency learner progress must persist the completed first lesson.');
      assert.equal(await RewardLedgerModel.countDocuments({
        learnerId: idempotencyLearnerId,
      }), 0, 'A first-lesson retry must not create an unrelated reward ledger entry.');

      // Verify concurrent writes and the resulting progress/reward state in MongoDB.
      const concurrentUser = await UserModel.findOne({
        email: concurrentRegisteredEmail,
      }).select('_id');
      assert.ok(concurrentUser, 'The isolated concurrency test account should exist.');
      const learnerId = String(concurrentUser._id);
      const attemptCount = await QuizAttemptModel.countDocuments({
        learnerId,
        idempotencyKey: concurrentAttemptId,
      });
      assert.equal(attemptCount, 1,
        'Concurrent first-completion requests must persist exactly one quiz attempt.');
      const concurrentAttempt = await QuizAttemptModel.findOne({
        learnerId,
        idempotencyKey: concurrentAttemptId,
      }).select('lessonId xpAwarded bonusXpAwarded totalXpAfter');
      assert.equal(concurrentAttempt?.lessonId, 2,
        'The single concurrent attempt must persist for lesson 2.');
      assert.equal(concurrentAttempt?.xpAwarded, 68,
        'The single concurrent attempt must persist the lesson XP plus one daily bonus.');
      assert.equal(concurrentAttempt?.bonusXpAwarded, 50,
        'The single concurrent attempt must persist exactly one 50 XP daily bonus.');
      assert.equal(concurrentAttempt?.totalXpAfter, 86,
        'The single concurrent attempt must persist the final 86 XP total.');

      const concurrentProgress = await ProgressModel.findOne({ learnerId });
      assert.ok(concurrentProgress, 'The concurrency learner progress must be persisted.');
      assert.equal(concurrentProgress.totalXp, 86,
        'MongoDB progress must persist exactly 86 XP after the concurrent submissions.');
      assert.deepEqual(concurrentProgress.completedLessonIds, [1, 2],
        'MongoDB progress must persist both completed lessons exactly once.');
      assert.equal(concurrentProgress.dailyActivity?.completedLessonIds.length, 2,
        'MongoDB daily activity must persist two completed lessons.');
      assert.equal(concurrentProgress.dailyActivity?.highScoreLessonIds.length, 2,
        'MongoDB daily activity must persist both high-score lessons.');
      assert.equal(concurrentProgress.bestXpByLesson?.get('1'), 18,
        'MongoDB progress must persist lesson 1 best XP.');
      assert.equal(concurrentProgress.bestXpByLesson?.get('2'), 18,
        'MongoDB progress must persist lesson 2 best XP.');

      const dailyQuestLedgerCount = await RewardLedgerModel.countDocuments({
        learnerId,
        sourceType: 'daily_quest',
      });
      assert.equal(dailyQuestLedgerCount, 1,
        'Concurrent completion of the second lesson must create exactly one daily quest ledger entry.');
      const dailyQuestLedger = await RewardLedgerModel.findOne({
        learnerId,
        sourceType: 'daily_quest',
      }).select('xpAmount idempotencyKey sourceId');
      assert.equal(dailyQuestLedger?.xpAmount, 50,
        'The single daily quest ledger entry must award exactly 50 XP.');
      assert.equal(dailyQuestLedger?.idempotencyKey, 'daily_quest:' + concurrentProgress.dailyActivity?.date,
        'The reward ledger idempotency key must match the persisted learning date.');
      assert.equal(dailyQuestLedger?.sourceId, concurrentProgress.dailyActivity?.date,
        'The reward ledger source ID must match the persisted learning date.');
    } finally {
      await mongoose.disconnect();
    }
  } finally {
    await stopApi(child);
    await api.dispose();
    await mongoose.connect(quizTestUri, { serverSelectionTimeoutMS: 5000 });
    try {
      const testUsers = await UserModel.find({
        email: { $in: [registeredEmail, concurrentRegisteredEmail] },
      }).select('_id email');
      const learnerIds = testUsers.map((user) => String(user._id));
      if (learnerIds.length > 0) {
        await Promise.all([
          QuizAttemptModel.deleteMany({ learnerId: { $in: learnerIds } }),
          ProgressModel.deleteMany({ learnerId: { $in: learnerIds } }),
          RewardLedgerModel.deleteMany({ learnerId: { $in: learnerIds } }),
          UserModel.deleteMany({
            _id: { $in: testUsers.map((user) => user._id) },
            email: { $in: [registeredEmail, concurrentRegisteredEmail] },
          }),
        ]);
      }

      // Prove the finally-block cleanup removed only this run's synthetic learners.
      const remainingUsers = await UserModel.countDocuments({
        email: { $in: [registeredEmail, concurrentRegisteredEmail] },
      });
      const remainingProgress = learnerIds.length
        ? await ProgressModel.countDocuments({ learnerId: { $in: learnerIds } })
        : 0;
      const remainingAttempts = learnerIds.length
        ? await QuizAttemptModel.countDocuments({ learnerId: { $in: learnerIds } })
        : 0;
      const remainingRewards = learnerIds.length
        ? await RewardLedgerModel.countDocuments({ learnerId: { $in: learnerIds } })
        : 0;
      assert.deepEqual(
        [remainingUsers, remainingProgress, remainingAttempts, remainingRewards],
        [0, 0, 0, 0],
        'Scoped cleanup must leave no user, progress, quiz-attempt, or reward-ledger records for this test run.',
      );
    } finally {
      await mongoose.disconnect();
    }
  }
});
