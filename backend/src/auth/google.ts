import express, { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { authLoginLimiter } from "../middleware/rateLimit";
import { setAuthCookie, signToken, type Role } from "./jwt";

/**
 * Sign in with Google (Google Identity Services): the browser gets a signed ID token from Google and
 * posts it here. We verify signature, audience and expiry, require a verified email in the allowed
 * Google Workspace domain (Yale's), and issue the same JWT cookie CAS does. Until Yale registers the
 * app with CAS this is how people log in.
 */

export interface GoogleClaims {
  email?: string;
  email_verified?: boolean;
  hd?: string;
}

export type GoogleVerifier = (credential: string) => Promise<GoogleClaims>;

export function googleClientId(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.GOOGLE_CLIENT_ID || undefined;
}

export function createGoogleVerifier(clientId: string): GoogleVerifier {
  const client = new OAuth2Client(clientId);
  return async (credential) => {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    return ticket.getPayload() ?? {};
  };
}

export interface GoogleIdentity {
  email: string;
  /** Local part of the email: the stable id orders and roles are keyed by, in place of a CAS NetID. */
  netId: string;
}

/** null unless Google vouches for a verified email in the allowed domain (both the `hd` claim and the address). */
export function identityFromClaims(claims: GoogleClaims, allowedDomain: string): GoogleIdentity | null {
  const domain = allowedDomain.toLowerCase();
  const email = claims.email?.toLowerCase();
  if (!email || claims.email_verified !== true) return null;
  if (claims.hd?.toLowerCase() !== domain || !email.endsWith(`@${domain}`)) return null;
  const netId = email.slice(0, email.length - domain.length - 1);
  return netId ? { email, netId } : null;
}

interface Deps {
  verify?: GoogleVerifier;
  allowedDomain?: string;
  /** Role for this person (from the Roles tab, or the user table). */
  resolveRole: (identity: GoogleIdentity) => Promise<Role> | Role;
}

export function createGoogleAuthRouter({ verify, allowedDomain, resolveRole }: Deps) {
  const router = express.Router();

  router.post("/api/auth/google", authLoginLimiter, async (req: Request, res: Response) => {
    const clientId = googleClientId();
    const verifier = verify ?? (clientId ? createGoogleVerifier(clientId) : null);
    if (!verifier) {
      res.status(404).json({ error: "Not found" }); // not configured: look like no such route
      return;
    }
    const credential = req.body?.credential;
    if (typeof credential !== "string" || credential.length === 0 || credential.length > 4096) {
      res.status(400).json({ error: "Missing credential" });
      return;
    }

    try {
      const claims = await verifier(credential);
      const identity = identityFromClaims(claims, allowedDomain ?? process.env.GOOGLE_ALLOWED_DOMAIN ?? "yale.edu");
      if (!identity) {
        res.status(403).json({ error: "Sign in with your Yale Google account", code: "DOMAIN_NOT_ALLOWED" });
        return;
      }
      const role = await resolveRole(identity);
      setAuthCookie(res, signToken({ netId: identity.netId, role, email: identity.email }));
      res.json({ netId: identity.netId, role });
    } catch (error) {
      console.warn("[AUTH] Google sign-in rejected:", error instanceof Error ? error.message : error);
      res.status(401).json({ error: "Invalid Google credential" });
    }
  });

  return router;
}
