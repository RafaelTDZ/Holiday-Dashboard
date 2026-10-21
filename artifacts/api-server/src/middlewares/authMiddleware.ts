import { type Request, type Response, type NextFunction } from "express";
import { mongoose } from "@workspace/db";
import { UserModel } from "@workspace/db";
import type { AuthUser } from "../types/auth";
import { clearSession, getSessionId, getSession } from "../lib/auth";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

/**
 * Decides whether a session must be invalidated.
 *
 * A session is only valid while its user still exists in the database.
 * `hasUser` is false when the id stored in the session is not a valid
 * ObjectId or when no user document matches it (e.g. the user was deleted).
 */
export function shouldInvalidateSession(opts: { hasUser: boolean }): boolean {
  return !opts.hasUser;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  // The manager flag is always read fresh from the database so a role change
  // takes effect on the next request (no stale session data).
  const dbUser = mongoose.isValidObjectId(session.user.id)
    ? await UserModel.findById(session.user.id).select("isManager").lean()
    : null;

  // A session is only valid while its user still exists in the database.
  // When the user was deleted (or the stored id is not a valid ObjectId) the
  // session must be dropped instead of authenticating the request: the
  // session document is removed, the cookie is cleared and `req.user` stays
  // unset, so protected routes answer 401.
  if (shouldInvalidateSession({ hasUser: dbUser != null })) {
    await clearSession(res, sid);
    next();
    return;
  }

  req.user = { ...session.user, isManager: dbUser!.isManager };

  next();
}
