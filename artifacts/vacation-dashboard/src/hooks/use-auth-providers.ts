import { useEffect, useState } from "react";
import { getApiBase } from "@/utils/api";

export interface AuthProviders {
  google: boolean;
}

/**
 * Tells the UI which external login providers the API has configured.
 * The Google button stays hidden when the OAuth credentials are missing.
 */
export function useAuthProviders(): AuthProviders {
  const [providers, setProviders] = useState<AuthProviders>({ google: false });

  useEffect(() => {
    let cancelled = false;

    fetch(`${getApiBase()}/auth/providers`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { google: false }))
      .then((data) => {
        if (!cancelled) setProviders({ google: Boolean(data?.google) });
      })
      .catch(() => {
        if (!cancelled) setProviders({ google: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return providers;
}
