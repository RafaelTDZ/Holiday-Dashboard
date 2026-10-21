import bcrypt from "bcryptjs";
import { UserModel, seedDemoData, syncModelIndexes } from "@workspace/db";
import { logger } from "./logger";

/**
 * Prepares the database on the first request of a deployment:
 *
 * - creates (or promotes) the manager account configured through the
 *   `ADMIN_EMAIL` / `ADMIN_PASSWORD` environment variables. This part always
 *   runs, in every environment (including production), because the manager
 *   account is required to operate the app. It is idempotent: an existing
 *   account is only promoted to manager, never recreated or overwritten;
 * - optionally seeds the demo dataset (fake accounts with a known password,
 *   sample vacations, sales and notifications), which is **never** allowed in
 *   production.
 *
 * Demo seed rules (double opt-in):
 * - `SEED_DEMO_DATA=true` asks for the demo dataset to be created;
 * - `ALLOW_DEMO_SEED=true` is the second, explicit opt-in required to
 *   actually run it;
 * - the seed is additionally blocked in production-like environments, that is,
 *   when `VERCEL_ENV === "production"` or when `NODE_ENV === "production"`
 *   outside of a Vercel preview deployment.
 *
 * The demo seed therefore only runs when `SEED_DEMO_DATA=true` **and**
 * `ALLOW_DEMO_SEED=true` **and** the environment is not production. When it
 * was requested but blocked, a warning is logged and the bootstrap continues
 * (it never throws because of the demo seed).
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

/**
 * Production-like environments: the demo seed must never run there, because
 * it creates accounts with a well-known password.
 *
 * Vercel sets `NODE_ENV=production` on production *and* preview builds, so the
 * `VERCEL_ENV` check comes first: a preview deployment may seed the demo
 * dataset when it explicitly opts in, while production never can.
 */
function isProductionEnvironment(): boolean {
  if (process.env.VERCEL_ENV === "production") return true;
  if (process.env.VERCEL_ENV === "preview") return false;
  return process.env.NODE_ENV === "production";
}

async function bootstrap(): Promise<void> {
  // The TTL indexes of the sessions and of the password reset tokens depend on
  // the schema definition: an old non-TTL index over the same key pattern
  // makes MongoDB refuse to create the TTL one, so the indexes are synced here
  // (once per runtime) before anything else touches those collections.
  try {
    await syncModelIndexes();
  } catch (err) {
    logger.error({ err }, "Failed to sync the database indexes");
  }

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

  if (process.env.SEED_DEMO_DATA !== "true") {
    return;
  }

  const production = isProductionEnvironment();
  const allowed = process.env.ALLOW_DEMO_SEED === "true";

  if (production || !allowed) {
    logger.warn(
      {
        seedDemoData: true,
        allowDemoSeed: allowed,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        reason: production
          ? "production-environment"
          : "missing-ALLOW_DEMO_SEED-opt-in",
      },
      "Skipped the demo seed: it only runs outside production and requires both SEED_DEMO_DATA=true and ALLOW_DEMO_SEED=true",
    );
    return;
  }

  await seedDemoData();
  logger.info("Seeded the demo dataset");
}
