import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const baseUrl = process.env.STAGING_API_BASE_URL;
const expectedBaseUrl = "https://hoctap-staging-api.onrender.com";
const runId = process.env.GITHUB_RUN_ID || "manual";
const runAttempt = process.env.GITHUB_RUN_ATTEMPT || "1";
const email = "p54b-" + runId + "-" + runAttempt + "-" + randomUUID().slice(0, 8) + "@example.test";
const password = randomBytes(24).toString("base64url");
const results = [];
let userId = null;
let token = null;

function record(name, ok, detail) {
  results.push({ name, status: ok ? "PASS" : "FAIL", detail });
  console.log((ok ? "PASS" : "FAIL") + " | " + name + " | " + detail);
  if (!ok) throw new Error(name + ": " + detail);
}

async function request(path, options = {}) {
  const url = new URL(path, baseUrl);
  if (url.origin !== expectedBaseUrl) throw new Error("Refusing request outside the exact staging API origin.");
  const headers = { accept: "application/json" };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.token) headers.authorization = "Bearer " + options.token;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "error",
    signal: AbortSignal.timeout(30000)
  });
  if (new URL(response.url).origin !== expectedBaseUrl) throw new Error("Response origin did not match the staging API allowlist.");
  let body = {};
  try { body = await response.json(); } catch {}
  return { status: response.status, body };
}

function expectStatus(result, status, name) {
  record(name, result.status === status, "expected HTTP " + status + ", received HTTP " + result.status);
}

function expectEqual(actual, expected, name) {
  record(name, actual === expected, "expected " + String(expected) + ", received " + String(actual));
}

