# RBAC Middleware Architecture Documentation

## Overview

This middleware architecture provides comprehensive Role-Based Access Control (RBAC) for BlueBite's menu editing features. It integrates with existing Passport.js/Yale CAS authentication and provides layered security through authentication, authorization, field-level permissions, CSRF protection, rate limiting, and audit logging.

## Architecture Components

### 1. Authentication & Authorization (`auth.ts`)

Core middleware for verifying user identity and role-based access control.

#### Middleware Functions

**`requireAuth`**
- **Purpose**: Ensures user is authenticated via Passport.js
- **Returns**: 401 if not authenticated
- **Usage**: Base layer for all protected endpoints

```typescript
router.post('/api/menu', requireAuth, requireAdmin, handler);
```

**`requireStaff`**
- **Purpose**: Requires staff or admin role
- **Returns**: 401 if not authenticated, 403 if insufficient role
- **Usage**: For staff-level operations (toggling availability/hot status)

```typescript
router.put('/api/menu/:id', requireStaff, handler);
```

**`requireAdmin`**
- **Purpose**: Requires admin role
- **Returns**: 401 if not authenticated, 403 if not admin
- **Usage**: For admin-only operations (CRUD on menu items/modifiers)

```typescript
router.post('/api/menu', requireAdmin, handler);
router.delete('/api/menu/:id', requireAdmin, handler);
```

**`requireRole(...allowedRoles)`**
- **Purpose**: Flexible role-based authorization
- **Parameters**: Variable list of allowed roles
- **Usage**: Custom role combinations

```typescript
router.get('/api/reports', requireRole('staff', 'admin'), handler);
```

#### Helper Functions

**`hasRole(req, role)`**
- Check if user has specific role
- Returns boolean

**`hasRoleLevel(req, minRole)`**
- Check if user has at least a certain role level
- Role hierarchy: customer < staff < admin
- Returns boolean

### 2. Field-Level Authorization (`fieldAuthorization.ts`)

Granular control over which fields users can modify based on their role.

#### Staff-Allowed Fields
- `isAvailable` - Toggle menu item availability
- `isHot` - Toggle hot status flag

#### Admin-Only Fields
- `name`, `description`, `category`, `price`
- `imageUrl`, `modifiers`, `dietaryInfo`

#### Middleware Functions

**`validateMenuItemUpdate`**
- **Purpose**: Rejects requests if staff tries to modify admin-only fields
- **Behavior**: Returns 403 with list of unauthorized fields
- **Usage**: Strict validation approach

```typescript
router.put('/api/menu/:id',
  requireStaff,
  validateMenuItemUpdate,
  handler
);
```

**`sanitizeMenuItemUpdate`**
- **Purpose**: Automatically filters out unauthorized fields
- **Behavior**: Silently removes admin-only fields from staff requests
- **Usage**: Permissive approach (alternative to validateMenuItemUpdate)

```typescript
router.put('/api/menu/:id',
  requireStaff,
  sanitizeMenuItemUpdate, // Use instead of validateMenuItemUpdate
  handler
);
```

**`validateMenuItemFields`**
- **Purpose**: Validates that only known fields are present
- **Behavior**: Prevents injection of unexpected fields
- **Usage**: Input validation layer

```typescript
router.put('/api/menu/:id',
  validateMenuItemFields,
  validateMenuItemUpdate,
  handler
);
```

#### Helper Functions

**`isStaffAllowedField(field)`**
- Type guard for staff-allowed fields

**`isAdminOnlyField(field)`**
- Type guard for admin-only fields

**`getAllowedFields(role)`**
- Get list of allowed fields for a role

### 3. Security Middleware (`security.ts`)

Protection against common security threats and operational concerns.

#### CSRF Protection

**`csrfProtection`**
- **Purpose**: Prevents Cross-Site Request Forgery attacks
- **Mechanism**: Requires custom header `X-CSRF-Protection: 1`
- **Applies to**: POST, PUT, PATCH, DELETE requests
- **Why custom header**: Browser same-origin policy prevents cross-origin custom headers

