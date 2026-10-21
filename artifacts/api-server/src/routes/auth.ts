import bcrypt from "bcryptjs";
import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { UserModel, PasswordResetTokenModel, SessionModel } from "@workspace/db";
import { createHash, randomBytes } from "node:crypto";
import { sendPasswordResetEmail } from "../lib/email";
import { logger } from "../lib/logger";
import {
  getAllowedEmailDomain,
  getCompanyEmailError,
  isAllowedCompanyEmail,
} from "../lib/email-domain";
import {
  clearSession,
  getSessionId,
  getSession,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth";
import {
  buildGoogleAuthUrl,
  getGoogleRedirectUri,
  isGoogleAuthEnabled,
  verifyGoogleCode,
} from "../lib/google-auth";

const router: IRouter = Router();

/** Cookie used to protect the OAuth round-trip against CSRF. */
const GOOGLE_STATE_COOKIE = "google_oauth_state";
const GOOGLE_STATE_TTL = 10 * 60 * 1000;

function appBaseUrl(req: Request): string {
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? `${req.protocol}://${req.get("host")}`;
  const appBase = process.env.APP_BASE_PATH ?? "";
  return `${base}${appBase}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Hashes a password-reset token (SHA-256) before it is stored in the database.
 * The plain token is only delivered through the e-mail sent to the user, so a
 * leaked database dump does not allow anyone to reset a password.
 */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthUser(user: {
  _id: unknown;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  isManager?: boolean;
}) {
  return {
    id: String(user._id),
    email: user.email ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    profileImageUrl: user.profileImageUrl ?? null,
    isManager: user.isManager ?? false,
  };
}

router.get("/auth/user", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json(GetCurrentAuthUserResponse.parse({ user: null }));
    return;
  }

  const user = await UserModel.findById(req.user!.id).lean();

  if (!user) {
    res.json(GetCurrentAuthUserResponse.parse({ user: null }));
    return;
  }

  res.json(GetCurrentAuthUserResponse.parse({ user: toAuthUser(user) }));
});

router.get("/auth/providers", (_req: Request, res: Response) => {
  res.json({ google: isGoogleAuthEnabled() });
});

router.get("/auth/google", (req: Request, res: Response) => {
  if (!isGoogleAuthEnabled()) {
    res.status(404).json({ error: "Login com Google não configurado." });
    return;
  }

  const state = randomBytes(16).toString("hex");
  res.cookie(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: GOOGLE_STATE_TTL,
  });

  res.redirect(buildGoogleAuthUrl(state));
});

router.get("/auth/google/callback", async (req: Request, res: Response) => {
  const loginUrl = `${appBaseUrl(req)}/login`;
  const redirect = (params: string) => res.redirect(`${loginUrl}?${params}`);

  if (!isGoogleAuthEnabled()) {
    redirect("error=google_indisponivel");
    return;
  }

  const { code, state, error } = req.query as Record<string, string | undefined>;

  if (error) {
    redirect(`error=${encodeURIComponent(error)}`);
    return;
  }
  if (!code || !state) {
    redirect("error=google_invalido");
    return;
  }

  const savedState = req.cookies?.[GOOGLE_STATE_COOKIE];
  res.clearCookie(GOOGLE_STATE_COOKIE, { path: "/" });

  if (!savedState || savedState !== state) {
    redirect("error=google_invalido");
    return;
  }

  let profile;
  try {
    profile = await verifyGoogleCode(code);
  } catch (err) {
    logger.error({ err }, "Google login failed");
    redirect("error=google_falha");
    return;
  }

  if (!isAllowedCompanyEmail(profile.email)) {
    redirect("error=dominio_nao_permitido");
    return;
  }

  // Existing accounts keep their password and manager flag; the Google
  // profile only refreshes the display name and the picture.
  const user = await UserModel.findOneAndUpdate(
    { email: profile.email },
    {
      $set: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        profileImageUrl: profile.profileImageUrl,
      },
      $setOnInsert: { email: profile.email },
    },
    { upsert: true, new: true },
  );

  const sessionData: SessionData = {
    user: toAuthUser(user),
    access_token: "",
    localAuth: false,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(appBaseUrl(req) || "/");
});

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

router.post(
  "/auth/register-local",
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body ?? {};

    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: "E-mail inválido." });
      return;
    }
    if (!isAllowedCompanyEmail(email)) {
      res.status(400).json({ error: getCompanyEmailError() });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await UserModel.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ error: "Este e-mail já está cadastrado." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await UserModel.create({
      email: normalizedEmail,
      passwordHash,
    });

    const sessionData: SessionData = {
      user: toAuthUser(user),
      access_token: "",
      localAuth: true,
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    res.json({ ok: true });
  },
);

router.post(
  "/auth/login-local",
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "E-mail ou senha inválidos." });
      return;
    }

    if (!isAllowedCompanyEmail(email)) {
      res.status(400).json({ error: getCompanyEmailError() });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "E-mail ou senha incorretos." });
      return;
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      res.status(401).json({ error: "E-mail ou senha incorretos." });
      return;
    }

    const sessionData: SessionData = {
      user: toAuthUser(user),
      access_token: "",
      localAuth: true,
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    res.json({ ok: true });
  },
);

router.post(
  "/auth/forgot-password",
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body ?? {};
    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "E-mail é obrigatório." });
      return;
    }

    if (!isAllowedCompanyEmail(email)) {
      res.status(400).json({ error: getCompanyEmailError() });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await UserModel.findOne({ email: normalizedEmail });

    // Always return 200 to avoid leaking which emails are registered
    if (!user || !user.passwordHash) {
      res.json({ ok: true });
      return;
    }

    // Delete any existing token for this user
    await PasswordResetTokenModel.deleteMany({ userId: String(user._id) });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await PasswordResetTokenModel.create({
      token: hashResetToken(token),
      userId: String(user._id),
      expiresAt,
    });

    const baseUrl = process.env.APP_URL ?? `${req.protocol}://${req.get("host")}`;
    const appBase = process.env.APP_BASE_PATH ?? "";
    const resetUrl = `${baseUrl}${appBase}/reset-password?token=${token}`;

    await sendPasswordResetEmail(normalizedEmail, resetUrl);

    res.json({ ok: true });
  },
);

router.post(
  "/auth/reset-password",
  async (req: Request, res: Response): Promise<void> => {
    const { token, password } = req.body ?? {};
    if (!token || !password || typeof token !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Token e nova senha são obrigatórios." });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres." });
      return;
    }

    const tokenHash = hashResetToken(token);

    const record = await PasswordResetTokenModel.findOne({
      token: tokenHash,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      res.status(400).json({ error: "Link de redefinição inválido ou expirado." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await UserModel.updateOne(
      { _id: record.userId },
      { $set: { passwordHash } },
    );
    await PasswordResetTokenModel.deleteOne({ token: tokenHash });

    // The password changed: every existing session of this user is revoked.
    await SessionModel.deleteMany({ "sess.user.id": String(record.userId) });

    res.json({ ok: true });
  },
);

export default router;
