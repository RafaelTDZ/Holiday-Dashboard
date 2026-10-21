import { OAuth2Client } from "google-auth-library";
import { getAllowedEmailDomain } from "./email-domain";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();

/**
 * Workspace domain used to pre-select the corporate account on the Google
 * consent screen. The `hd` parameter is only a hint — the e-mail domain is
 * still verified server-side before the session is created.
 */
function getWorkspaceDomain(): string | undefined {
  const explicit = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim()
    .replace(/^@/, "")
    .toLowerCase();
  if (explicit) return explicit;
  return getAllowedEmailDomain() ?? undefined;
}

export function isGoogleAuthEnabled(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export function getGoogleClient(): OAuth2Client {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      "Google login is not configured (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)",
    );
  }
  return new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
}

/**
 * Redirect URI configured in the Google Cloud Console. It defaults to the
 * public app URL so the same value works on production and preview builds.
 */
export function getGoogleRedirectUri(): string {
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const path = "/api/auth/google/callback";
  if (!base) return path;
  return `${base}${path}`;
}

export function buildGoogleAuthUrl(state: string): string {
  const client = getGoogleClient();
  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });

  const domain = getWorkspaceDomain();
  if (domain) params.set("hd", domain);

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleProfile {
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export async function verifyGoogleCode(code: string): Promise<GoogleProfile> {
  const client = getGoogleClient();
  const { tokens } = await client.getToken({
    code,
    redirect_uri: getGoogleRedirectUri(),
  });

  if (!tokens.id_token) {
    throw new Error("Google did not return an id_token");
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload?.email) {
    throw new Error("Google did not return an e-mail");
  }
  if (!payload.email_verified) {
    throw new Error("The Google account e-mail is not verified");
  }

  const [firstName, ...rest] = (payload.name ?? "").split(" ").filter(Boolean);

  return {
    email: payload.email.toLowerCase(),
    firstName: firstName ?? null,
    lastName: rest.length ? rest.join(" ") : null,
    profileImageUrl: payload.picture ?? null,
  };
}
