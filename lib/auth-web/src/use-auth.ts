import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

/**
 * Removes the trailing slashes and the root ("/") from a base path.
 */
function normalizeBase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";
  return trimmed.replace(/\/+$/, "");
}

/**
 * Base path in which the app is published ("" for the root of the domain,
 * "/ferias" when published under a subpath).
 *
 * `import.meta.env.BASE_URL` is injected by Vite (the `base` option of
 * `vite.config.ts`) and is the source of truth. The `document.baseURI` is
 * only used as a fallback, for environments where the bundler does not
 * inject the env.
 */
function readAppBase(): string {
  const env = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env;
  const base = env?.BASE_URL;
  if (typeof base === "string" && base.trim() !== "") {
    return normalizeBase(base);
  }

  if (typeof document !== "undefined" && document.baseURI) {
    try {
      return normalizeBase(new URL(document.baseURI).pathname);
    } catch {
      // Ignore: the app simply runs without a base path.
    }
  }

  return "";
}

/**
 * Base URL of the API — always inside the app's base path, so the session
 * cookie is sent to the right place when the app lives under a subpath.
 */
function getApiBase(): string {
  return `${readAppBase()}/api`;
}

/**
 * Reads the current session from the API. The session lives in a httpOnly
 * cookie, so there is nothing to store on the client.
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`${getApiBase()}/auth/user`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(() => {
    const appBase = readAppBase();

    // `GET /api/logout` is deprecated: the session is closed with a POST and
    // the browser is redirected by the app itself.
    fetch(`${getApiBase()}/logout`, { method: "POST", credentials: "include" })
      .catch(() => {})
      .finally(() => {
        window.location.href = appBase ? `${appBase}/` : "/";
      });
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };
}
