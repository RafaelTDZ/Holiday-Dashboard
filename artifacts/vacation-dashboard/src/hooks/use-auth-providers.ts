import { useListAuthProviders, getListAuthProvidersQueryKey } from "@workspace/api-client-react";

export interface AuthProviders {
  google: boolean;
}

/**
 * Tells the UI which external login providers the API has configured.
 * The Google button stays hidden when the OAuth credentials are missing.
 *
 * The request is made by the generated client (orval), which already applies
 * the base path of the deploy to the API URL.
 */
export function useAuthProviders(): AuthProviders {
  const { data } = useListAuthProviders({
    query: {
      queryKey: getListAuthProvidersQueryKey(),
      staleTime: 5 * 60_000,
      retry: 1,
    },
  });

  return { google: Boolean(data?.google) };
}
