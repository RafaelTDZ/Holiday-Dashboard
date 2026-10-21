import mongoose, { type Schema as SchemaType, type Model } from "mongoose";

const { Schema, model, models } = mongoose;

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

export const CounterModel =
  (models.Counter as Model<{
    _id: string;
    seq: number;
  }>) ?? model("Counter", counterSchema);

export async function nextSequence(name: string): Promise<number> {
  const counter = await CounterModel.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return counter.seq;
}

type UpsertQuery = {
  getOptions: () => { upsert?: boolean };
  getUpdate: () => Record<string, unknown> | undefined;
  getFilter: () => unknown;
  setUpdate: (update: Record<string, unknown>) => void;
  model: { exists: (filter: unknown) => Promise<unknown> };
};

/**
 * Fills the numeric `id` field of a document on validation.
 *
 * The field itself is declared by each schema (`id: { type: Number, unique:
 * true, index: true }`), this only takes care of assigning the next value of
 * the collection counter.
 */
export function withNumericId<T extends SchemaType>(
  schema: T,
  counterName: string,
): T {
  schema.pre("validate", async function (this: { id?: number }) {
    if (this.id == null) {
      this.id = await nextSequence(counterName);
    }
  });

  // `findOneAndUpdate` does not run the document validation hooks, so the id
  // has to be assigned explicitly when the query really inserts a document.
  schema.pre("findOneAndUpdate", async function (this: UpsertQuery) {
    const options = this.getOptions();
    if (!options?.upsert) return;

    const update = this.getUpdate();
    if (!update) return;

    const set = (update.$set ?? {}) as Record<string, unknown>;
    if (set.id != null) return;

    // Only when there is no document matching the filter yet
    const exists = await this.model.exists(this.getFilter());
    if (exists) return;

    const id = await nextSequence(counterName);

    if (update.$set) {
      this.setUpdate({ ...update, $set: { ...set, id } });
    } else {
      this.setUpdate({ $set: { ...update, id } });
    }
  });

  return schema;
}
