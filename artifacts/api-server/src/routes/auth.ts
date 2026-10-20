import bcrypt from "bcryptjs";
import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { UserModel, PasswordResetTokenModel } from "@workspace/db";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "../lib/email";
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

const router: IRouter = Router();

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
      token,
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

    const record = await PasswordResetTokenModel.findOne({
      token,
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
    await PasswordResetTokenModel.deleteOne({ token });

    res.json({ ok: true });
  },
);

export default router;
