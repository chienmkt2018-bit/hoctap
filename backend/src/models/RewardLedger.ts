import mongoose from 'mongoose';
import type { InferSchemaType, Model } from 'mongoose';

const rewardLedgerSchema = new mongoose.Schema({
  learnerId: { type: String, required: true, trim: true, maxlength: 128 },
  sourceType: { type: String, required: true, enum: ['streak', 'chapter', 'daily_quest'] },
  sourceId: { type: String, required: true, trim: true, maxlength: 128 },
  idempotencyKey: { type: String, required: true, trim: true, maxlength: 256 },
  xpAmount: {
    type: Number,
    required: true,
    min: 0,
    validate: { validator: Number.isSafeInteger, message: 'xpAmount must be a non-negative integer.' },
  },
}, {
  timestamps: true,
  versionKey: false,
});

// The unique index is the final guard against concurrent duplicate rewards.
rewardLedgerSchema.index({ learnerId: 1, idempotencyKey: 1 }, { unique: true });
rewardLedgerSchema.index({ learnerId: 1, sourceType: 1, sourceId: 1 }, { unique: true });

export type RewardLedgerDocument = InferSchemaType<typeof rewardLedgerSchema>;
export const RewardLedgerModel: Model<RewardLedgerDocument> =
  (mongoose.models.RewardLedger as Model<RewardLedgerDocument> | undefined) ??
  mongoose.model<RewardLedgerDocument>('RewardLedger', rewardLedgerSchema);
