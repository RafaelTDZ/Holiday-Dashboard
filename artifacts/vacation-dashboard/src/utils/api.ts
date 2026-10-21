import { setBaseUrl } from "@workspace/api-client-react";

/**
 * Base path in which the app is published.
 *
 * `import.meta.env.BASE_URL` comes from the Vite `base` option (see
 * `vite.config.ts`): "/" when the app is served from the root of the domain
 * and "/ferias/" when it is published under a subpath. Every request to the
 * API must be prefixed with it, otherwise the app breaks outside the root.
 */
export function getAppBase(): string {
  const raw = import.meta.env.BASE_URL ?? "";
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "/") return "";
  return trimmed.replace(/\/+$/, "");
}

/**
 * Base URL of the API — always inside the app's base path.
 *
 * In development the base path is empty, so this returns "/api" and the
 * requests are proxied by the Vite dev server to the API server.
 */
export function getApiBase(): string {
  return `${getAppBase()}/api`;
}

/**
 * Absolute URL of an API route, respecting the app's base path.
 *
 * `apiUrl("/employees")` → "/api/employees" (or "/ferias/api/employees").
 */
export function apiUrl(path: string): string {
  return `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Points the generated HTTP client (orval) to the right base path.
 *
 * The generated client builds relative URLs ("/api/...") and relies on
 * `setBaseUrl()` to prefix them, so this must run before the first request.
 */
export function configureApiClient(): void {
  setBaseUrl(getAppBase() || null);
}

// Applied as soon as this module is loaded: every consumer of the generated
// client (queries and mutations) then hits the right URL, even when the app
// is published under a subpath.
configureApiClient();

/**
 * Reads a user-facing message out of an error returned by the API.
 *
 * The generated client throws an `ApiError` whose `data` holds the parsed
 * body (`{ error: "..." }`); the helpers below accept that shape as well as
 * a plain `Error`.
 */
export function getApiErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  const err = error as { data?: unknown; message?: unknown; status?: unknown };

  // A network failure never reached the API: there is no API message to show.
  if (isNetworkError(error)) return null;

  const fromData = extractErrorMessage(err.data);
  if (fromData) return fromData;

  // Errors raised by the HTTP layer carry a status; anything else has no
  // message worth showing.
  if (typeof err.status === "number") return null;

  if (typeof err.message === "string" && err.message.trim() !== "") {
    return err.message;
  }

  return null;
}

/**
 * Tells whether the error was caused by the network (the request never
 * reached the API) instead of by an API response.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { status?: unknown; name?: unknown };
  if (typeof err.status === "number") return false;
  return err.name === "TypeError" || err.name === "AbortError";
}

function extractErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  for (const key of ["error", "message", "detail", "title"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }

  return null;
}
