/**
 * Vercel Serverless Function entry point.
 *
 * The whole Express API is exposed as a single function mounted at `/api`, so
 * the frontend and the API live under the same domain: the session cookie
 * stays first-party and no CORS is needed.
 *
 * The app is imported from the CommonJS bundle (`pnpm --filter
 * @workspace/api-server run build`): the Vercel runtime compiles the function
 * to CommonJS, so it cannot require an ES module.
 */
const handler = require("../artifacts/api-server/dist/cjs/handler.cjs");
const app = handler.default ?? handler;

module.exports = (req, res) => {
  // The Express app mounts its routes under `/api`. Depending on how the
  // request reaches the function the prefix can be missing, so we normalize it.
  if (!req.url.startsWith("/api")) {
    req.url = `/api${req.url === "/" ? "" : req.url}`;
  }
  return app(req, res);
};
