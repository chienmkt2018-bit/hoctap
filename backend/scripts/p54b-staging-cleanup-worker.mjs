import mongoose from "mongoose";

const EXPECTED_DB = "test";
const EXPECTED_ATLAS_HOST = "hoctap-staging.otwsdgz.mongodb.net";
const COLLECTIONS = ["progresses", "quizattempts", "rewardledgers"];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

function maskEmail(email) {
  const [local, domain] = email.split("@");
  return (local.slice(0, 5) + "***@" + domain);
}

function validateInputs() {
  const uri = required("MONGODB_URI");
  const dbName = required("MONGODB_DB_NAME");
  const runId = required("P54B_RUN_ID");
  const runAttempt = required("P54B_RUN_ATTEMPT");
  const email = required("P54B_TEST_EMAIL").toLowerCase();
  const userId = process.env.P54B_TEST_USER_ID || "";

  if (dbName !== EXPECTED_DB) throw new Error("Refusing database other than the exact staging database 'test'.");
  if (!/^\d{5,}$/.test(runId) || !/^\d+$/.test(runAttempt)) throw new Error("Invalid GitHub run identity.");
  const emailPattern = new RegExp("^p54b-" + runId + "-" + runAttempt + "-[a-f0-9]{8}\\@example\\.test$");
  if (!emailPattern.test(email)) throw new Error("Synthetic email does not match this exact GitHub run and attempt.");
  if (userId && !/^[a-f0-9]{24}$/i.test(userId)) throw new Error("Invalid MongoDB user ID.");

  const host = new URL(uri).hostname.toLowerCase();
  const testMode = process.env.P54B_CLEANUP_TEST_MODE === "true";
  const localTestHost = testMode && ["127.0.0.1", "localhost"].includes(host);
  if (host !== EXPECTED_ATLAS_HOST && !localTestHost) {
    throw new Error("Refusing MongoDB host outside the approved staging Atlas cluster.");
  }
  if (testMode && !localTestHost) throw new Error("CI test mode may only use localhost.");
  if (!testMode && host !== EXPECTED_ATLAS_HOST) throw new Error("Staging Atlas host verification failed.");

  return { uri, dbName, runId, runAttempt, email, userId };
}

async function main() {
  const input = validateInputs();
  const apply = process.env.P54B_CLEANUP_APPLY === "true";
  const expectedConfirmation = "DELETE-P54B-" + input.runId + "-" + input.runAttempt;
  if (apply && process.env.P54B_CLEANUP_CONFIRMATION !== expectedConfirmation) {
    throw new Error("Deletion confirmation does not match the exact GitHub run and attempt.");
  }

  await mongoose.connect(input.uri, {
    dbName: input.dbName,
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 2,
    minPoolSize: 0
  });

  const db = mongoose.connection.db;
  if (!db || db.databaseName !== EXPECTED_DB) throw new Error("Connected database is not the approved staging database.");

  const users = db.collection("users");
  const userMatches = await users.find({ email: input.email }).limit(2).toArray();
  if (userMatches.length > 1) throw new Error("More than one exact-email user was found; refusing cleanup.");

  const user = userMatches[0] || null;
  if (!user) {
    const orphanCounts = {};
    for (const name of COLLECTIONS) {
      orphanCounts[name] = input.userId
        ? await db.collection(name).countDocuments({ learnerId: input.userId })
        : 0;
    }
    if (Object.values(orphanCounts).some(count => count > 0)) {
      throw new Error("User record is absent but linked records remain; manual identity verification is required.");
    }
    console.log("PASS | no matching synthetic user or linked records; nothing to clean.");
    return;
  }

  const resolvedUserId = String(user._id);
  if (input.userId && resolvedUserId.toLowerCase() !== input.userId.toLowerCase()) {
    throw new Error("Provided user ID does not match the exact synthetic email record.");
  }

  const countsBefore = {};
  for (const name of COLLECTIONS) {
    countsBefore[name] = await db.collection(name).countDocuments({ learnerId: resolvedUserId });
  }
  countsBefore.users = await users.countDocuments({ _id: user._id, email: input.email });

  console.log("Cleanup target: " + maskEmail(input.email) + "; userId=" + resolvedUserId);
  console.log("Pre-cleanup counts: " + JSON.stringify(countsBefore));

  if (!apply) {
    console.log("DRY RUN only. No documents were changed.");
    return;
  }

  for (const name of COLLECTIONS) {
    await db.collection(name).deleteMany({ learnerId: resolvedUserId });
  }
  const userDelete = await users.deleteOne({ _id: user._id, email: input.email });
  if (userDelete.deletedCount !== 1) throw new Error("Expected exactly one matching synthetic user deletion.");

  const countsAfter = {};
  for (const name of COLLECTIONS) {
    countsAfter[name] = await db.collection(name).countDocuments({ learnerId: resolvedUserId });
  }
  countsAfter.users = await users.countDocuments({ _id: user._id, email: input.email });
  if (Object.values(countsAfter).some(count => count !== 0)) {
    throw new Error("Post-cleanup verification failed: " + JSON.stringify(countsAfter));
  }

  console.log("PASS | exact synthetic learner cleanup verified.");
  console.log("Post-cleanup counts: " + JSON.stringify(countsAfter));
}

try {
  await main();
} finally {
  await mongoose.disconnect().catch(() => undefined);
}
