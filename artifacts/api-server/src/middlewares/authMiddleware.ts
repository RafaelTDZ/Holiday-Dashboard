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

  req.user = dbUser
    ? { ...session.user, isManager: dbUser.isManager }
    : session.user;

  next();
}
