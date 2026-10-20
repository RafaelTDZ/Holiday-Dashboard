import bcrypt from "bcryptjs";
import { UserModel } from "@workspace/db";
import { logger } from "./logger";

/**
 * Creates (or promotes) the manager account configured through the
 * `ADMIN_EMAIL` / `ADMIN_PASSWORD` environment variables.
 *
 * It is idempotent and runs once per runtime, so it is safe to call on every
 * request. It gives a fresh deployment a usable coordinator account without
 * having to open the MongoDB Atlas UI.
 */
let bootstrapPromise: Promise<void> | null = null;

export async function ensureBootstrapAdmin(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapAdmin().catch((err) => {
      logger.error({ err }, "Failed to bootstrap the admin account");
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}

async function bootstrapAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    return;
  }

  const existing = await UserModel.findOne({ email });

  if (existing) {
    if (!existing.isManager) {
      await UserModel.updateOne({ _id: existing._id }, { $set: { isManager: true } });
      logger.info({ email }, "Promoted the configured admin account to manager");
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await UserModel.create({ email, passwordHash, isManager: true });
  logger.info({ email }, "Created the configured admin account");
}
