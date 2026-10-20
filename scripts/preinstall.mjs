/**
 * Pre-install guard.
 *
 * - removes the lockfiles of the other package managers (the project only
 *   supports pnpm);
 * - fails the install when it is not running with pnpm.
 *
 * Written in Node so it works the same on Windows, macOS and Linux (the
 * previous version relied on `sh`).
 */
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  const target = path.join(root, lockfile);
  try {
    rmSync(target, { force: true });
  } catch {
    // nothing to remove
  }
}

const userAgent = process.env.npm_config_user_agent ?? "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead (run: corepack enable && pnpm install)");
  process.exit(1);
}
