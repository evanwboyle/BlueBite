# RBAC Middleware - Quick Reference Guide

## Import Statements

```typescript
// Authentication & Authorization
import {
  requireAuth,
  requireStaff,
  requireAdmin,
  requireRole,
  AuthenticatedRequest,
} from '../middleware/auth';

// Field-Level Authorization
import {
  validateMenuItemUpdate,
  sanitizeMenuItemUpdate,
  validateMenuItemFields,
} from '../middleware/fieldAuthorization';

// Security
import {
  auditLogger,
  csrfProtection,
  rateLimit,
  sessionIntegrityCheck,
} from '../middleware/security';
```

## Common Middleware Patterns

### Public Endpoint (No Auth)
```typescript
router.get('/api/menu', async (req, res) => {
  // Anyone can view menu
});
```

### Authenticated Only
```typescript
router.get('/api/orders/my-orders',
  requireAuth,
  async (req, res) => {
    // Any logged-in user
  }
);
```

### Staff or Admin
```typescript
router.patch('/api/menu/:id/toggle-availability',
  requireAuth,
  requireStaff, // Staff or Admin
  csrfProtection,
  auditLogger('TOGGLE_AVAILABILITY', 'menu_item'),
  async (req, res) => {
    // Staff and Admin can toggle
  }
);
```

### Admin Only
```typescript
router.post('/api/menu',
  requireAuth,
  requireAdmin,
  csrfProtection,
  rateLimit({ windowMs: 60000, maxRequests: 20 }),
  auditLogger('CREATE', 'menu_item'),
  async (req, res) => {
    // Admin only
  }
);
```

### Update with Field Validation
```typescript
router.put('/api/menu/:id',
  requireAuth,
  requireStaff, // Staff or Admin
  csrfProtection,
  validateMenuItemFields, // Ensure valid fields
  validateMenuItemUpdate, // Ensure role has permission
  rateLimit({ windowMs: 60000, maxRequests: 50 }),
  auditLogger('UPDATE', 'menu_item'),
  async (req, res) => {
    // Staff: can update isAvailable, isHot
    // Admin: can update all fields
  }
);
```

### Custom Role Combination
```typescript
router.get('/api/analytics',
  requireAuth,
  requireRole('staff', 'admin'), // Explicit roles
  async (req, res) => {
    // Staff and Admin only
  }
);
```

## Accessing User in Route Handlers

```typescript
import { AuthenticatedRequest } from '../middleware/auth';

router.post('/api/menu',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    // Access user properties
    const netId = authReq.user?.netId;
    const role = authReq.user?.role;
    const name = authReq.user?.name;

    console.log(`Menu item created by ${name} (${role})`);
  }
);
```

## Rate Limiting Examples

```typescript
// Basic rate limiting
rateLimit({ windowMs: 60000, maxRequests: 100 }) // 100 req/min

// Custom key generator (e.g., by IP instead of user)
rateLimit({
  windowMs: 60000,
  maxRequests: 50,
  keyGenerator: (req) => req.ip || 'unknown',
})

// Stricter limits for sensitive operations
rateLimit({ windowMs: 60000, maxRequests: 10 }) // 10 req/min
```

## Frontend Integration Snippets

### Making Authenticated Request

```typescript
const response = await fetch('/api/menu', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Protection': '1', // Required!
  },
  credentials: 'include', // Include session cookie
  body: JSON.stringify({
    name: 'New Item',
    category: 'entree',
    price: 12.99,
  }),
});
```

### Handling Errors

```typescript
const handleError = (response: Response, data: any) => {
  switch (response.status) {
    case 401:
      // Not authenticated - redirect to login
      window.location.href = '/auth/cas';
      break;

    case 403:
      // Forbidden - show error
      if (data.code === 'FIELD_AUTHORIZATION_ERROR') {
        alert(`You can only modify: ${data.allowedFields.join(', ')}`);
      } else {
        alert(`Access denied. ${data.requiredRole} role required.`);
      }
      break;

    case 429:
      // Rate limited
      alert(`Too many requests. Try again in ${data.retryAfter} seconds.`);
      break;

    default:
      alert('An error occurred');
  }
};
```

### Conditional UI by Role

