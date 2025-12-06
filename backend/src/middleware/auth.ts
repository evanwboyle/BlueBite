import { Request, Response, NextFunction } from 'express';

/**
 * Extended Express Request interface to include user from Passport.js
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    netId: string;
    name: string;
    role: 'customer' | 'staff' | 'admin';
  };
}

/**
 * Base authentication middleware
 * Ensures user is authenticated via Passport.js
 * Returns 401 if not authenticated
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.isAuthenticated()) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please log in.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }
  next();
};

/**
 * Staff-level authorization middleware
 * Requires authenticated user with 'staff' or 'admin' role
 * Returns 403 if user lacks required role
 */
export const requireStaff = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthenticatedRequest;

  if (!req.isAuthenticated() || !authReq.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please log in.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  const allowedRoles: Array<string> = ['staff', 'admin'];
  if (!allowedRoles.includes(authReq.user.role)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Insufficient permissions. Staff or admin role required.',
      code: 'INSUFFICIENT_PERMISSIONS',
      requiredRole: 'staff',
      currentRole: authReq.user.role,
    });
    return;
  }

  next();
};

/**
 * Admin-level authorization middleware
 * Requires authenticated user with 'admin' role
 * Returns 403 if user lacks admin role
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthenticatedRequest;

  if (!req.isAuthenticated() || !authReq.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please log in.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  if (authReq.user.role !== 'admin') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Insufficient permissions. Admin role required.',
      code: 'INSUFFICIENT_PERMISSIONS',
      requiredRole: 'admin',
      currentRole: authReq.user.role,
    });
    return;
  }

  next();
};

/**
 * Role-based authorization middleware factory
 * More flexible approach - pass allowed roles as parameter
 */
export const requireRole = (...allowedRoles: Array<'customer' | 'staff' | 'admin'>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!req.isAuthenticated() || !authReq.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Please log in.',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. One of the following roles required: ${allowedRoles.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        currentRole: authReq.user.role,
      });
      return;
    }

    next();
  };
};

/**
 * Check if user has specific role
 * Utility function for conditional logic in routes
 */
export const hasRole = (
  req: Request,
  role: 'customer' | 'staff' | 'admin'
): boolean => {
  const authReq = req as AuthenticatedRequest;
  return authReq.user?.role === role;
};

/**
 * Check if user has at least a certain role level
 * Hierarchy: customer < staff < admin
 */
export const hasRoleLevel = (
  req: Request,
  minRole: 'customer' | 'staff' | 'admin'
): boolean => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) return false;

  const roleHierarchy = { customer: 0, staff: 1, admin: 2 };
  return roleHierarchy[authReq.user.role] >= roleHierarchy[minRole];
};
