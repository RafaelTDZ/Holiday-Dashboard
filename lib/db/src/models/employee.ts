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
      // Sem `default: null` de propósito: um funcionário criado pelo gestor
      // pode não ter conta de usuário e, nesse caso, o campo simplesmente
      // **não existe** no documento. É o que permite que o índice único e
      // sparse abaixo aceite vários funcionários sem usuário — um índice
      // sparse ignora os documentos sem o campo, mas não ignora os que têm o
      // campo preenchido com `null`.
      userId: { type: String },
      createdAt: { type: Date, default: () => new Date() },
    },
    { id: false, collection: "employees" },
  ),
  "employee",
);

/**
 * Vínculo usuário ↔ funcionário é 1:1 (BIZ-07).
 *
 * O índice é único para impedir que o mesmo usuário esteja vinculado a dois
 * funcionários (o `/me/employee` escolheria um deles de forma arbitrária) e
 * sparse para permitir mais de um funcionário sem conta de usuário.
 */
employeeSchema.index({ userId: 1 }, { unique: true, sparse: true });

export type Employee = InferSchemaType<typeof employeeSchema>;

export const EmployeeModel =
  (models.Employee as Model<Employee>) ??
  model<Employee>("Employee", employeeSchema);
