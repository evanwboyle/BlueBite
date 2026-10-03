# Deploying on Vercel (serverless)

Frontend = static Vite build. API = one Express function (`api/index.ts` -> `backend/dist/index.js`), same origin.

## Moving parts
- **Auth**: stateless JWT in an HttpOnly `bluebite_auth` cookie (`backend/src/auth/jwt.ts`). CAS login sets it. Roles come from the sheet's Roles tab on every request.
- **Sheet mirror**: with `UPSTASH_REDIS_REST_URL/TOKEN` set, all instances share one snapshot in Redis (fresh for 4s, one instance refreshes under a lock). No poll timer. The Apps Script webhook refreshes immediately.
- **Payments**: attempts live in Redis (`services/payments/paymentStore.ts`). `PAYMENT_PROVIDER=clover-rest` holds one HTTPS request open (55s) per tap, hence `maxDuration: 60` in `vercel.json`.
- **Realtime**: Ably. Events are flushed before each response ends (`flushRealtime`). Build the frontend with `VITE_REALTIME=ably`.

## Env vars
Backend: `STORE=sheets`, `GOOGLE_SHEETS_*`, `SHEETS_ADMIN_EMAILS`, `SHEETS_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ABLY_API_KEY`, `JWT_SECRET`, `SERVER_BASE_URL` (the Vercel URL, used for CAS), `PAYMENT_PROVIDER`, and for Clover `CLOVER_ACCESS_TOKEN`, `CLOVER_DEVICE_SERIAL`, `CLOVER_ENVIRONMENT`, `CLOVER_POS_ID`.
Frontend (build time): `VITE_REALTIME=ably`, optional `VITE_API_URL` (defaults to `/api` in production builds), `VITE_YALIES_KEY`.
Not needed: `DATABASE_URL`, `DIRECT_URL`, Supabase vars.

## Limits
- Rate limiters are per instance (in memory), so limits are looser than configured under load.
- `/api/events` (SSE) cannot work on serverless; use Ably.
- Vercel Hobby may cap function duration below 60s. Check the plan before relying on tap-to-pay.
- The Clover REST provider has not run against a real device (see CLOVER_PAYMENTS.md).

## Login
- **Sign in with Google** (`backend/src/auth/google.ts`): the browser posts a Google ID token to `POST /api/auth/google`. The server verifies signature/audience, requires a verified email whose `hd` claim and address are in `GOOGLE_ALLOWED_DOMAIN` (default `yale.edu`), and issues the same JWT cookie. The identity key ("netId") is the email local part (`first.last`). Staff/admin roles match on the Roles tab's **Google Email** column (or NetID column).
- **CAS** only validates `localhost` on Yale's test server; production needs a service registered with Yale IAM and `CAS_BASE_URL=https://secure.its.yale.edu/cas`. With `VITE_GOOGLE_CLIENT_ID` set the CAS button is hidden unless `VITE_ENABLE_CAS=true`.
- Google setup: Google Cloud Console > APIs & Services > Credentials > OAuth client ID (Web). Authorised JavaScript origins: the production URL and `http://localhost:5173`. No redirect URI is needed.
- Orders placed under Google identities are keyed by email local part, so they will not merge with CAS NetIDs later.
