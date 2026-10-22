import mongoose from 'mongoose';
import type { InferSchemaType, Model } from 'mongoose';

const quizAttemptSchema = new mongoose.Schema({
  learnerId: { type: String, required: true, trim: true, maxlength: 128 },
  idempotencyKey: { type: String, required: true, trim: true, minlength: 16, maxlength: 128 },
  // Bind an idempotency key to the original quiz and answers. Optional for
  // backward compatibility with attempts written before this field existed.
  requestFingerprint: { type: String, required: false, minlength: 64, maxlength: 64 },
  lessonId: { type: Number, required: true, min: 1, max: 500 },
  correctCount: { type: Number, required: true, min: 0, max: 100 },
  totalQuestions: { type: Number, required: true, min: 1, max: 100 },
  percentage: { type: Number, required: true, min: 0, max: 100 },
  calculatedXp: { type: Number, required: true, min: 0 },
  xpAwarded: { type: Number, required: true, min: 0 },
  totalXpAfter: { type: Number, required: true, min: 0 },
}, {
  timestamps: true,
  versionKey: false,
});

quizAttemptSchema.index({ learnerId: 1, idempotencyKey: 1 }, { unique: true });
quizAttemptSchema.index({ learnerId: 1, createdAt: -1 });

export type QuizAttemptDocument = InferSchemaType<typeof quizAttemptSchema>;
export const QuizAttemptModel: Model<QuizAttemptDocument> =
  (mongoose.models.QuizAttempt as Model<QuizAttemptDocument> | undefined) ??
  mongoose.model<QuizAttemptDocument>('QuizAttempt', quizAttemptSchema);
