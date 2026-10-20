import mongoose, { type InferSchemaType, type Model } from "mongoose";

const { Schema, model, models } = mongoose;
import { withNumericId } from "./counter";

/**
 * Date-only fields (hire date, vacation period, sale date) are stored as
 * `"YYYY-MM-DD"` strings on purpose: the whole domain works with calendar
 * dates, and keeping them as strings avoids timezone shifts (a hire date of
 * 2020-01-15 must never become 2020-01-14 because of the server timezone).
 * Lexicographic order of ISO dates matches chronological order, so sorting and
 * range queries keep working.
 */
const employeeSchema = withNumericId(
  new Schema(
    {
      id: { type: Number, required: true, unique: true, index: true },
      name: { type: String, required: true },
      role: { type: String, required: true },
      department: { type: String, required: true },
      hireDate: { type: String, required: true },
      userId: { type: String, default: null, index: true },
      createdAt: { type: Date, default: () => new Date() },
    },
    { id: false, collection: "employees" },
  ),
  "employee",
);

export type Employee = InferSchemaType<typeof employeeSchema>;

export const EmployeeModel =
  (models.Employee as Model<Employee>) ??
  model<Employee>("Employee", employeeSchema);
