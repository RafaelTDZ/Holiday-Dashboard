/**
 * Vercel Serverless Function entry point.
 *
 * The whole Express API is exposed as a single function so the frontend and
 * the API live under the same domain (`/api/*`), which keeps the session
 * cookie first-party and avoids CORS.
 */
import app from "../artifacts/api-server/src/app";

export default app;