async function main() {
  if (baseUrl !== expectedBaseUrl) throw new Error("STAGING_API_BASE_URL must equal the exact approved staging API URL.");
  if (!process.env.GITHUB_REF || process.env.GITHUB_REF !== "refs/heads/test/playwright-readonly-staging") {
    throw new Error("This test may run only from test/playwright-readonly-staging.");
  }

  const health = await request("/api/v1/health");
  expectStatus(health, 200, "P54B-API-01 staging health");
  expectEqual(health.body.status, "ok", "P54B-API-02 API status");
  expectEqual(health.body.database, "connected", "P54B-API-03 database connected");
  expectEqual(health.body.service, "hoc-tap-quest-api", "P54B-API-04 service identity");

  const attemptOne = "p54b-one-" + randomUUID();
  const answersOne = [
    { questionId: "q1", selectedOptionId: "1" },
    { questionId: "q2", selectedOptionId: "0" },
    { questionId: "q3", selectedOptionId: "2" }
  ];
  const answersTwo = [
    { questionId: "q1", selectedOptionId: "1" },
    { questionId: "q2", selectedOptionId: "2" },
    { questionId: "q3", selectedOptionId: "0" }
  ];
  const answersThree = [
    { questionId: "q1", selectedOptionId: "0" },
    { questionId: "q2", selectedOptionId: "1" },
    { questionId: "q3", selectedOptionId: "2" }
  ];

  const unauth = await request("/api/v1/quizzes/1/attempts", {
    method: "POST",
    body: { attemptId: attemptOne, answers: answersOne }
  });
  expectStatus(unauth, 401, "P54B-AUTH-01 quiz endpoint requires authentication");

  // Emit the exact synthetic email before registration so cleanup can recover even if the response is lost.\n  console.log("QA_CLEANUP_EMAIL=" + email);\n  console.log("QA_CLEANUP_RUN_ID=" + runId);\n  console.log("QA_CLEANUP_RUN_ATTEMPT=" + runAttempt);\n\n  const registered = await request("/api/v1/auth/register", {
    method: "POST",
    body: { email, password, timezone: "Asia/Ho_Chi_Minh" }
  });
  expectStatus(registered, 201, "P54B-AUTH-02 register synthetic learner");
  if (!registered.body.user || typeof registered.body.user.id !== "string") {
    throw new Error("Registration response did not include a learner ID.");
  }
  userId = registered.body.user.id;
  console.log("QA_CLEANUP_EMAIL=" + email);
  console.log("QA_CLEANUP_USER_ID=" + userId);

  const login = await request("/api/v1/auth/login", {
    method: "POST",
    body: { email, password }
  });
  expectStatus(login, 200, "P54B-AUTH-03 login synthetic learner");
  if (typeof login.body.token !== "string") throw new Error("Login did not return a bearer token.");
  token = login.body.token;

  const me = await request("/api/v1/auth/me", { token });
  expectStatus(me, 200, "P54B-AUTH-04 authenticated identity");
  expectEqual(me.body.user && me.body.user.id, userId, "P54B-AUTH-05 identity is the synthetic learner");

  const initialProgress = await request("/api/v1/progress", { token });
  expectStatus(initialProgress, 200, "P54B-PROGRESS-01 initial progress");
  expectEqual(initialProgress.body.progress && initialProgress.body.progress.totalXp, 0, "P54B-PROGRESS-02 initial XP");

  const first = await request("/api/v1/quizzes/1/attempts", {
    method: "POST", token, body: { attemptId: attemptOne, answers: answersOne }
  });
  expectStatus(first, 201, "P54B-QUIZ-01 first quiz submission");
  expectEqual(first.body.correctCount, 3, "P54B-QUIZ-02 server-calculated correct answers");
  expectEqual(first.body.percentage, 100, "P54B-QUIZ-03 server-calculated percentage");
  expectEqual(first.body.xpAwarded, 18, "P54B-XP-01 first lesson XP");
  expectEqual(first.body.totalXp, 18, "P54B-XP-02 total XP after first lesson");
  expectEqual(first.body.replayed, false, "P54B-IDEM-01 first request is not replayed");

  const retry = await request("/api/v1/quizzes/1/attempts", {
    method: "POST", token, body: { attemptId: attemptOne, answers: answersOne }
  });
  expectStatus(retry, 200, "P54B-IDEM-02 same attempt retry");
  expectEqual(retry.body.replayed, true, "P54B-IDEM-03 retry marked replayed");
  expectEqual(retry.body.totalXp, 18, "P54B-IDEM-04 retry does not duplicate XP");

  const changedPayload = await request("/api/v1/quizzes/1/attempts", {
    method: "POST",
    token,
    body: {
      attemptId: attemptOne,
      answers: [
        { questionId: "q1", selectedOptionId: "0" },
        { questionId: "q2", selectedOptionId: "0" },
        { questionId: "q3", selectedOptionId: "2" }
      ]
    }
  });
  expectStatus(changedPayload, 409, "P54B-IDEM-05 reused key with different payload");
  expectEqual(changedPayload.body.error && changedPayload.body.error.code, "IDEMPOTENCY_KEY_REUSED", "P54B-IDEM-06 conflict code");

  const second = await request("/api/v1/quizzes/2/attempts", {
    method: "POST",
    token,
    body: { attemptId: "p54b-two-" + randomUUID(), answers: answersTwo }
  });
  expectStatus(second, 201, "P54B-QUIZ-04 second lesson submission");
  expectEqual(second.body.xpAwarded, 68, "P54B-XP-03 second lesson includes one daily quest bonus");
  expectEqual(second.body.bonusXpAwarded, 50, "P54B-REWARD-01 daily quest bonus amount");
  expectEqual(second.body.totalXp, 86, "P54B-XP-04 cumulative XP after daily quest");

  const concurrentAttemptId = "p54b-race-" + randomUUID();
  const concurrentRequests = await Promise.all(Array.from({ length: 10 }, () =>
    request("/api/v1/quizzes/3/attempts", {
      method: "POST",
      token,
      body: { attemptId: concurrentAttemptId, answers: answersThree }
    })
  ));
  const statuses = concurrentRequests.map(item => item.status).sort((a, b) => a - b);
  const expectedStatuses = Array(9).fill(200).concat([201]).sort((a, b) => a - b);
  record("P54B-CONC-01 ten simultaneous same-key requests", JSON.stringify(statuses) === JSON.stringify(expectedStatuses),
    "expected one HTTP 201 and nine HTTP 200; received " + statuses.join(","));
  expectEqual(concurrentRequests.filter(item => item.body.replayed === false).length, 1, "P54B-CONC-02 one non-replayed result");
  expectEqual(concurrentRequests.filter(item => item.body.replayed === true).length, 9, "P54B-CONC-03 nine replayed results");
  record("P54B-CONC-04 concurrent results share one total XP", concurrentRequests.every(item => item.body.totalXp === 122),
    "all responses must report totalXp=122");
  record("P54B-CONC-05 concurrent results share one attempt XP", concurrentRequests.every(item => item.body.xpAwarded === 36),
    "all responses must report xpAwarded=36");

  const progress = await request("/api/v1/progress", { token });
  expectStatus(progress, 200, "P54B-PROGRESS-03 final progress endpoint");
  expectEqual(progress.body.progress && progress.body.progress.totalXp, 122, "P54B-PROGRESS-04 final XP");
  record("P54B-PROGRESS-05 completed lesson IDs", JSON.stringify(progress.body.progress && progress.body.progress.completedLessonIds) === JSON.stringify([1, 2, 3]),
    "expected [1,2,3]");
  expectEqual(progress.body.progress && progress.body.progress.bestXpByLesson && progress.body.progress.bestXpByLesson["1"], 18, "P54B-PROGRESS-06 lesson 1 best XP");
  expectEqual(progress.body.progress && progress.body.progress.bestXpByLesson && progress.body.progress.bestXpByLesson["2"], 18, "P54B-PROGRESS-07 lesson 2 best XP");
  expectEqual(progress.body.progress && progress.body.progress.bestXpByLesson && progress.body.progress.bestXpByLesson["3"], 36, "P54B-PROGRESS-08 lesson 3 best XP");
  expectEqual(progress.body.progress && progress.body.progress.dailyActivity && progress.body.progress.dailyActivity.completedLessonIds.length, 3, "P54B-PROGRESS-09 daily activity lesson count");
  expectEqual(progress.body.progress && progress.body.progress.dailyActivity && progress.body.progress.dailyActivity.highScoreLessonIds.length, 3, "P54B-PROGRESS-10 daily high-score count");
  record("P54B-PROGRESS-11 learning date persisted", Array.isArray(progress.body.progress.learningDates) && progress.body.progress.learningDates.length === 1,
    "one learning-date key is expected for the synthetic learner");

  console.log("QA_CLEANUP_EMAIL=" + email);
  console.log("QA_CLEANUP_USER_ID=" + userId);
  console.log("API test phase complete; database record verification and scoped cleanup are pending.");
}

let failure = null;
try {
  await main();
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  console.error("FAIL | P54B-RUNNER | " + failure);
} finally {
  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/p54b-staging-api-summary.json", JSON.stringify({
    apiOrigin: expectedBaseUrl,
    testEmail: email,
    testUserId: userId,
    results,
    failure,
    cleanup: "pending external verification and exact-ID cleanup"
  }, null, 2));
  token = null;
}
console.log("Summary: " + results.filter(item => item.status === "PASS").length + " PASS, " +
  results.filter(item => item.status === "FAIL").length + " FAIL");
if (failure) process.exitCode = 1;
