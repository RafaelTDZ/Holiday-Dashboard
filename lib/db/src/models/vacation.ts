import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { withNumericId } from "./counter";

export const VACATION_STATUSES = ["pending", "approved", "rejected"] as const;
export type VacationStatus = (typeof VACATION_STATUSES)[number];

const vacationSchema = withNumericId(
  new Schema(
    {
      id: { type: Number, required: true, unique: true, index: true },
      employeeId: { type: Number, required: true, index: true },
      startDate: { type: String, required: true },
      endDate: { type: String, required: true },
      notes: { type: String, default: null },
      status: {
        type: String,
        enum: VACATION_STATUSES,
        default: "pending",
      },
      createdAt: { type: Date, default: () => new Date() },
    },
    { id: false, collection: "vacations" },
  ),
  "vacation",
);

export type Vacation = InferSchemaType<typeof vacationSchema>;

export const VacationModel =
  (models.Vacation as Model<Vacation>) ??
  model<Vacation>("Vacation", vacationSchema);
