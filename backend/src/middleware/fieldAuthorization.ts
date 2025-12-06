import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

/**
 * Fields that staff can modify on menu items
 * Staff have limited edit permissions - only operational flags
 */
const STAFF_ALLOWED_FIELDS = ['isAvailable', 'isHot'] as const;

/**
 * Fields that only admins can modify
 * Structural changes to menu items reserved for admins
 */
const ADMIN_ONLY_FIELDS = [
  'name',
  'description',
  'category',
  'price',
  'imageUrl',
  'modifiers',
  'dietaryInfo',
] as const;

type StaffAllowedField = typeof STAFF_ALLOWED_FIELDS[number];
type AdminOnlyField = typeof ADMIN_ONLY_FIELDS[number];
type MenuItemField = StaffAllowedField | AdminOnlyField;

/**
 * Validates that staff users only modify allowed fields
 * Allows admins to modify any field
 * Middleware for PUT /api/menu/:itemId
 */
export const validateMenuItemUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthenticatedRequest;
  const updateFields = Object.keys(req.body);

  // Admin can update anything
  if (authReq.user?.role === 'admin') {
    next();
    return;
  }

  // Staff can only update specific fields
  if (authReq.user?.role === 'staff') {
    const unauthorizedFields = updateFields.filter(
      (field) => !STAFF_ALLOWED_FIELDS.includes(field as StaffAllowedField)
    );

    if (unauthorizedFields.length > 0) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Staff users can only modify availability and hot status',
        code: 'FIELD_AUTHORIZATION_ERROR',
        unauthorizedFields,
        allowedFields: STAFF_ALLOWED_FIELDS,
        hint: 'Admin role required to modify other fields',
      });
      return;
    }

    next();
    return;
  }

  // Customers should never reach here (protected by requireStaff)
  // But handle defensively
  res.status(403).json({
    error: 'Forbidden',
    message: 'Insufficient permissions to modify menu items',
    code: 'INSUFFICIENT_PERMISSIONS',
  });
};

/**
 * Sanitizes request body to only include fields user is authorized to modify
 * Alternative approach: automatically filter fields instead of rejecting request
 *
 * Usage: Use this instead of validateMenuItemUpdate for more permissive behavior
 */
export const sanitizeMenuItemUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthenticatedRequest;

  // Admin can update anything - no sanitization needed
  if (authReq.user?.role === 'admin') {
    next();
    return;
  }

  // Staff: filter to only allowed fields
  if (authReq.user?.role === 'staff') {
    const sanitized: Record<string, unknown> = {};

    for (const field of STAFF_ALLOWED_FIELDS) {
      if (field in req.body) {
        sanitized[field] = req.body[field];
      }
    }

    // Replace body with sanitized version
    req.body = sanitized;

    // Warn if fields were filtered (optional - for debugging)
    const originalFields = Object.keys(req.body);
    const removedFields = originalFields.filter(
      (f) => !STAFF_ALLOWED_FIELDS.includes(f as StaffAllowedField)
    );

    if (removedFields.length > 0) {
      // Could log this for audit trail
      console.warn(`Staff user ${authReq.user.netId} attempted to modify restricted fields: ${removedFields.join(', ')}`);
    }

    next();
    return;
  }

  // Customers shouldn't reach here
  res.status(403).json({
    error: 'Forbidden',
    message: 'Insufficient permissions to modify menu items',
    code: 'INSUFFICIENT_PERMISSIONS',
  });
};

/**
 * Type guard for staff-allowed fields
 * Useful in route handlers for conditional logic
 */
export const isStaffAllowedField = (field: string): field is StaffAllowedField => {
  return STAFF_ALLOWED_FIELDS.includes(field as StaffAllowedField);
};

/**
 * Type guard for admin-only fields
 */
export const isAdminOnlyField = (field: string): field is AdminOnlyField => {
  return ADMIN_ONLY_FIELDS.includes(field as AdminOnlyField);
};

/**
 * Get allowed fields for a user based on their role
 */
export const getAllowedFields = (
  role: 'customer' | 'staff' | 'admin'
): readonly MenuItemField[] => {
  switch (role) {
    case 'admin':
      return [...STAFF_ALLOWED_FIELDS, ...ADMIN_ONLY_FIELDS];
    case 'staff':
      return STAFF_ALLOWED_FIELDS;
    case 'customer':
      return []; // Customers can't modify anything
  }
};

/**
 * Validates that request body only contains valid menu item fields
 * Protects against injection of unexpected fields
 */
export const validateMenuItemFields = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const updateFields = Object.keys(req.body);
  const allValidFields = [...STAFF_ALLOWED_FIELDS, ...ADMIN_ONLY_FIELDS];

  const invalidFields = updateFields.filter(
    (field) => !allValidFields.includes(field as MenuItemField)
  );

  if (invalidFields.length > 0) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Request contains invalid fields',
      code: 'INVALID_FIELDS',
      invalidFields,
      validFields: allValidFields,
    });
    return;
  }

  next();
};
