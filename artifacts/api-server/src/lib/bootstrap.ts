import bcrypt from "bcryptjs";
import { UserModel, seedDemoData } from "@workspace/db";
import { logger } from "./logger";

/**
 * Prepares the database on the first request of a deployment:
 *
 * - creates (or promotes) the manager account configured through the
 *   `ADMIN_EMAIL` / `ADMIN_PASSWORD` environment variables;
 * - optionally seeds the demo dataset (`SEED_DEMO_DATA=true`).
 *
 * Everything is idempotent and runs once per runtime, so it is safe to call on
 * every request.
 */
let bootstrapPromise: Promise<void> | null = null;

export async function ensureBootstrapAdmin(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap().catch((err) => {
      logger.error({ err }, "Failed to bootstrap the database");
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}

async function bootstrap(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (email && password) {
    const existing = await UserModel.findOne({ email });

    if (existing) {
      if (!existing.isManager) {
        await UserModel.updateOne(
          { _id: existing._id },
          { $set: { isManager: true } },
        );
        logger.info({ email }, "Promoted the configured admin account to manager");
      }
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      await UserModel.create({ email, passwordHash, isManager: true });
      logger.info({ email }, "Created the configured admin account");
    }
  }

  if (process.env.SEED_DEMO_DATA === "true") {
    await seedDemoData();
    logger.info("Seeded the demo dataset");
  }
}
