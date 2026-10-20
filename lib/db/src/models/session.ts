import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Sessions are stored server-side (the cookie only carries the `sid`).
 */
const sessionSchema = new Schema(
  {
    sid: { type: String, unique: true, index: true },
    sess: { type: Schema.Types.Mixed, required: true },
    expire: { type: Date, required: true, index: true },
  },
  { collection: "sessions", versionKey: false, id: false },
);

export type Session = InferSchemaType<typeof sessionSchema>;

export const SessionModel =
  (models.Session as Model<Session>) ??
  model<Session>("Session", sessionSchema);
