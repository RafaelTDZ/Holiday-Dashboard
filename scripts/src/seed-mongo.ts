/**
 * Seeds the demo dataset used by the Dashboard de Férias.
 *
 * Usage:
 *   MONGODB_URI="mongodb://..." pnpm --filter @workspace/scripts run seed:mongo
 */
import { connectDb, disconnectDb, seedDemoData } from "@workspace/db";

const password = process.env.SEED_PASSWORD;

async function main() {
  await connectDb();
  await seedDemoData(password ? { password } : {});
  console.log("Seed finished.");
  if (password) {
    console.log(`Password used for the demo accounts: ${password}`);
  }
}

main()
  .then(async () => {
    await disconnectDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await disconnectDb();
    process.exit(1);
  });
