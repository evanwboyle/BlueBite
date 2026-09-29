import type { Request, Response, NextFunction, CookieOptions } from "express";
import jwt from "jsonwebtoken";
import { useSheets, getSheets } from "../services/sheets/runtime";

export const AUTH_COOKIE = "bluebite_auth";
const MAX_AGE_SECONDS = 24 * 60 * 60;
const DEV_SECRET = "bluebite-dev-secret";

export type Role = "customer" | "staff" | "admin";
export interface TokenPayload {
  netId: string;
  role: Role;
}

function secret(): string {
  const value = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET must be set in production");
  return DEV_SECRET;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign({ netId: payload.netId, role: payload.role }, secret(), { algorithm: "HS256", expiresIn: MAX_AGE_SECONDS });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret(), { algorithms: ["HS256"] }) as Partial<TokenPayload>;
    return decoded.netId && decoded.role ? { netId: decoded.netId, role: decoded.role } : null;
  } catch {
    return null;
  }
}

// Lax, not Strict: the cookie is set on the redirect back from Yale CAS, and Strict would drop it
// for the page load that follows that cross-site redirect.
const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions(), maxAge: MAX_AGE_SECONDS * 1000 });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
}

/**
 * Replaces express-session + passport.session(): reads the JWT cookie and sets req.user and
 * req.isAuthenticated(), which is what the role middleware and routes already use. In sheets mode
 * the role is re-read from the Roles tab, so a role change applies without logging in again.
 */
export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[AUTH_COOKIE];
  const payload = token ? verifyToken(token) : null;
  let user: { netId: string; name: string | null; role: Role } | null = null;

  if (payload) {
    user = { netId: payload.netId, name: null, role: payload.role };
    if (useSheets()) {
      const { mirror } = getSheets();
      await mirror.ensureFresh().catch(() => undefined); // a cold instance must not see every admin as a customer
      user.role = mirror.getRole(payload.netId);
    }
  }

  (req as Request & { user?: unknown }).user = user ?? undefined;
  req.isAuthenticated = (() => user !== null) as Request["isAuthenticated"];
  next();
}
