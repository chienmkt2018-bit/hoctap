import { Schema, model, models, type InferSchemaType } from 'mongoose';

const userSchema = new Schema({
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
}, {
  timestamps: true,
  versionKey: false,
});

export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel = models.User ?? model('User', userSchema);
