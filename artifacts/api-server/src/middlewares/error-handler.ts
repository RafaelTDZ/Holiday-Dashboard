import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

const ROUTE_NOT_FOUND_MESSAGE = "Rota não encontrada.";
const INVALID_BODY_MESSAGE = "Corpo da requisição inválido.";
const INTERNAL_ERROR_MESSAGE = "Erro interno do servidor.";

type ErrorLike = Record<string, unknown>;

function toErrorLike(err: unknown): ErrorLike | null {
  return typeof err === "object" && err !== null ? (err as ErrorLike) : null;
}

/**
 * body-parser (used by express.json/express.urlencoded) reports a malformed
 * payload with a SyntaxError carrying `status: 400` and the raw `body`.
 */
function isMalformedBodyError(err: unknown): boolean {
  if (!(err instanceof SyntaxError)) {
    return false;
  }

  const error = toErrorLike(err);
  if (!error) {
    return false;
  }

  return error.status === 400 && error.body !== undefined;
}

/**
 * Keeps an explicit status already present on the error (400-599); anything
 * else falls back to 500.
 */
function resolveStatus(err: unknown): number {
  const error = toErrorLike(err);
  if (!error) {
    return 500;
  }

  const candidates = [error.status, error.statusCode];
  for (const candidate of candidates) {
    if (
      typeof candidate === "number" &&
      Number.isInteger(candidate) &&
      candidate >= 400 &&
      candidate <= 599
    ) {
      return candidate;
    }
  }

  return 500;
}

function resolveStack(err: unknown): string | undefined {
  if (err instanceof Error && typeof err.stack === "string") {
    return err.stack;
  }
  return undefined;
}

/**
 * Runs after the router: every request that did not match a route ends here
 * and receives a JSON body instead of the default Express HTML page.
 */
export function notFoundHandler(
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  res.status(404).json({ error: ROUTE_NOT_FOUND_MESSAGE });
}

/**
 * Express 5 error middleware: it must declare the four parameters
 * (err, req, res, next) so Express treats it as an error handler.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  logger.error({ err }, "Unhandled error while processing request");

  // The response already started: delegating to Express is the only safe move,
  // otherwise we would try to write headers twice.
  if (res.headersSent) {
    next(err);
    return;
  }

  const malformedBody = isMalformedBodyError(err);
  const status = malformedBody ? 400 : resolveStatus(err);
  const message = malformedBody ? INVALID_BODY_MESSAGE : INTERNAL_ERROR_MESSAGE;

  const payload: { error: string; details?: string } = { error: message };

  // The stack trace is helpful locally but must never leak to clients.
  if (process.env.NODE_ENV !== "production") {
    const details = resolveStack(err);
    if (details) {
      payload.details = details;
    }
  }

  res.status(status).json(payload);
}
