/**
 * Catch-all Vercel Function: handles every `/api/*` path.
 */
const handler = require("../artifacts/api-server/dist/cjs/handler.cjs");

module.exports = handler.default ?? handler;
