# Clover Payments

BlueBite sends a "tap to pay" charge request to a Clover terminal for every
order, waits for the customer to complete or cancel it on the device, and
only releases the order to the kitchen once that payment has actually
succeeded. This app never touches, stores, or transmits card data itself -
it only tells a Clover device how much to charge and listens for the
result.

## Architecture

- **`backend/src/services/payments/`** - the `PaymentProvider` abstraction
  (`types.ts`) plus two implementations:
  - `mockProvider.ts` - an in-process simulator. Zero Clover account or
    hardware needed. This is the default.
  - `cloverProvider.ts` - the real integration, built on Clover's official
    [`remote-pay-cloud`](https://www.npmjs.com/package/remote-pay-cloud) SDK
    (Node adapters for its WebSocket transport live in `clover/`).
  - `paymentLogger.ts` - every lifecycle transition is written to the
    `PaymentEvent` table (full audit trail: who requested it, what the
    device said, admin bypasses, etc.) and to the console as `[PAYMENT]` lines.
- **`backend/src/routes/payments.ts`** - `POST/GET /api/orders/:orderId/payment`,
  `.../payment/cancel`, `.../payment/bypass`, `.../payment/simulate`. This is
  also where the async result from a provider (the device's eventual tap
  response) gets applied to the `Payment` and `Order` rows and broadcast over
  SSE (`payment:updated`).
- **`Payment` / `PaymentEvent` models** (`backend/prisma/schema.prisma`) -
  one `Payment` row per order (reused across retries), with a full
  `PaymentEvent` audit trail.
- **`src/components/PaymentModal.tsx`** - shown right after checkout; sends
  the sale request, polls for the result, and lets the customer cancel.

There is **no public webhook**. Clover's Remote Pay Cloud SDK keeps one
persistent, OAuth-authenticated WebSocket connection open to the paired
device; the device's response comes back through that same connection's
listener callbacks, not an inbound HTTP endpoint. That removes an entire
class of attack surface (no endpoint to spoof a "payment succeeded" webhook
against).

## The security model

1. **An order cannot reach the kitchen without a successful payment.**
   `POST /api/orders` now creates the order in `awaiting_payment` status
   (previously `pending`). Only three things move it to `pending`:
   a successful device payment, an admin bypass, or (in mock mode) the
   simulator resolving "succeeded". Everything else lands in `payment_failed`
   or `cancelled`.
2. **The charged amount is never taken from the client.** `POST /api/orders`
   recomputes the order total server-side from the current menu item and
   modifier prices (it used to trust a client-supplied `totalPrice`); the
   payment amount is then read from that persisted `Order.totalPrice`, not
   from any request body.
3. **Idempotency.** Each payment attempt gets a server-generated ID
   (`Payment.id` / `externalPaymentId`) that's handed to the provider as the
   idempotency key, so a retried network call can't double-charge.
4. **Stale/duplicate results can't reopen a finished payment.** Once a
   `Payment` reaches a terminal status (`succeeded`, `failed`, `cancelled`,
   `error`, `expired`, `bypassed`), any later result for that same payment
   (e.g. a delayed device callback arriving after a cancel) is logged as
   `ignored_late_result` and dropped instead of overwriting it.
5. **Rate limiting** (`backend/src/middleware/rateLimit.ts`, built on the
   existing in-house limiter in `middleware/security.ts`): order creation,
   payment initiation, status polling, cancellation, and admin actions each
   have their own window/cap, keyed by IP.
6. **Every transition is logged and audited**: `[PAYMENT]` console lines plus
   permanent `PaymentEvent` rows, including who initiated a request, what the
   device said, and - loudly - every use of the admin bypass.

## Developing without any hardware (default)

Nothing to configure. With `PAYMENT_PROVIDER` unset (or `mock`), placing an
order sends a request to `MockPaymentProvider`, which:

- resolves to **succeeded** after `MOCK_PAYMENT_DELAY_MS` (default 3s) by default,
- or **failed**, if `MOCK_PAYMENT_OUTCOME=fail`,
- or stays in `awaiting_device` indefinitely if `MOCK_PAYMENT_OUTCOME=manual`,
  until you either cancel it from the UI or force an outcome via the debug
  endpoint below.

This is enough to build and test the entire order -> payment -> kitchen flow,
including the cancel button and failure/retry UI, with no Clover account at all.

### Debug endpoint

With `PAYMENTS_DEBUG_MODE=true` and `PAYMENT_PROVIDER=mock`, an admin can
force a pending "manual" mock payment to resolve immediately:

```
POST /api/orders/:orderId/payment/simulate
Body: { "outcome": "succeeded" | "failed" | "cancelled" }
```

This only works against the mock provider - it's a no-op (403) against Clover.

### Admin bypass (works with any provider)

```
POST /api/orders/:orderId/payment/bypass
Body: { "reason": "terminal was down, took cash" }
```

Admin-only, rate-limited, and every call is logged with the admin's NetID and
reason (`PaymentEvent.type = "bypassed"`). Set `PAYMENT_BYPASS_ENABLED=false`
to disable this endpoint entirely (e.g. in a production deployment that
should never release an order without a confirmed device payment).

## Switching to a real Clover device

Set `PAYMENT_PROVIDER=clover` and fill in:

| Var | What it is |
|---|---|
| `CLOVER_MERCHANT_ID` | The Clover merchant ID the device belongs to |
| `CLOVER_DEVICE_ID` | The device's Clover-assigned ID (not its serial number) |
| `CLOVER_ACCESS_TOKEN` | An OAuth access token for a Clover app authorized against that merchant |
| `CLOVER_ENVIRONMENT` | `sandbox` (default) or `production` |

General setup path (verify current exact steps against Clover's own developer
docs, since sandbox/device-simulator offerings do change over time):

1. Create a Clover developer account and a **sandbox merchant** at Clover's
   developer dashboard.
2. Register a Clover app for BlueBite to get OAuth credentials, and go
   through Clover's OAuth flow once to obtain an access token scoped to your
   sandbox merchant (that's `CLOVER_ACCESS_TOKEN`).
3. Get a device onto that merchant in **"Cloud Pay Display"** mode - either a
   real Clover Flex/Mini/Station, or whatever device simulator Clover
   currently offers in its sandbox for testing Remote Pay Cloud without
   hardware (check the Clover developer docs / dashboard for the
   current option, as this has changed across SDK versions).
4. Note that device's `deviceId` (shown in the merchant dashboard, distinct
   from its physical serial number) - that's `CLOVER_DEVICE_ID`.
5. Restart the backend with `PAYMENT_PROVIDER=clover` and the vars above set.
   On the first payment request it opens a persistent connection to the
   device and waits for `onDeviceReady` before sending the sale.

**Important caveat:** `cloverProvider.ts` was built directly against
`remote-pay-cloud`'s shipped type definitions and its own documented Node
usage pattern (it explicitly recommends the `ws` package for non-browser
environments, which is what the `NodeCloverWebSocketImpl` adapter here uses).
It has **not** been exercised against a real device or Clover's sandbox from
this development environment - there was no network path to a paired
terminal available while building it. Before relying on it for real
transactions, run it against a sandbox merchant + real or simulated device
and confirm: `onDeviceReady` fires, a `sale()` request shows up on the
device, a completed tap resolves the order to `pending`, and `resetDevice()`
correctly aborts an in-progress request when the customer cancels.

## Order status flow

```
awaiting_payment ──(payment succeeds / admin bypass)──> pending ──> preparing ──> ready ──> completed
        │
        ├──(payment declined/errors/times out)──> payment_failed  (retry re-enters awaiting_payment)
        └──(customer/staff cancels)──────────────> cancelled
```
