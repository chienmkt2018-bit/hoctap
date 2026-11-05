import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import mongoose from 'mongoose';
import test from 'node:test';
import { ProgressModel } from '../src/models/Progress.js';

const configuredTestUri = process.env.MONGODB_TEST_URI;
const enabled = Boolean(configuredTestUri);

if (enabled && !/\/hoctap_xp_test(?:\?|$)/.test(configuredTestUri ?? '')) {
  throw new Error('MONGODB_TEST_URI must target the isolated hoctap_xp_test database.');
}

const progressTestUri = configuredTestUri?.replace(
  /\/hoctap_xp_test(?=\?|$)/,
  '/hoctap_progress_readonly_test',
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

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  return { status: response.status, body: await response.json() as Record<string, any> };
}

async function waitForApi(child: ChildProcess, baseUrl: string, output: () => string): Promise<void> {
  let lastHealth = 'No response received yet.';
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Test API exited before readiness. Last health: ${lastHealth}. Output: ${output().slice(-2000)}`);
    }
    try {
      const health = await fetchJson(`${baseUrl}/api/v1/health`);
      lastHealth = `HTTP ${health.status}, database=${String(health.body.database)}`;
      if (health.status === 200 && health.body.database === 'connected') return;
    } catch (error) {
      lastHealth = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`Test API did not become ready. Last health: ${lastHealth}. Output: ${output().slice(-2000)}`);
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

test('GET /progress returns defaults without creating a progress document', { skip: !enabled }, async () => {
  assert.ok(progressTestUri, 'The isolated progress test URI must be configured.');
  assert.notEqual(progressTestUri, configuredTestUri, 'Progress tests must use their own database.');

  await mongoose.connect(progressTestUri, { serverSelectionTimeoutMS: 5000 });
  try {
    await mongoose.connection.db!.dropDatabase();
  } finally {
    await mongoose.disconnect();
  }

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: backendDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: 'local-progress-readonly-test-secret-2026',
      MONGODB_URI: progressTestUri,
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

    const registration = await fetchJson(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `progress-readonly-${randomUUID()}@example.test`,
        password: 'OnlyForTests_12345',
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    });
    assert.equal(registration.status, 201);
    const token = registration.body.token;
    const learnerId = registration.body.user?.id;
    assert.equal(typeof token, 'string');
    assert.equal(typeof learnerId, 'string');

    const progressResponse = await fetchJson(`${baseUrl}/api/v1/progress`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(progressResponse.status, 200);
    assert.equal(progressResponse.body.progress.totalXp, 0);
    assert.deepEqual(progressResponse.body.progress.completedLessonIds, []);
    assert.deepEqual(progressResponse.body.progress.learningDates, []);
    assert.equal(progressResponse.body.progress.dailyActivity, null);
    assert.deepEqual(progressResponse.body.progress.bestXpByLesson, {});
    assert.deepEqual(progressResponse.body.progress.questStatuses, {});

    await mongoose.connect(progressTestUri, { serverSelectionTimeoutMS: 5000 });
    try {
      assert.equal(
        await ProgressModel.countDocuments({ learnerId }),
        0,
        'A read-only GET must not create a progress document.',
      );
    } finally {
      await mongoose.disconnect();
    }
  } finally {
    await stopApi(child);
    await mongoose.connect(progressTestUri, { serverSelectionTimeoutMS: 5000 });
    try {
      await mongoose.connection.db!.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  }
});
