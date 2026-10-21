import mongoose, { type InferSchemaType, type Model } from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * One-time tokens used by the "forgot password" flow.
 *
 * The value stored in `token` is the SHA-256 hash of the real token — the
 * plain token only exists in the e-mail sent to the user, so a database leak
 * does not allow anyone to reset a password.
 *
 * Expired documents are removed automatically by MongoDB through the TTL index
 * on `expiresAt` (`expireAfterSeconds: 0`).
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

// TTL index: MongoDB deletes the document once `expiresAt` is in the past.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetToken = InferSchemaType<typeof passwordResetTokenSchema>;

export const PasswordResetTokenModel =
  (models.PasswordResetToken as Model<PasswordResetToken>) ??
  model<PasswordResetToken>("PasswordResetToken", passwordResetTokenSchema);
