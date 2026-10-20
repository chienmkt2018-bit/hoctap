import { Schema, model, models, type InferSchemaType } from 'mongoose';

const progressSchema = new Schema({
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
export const ProgressModel = models.Progress ?? model('Progress', progressSchema);
