import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

/**
 * Audit log entry interface
 */
interface AuditLogEntry {
  timestamp: Date;
  netId: string;
  role: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  changes?: Record<string, unknown>;
  success: boolean;
  statusCode?: number;
}

/**
 * In-memory audit log storage (replace with database in production)
 * For production: write to database, external logging service, or file
 */
const auditLog: AuditLogEntry[] = [];

/**
 * Audit logging middleware
 * Logs all authenticated actions for security and compliance
 */
export const auditLogger = (action: string, resource: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    const startTime = Date.now();

    // Capture original res.json to intercept response
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown): Response {
      const entry: AuditLogEntry = {
        timestamp: new Date(),
        netId: authReq.user?.netId || 'anonymous',
        role: authReq.user?.role || 'none',
        action,
        resource,
        resourceId: req.params.itemId || req.params.modifierId,
        method: req.method,
        path: req.path,
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        changes: req.body,
        success: res.statusCode >= 200 && res.statusCode < 300,
        statusCode: res.statusCode,
      };

      auditLog.push(entry);

      // In production: write to database or logging service
      console.log('[AUDIT]', JSON.stringify(entry));

      return originalJson(body);
    };

    next();
  };
};

/**
 * Get audit log entries (admin only)
 * Could be exposed as GET /api/audit endpoint
 */
export const getAuditLog = (
  filters?: {
    netId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
  }
): AuditLogEntry[] => {
  let filtered = [...auditLog];

  if (filters?.netId) {
    filtered = filtered.filter((entry) => entry.netId === filters.netId);
  }

  if (filters?.action) {
    filtered = filtered.filter((entry) => entry.action === filters.action);
  }

  if (filters?.resource) {
    filtered = filtered.filter((entry) => entry.resource === filters.resource);
  }

  if (filters?.startDate) {
    filtered = filtered.filter((entry) => entry.timestamp >= filters.startDate!);
  }

  if (filters?.endDate) {
    filtered = filtered.filter((entry) => entry.timestamp <= filters.endDate!);
  }

  return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

/**
 * CSRF protection middleware
 * Validates CSRF token from custom header for state-changing operations
 *
 * Note: Express-session has built-in CSRF protection via csurf package
 * This is a lightweight alternative using custom header validation
 */
export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthenticatedRequest;

  // Only check CSRF for authenticated state-changing requests
  const statefulMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!statefulMethods.includes(req.method)) {
    next();
    return;
  }

  // Require custom header to prevent CSRF
  // Browser same-origin policy prevents cross-origin custom headers
  const csrfHeader = req.get('X-CSRF-Protection');

  if (!csrfHeader || csrfHeader !== '1') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'CSRF protection validation failed',
      code: 'CSRF_VALIDATION_FAILED',
      hint: 'Include X-CSRF-Protection: 1 header in request',
    });
    return;
  }

  next();
};

/**
 * Rate limiting protection
 * Prevents abuse by limiting requests per user per time window
 *
 * For production: use redis-based rate limiting (e.g., express-rate-limit with redis store)
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export const rateLimit = (options: {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    // Generate key (default: netId, fallback to IP)
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : authReq.user?.netId || req.ip || 'anonymous';

    const now = Date.now();
    const entry = rateLimitStore.get(key);

    // Reset window if expired
    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      next();
      return;
    }

    // Increment counter
    entry.count++;

    // Check if limit exceeded
    if (entry.count > options.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter,
      });
      return;
    }

    next();
  };
};

/**
 * Session hijacking protection
 * Validates session integrity by checking IP and User-Agent consistency
 *
 * WARNING: This can cause issues with legitimate users behind proxies or changing networks
 * Use with caution - consider fingerprinting instead for production
 */
export const sessionIntegrityCheck = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.session) {
    next();
    return;
  }

  const currentIp = req.ip || req.socket.remoteAddress;
  const currentUserAgent = req.get('user-agent');

  // Store initial session metadata
  if (!req.session.metadata) {
    req.session.metadata = {
      initialIp: currentIp,
      initialUserAgent: currentUserAgent,
    };
    next();
    return;
  }

  // Validate session hasn't been hijacked
  const ipChanged = req.session.metadata.initialIp !== currentIp;
  const userAgentChanged = req.session.metadata.initialUserAgent !== currentUserAgent;

  if (ipChanged || userAgentChanged) {
    console.warn('[SECURITY] Potential session hijacking detected:', {
      netId: (req as AuthenticatedRequest).user?.netId,
      ipChanged,
      userAgentChanged,
    });

    // Destroy session and force re-authentication
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying suspicious session:', err);
      }
    });

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Session integrity validation failed. Please log in again.',
      code: 'SESSION_INTEGRITY_FAILED',
    });
    return;
  }

  next();
};

/**
 * Extend Express session type to include metadata
 */
declare module 'express-session' {
  interface SessionData {
    metadata?: {
      initialIp?: string;
      initialUserAgent?: string;
    };
  }
}
