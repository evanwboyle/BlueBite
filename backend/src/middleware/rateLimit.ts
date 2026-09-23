import { Request } from "express";
import { rateLimit } from "./security";

// Keyed by IP (not netId) - a customer hasn't necessarily authenticated when
// placing an order or paying, and the goal here is blunting abuse/spam from
// a given network, same as the order-creation limiter below.
const byIp = (req: Request) => req.ip || req.socket.remoteAddress || "unknown";

/** New order submissions - generous enough for real customer traffic, tight enough to blunt spam. */
export const orderCreateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  maxRequests: 20,
  keyGenerator: byIp,
});

/** Sending a sale request to the device - each order should only need a handful of attempts. */
export const paymentInitiateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  maxRequests: 10,
  keyGenerator: byIp,
});

/** Status polling fallback (SSE is primary) - needs a much higher ceiling. */
export const paymentStatusLimiter = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 120,
  keyGenerator: byIp,
});

export const paymentCancelLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  maxRequests: 20,
  keyGenerator: byIp,
});

/** Admin bypass and debug-simulate are privileged/dev-only actions - keep them tightly capped. */
export const paymentAdminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 30,
  keyGenerator: byIp,
});
