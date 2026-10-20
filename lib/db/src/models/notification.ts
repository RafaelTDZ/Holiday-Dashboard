import mongoose, { type InferSchemaType, type Model } from "mongoose";

const { Schema, model, models } = mongoose;
import { withNumericId } from "./counter";

const notificationSchema = withNumericId(
  new Schema(
    {
      id: { type: Number, required: true, unique: true, index: true },
      userId: { type: String, required: true, index: true },
      message: { type: String, required: true },
      read: { type: Boolean, default: false },
      vacationId: { type: Number, default: null },
      employeeId: { type: Number, default: null },
      createdAt: { type: Date, default: () => new Date() },
    },
    { id: false, collection: "notifications" },
  ),
  "notification",
);

export type Notification = InferSchemaType<typeof notificationSchema>;

export const NotificationModel =
  (models.Notification as Model<Notification>) ??
  model<Notification>("Notification", notificationSchema);