```typescript
// Frontend must include header
fetch('/api/menu', {
  method: 'POST',
  headers: {
    'X-CSRF-Protection': '1',
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Include session cookie
  body: JSON.stringify(data),
});
```

#### Rate Limiting

**`rateLimit(options)`**
- **Purpose**: Prevents abuse and DDoS attacks
- **Storage**: In-memory Map (replace with Redis for production)
- **Options**:
  - `windowMs`: Time window in milliseconds
  - `maxRequests`: Max requests per window
  - `keyGenerator`: Custom key function (default: netId or IP)

```typescript
// 20 requests per minute
router.post('/api/menu',
  rateLimit({ windowMs: 60000, maxRequests: 20 }),
  handler
);
```

**Production Recommendation**: Use Redis-backed rate limiting:
```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });

const limiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'bluebite:ratelimit:',
  }),
  windowMs: 60000,
  max: 20,
});
```

#### Audit Logging

**`auditLogger(action, resource)`**
- **Purpose**: Comprehensive logging of all authenticated actions
- **Captures**: Timestamp, user, action, resource, IP, user agent, changes, status
- **Storage**: In-memory array (replace with database/logging service for production)

```typescript
router.post('/api/menu',
  auditLogger('CREATE', 'menu_item'),
  handler
);
```

**Log Entry Structure**:
```typescript
{
  timestamp: Date,
  netId: string,
  role: string,
  action: string,
  resource: string,
  resourceId?: string,
  method: string,
  path: string,
  ip: string,
  userAgent: string,
  changes?: object,
  success: boolean,
  statusCode?: number,
}
```

**Production Integration**:
```typescript
// Write to database
const entry = { /* audit data */ };
await prisma.auditLog.create({ data: entry });

// Or external logging service
winston.info('audit', entry);
```

**`getAuditLog(filters)`**
- Query audit logs with filters
- Filters: netId, action, resource, startDate, endDate
- Expose via admin endpoint: `GET /api/audit`

#### Session Integrity Check

**`sessionIntegrityCheck`**
- **Purpose**: Detect session hijacking
- **Mechanism**: Validates IP and User-Agent consistency
- **Behavior**: Destroys session if mismatch detected
- **Warning**: Can cause issues with legitimate users behind proxies or changing networks

```typescript
// Apply globally or to sensitive routes
app.use(sessionIntegrityCheck);
```

**Production Consideration**: This is aggressive and may cause false positives. Consider:
- Device fingerprinting instead
- Allowing IP changes within same subnet
- Requiring re-authentication for sensitive operations instead of destroying session

## Integration Guide

### Basic Setup

1. **Import middleware in your Express app**:

```typescript
// backend/src/app.ts
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import menuRoutes from './routes/menu';
import { csrfProtection, sessionIntegrityCheck } from './middleware/security';

const app = express();

// Session configuration (already configured)
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // CSRF protection
  },
}));

// Passport configuration (already configured)
app.use(passport.initialize());
app.use(passport.session());

// Global security middleware (optional)
app.use(sessionIntegrityCheck); // Consider removing if too strict

// Routes
app.use('/api/menu', menuRoutes);
```

2. **Apply middleware to routes** (see `/backend/src/routes/menu.ts` for complete examples)

### Middleware Stacking Order

**Critical**: Middleware order matters. Apply in this sequence:

```typescript
router.post('/api/menu/:id',
  // 1. Authentication (verify user identity)
  requireAuth,

  // 2. Authorization (verify user role)
  requireStaff, // or requireAdmin

  // 3. Security checks
  csrfProtection,

  // 4. Input validation
  validateMenuItemFields,
  validateMenuItemUpdate,

  // 5. Rate limiting
  rateLimit({ windowMs: 60000, maxRequests: 50 }),

  // 6. Audit logging
  auditLogger('UPDATE', 'menu_item'),

  // 7. Route handler
  async (req, res) => {
    // Implementation
  }
);
```

