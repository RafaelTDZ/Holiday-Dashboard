import mongoose, { type InferSchemaType, type Model } from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Sessions are stored server-side (the cookie only carries the `sid`).
 *
 * Expiration is guaranteed by MongoDB itself: the TTL index declared below
 * (`expireAfterSeconds: 0`) makes the database remove the document as soon as
 * `expire` is reached, so expired sessions are not kept around forever.
 * The application-level check on read (`getSession`) is kept as a safety net
 * for the short window between the expiry instant and the TTL monitor sweep
 * (which runs roughly once per minute).
 */
const sessionSchema = new Schema(
  {
    sid: { type: String, unique: true, index: true },
    sess: { type: Schema.Types.Mixed, required: true },
    expire: { type: Date, required: true },
  },
  { collection: "sessions", versionKey: false, id: false },
);

// TTL index: MongoDB deletes the document once `expire` is in the past.
sessionSchema.index({ expire: 1 }, { expireAfterSeconds: 0 });

export type Session = InferSchemaType<typeof sessionSchema>;

export const SessionModel =
  (models.Session as Model<Session>) ??
  model<Session>("Session", sessionSchema);
