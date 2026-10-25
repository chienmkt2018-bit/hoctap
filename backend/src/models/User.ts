import mongoose from 'mongoose';
import type { InferSchemaType, Model } from 'mongoose';
import { DEFAULT_TIME_ZONE, isValidTimeZone } from '../learningDate.js';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
  },
  passwordHash: {
    type: String,
    required: true,
    select: false,
  },
  timezone: { type: String, required: true, default: DEFAULT_TIME_ZONE, validate: { validator: isValidTimeZone, message: 'timezone must be a valid IANA timezone.' } },
}, {
  timestamps: true,
  versionKey: false,
});

export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument> | undefined) ??
  mongoose.model<UserDocument>('User', userSchema);
