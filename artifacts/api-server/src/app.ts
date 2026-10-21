import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { connectDb } from "@workspace/db";
import { authMiddleware } from "./middlewares/authMiddleware";
import { notFoundHandler, errorHandler } from "./middlewares/error-handler";
import router from "./routes";
import { logger } from "./lib/logger";
import { ensureBootstrapAdmin } from "./lib/bootstrap";

const app: Express = express();

// The app runs behind a single proxy (the Vercel edge) in production, so
// `req.ip` has to be resolved from `X-Forwarded-For` — otherwise every
// request would be attributed to the proxy and the rate limiter would treat
// all users as one client. Trusting a single hop keeps the last entry of the
// header (the real client) while still ignoring anything the client forged.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// The connection is established once per runtime (it is cached) and awaited
// before any route runs.
app.use(async (_req, res, next) => {
  try {
    await connectDb();
    await ensureBootstrapAdmin();
    next();
  } catch (err) {
    logger.error({ err }, "Failed to connect to MongoDB");
    res.status(503).json({ error: "Banco de dados indisponível." });
  }
});

app.use(authMiddleware);

app.use("/api", router);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
