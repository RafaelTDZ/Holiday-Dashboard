import mongoose from "mongoose";
import { SessionModel } from "./models/session";
import { PasswordResetTokenModel } from "./models/password-reset-token";
import { EmployeeModel } from "./models/employee";

/**
 * MongoDB connection helper.
 *
 * On serverless platforms (Vercel) the process is reused between invocations,
 * so the connection promise is cached in a global to avoid opening a new
 * connection on every request.
 */
const globalForMongoose = globalThis as unknown as {
  __mongoConnectionPromise?: Promise<typeof mongoose>;
};

export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI must be set. Point it to a MongoDB Atlas connection string.",
    );
  }
  return uri;
}

export function connectDb(uri: string = getMongoUri()): Promise<typeof mongoose> {
  if (!globalForMongoose.__mongoConnectionPromise) {
    globalForMongoose.__mongoConnectionPromise = mongoose
      .connect(uri, {
        bufferCommands: true,
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 10,
      })
      .then((m) => m);
  }
  return globalForMongoose.__mongoConnectionPromise;
}

export async function disconnectDb(): Promise<void> {
  if (globalForMongoose.__mongoConnectionPromise) {
    globalForMongoose.__mongoConnectionPromise = undefined;
  }
  await mongoose.disconnect();
}

/**
 * Align the indexes of the collections that rely on TTL with the schema.
 *
 * `Model.syncIndexes()` drops the indexes that are not declared in the schema
 * and creates the missing ones. It is required because the `expire` field used
 * to be a plain index: MongoDB refuses to create a TTL index over the same key
 * pattern while the old (non-TTL) index exists (`IndexOptionsConflict`).
 *
 * It is idempotent and runs once per runtime, right after the connection is
 * established.
 */
export async function syncModelIndexes(): Promise<void> {
  await Promise.all([
    SessionModel.syncIndexes(),
    PasswordResetTokenModel.syncIndexes(),
  ]);

  // The unique and sparse index of `employees.userId` (BIZ-07) is synced
  // separately: creating it fails when the collection still has two
  // employees sharing the same `userId` (legacy data), and that must not
  // take the whole application down. The warning below points to the data
  // that has to be cleaned up manually (duplicated `userId`).
  try {
    await EmployeeModel.syncIndexes();
  } catch (err) {
    console.warn(
      "[@workspace/db] Could not sync the `employees` indexes: check for employees " +
        "sharing the same `userId` (legacy duplicates) and remove them manually. " +
        "The unique index on `employees.userId` is not active until then.",
      err,
    );
  }
}

export { mongoose };
