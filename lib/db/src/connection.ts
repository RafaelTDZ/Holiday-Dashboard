import mongoose from "mongoose";

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

export { mongoose };
