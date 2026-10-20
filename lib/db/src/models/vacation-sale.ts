import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { withNumericId } from "./counter";

const vacationSaleSchema = withNumericId(
  new Schema(
    {
      id: { type: Number, required: true, unique: true, index: true },
      employeeId: { type: Number, required: true, index: true },
      daysSold: { type: Number, required: true },
      saleDate: { type: String, required: true },
      notes: { type: String, default: null },
      createdAt: { type: Date, default: () => new Date() },
    },
    { id: false, collection: "vacation_sales" },
  ),
  "vacation_sale",
);

export type VacationSale = InferSchemaType<typeof vacationSaleSchema>;

export const VacationSaleModel =
  (models.VacationSale as Model<VacationSale>) ??
  model<VacationSale>("VacationSale", vacationSaleSchema);
