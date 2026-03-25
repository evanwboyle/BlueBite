# Vercel Serverless Deployment with JWT Auth

**Date:** 2026-03-25
**Status:** Approved

## Overview

Deploy BlueBite as a monorepo on Vercel: Vite frontend as static assets on CDN, Express backend as a single serverless function. Replace express-session with stateless JWT auth (HttpOnly cookies). Same-origin deployment eliminates CORS.

## Architecture

```
Vercel CDN (static)          Vercel Serverless Function
+-----------------+          +-------------------------+
| Vite build      |  /api/*  | Express app             |
| (React 19 SPA)  |--------->| Prisma -> Supabase PG   |
| src/ -> dist/   |          | JWT auth (cookie-based)  |
+-----------------+          | Google Sheets sync       |
                             +-------------------------+
```

Frontend and API share the same Vercel domain. No CORS needed.

## Project Structure Changes

```
BlueBite/
├── api/
│   └── index.ts              # NEW: Vercel serverless entry point
├── vercel.json               # NEW: Build + routing config
├── backend/
│   └── src/
│       ├── app.ts            # NEW: Express app factory (no listen)
│       ├── index.ts          # Modified: imports app, calls listen() for local dev
│       ├── auth/
│       │   ├── cas.ts        # Modified: CAS verify -> issue JWT cookie -> redirect
│       │   └── jwt.ts        # NEW: sign/verify/cookie helpers
│       └── middleware/
│           └── auth.ts       # Modified: verify JWT from cookie, not session
```

## Auth: Session to JWT Migration

### New file: `backend/src/auth/jwt.ts`

Responsibilities:
- `signToken({ netId, role })` - signs with HS256, 24h expiry, `JWT_SECRET` env var
- `verifyToken(token)` - verifies signature + expiry, returns payload
- `setAuthCookie(res, token)` - sets cookie: `HttpOnly`, `Secure` (prod), `SameSite=Strict`, `Path=/`, 24h maxAge
- `clearAuthCookie(res)` - clears the auth cookie

Cookie name: `bluebite_auth`

### Modified: `backend/src/auth/cas.ts`

- Remove Passport serialize/deserialize (no sessions)
- CAS callback flow:
  1. Passport CAS strategy validates ticket with Yale CAS server
  2. Upsert user in database (existing logic)
  3. Sign JWT with `{ netId, role }`
  4. Set JWT as HttpOnly cookie via `setAuthCookie()`
  5. Redirect to frontend URL

### Modified: `backend/src/middleware/auth.ts`

- `requireAuth`: extract JWT from `bluebite_auth` cookie -> `verifyToken()` -> set `req.user = { netId, role }`
- `requireStaff` / `requireAdmin`: unchanged logic, reads `req.user.role`

### Modified: `backend/src/index.ts` (becomes `app.ts` + `index.ts`)

Removals:
- `express-session` middleware
- `passport.initialize()` / `passport.session()`

Additions:
- `cookie-parser` middleware (needed to parse JWT cookie in `requireAuth`)

The Express app creation moves to `app.ts` (exports `app`). The existing `index.ts` imports it and calls `app.listen()` for local development only.

### Auth endpoints after migration

- `GET /api/auth/login` - initiates CAS, callback sets JWT cookie, redirects to frontend
- `POST /api/auth/logout` - clears JWT cookie
- `GET /api/auth/user` - verifies JWT, returns `{ netId, role }` from token (no DB hit needed)

## Vercel Configuration

### `vercel.json`

```json
{
  "buildCommand": "npm run build && cd backend && npm install && npx prisma generate && npm run build",
  "outputDirectory": "dist",
  "functions": {
    "api/index.ts": {
      "maxDuration": 30,
      "includeFiles": "backend/dist/**,backend/node_modules/.prisma/**,backend/prisma/**"
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" }
  ]
}
```

**Build flow:**
1. `npm run build` compiles the Vite frontend to `dist/` (Vercel serves this as static)
2. `cd backend && npm install && npx prisma generate && npm run build` compiles backend TypeScript to `backend/dist/`
3. Vercel automatically bundles `api/index.ts` as a serverless function (separate from the static output)
4. The `rewrites` rule sends all `/api/*` requests to the serverless function; everything else serves static files from `dist/`

Note: Vercel treats `outputDirectory` for static assets and `functions` for serverless independently. There is no conflict between `dist/` (frontend) and `backend/dist/` (backend compiled output referenced by the function).

### `api/index.ts` (Vercel entry point)

The backend uses CommonJS (`"module": "commonjs"` in `backend/tsconfig.json`). The `api/index.ts` file is compiled by Vercel's own bundler (which handles mixed module formats), so standard ESM import syntax works here -- Vercel's bundler resolves the CommonJS export.

```typescript
import app from '../backend/dist/app';
export default app;
```

**Important:** This imports from the compiled `backend/dist/app.js`, not from `backend/src/app.ts`. The backend must be built before the function can resolve the import. The `buildCommand` ensures this ordering.

This file is the Vercel serverless function. Vercel wraps the Express app in its Node.js runtime.

## Prisma Changes

In `backend/prisma/schema.prisma`, add binary target for Vercel's runtime:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}
```

No schema or model changes needed.

## Frontend Changes

### `src/utils/config.ts`

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
```

Default changes from `http://localhost:3000/api` to `/api` (relative, same-origin).

### `src/utils/api.ts`

Ensure all `fetch()` calls include `credentials: 'include'` so the browser sends the HttpOnly JWT cookie.

## Environment Variables (Vercel Dashboard)

### Required
- `JWT_SECRET` - secret for signing JWTs (new, generate a strong random string)
- `DATABASE_URL` - Supabase Postgres pooled connection string
- `DIRECT_URL` - Supabase Postgres direct connection string

### Required for image uploads
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - service role key

### Required for frontend (VITE_ prefix)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

### Optional
- `VITE_API_URL` - override API base URL (default: `/api`)
- `VITE_YALIES_KEY` - Yalies API key
- `SERVER_BASE_URL` - Vercel deployment URL (for CAS callback)
- `CORS_ORIGIN` - frontend URL (not needed in monorepo, but kept for local dev)
- `NODE_ENV` - set to `production` by Vercel automatically
- Google Sheets credentials (`GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`)

## Security

- JWT signed with HS256 + server-only `JWT_SECRET`
- Cookie: `HttpOnly` (no JS access), `Secure` (HTTPS only in prod), `SameSite=Strict` (no CSRF)
- 24-hour token expiry matches current session maxAge
- Same-origin eliminates CORS attack surface
- No token in localStorage or URL parameters

## What Does NOT Change

- All Prisma models and database schema
- All API route handler logic (only middleware layer changes)
- Google Sheets integration
- Supabase Realtime subscriptions (frontend)
- Frontend components (except fetch credentials config)
- Multer file upload handling
- Image upload to Supabase Storage

## Dependencies

### Add
- `jsonwebtoken` + `@types/jsonwebtoken` (backend)
- `cookie-parser` + `@types/cookie-parser` (backend) - needed to parse `bluebite_auth` cookie in middleware

### Remove
- `express-session` + `@types/express-session` (backend)
- Passport serialize/deserialize logic (code removal, not a dep removal -- Passport itself stays for CAS)

## Local Development

Local dev continues to work by running frontend and backend separately:
- `npm run dev` (Vite on :5173)
- `cd backend && npm run dev` (Express on :3000, calls `app.listen()`)
- `VITE_API_URL=http://localhost:3000/api` for local frontend -> backend

The `app.listen()` call is conditional: only runs when not in Vercel's serverless environment.