### Error Response Patterns

#### 401 Unauthorized
User is not authenticated (not logged in).

```json
{
  "error": "Unauthorized",
  "message": "Authentication required. Please log in.",
  "code": "AUTH_REQUIRED"
}
```

**Frontend Action**: Redirect to login page or CAS authentication.

#### 403 Forbidden
User is authenticated but lacks required permissions.

```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions. Admin role required.",
  "code": "INSUFFICIENT_PERMISSIONS",
  "requiredRole": "admin",
  "currentRole": "staff"
}
```

**Frontend Action**: Display error message, hide unauthorized UI elements.

#### 403 Field Authorization Error
Staff user attempted to modify admin-only fields.

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

**Frontend Action**: Filter form fields based on user role before submission.

#### 429 Too Many Requests
Rate limit exceeded.

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 45
}
```

**Frontend Action**: Display countdown, disable submit button until retry time.

### Frontend Integration

#### Setting User Role in Frontend

After authentication, fetch user profile and store role:

```typescript
// After CAS login redirect
const response = await fetch('/api/auth/profile', {
  credentials: 'include',
});
const user = await response.json();

// Store in React state or context
setUser({
  netId: user.netId,
  name: user.name,
  role: user.role, // 'customer' | 'staff' | 'admin'
});
```

#### Conditional UI Based on Role

```typescript
// Show admin-only features
{user?.role === 'admin' && (
  <button onClick={() => deleteMenuItem(item.id)}>
    Delete Item
  </button>
)}

