import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import mongoose from 'mongoose';
import test from 'node:test';

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
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<ApiResponse> {
  const response = await fetch(new URL(path, baseUrl), {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, body: await response.json() as Record<string, any> };
}

async function waitForApi(
  child: ChildProcess,
  baseUrl: string,
  output: () => string,
): Promise<void> {
  for (let attempt = 0; attempt < 75; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Test API process exited before becoming ready. Output: ${output().slice(-3000)}`);
    }
    try {
      const health = await requestJson(baseUrl, '/api/v1/health');
      if (health.status === 200 && health.body.database === 'connected') return;
    } catch {
      // The local server may not have bound its port yet.
    }
    await delay(200);
  }
  throw new Error(`Test API did not become ready with the isolated database. Output: ${output().slice(-3000)}`);
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
  child.stdout?.on('data', (chunk: Buffer) => { processOutput += chunk.toString(); });
  child.stderr?.on('data', (chunk: Buffer) => { processOutput += chunk.toString(); });

  try {
    await waitForApi(child, baseUrl, () => processOutput);

    const attemptId = `quiz-test-${randomUUID()}`;
    const validAnswers = [
      { questionId: 'q1', selectedOptionId: '1' },
      { questionId: 'q2', selectedOptionId: '0' },
      { questionId: 'q3', selectedOptionId: '2' },
    ];

    const unauthenticated = await requestJson(baseUrl, '/api/v1/quizzes/1/attempts', {
      method: 'POST',
      body: { attemptId, answers: validAnswers },
    });
    assert.equal(unauthenticated.status, 401, 'Quiz attempts must require authentication.');

    const registered = await requestJson(baseUrl, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        email: `quiz-api-${randomUUID()}@example.test`,
        password: 'OnlyForTests_12345',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    });
    assert.equal(registered.status, 201, 'A fresh test account should register in the isolated database.');
    assert.equal(typeof registered.body.token, 'string');
    const token = registered.body.token as string;

    const forgedScore = await requestJson(baseUrl, '/api/v1/quizzes/1/attempts', {
      method: 'POST',
      token,
      body: { attemptId: `forged-${randomUUID()}`, answers: validAnswers, xp: 99999, score: 100 },
    });
    assert.equal(forgedScore.status, 400, 'Client-supplied XP/score fields must not be accepted.');

    const first = await requestJson(baseUrl, '/api/v1/quizzes/1/attempts', {
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

    const replay = await requestJson(baseUrl, '/api/v1/quizzes/1/attempts', {
      method: 'POST',
      token,
      body: { attemptId, answers: validAnswers },
    });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replayed, true);
    assert.equal(replay.body.xpAwarded, first.body.xpAwarded);
    assert.equal(replay.body.totalXp, first.body.totalXp);

    const changedPayload = await requestJson(baseUrl, '/api/v1/quizzes/1/attempts', {
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
    const concurrentResults = await Promise.all([
      requestJson(baseUrl, '/api/v1/quizzes/1/attempts', {
        method: 'POST', token, body: { attemptId: concurrentAttemptId, answers: validAnswers },
      }),
      requestJson(baseUrl, '/api/v1/quizzes/1/attempts', {
        method: 'POST', token, body: { attemptId: concurrentAttemptId, answers: validAnswers },
      }),
    ]);
    assert.deepEqual(
      concurrentResults.map((result) => result.status).sort((a, b) => a - b),
      [200, 201],
      'Concurrent retries should create one attempt and replay the same result once.',
    );
    assert.equal(concurrentResults.filter((result) => result.body.replayed === false).length, 1);
    assert.equal(concurrentResults.filter((result) => result.body.replayed === true).length, 1);
    assert.ok(concurrentResults.every((result) => result.body.totalXp === 18));

    const progress = await requestJson(baseUrl, '/api/v1/progress', { token });
    assert.equal(progress.status, 200);
    assert.equal(progress.body.progress.totalXp, 18, 'Retries must not add XP twice.');
    assert.deepEqual(progress.body.progress.completedLessonIds, [1]);
    assert.equal(progress.body.progress.bestXpByLesson['1'], 18);
  } finally {
    await stopApi(child);
    await mongoose.connect(quizTestUri, { serverSelectionTimeoutMS: 5000 });
    try {
      await mongoose.connection.db!.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  }
});
