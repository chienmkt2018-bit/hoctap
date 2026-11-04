import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import mongoose from "mongoose";

const uri = process.env.MONGODB_TEST_URI;
assert.ok(uri, "MONGODB_TEST_URI is required for the isolated replica-set test");
const script = new URL("../scripts/p54b-staging-cleanup-worker.mjs", import.meta.url);
const runId = "123456789";
const runAttempt = "1";
const email = "p54b-" + runId + "-" + runAttempt + "-" + randomUUID().slice(0, 8) + "@example.test";
const targetId = new mongoose.Types.ObjectId();
const unrelatedId = new mongoose.Types.ObjectId();
let connection;

async function db() {
  if (!connection) {
    connection = await mongoose.createConnection(uri, { dbName: "test" }).asPromise();
  }
  return connection.db;
}

async function seedLearner(id, learnerEmail) {
  const database = await db();
  await database.collection("users").insertOne({
    _id: id,
    email: learnerEmail,
    passwordHash: "synthetic-test-hash",
    timezone: "Asia/Ho_Chi_Minh"
  });
  for (const collection of ["progresses", "quizattempts", "rewardledgers"]) {
    await database.collection(collection).insertOne({ learnerId: String(id), marker: "synthetic-test" });
  }
}

function runWorker(overrides = {}) {
  const env = {
    ...process.env,
    MONGODB_URI: uri,
    MONGODB_DB_NAME: "test",
    P54B_RUN_ID: runId,
    P54B_RUN_ATTEMPT: runAttempt,
    P54B_TEST_EMAIL: email,
    P54B_TEST_USER_ID: String(targetId),
    P54B_CLEANUP_TEST_MODE: "true",
    ...overrides
  };
  return spawnSync(process.execPath, [script.pathname], {
    env,
    encoding: "utf8",
    timeout: 20000
  });
}

async function countFor(id) {
  const database = await db();
  const counts = {};
  counts.users = await database.collection("users").countDocuments({ _id: id });
  for (const collection of ["progresses", "quizattempts", "rewardledgers"]) {
    counts[collection] = await database.collection(collection).countDocuments({ learnerId: String(id) });
  }
  return counts;
}

test("cleanup worker dry-run reports exact target without writes", async () => {
  await seedLearner(targetId, email);
  const result = runWorker();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /DRY RUN only/);
  assert.deepEqual(await countFor(targetId), {
    users: 1, progresses: 1, quizattempts: 1, rewardledgers: 1
  });
});

test("cleanup worker deletes only the exact synthetic learner and verifies zero residue", async () => {
  await seedLearner(unrelatedId, "unrelated-" + randomUUID() + "@example.test");
  const confirmation = "DELETE-P54B-" + runId + "-" + runAttempt;
  const result = runWorker({
    P54B_CLEANUP_APPLY: "true",
    P54B_CLEANUP_CONFIRMATION: confirmation
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /exact synthetic learner cleanup verified/);
  assert.deepEqual(await countFor(targetId), {
    users: 0, progresses: 0, quizattempts: 0, rewardledgers: 0
  });
  assert.deepEqual(await countFor(unrelatedId), {
    users: 1, progresses: 1, quizattempts: 1, rewardledgers: 1
  });
});

test("cleanup worker rejects a mismatched user ID without deleting anything", async () => {
  const anotherId = new mongoose.Types.ObjectId();
  const confirmation = "DELETE-P54B-" + runId + "-" + runAttempt;
  const result = runWorker({
    P54B_TEST_USER_ID: String(anotherId),
    P54B_CLEANUP_APPLY: "true",
    P54B_CLEANUP_CONFIRMATION: confirmation
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match/);
  assert.deepEqual(await countFor(targetId), {
    users: 1, progresses: 1, quizattempts: 1, rewardledgers: 1
  });
});

test("cleanup worker is idempotent after a successful cleanup", async () => {
  const confirmation = "DELETE-P54B-" + runId + "-" + runAttempt;
  const first = runWorker({
    P54B_CLEANUP_APPLY: "true",
    P54B_CLEANUP_CONFIRMATION: confirmation
  });
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const second = runWorker({
    P54B_CLEANUP_APPLY: "true",
    P54B_CLEANUP_CONFIRMATION: confirmation
  });
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.match(second.stdout, /nothing to clean/);
  assert.deepEqual(await countFor(targetId), {
    users: 0, progresses: 0, quizattempts: 0, rewardledgers: 0
  });
});

test.after(async () => {
  if (connection) {
    const database = connection.db;
    await database.collection("users").deleteMany({ _id: { $in: [targetId, unrelatedId] } });
    for (const collection of ["progresses", "quizattempts", "rewardledgers"]) {
      await database.collection(collection).deleteMany({
        learnerId: { $in: [String(targetId), String(unrelatedId)] }
      });
    }
    await connection.close();
  }
});
