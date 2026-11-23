import type { Request, Response, NextFunction } from "express";
import { Session, User } from "./models.js";
import { hash, token, HttpError } from "./utils.js";
import { config } from "./config.js";
declare global {
  namespace Express {
    interface Request {
      user?: any;
      sessionHash?: string;
    }
  }
}
export const cookieOptions = {
  httpOnly: true,
  secure: config.production,
  sameSite: config.sameSite,
  path: "/",
} as const;
export async function userFromCookie(raw?: string) {
  if (!raw) return null;
  const session = await Session.findOne({
    tokenHash: hash(raw),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;
  return User.findOne({ _id: session.userId, suspended: false });
}
export async function sessionMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    req.user = await userFromCookie(req.cookies?.quizora_session);
    req.sessionHash = req.cookies?.quizora_session
      ? hash(req.cookies.quizora_session)
      : undefined;
    next();
  } catch (e) {
    next(e);
  }
}
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Sign in to continue."));
  if (config.verify && !req.user.emailVerified)
    return next(new HttpError(403, "Verify your email before continuing."));
  next();
}
export function allow(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) =>
    requireAuth(req, res, (error?: unknown) => {
      if (error) return next(error);
      if (!roles.includes(req.user.role))
        return next(
          new HttpError(403, "You do not have permission for this action."),
        );
      next();
    });
}
export async function createSession(userId: string, res: Response) {
  const raw = token();
  await Session.create({
    tokenHash: hash(raw),
    userId,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  res.cookie("quizora_session", raw, {
    ...cookieOptions,
    maxAge: 7 * 86400000,
  });
}
