import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { after, before, test } from 'node:test';
import { ProgressModel } from '../src/models/Progress.js';
import { RewardLedgerModel } from '../src/models/RewardLedger.js';

const testUri = process.env.MONGODB_TEST_URI;
const enabled = Boolean(testUri);

if (enabled && !/\/hoctap_xp_test(?:\?|$)/.test(testUri ?? '')) {
  throw new Error('MONGODB_TEST_URI must target the isolated hoctap_xp_test database.');
}

before(async () => {
  if (!enabled) return;
  await mongoose.connect(testUri!, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.db!.dropDatabase();
  await Promise.all([ProgressModel.init(), RewardLedgerModel.init()]);
});

after(async () => {
  if (enabled) {
    await mongoose.connection.db!.dropDatabase();
    await mongoose.disconnect();
  }
});

test('reward ledger unique index allows only one concurrent event record', { skip: !enabled }, async () => {
  const reward = {
    learnerId: 'integration-test-learner',
    sourceType: 'daily_quest' as const,
    sourceId: '2026-10-25',
    idempotencyKey: 'daily_quest:2026-10-25',
    xpAmount: 50,
  };
  const results = await Promise.allSettled([
    RewardLedgerModel.create(reward),
    RewardLedgerModel.create(reward),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(await RewardLedgerModel.countDocuments({ learnerId: reward.learnerId }), 1);
});

test('transaction rollback does not leave a reward without its progress update', { skip: !enabled }, async () => {
  const learnerId = 'rollback-test-learner';
  const session = await mongoose.startSession();
  try {
    await assert.rejects(session.withTransaction(async () => {
      await ProgressModel.create([{ learnerId, totalXp: 150 }], { session });
      await RewardLedgerModel.create([{
        learnerId,
        sourceType: 'chapter',
        sourceId: 'chapter-1',
        idempotencyKey: 'chapter:chapter-1',
        xpAmount: 200,
      }], { session });
      throw new Error('intentional rollback probe');
    }), /intentional rollback probe/);
  } finally {
    await session.endSession();
  }

  assert.equal(await ProgressModel.countDocuments({ learnerId }), 0);
  assert.equal(await RewardLedgerModel.countDocuments({ learnerId }), 0);
});