// Show staff features
{(user?.role === 'staff' || user?.role === 'admin') && (
  <button onClick={() => toggleAvailability(item.id)}>
    Toggle Availability
  </button>
)}
```

#### Making Authenticated Requests

Always include CSRF header for state-changing requests:

```typescript
const updateMenuItem = async (itemId: string, data: Partial<MenuItem>) => {
  const response = await fetch(`/api/menu/${itemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Protection': '1', // Required for CSRF protection
    },
    credentials: 'include', // Include session cookie
    body: JSON.stringify(data),
  });

  if (response.status === 401) {
    // Redirect to login
    window.location.href = '/auth/cas';
    return;
  }

  if (response.status === 403) {
    const error = await response.json();
    // Display error message
    alert(error.message);
    return;
  }

  if (response.status === 429) {
    const error = await response.json();
    // Display rate limit error
    alert(`Rate limit exceeded. Try again in ${error.retryAfter} seconds.`);
    return;
  }

  if (!response.ok) {
    throw new Error('Failed to update menu item');
  }

  return response.json();
};
```

#### Role-Based Form Fields

```typescript
const MenuItemForm = ({ user, item, onSubmit }) => {
  const isAdmin = user?.role === 'admin';
  const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin';

  return (
    <form onSubmit={onSubmit}>
      {/* Admin-only fields */}
      {isAdmin && (
        <>
          <input name="name" defaultValue={item.name} />
          <input name="price" type="number" defaultValue={item.price} />
          <textarea name="description" defaultValue={item.description} />
        </>
      )}

      {/* Staff-allowed fields */}
      {isStaffOrAdmin && (
        <>
          <label>
            <input
              type="checkbox"
              name="isAvailable"
              defaultChecked={item.isAvailable}
            />
            Available
          </label>
          <label>
            <input
              type="checkbox"
              name="isHot"
              defaultChecked={item.isHot}
            />
            Hot Item
          </label>
        </>
      )}

      <button type="submit">
        {isAdmin ? 'Update Item' : 'Update Status'}
      </button>
    </form>
  );
};
```

### Testing Middleware

#### Unit Tests (using Jest/Vitest)

```typescript
import { requireAuth, requireAdmin } from '../middleware/auth';
import { Request, Response, NextFunction } from 'express';

describe('requireAuth', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      isAuthenticated: jest.fn(),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

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
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Unauthorized',
        code: 'AUTH_REQUIRED',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
```

#### Integration Tests

```typescript
import request from 'supertest';
import app from '../app';

describe('POST /api/menu', () => {
  it('should return 401 if not authenticated', async () => {
    const response = await request(app)
      .post('/api/menu')
      .send({ name: 'Test Item', price: 5.99 });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTH_REQUIRED');
  });

  it('should return 403 if staff user tries to create item', async () => {
    // Login as staff user first
    const agent = request.agent(app);
    await agent.get('/auth/cas'); // Simulate CAS login

    const response = await agent
      .post('/api/menu')
      .set('X-CSRF-Protection', '1')
      .send({ name: 'Test Item', price: 5.99 });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('should create item if admin user', async () => {
    // Login as admin user
    const agent = request.agent(app);
    await agent.get('/auth/cas'); // Simulate CAS login as admin

    const response = await agent
      .post('/api/menu')
      .set('X-CSRF-Protection', '1')
      .send({
        name: 'New Item',
        category: 'entree',
        price: 12.99,
        description: 'Delicious food',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});
```

## Security Considerations

### 1. Session Security

**Current Configuration** (from your existing setup):
```typescript
session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // ✅ Prevents XSS access to cookies
    secure: process.env.NODE_ENV === 'production', // ✅ HTTPS only in production
    maxAge: 24 * 60 * 60 * 1000, // ✅ 24-hour expiration
    sameSite: 'lax', // ✅ CSRF protection
  },
})
```

**Recommendations**:
- ✅ Already configured correctly
- Consider: Set `sameSite: 'strict'` for stronger CSRF protection (may affect redirects)
- Consider: Shorter session duration for staff/admin (e.g., 4 hours)
- Production: Use Redis session store for horizontal scaling

```typescript
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET!,
  // ... other options
}));
```

### 2. CSRF Protection

**Current Implementation**: Custom header validation (`X-CSRF-Protection: 1`)

**Why this approach**:
- Browser same-origin policy prevents cross-origin custom headers
- Simpler than token-based CSRF (no token generation/validation)
- Works well with fetch API and modern frontends

**Alternative**: Use `csurf` package for token-based CSRF
```typescript
import csrf from 'csurf';

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
  },
});

app.use(csrfProtection);

// Send token to frontend
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Frontend includes token in header or body
```

### 3. Rate Limiting

**Current Implementation**: In-memory Map

**Production Recommendations**:
- Use Redis-backed rate limiting for distributed systems
- Different limits for different roles:
  - Customer: 100 req/min
  - Staff: 200 req/min
  - Admin: 500 req/min
- Implement IP-based rate limiting for unauthenticated endpoints

```typescript
const roleLimiter = (role: string) => {
  const limits = {
    customer: 100,
    staff: 200,
    admin: 500,
  };

  return rateLimit({
    windowMs: 60000,
    maxRequests: limits[role] || 50,
  });
};
```

### 4. Audit Logging

**Current Implementation**: In-memory array

**Production Requirements**:
- Store in database (Prisma model)
- Retention policy (e.g., 90 days)
- Compliance requirements (GDPR, FERPA for educational institutions)
- Tamper-proof logging (append-only, cryptographic hashing)

**Prisma Schema**:
```prisma
model AuditLog {
  id          String   @id @default(cuid())
  timestamp   DateTime @default(now())
  netId       String
  role        String
  action      String
  resource    String
  resourceId  String?
  method      String
  path        String
  ip          String
  userAgent   String
  changes     Json?
  success     Boolean
  statusCode  Int?

  @@index([netId])
  @@index([timestamp])
  @@index([action])
}
```

### 5. Input Validation

**Recommendations**:
- Use validation library (Zod, Joi, class-validator)
- Validate all inputs before database operations
- Sanitize HTML/SQL inputs

```typescript
import { z } from 'zod';

const menuItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['entree', 'side', 'beverage', 'dessert']),
  price: z.number().positive(),
  isAvailable: z.boolean().optional(),
  isHot: z.boolean().optional(),
});

router.post('/api/menu', requireAdmin, async (req, res) => {
  try {
    const validated = menuItemSchema.parse(req.body);
    // Use validated data
  } catch (error) {
    res.status(400).json({
      error: 'Validation Error',
      details: error.errors,
    });
  }
});
```

### 6. Environment Variables

**Required**:
```env
# Session
SESSION_SECRET=<strong-random-secret>

# Database
DATABASE_URL=postgresql://...

# Redis (production)
REDIS_URL=redis://...

# CAS
CAS_URL=https://secure.its.yale.edu/cas
CAS_SERVICE_URL=http://localhost:3000/auth/cas/callback

# Environment
NODE_ENV=development|production
```

**Generate strong session secret**:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Performance Considerations

1. **Rate Limiting**: In-memory store works for single instance; use Redis for multi-instance deployments
2. **Audit Logging**: Async logging to avoid blocking request handling
3. **Session Store**: Use Redis for production (express-session with connect-redis)
4. **Caching**: Cache role permissions in session to avoid repeated lookups

## Monitoring & Observability

### Metrics to Track
- Authentication failures by netId/IP
- Authorization failures by endpoint/role
- Rate limit hits
- Session hijacking attempts
- CSRF validation failures

### Logging Strategy
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Log security events
logger.warn('Authorization failure', {
  netId: user.netId,
  role: user.role,
  endpoint: req.path,
  requiredRole: 'admin',
});
```

## Migration Path

### Phase 1: Authentication (Already Done ✅)
- Passport.js with Yale CAS
- Express sessions
- User model with roles

### Phase 2: Authorization (Current)
- Implement RBAC middleware
- Protect menu endpoints
- Add field-level permissions

### Phase 3: Security Hardening
- Add CSRF protection
- Implement rate limiting
- Add audit logging
- Deploy session integrity checks

### Phase 4: Production Readiness
- Redis session store
- Redis rate limiting
- Database audit logging
- Monitoring and alerting

## Support & Troubleshooting

### Common Issues

**1. "Session integrity check keeps logging me out"**
- Disable `sessionIntegrityCheck` if users are behind NAT/proxies
- Or make it less strict (only check on sensitive operations)

**2. "Rate limiting too aggressive"**
- Adjust `maxRequests` based on usage patterns
- Implement role-based limits
- Use Redis for distributed rate limiting

**3. "CSRF validation failing"**
- Ensure frontend includes `X-CSRF-Protection: 1` header
- Check `credentials: 'include'` in fetch requests
- Verify session cookie is being sent

**4. "401 errors on authenticated requests"**
- Verify session cookie configuration
- Check `credentials: 'include'` in fetch requests
- Ensure CAS authentication is working
- Check session expiration (24 hours)

### Debug Mode

Enable verbose logging:
```typescript
// In development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log('[DEBUG]', {
      method: req.method,
      path: req.path,
      authenticated: req.isAuthenticated(),
      user: (req as AuthenticatedRequest).user,
      session: req.session,
    });
    next();
  });
}
```

## Future Enhancements

1. **Permission-Based Access Control (PBAC)**
   - More granular than role-based
   - Define permissions: `menu:create`, `menu:update`, `menu:delete`
   - Assign permissions to roles

2. **Attribute-Based Access Control (ABAC)**
   - Context-aware authorization
   - Example: Staff can only modify items they created

3. **Multi-Factor Authentication (MFA)**
   - For admin actions
   - Time-based OTP (TOTP)

4. **IP Whitelisting**
   - Restrict admin access to campus network

5. **Advanced Rate Limiting**
   - Sliding window counters
   - Token bucket algorithm
   - Different limits per endpoint

6. **Anomaly Detection**
   - ML-based detection of unusual access patterns
   - Alert on suspicious activity
