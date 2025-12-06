import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth';
import {
  validateMenuItemUpdate,
  sanitizeMenuItemUpdate,
  validateMenuItemFields,
  isStaffAllowedField,
  isAdminOnlyField,
  getAllowedFields,
} from '../fieldAuthorization';

describe('Field Authorization Middleware', () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('validateMenuItemUpdate', () => {
    it('should allow admin to update any field', () => {
      req.user = { netId: 'admin1', name: 'Admin', role: 'admin' };
      req.body = {
        name: 'New Name',
        price: 15.99,
        isAvailable: true,
        isHot: false,
      };

      validateMenuItemUpdate(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow staff to update isAvailable', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };
      req.body = { isAvailable: false };

      validateMenuItemUpdate(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow staff to update isHot', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };
      req.body = { isHot: true };

      validateMenuItemUpdate(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow staff to update both isAvailable and isHot', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };
      req.body = { isAvailable: true, isHot: true };

      validateMenuItemUpdate(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject staff attempting to update name', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };
      req.body = { name: 'New Name' };

      validateMenuItemUpdate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Staff users can only modify availability and hot status',
        code: 'FIELD_AUTHORIZATION_ERROR',
        unauthorizedFields: ['name'],
        allowedFields: ['isAvailable', 'isHot'],
        hint: 'Admin role required to modify other fields',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject staff attempting to update price', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };
      req.body = { price: 9.99 };

      validateMenuItemUpdate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FIELD_AUTHORIZATION_ERROR',
          unauthorizedFields: ['price'],
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject staff attempting to update multiple admin-only fields', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };
      req.body = {
        name: 'New Name',
        price: 15.99,
        description: 'New description',
      };

      validateMenuItemUpdate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FIELD_AUTHORIZATION_ERROR',
          unauthorizedFields: expect.arrayContaining(['name', 'price', 'description']),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject staff attempting to update mix of allowed and disallowed fields', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };
      req.body = {
        isAvailable: true,
        price: 15.99, // Not allowed
      };

      validateMenuItemUpdate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          unauthorizedFields: ['price'],
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject customer attempting to update any field', () => {
      req.user = { netId: 'customer1', name: 'Customer', role: 'customer' };
      req.body = { isAvailable: false };

      validateMenuItemUpdate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Insufficient permissions to modify menu items',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('sanitizeMenuItemUpdate', () => {
    it('should allow all fields for admin', () => {
      req.user = { netId: 'admin1', name: 'Admin', role: 'admin' };
      req.body = {
        name: 'New Name',
        price: 15.99,
        isAvailable: true,
      };

      const originalBody = { ...req.body };
      sanitizeMenuItemUpdate(req as Request, res as Response, next);

      expect(req.body).toEqual(originalBody);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should filter staff request to only allowed fields', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };
      req.body = {
        name: 'New Name', // Should be removed
        price: 15.99, // Should be removed
        isAvailable: true, // Should be kept
        isHot: false, // Should be kept
      };

      sanitizeMenuItemUpdate(req as Request, res as Response, next);

      expect(req.body).toEqual({
        isAvailable: true,
        isHot: false,
      });
      expect(next).toHaveBeenCalled();
    });

    it('should keep only staff-allowed fields and ignore others', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };
      req.body = {
        isAvailable: false,
      };

      sanitizeMenuItemUpdate(req as Request, res as Response, next);

      expect(req.body).toEqual({ isAvailable: false });
      expect(next).toHaveBeenCalled();
    });

    it('should result in empty body if staff provides only admin fields', () => {
      req.user = { netId: 'staff1', name: 'Staff', role: 'staff' };
      req.body = {
        name: 'New Name',
        price: 15.99,
      };

      sanitizeMenuItemUpdate(req as Request, res as Response, next);

      expect(req.body).toEqual({});
      expect(next).toHaveBeenCalled();
    });

    it('should reject customer', () => {
      req.user = { netId: 'customer1', name: 'Customer', role: 'customer' };
      req.body = { isAvailable: false };

      sanitizeMenuItemUpdate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateMenuItemFields', () => {
    it('should allow valid staff fields', () => {
      req.body = { isAvailable: true, isHot: false };

      validateMenuItemFields(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow valid admin fields', () => {
      req.body = {
        name: 'Test',
        description: 'Test description',
        category: 'entree',
        price: 9.99,
      };

      validateMenuItemFields(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow mix of staff and admin fields', () => {
      req.body = {
        name: 'Test',
        price: 9.99,
        isAvailable: true,
        isHot: false,
      };

      validateMenuItemFields(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject unknown fields', () => {
      req.body = {
        unknownField: 'value',
        anotherUnknownField: 123,
      };

      validateMenuItemFields(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Request contains invalid fields',
        code: 'INVALID_FIELDS',
        invalidFields: expect.arrayContaining(['unknownField', 'anotherUnknownField']),
        validFields: expect.any(Array),
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject mix of valid and invalid fields', () => {
      req.body = {
        name: 'Valid',
        invalidField: 'Invalid',
      };

      validateMenuItemFields(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          invalidFields: ['invalidField'],
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow empty body', () => {
      req.body = {};

      validateMenuItemFields(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Helper functions', () => {
    describe('isStaffAllowedField', () => {
      it('should return true for isAvailable', () => {
        expect(isStaffAllowedField('isAvailable')).toBe(true);
      });

      it('should return true for isHot', () => {
        expect(isStaffAllowedField('isHot')).toBe(true);
      });

      it('should return false for name', () => {
        expect(isStaffAllowedField('name')).toBe(false);
      });

      it('should return false for price', () => {
        expect(isStaffAllowedField('price')).toBe(false);
      });

      it('should return false for unknown field', () => {
        expect(isStaffAllowedField('unknownField')).toBe(false);
      });
    });

    describe('isAdminOnlyField', () => {
      it('should return true for name', () => {
        expect(isAdminOnlyField('name')).toBe(true);
      });

      it('should return true for price', () => {
        expect(isAdminOnlyField('price')).toBe(true);
      });

      it('should return true for description', () => {
        expect(isAdminOnlyField('description')).toBe(true);
      });

      it('should return false for isAvailable', () => {
        expect(isAdminOnlyField('isAvailable')).toBe(false);
      });

      it('should return false for isHot', () => {
        expect(isAdminOnlyField('isHot')).toBe(false);
      });

      it('should return false for unknown field', () => {
        expect(isAdminOnlyField('unknownField')).toBe(false);
      });
    });

    describe('getAllowedFields', () => {
      it('should return all fields for admin', () => {
        const fields = getAllowedFields('admin');

        expect(fields).toContain('isAvailable');
        expect(fields).toContain('isHot');
        expect(fields).toContain('name');
        expect(fields).toContain('price');
        expect(fields).toContain('description');
        expect(fields.length).toBeGreaterThan(2);
      });

      it('should return only staff fields for staff', () => {
        const fields = getAllowedFields('staff');

        expect(fields).toEqual(['isAvailable', 'isHot']);
      });

      it('should return empty array for customer', () => {
        const fields = getAllowedFields('customer');

        expect(fields).toEqual([]);
      });
    });
  });
});
