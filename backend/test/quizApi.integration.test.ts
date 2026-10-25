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
import { QuizAttemptModel } from '../src/models/QuizAttempt.js';
import { UserModel } from '../src/models/User.js';

const configuredTestUri = process.env.MONGODB_TEST_URI;
const enabled = Boolean(configuredTestUri);

// Keep this API suite isolated from the reward-ledger suite and any non-test database.
if (enabled && !/\/hoctap_xp_test(?:\?|$)/.test(configuredTestUri ?? '')) {
  throw new Error('MONGODB_TEST_URI must target the isolated hoctap_xp_test database.');
}
const quizTestUri = configuredTestUri?.replace(
  /\/hoctap_xp_test(?=\?|$)/,
  '/hoctap_quiz_api_test',
);

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
  assert.notEqual(quizTestUri, configuredTestUri, 'Quiz API tests must use their own database.');

  // This suite drops only its dedicated, explicitly named test database.
  await mongoose.connect(quizTestUri, { serverSelectionTimeoutMS: 5000 });
  try {
    await mongoose.connection.db!.dropDatabase();
  } finally {
    await mongoose.disconnect();
  }

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

    const registeredEmail = `quiz-api-${randomUUID()}@example.test`;
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

    const concurrentAttemptId = `quiz-race-${randomUUID()}`;
    const concurrentRequestCount = 10;
    const concurrentResults = await Promise.all(
      Array.from({ length: concurrentRequestCount }, () =>
        requestJson(api, baseUrl, '/api/v1/quizzes/1/attempts', {
          method: 'POST', token, body: { attemptId: concurrentAttemptId, answers: validAnswers },
        }),
      ),
    );
    assert.deepEqual(
      concurrentResults.map((result) => result.status).sort((a, b) => a - b),
      [...Array(concurrentRequestCount - 1).fill(200), 201],
      'Ten concurrent retries should create one attempt and replay the same result for the other nine.',
    );
    assert.equal(concurrentResults.filter((result) => result.body.replayed === false).length, 1);
    assert.equal(concurrentResults.filter((result) => result.body.replayed === true).length, concurrentRequestCount - 1);
    assert.ok(concurrentResults.every((result) => result.body.totalXp === 18));

    const progress = await requestJson(api, baseUrl, '/api/v1/progress', { token });
    assert.equal(progress.status, 200);
    assert.equal(progress.body.progress.totalXp, 18, 'Retries must not add XP twice.');
    assert.deepEqual(progress.body.progress.completedLessonIds, [1]);
    assert.equal(progress.body.progress.bestXpByLesson['1'], 18);

    // Verify the database invariant directly: one attempt record for this learner/key.
    await mongoose.connect(quizTestUri, { serverSelectionTimeoutMS: 5000 });
    try {
      const testUser = await UserModel.findOne({ email: registeredEmail }).select('_id');
      assert.ok(testUser, 'The isolated test account should exist in the test database.');
      const attemptCount = await QuizAttemptModel.countDocuments({
        learnerId: String(testUser._id),
        idempotencyKey: concurrentAttemptId,
      });
      assert.equal(attemptCount, 1, 'Concurrent retries must persist exactly one quiz attempt.');
    } finally {
      await mongoose.disconnect();
    }
  } finally {
    await stopApi(child);
    await api.dispose();
    await mongoose.connect(quizTestUri, { serverSelectionTimeoutMS: 5000 });
    try {
      await mongoose.connection.db!.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  }
});
