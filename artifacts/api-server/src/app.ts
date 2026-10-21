import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { connectDb } from "@workspace/db";
import { authMiddleware } from "./middlewares/authMiddleware";
import { notFoundHandler, errorHandler } from "./middlewares/error-handler";
import router from "./routes";
import { logger } from "./lib/logger";
import { ensureBootstrapAdmin } from "./lib/bootstrap";

const app: Express = express();

/**
 * Origens liberadas por padrão quando `CORS_ORIGINS` não é configurado: o
 * servidor do Vite em desenvolvimento (porta `20421` do `.env.example` e a
 * porta padrão `3000`) acessado por `localhost`/`127.0.0.1`.
 */
const DEV_ORIGINS = [
  "http://localhost:20421",
  "http://127.0.0.1:20421",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/** Remove entradas repetidas preservando a ordem da lista. */
function uniqueOrigins(origins: string[]): string[] {
  return [...new Set(origins)];
}

/**
 * Resolve a allowlist de origens do CORS (SEC-06).
 *
 * A função é **pura**: ela só lê o `env` recebido e devolve a lista de
 * origens permitidas, sem tocar em banco, logger ou resposta HTTP. Isso a
 * torna testável isoladamente.
 *
 * Regras:
 * - `CORS_ORIGINS` separa as origens por vírgula (espaços são ignorados);
 * - `CORS_ORIGINS="*"` devolve `["*"]` (escape hatch de desenvolvimento);
 * - entradas vazias são descartadas e a lista não tem repetidas;
 * - sem `CORS_ORIGINS` (ausente, vazio ou só com vírgulas) usa `APP_URL`
 *   (quando definido) somado às origens de desenvolvimento.
 */
export function getAllowedOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const configured = env.CORS_ORIGINS?.trim();

  // Escape hatch de desenvolvimento: libera qualquer origem.
  if (configured === "*") {
    return ["*"];
  }

  const origins = (configured ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin.length > 0);

  // `CORS_ORIGINS` ausente (ou vazio) → `APP_URL` + origens de desenvolvimento.
  if (origins.length === 0) {
    const appUrl = env.APP_URL?.trim().replace(/\/+$/, "");
    return uniqueOrigins(appUrl ? [appUrl, ...DEV_ORIGINS] : [...DEV_ORIGINS]);
  }

  return uniqueOrigins(origins);
}

/**
 * CORS com allowlist (SEC-06).
 *
 * A origem pedida só é liberada quando está na allowlist; caso contrário
 * nenhum header `Access-Control-Allow-Origin` é enviado e o browser bloqueia
 * a requisição. `credentials: true` continua ativo porque o cookie de sessão
 * (`sid`) precisa ser enviado nas requisições autenticadas.
 */
const corsOptions: CorsOptions = {
  credentials: true,
  origin: (requestOrigin, callback) => {
    // Requisição sem o header `Origin` (mesma origem): nada a fazer.
    if (!requestOrigin) {
      callback(null, false);
      return;
    }

    const allowed = getAllowedOrigins();

    // Com o escape hatch `*` a origem pedida é refletida: o browser recusa
    // `Access-Control-Allow-Origin: *` em requisições com credenciais.
    if (allowed.includes("*") || allowed.includes(requestOrigin)) {
      callback(null, true);
      return;
    }

    // Origem desconhecida: nenhum header de CORS é enviado.
    callback(null, false);
  },
};

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
app.use(cors(corsOptions));
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
