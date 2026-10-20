import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * One-time tokens used by the "forgot password" flow.
 */
const passwordResetTokenSchema = new Schema(
  {
    token: { type: String, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { id: false, collection: "password_reset_tokens" },
);

export type PasswordResetToken = InferSchemaType<typeof passwordResetTokenSchema>;

export const PasswordResetTokenModel =
  (models.PasswordResetToken as Model<PasswordResetToken>) ??
  model<PasswordResetToken>("PasswordResetToken", passwordResetTokenSchema);
