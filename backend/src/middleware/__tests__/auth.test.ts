import { Request, Response, NextFunction } from 'express';
import {
  requireAuth,
  requireStaff,
  requireAdmin,
  requireRole,
  hasRole,
  hasRoleLevel,
  AuthenticatedRequest,
} from '../auth';

describe('Authentication & Authorization Middleware', () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      isAuthenticated: jest.fn(),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('requireAuth', () => {
    it('should call next() if user is authenticated', () => {
      (req.isAuthenticated as jest.Mock).mockReturnValue(true);

      requireAuth(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', () => {
      (req.isAuthenticated as jest.Mock).mockReturnValue(false);

      requireAuth(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required. Please log in.',
        code: 'AUTH_REQUIRED',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireStaff', () => {
    it('should call next() if user is staff', () => {
      (req.isAuthenticated as jest.Mock).mockReturnValue(true);
      req.user = { netId: 'abc123', name: 'Test User', role: 'staff' };

      requireStaff(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() if user is admin', () => {
      (req.isAuthenticated as jest.Mock).mockReturnValue(true);
      req.user = { netId: 'admin1', name: 'Admin User', role: 'admin' };

      requireStaff(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', () => {
      (req.isAuthenticated as jest.Mock).mockReturnValue(false);

      requireStaff(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          code: 'AUTH_REQUIRED',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user is customer', () => {
      (req.isAuthenticated as jest.Mock).mockReturnValue(true);
      req.user = { netId: 'customer1', name: 'Customer', role: 'customer' };

      requireStaff(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Insufficient permissions. Staff or admin role required.',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRole: 'staff',
        currentRole: 'customer',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should call next() if user is admin', () => {
      (req.isAuthenticated as jest.Mock).mockReturnValue(true);
      req.user = { netId: 'admin1', name: 'Admin User', role: 'admin' };

      requireAdmin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', () => {
      (req.isAuthenticated as jest.Mock).mockReturnValue(false);

      requireAdmin(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user is staff', () => {
      (req.isAuthenticated as jest.Mock).mockReturnValue(true);
      req.user = { netId: 'staff1', name: 'Staff User', role: 'staff' };

      requireAdmin(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Insufficient permissions. Admin role required.',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRole: 'admin',
        currentRole: 'staff',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user is customer', () => {
      (req.isAuthenticated as jest.Mock).mockReturnValue(true);
      req.user = { netId: 'customer1', name: 'Customer', role: 'customer' };

      requireAdmin(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should call next() if user has one of the allowed roles', () => {
      (req.isAuthenticated as jest.Mock).mockReturnValue(true);
      req.user = { netId: 'staff1', name: 'Staff User', role: 'staff' };

      const middleware = requireRole('staff', 'admin');
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user does not have any allowed role', () => {
      (req.isAuthenticated as jest.Mock).mockReturnValue(true);
      req.user = { netId: 'customer1', name: 'Customer', role: 'customer' };

      const middleware = requireRole('staff', 'admin');
      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Insufficient permissions. One of the following roles required: staff, admin',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: ['staff', 'admin'],
        currentRole: 'customer',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should work with single role', () => {
      (req.isAuthenticated as jest.Mock).mockReturnValue(true);
      req.user = { netId: 'admin1', name: 'Admin', role: 'admin' };

      const middleware = requireRole('admin');
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('hasRole', () => {
    it('should return true if user has the specified role', () => {
      req.user = { netId: 'admin1', name: 'Admin', role: 'admin' };

      expect(hasRole(req as Request, 'admin')).toBe(true);
    });

    it('should return false if user has different role', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };

      expect(hasRole(req as Request, 'admin')).toBe(false);
    });

    it('should return false if user is not set', () => {
      req.user = undefined;

      expect(hasRole(req as Request, 'admin')).toBe(false);
    });
  });

  describe('hasRoleLevel', () => {
    it('should return true if user is admin and min role is customer', () => {
      req.user = { netId: 'admin1', name: 'Admin', role: 'admin' };

      expect(hasRoleLevel(req as Request, 'customer')).toBe(true);
    });

    it('should return true if user is admin and min role is staff', () => {
      req.user = { netId: 'admin1', name: 'Admin', role: 'admin' };

      expect(hasRoleLevel(req as Request, 'staff')).toBe(true);
    });

    it('should return true if user is admin and min role is admin', () => {
      req.user = { netId: 'admin1', name: 'Admin', role: 'admin' };

      expect(hasRoleLevel(req as Request, 'admin')).toBe(true);
    });

    it('should return true if user is staff and min role is customer', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };

      expect(hasRoleLevel(req as Request, 'customer')).toBe(true);
    });

    it('should return true if user is staff and min role is staff', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };

      expect(hasRoleLevel(req as Request, 'staff')).toBe(true);
    });

    it('should return false if user is staff and min role is admin', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };

      expect(hasRoleLevel(req as Request, 'admin')).toBe(false);
    });

    it('should return false if user is customer and min role is staff', () => {
      req.user = { netId: 'customer1', name: 'Customer', role: 'customer' };

      expect(hasRoleLevel(req as Request, 'staff')).toBe(false);
    });

    it('should return false if user is not set', () => {
      req.user = undefined;

      expect(hasRoleLevel(req as Request, 'customer')).toBe(false);
    });
  });
});
