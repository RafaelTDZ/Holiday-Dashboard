/**
 * Vercel Serverless Function entry point.
 *
 * The whole Express API is exposed as a single function so the frontend and
 * the API live under the same domain (`/api/*`), which keeps the session
 * cookie first-party and avoids CORS.
 *
 * The app is imported from the CommonJS bundle (`pnpm --filter
 * @workspace/api-server run build`): the Vercel runtime compiles the function
 * to CommonJS, so it cannot require an ES module.
 */
const handler = require("../artifacts/api-server/dist/cjs/handler.cjs");

module.exports = handler.default ?? handler;
