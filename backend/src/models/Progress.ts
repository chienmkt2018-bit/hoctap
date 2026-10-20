import mongoose from 'mongoose';
import type { InferSchemaType, Model } from 'mongoose';

const progressSchema = new mongoose.Schema({
  learnerId: {
    type: String,
    required: true,
    trim: true,
    maxlength: 128,
  },
  totalXp: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: { validator: Number.isSafeInteger, message: 'totalXp must be an integer.' },
  },
  completedLessonIds: {
    type: [Number],
    default: [],
    validate: {
      validator: (ids: number[]) => ids.every((id) => Number.isSafeInteger(id) && id > 0),
      message: 'completedLessonIds must contain positive integers.',
    },
  },
  learningDates: {
    type: [String],
    default: [],
    validate: {
      validator: (dates: string[]) => dates.every((date) => {
        if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return false;
        const parsed = new Date(`${date}T12:00:00.000Z`);
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
      }),
      message: 'learningDates must contain valid YYYY-MM-DD date keys.',
    },
  },
  bestXpByLesson: {
    type: Map,
    of: { type: Number, min: 0 },
    default: {},
  },
  questStatuses: {
    type: Map,
    of: { type: String, enum: ['done', 'active', 'locked'] },
    default: {},
  },
}, {
  timestamps: true,
  versionKey: false,
});

progressSchema.index({ learnerId: 1 }, { unique: true });

export type ProgressDocument = InferSchemaType<typeof progressSchema>;
export const ProgressModel: Model<ProgressDocument> =
  (mongoose.models.Progress as Model<ProgressDocument> | undefined) ??
  mongoose.model<ProgressDocument>('Progress', progressSchema);
