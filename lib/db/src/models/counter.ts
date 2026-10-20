import { Schema, model, models, type Model } from "mongoose";

/**
 * Sequential ids for the collections that are exposed through the public API.
 *
 * The API contract (and the OpenAPI spec) uses numeric ids, so every document
 * gets its own `id` from a counter collection instead of exposing the MongoDB
 * `_id` to the clients.
 */
const counterSchema = new Schema(
  {
    _id: { type: String },
    seq: { type: Number, default: 0 },
  },
  { collection: "counters", versionKey: false },
);

export const CounterModel = (models.Counter as Model<{
  _id: string;
  seq: number;
}>) ??
  model("Counter", counterSchema);

export async function nextSequence(name: string): Promise<number> {
  const counter = await CounterModel.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return counter.seq;
}

/**
 * Fills the numeric `id` field of a document on validation.
 *
 * The field itself is declared by each schema (`id: { type: Number, unique:
 * true, index: true }`), this only takes care of assigning the next value of
 * the collection counter.
 */
export function withNumericId<T extends Schema>(
  schema: T,
  counterName: string,
): T {
  schema.pre("validate", async function (this: { id?: number }) {
    if (this.id == null) {
      this.id = await nextSequence(counterName);
    }
  });

  return schema;
}
