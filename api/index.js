/**
 * Vercel Serverless Function entry point.
 *
 * The whole Express API is exposed as a single function so the frontend and
 * the API live under the same domain (`/api/*`), which keeps the session
 * cookie first-party and avoids CORS.
 *
 * The app is imported from the esbuild bundle (`pnpm --filter
 * @workspace/api-server run build`) so Vercel does not have to compile the
 * TypeScript sources of the workspace packages.
 */
import handler from "../artifacts/api-server/dist/handler.mjs";

export default handler;