```typescript
// In React component
const MenuItemEditor = ({ user, item }) => {
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff' || user?.role === 'admin';

  return (
    <div>
      {/* Admin-only fields */}
      {isAdmin && (
        <div>
          <input name="name" defaultValue={item.name} />
          <input name="price" defaultValue={item.price} />
        </div>
      )}

      {/* Staff fields */}
      {isStaff && (
        <div>
          <label>
            <input type="checkbox" name="isAvailable" />
            Available
          </label>
        </div>
      )}

      {/* Admin-only actions */}
      {isAdmin && (
        <button onClick={() => deleteItem(item.id)}>Delete</button>
      )}
    </div>
  );
};
```

## Error Response Formats

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Authentication required. Please log in.",
  "code": "AUTH_REQUIRED"
}
```

### 403 Forbidden (Insufficient Role)
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions. Admin role required.",
  "code": "INSUFFICIENT_PERMISSIONS",
  "requiredRole": "admin",
  "currentRole": "staff"
}
```

### 403 Field Authorization Error
```json
{
  "error": "Forbidden",
  "message": "Staff users can only modify availability and hot status",
  "code": "FIELD_AUTHORIZATION_ERROR",
  "unauthorizedFields": ["price", "name"],
  "allowedFields": ["isAvailable", "isHot"],
  "hint": "Admin role required to modify other fields"
}
```

### 429 Rate Limit Exceeded
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 45
}
```

## Middleware Order (Critical!)

Always apply middleware in this order:

```typescript
router.METHOD('/path',
  // 1. Authentication
  requireAuth,

  // 2. Authorization (role check)
  requireStaff, // or requireAdmin

  // 3. Security
  csrfProtection,

  // 4. Validation
  validateMenuItemFields,
  validateMenuItemUpdate,

  // 5. Rate limiting
  rateLimit({ ... }),

  // 6. Audit logging
  auditLogger('ACTION', 'resource'),

  // 7. Handler
  async (req, res) => { ... }
);
```

## Role Hierarchy

```
customer < staff < admin
```

- **Customer**: Can only view menu and place orders
- **Staff**: Can toggle `isAvailable` and `isHot` on menu items
- **Admin**: Full CRUD on menu items and modifiers

## Staff-Allowed Fields

Staff can only modify these fields:
```typescript
['isAvailable', 'isHot']
```

## Admin-Only Fields

Only admins can modify:
```typescript
[
  'name',
  'description',
  'category',
  'price',
  'imageUrl',
  'modifiers',
  'dietaryInfo',
]
```

## Testing Checklist

- [ ] Unauthenticated user gets 401
- [ ] Customer trying staff endpoint gets 403
- [ ] Staff trying admin endpoint gets 403
- [ ] Staff modifying admin-only field gets 403
- [ ] Admin can perform all operations
- [ ] CSRF header missing returns 403
- [ ] Rate limit works (hit limit and verify 429)
- [ ] Audit log captures all actions

## Environment Variables

Required in `.env`:
```env
SESSION_SECRET=<64-char-hex-string>
DATABASE_URL=postgresql://...
CAS_URL=https://secure.its.yale.edu/cas
CAS_SERVICE_URL=http://localhost:3000/auth/cas/callback
NODE_ENV=development
```

## Debugging

Enable verbose logging in development:
```typescript
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log({
      method: req.method,
      path: req.path,
      authenticated: req.isAuthenticated(),
      role: (req as AuthenticatedRequest).user?.role,
    });
    next();
  });
}
```

## Production Checklist

- [ ] Use Redis for session store
- [ ] Use Redis for rate limiting
- [ ] Store audit logs in database
- [ ] Set `secure: true` for cookies (HTTPS only)
- [ ] Consider `sameSite: 'strict'` for cookies
- [ ] Implement proper logging (Winston, Pino)
- [ ] Set up monitoring and alerts
- [ ] Review session expiration time
- [ ] Test session hijacking protection
- [ ] Validate all environment variables

## Useful Commands

```bash
# Generate session secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Test endpoint with curl
curl -X POST http://localhost:3000/api/menu \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Protection: 1" \
  --cookie "connect.sid=..." \
  -d '{"name":"Test","price":9.99}'

# Check session in Redis (if using Redis store)
redis-cli KEYS "sess:*"
```

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Always getting 401 | Check if session cookie is being sent (`credentials: 'include'`) |
| CSRF validation failing | Ensure `X-CSRF-Protection: 1` header is present |
| Rate limit too strict | Increase `maxRequests` or `windowMs` |
| Session keeps expiring | Check `maxAge` in session config, verify Redis connection |
| 403 on valid request | Check user role in database matches expected role |
| Audit logs not appearing | Check console output, verify middleware is applied |
