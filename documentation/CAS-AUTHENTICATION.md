# Yale CAS Authentication Integration

## Overview

BlueBite uses Yale's Central Authentication Service (CAS) for secure authentication. Users can log in with their Yale NetID without needing passwords. The authentication is managed via Passport.js and Express sessions.

## How It Works

### Authentication Flow

1. **User clicks "Login with Yale CAS"** in the Settings modal
2. **Frontend redirects to `/api/auth/login`** (backend CAS endpoint)
3. **Backend redirects user to Yale's CAS server** for authentication
4. **User logs in at Yale** and is redirected back to backend with a service ticket
5. **Backend validates the ticket** with Yale's CAS server
6. **Session is created** with a secure, HttpOnly cookie
7. **User is redirected to frontend** (no URL parameters)
8. **Frontend fetches user data** from `/api/auth/user` using session cookie
9. **Settings modal displays** "Logged in as {netId}"

### Key Benefits

- ✅ No passwords stored (Yale manages authentication)
- ✅ Secure session cookies (HttpOnly, secure flag in production)
- ✅ Automatic user creation in database on first login
- ✅ Clean URLs (no auth parameters visible)
- ✅ Session-based approach (standard web authentication)

## Setup

### Prerequisites

- Node.js 18+
- Backend running at http://localhost:3000 (or configured via `SERVER_BASE_URL`)
- Frontend running at http://localhost:5173 (or configured via `CORS_ORIGIN`)

### Environment Variables

Create/update `.env` in `/backend` directory:

```env
# CAS Configuration
SERVER_BASE_URL="http://localhost:3000"  # Backend server URL
CORS_ORIGIN="http://localhost:5173"      # Frontend URL (for redirects after auth)

# Session
SESSION_SECRET="your-secret-key"         # Random string for session encryption

# Database (existing)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
PORT=3000
```

### Installation

CAS dependencies are already installed:

```bash
# These are already in package.json:
- @coursetable/passport-cas (v0.1.4)
- passport
- express-session
```

If needed, install manually:

```bash
cd backend
npm install passport @coursetable/passport-cas express-session
```

## API Endpoints

### GET `/api/auth/login`

Initiates CAS authentication or handles CAS callback.

**Usage**:
- Click "Login with Yale CAS" button → redirects to this endpoint
- Yale CAS redirects back to this endpoint with a `ticket` parameter
- Backend validates ticket and creates session

**Response**:
- On success: Redirects to frontend URL
- On failure: Returns JSON error response

### POST `/api/auth/logout`

Destroys the user's session.

**Request Body**:
```json
{}
```

**Response** (200):
```json
{
  "message": "Logged out successfully"
}
```

### GET `/api/auth/user`

Returns the current authenticated user's information.

**Response** (200 - authenticated):
```json
{
  "netId": "ewb28",
  "name": "John Doe",
  "role": "customer"
}
```

**Response** (401 - not authenticated):
```json
{
  "error": "Not authenticated"
}
```

## Frontend Integration

### App Component

The main `App.tsx` component fetches and caches the user login status when the page loads:

```typescript
// File: src/App.tsx

const [currentUser, setCurrentUser] = useState<User | null>(null);

// Initialize on mount
useEffect(() => {
  const init = async () => {
    // Fetch current user login status
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${apiUrl}/auth/user`, {
        credentials: 'include',
      });
      if (response.ok) {
        const user = await response.json();
        setCurrentUser(user);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  };

  init();
}, []);
```

**Key Points**:
- User data is fetched **once on page load** and cached in `currentUser` state
- Avoids repeated API calls when opening the settings modal
- `credentials: 'include'` ensures session cookies are sent with the request
- Cached data is passed to SettingsModal as a prop

### SettingsModal Component

The `SettingsModal` component receives cached user data and callbacks:

```typescript
// File: src/components/SettingsModal.tsx

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserLogin: (user: User) => void;
  onUserLogout: () => void;
}

export function SettingsModal({ isOpen, onClose, currentUser, onUserLogin, onUserLogout }: SettingsModalProps) {
  const handleCASLogin = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    window.location.href = `${apiUrl}/auth/login`;
  };

  const handleLogout = async () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    await fetch(`${apiUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    onUserLogout();
  };

  return (
    {currentUser ? (
      <div>
        <div>Logged in as {currentUser.netId}</div>
        <button onClick={handleLogout}>Logout</button>
      </div>
    ) : (
      <button onClick={handleCASLogin}>Login with Yale CAS</button>
    )}
  );
}
```

**Key Points**:
- Uses cached `currentUser` prop instead of fetching on every open
- Displays "Logged in as {netId}" or login button based on auth state
- Logout calls the backend, then notifies parent via `onUserLogout()`
- After successful login redirect, parent component receives `onUserLogin()` callback if needed

## Backend Implementation

### File: `backend/src/auth/cas.ts`

Configures Passport.js CAS strategy:

```typescript
const casOptions = {
  version: "CAS2.0",
  ssoBaseURL: "https://secure-tst.its.yale.edu/cas",  // Test CAS server
  serverBaseURL: process.env.SERVER_BASE_URL || "http://localhost:3000",
};

passport.use(
  new CasStrategy(casOptions, async (profile: any, done: any) => {
    const netId = profile.user || profile.nameidentifier;

    // Auto-create/update user in database
    const user = await prisma.user.upsert({
      where: { netId },
      update: { updatedAt: new Date() },
      create: { netId, role: "customer" },
    });

    return done(null, { netId: user.netId, name: user.name, role: user.role });
  })
);
```

**Configuration Details**:
- **version**: "CAS2.0" - Yale's test CAS uses the serviceValidate endpoint
- **ssoBaseURL**: Yale's test CAS server URL
- **serverBaseURL**: Used to construct the callback URL (where CAS redirects back)
- **verify function**: Receives CAS profile, creates/updates user in database

### File: `backend/src/index.ts`

Handles authentication routes:

```typescript
// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || "bluebite-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",  // HTTPS only in production
    httpOnly: true,                                  // JavaScript can't access cookie
    maxAge: 1000 * 60 * 60 * 24,                    // 24 hours
  },
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// CAS login route
app.get("/api/auth/login", (req, res, next) => {
  passport.authenticate("cas", { failureRedirect: "/" })(req, res, (err) => {
    if (err) {
      console.error("CAS authentication error:", err);
      return res.status(500).json({ error: "Authentication failed" });
    }
    next();
  });
}, (req, res) => {
  // Success: redirect to frontend (no URL params)
  const frontendUrl = process.env.CORS_ORIGIN || "http://localhost:5173";
  res.redirect(frontendUrl);
});

// Logout route
app.post("/api/auth/logout", (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.json({ message: "Logged out successfully" });
  });
});

// Get current user
app.get("/api/auth/user", (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});
```

## Testing CAS Login

### Local Development

1. **Start the backend**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend**:
   ```bash
   npm run dev
   ```

3. **Test the login flow**:
   - Open http://localhost:5173
   - Click Settings button
   - Click "Login with Yale CAS"
   - You'll be redirected to Yale's test CAS server
   - Log in with your Yale credentials
   - You'll be redirected back and should see "Logged in as {your_netId}"

4. **Test logout** (via API):
   ```bash
   curl -X POST http://localhost:3000/api/auth/logout
   ```

5. **Check session** (via API):
   ```bash
   curl -X GET http://localhost:3000/api/auth/user \
     -b "connect.sid=your_session_cookie"
   ```

### Important Notes for Testing

- **Yale's Test CAS**: No registration required for localhost
- **Service URL**: Must match what's configured in the CAS strategy
- **Session Cookies**: Automatically managed by browser, included with `credentials: 'include'`
- **CORS**: Must be configured to allow credentials from frontend domain

## Production Deployment

### Configuration Changes

Update environment variables for production:

```env
# Production CAS Server (change from test)
SERVER_BASE_URL="https://yourdomain.com"
CORS_ORIGIN="https://yourdomain.com"

# Security
SESSION_SECRET="generate-a-secure-random-string"
NODE_ENV="production"

# Database
DATABASE_URL="your-production-db-url"
DIRECT_URL="your-production-db-url"
```

### Security Checklist

- ✅ `secure: true` in cookie options (HTTPS only)
- ✅ Use strong `SESSION_SECRET` (random string, 32+ characters)
- ✅ Update `SERVER_BASE_URL` to production domain
- ✅ Update `CORS_ORIGIN` to production frontend domain
- ✅ Switch to Yale's production CAS server (not test)
- ✅ Enable HTTPS on backend and frontend
- ✅ Set `NODE_ENV=production`

### Production CAS Server

For production, change the CAS server in `backend/src/auth/cas.ts`:

```typescript
const casOptions = {
  version: "CAS2.0",
  ssoBaseURL: "https://secure.its.yale.edu/cas",  // Production CAS
  serverBaseURL: process.env.SERVER_BASE_URL,
};
```

## Troubleshooting

### "Error in validation" during CAS callback

**Cause**: CAS server rejected the validation request
**Solutions**:
- Verify `SERVER_BASE_URL` matches the callback URL Yale has registered
- Check that the service URL parameter is consistent
- Ensure backend is reachable from CAS server
- Check backend logs for detailed error information

### "Not Authorized to this service"

**Cause**: Domain not registered with Yale's CAS (for production CAS)
**Solution**:
- Use test CAS: `https://secure-tst.its.yale.edu/cas`
- For production, register domain with Yale IT

### Session not persisting

**Cause**: Cookies not being set or sent
**Solutions**:
- Ensure `credentials: 'include'` in frontend fetch requests
- Check that `httpOnly: false` is not set (keep cookies HttpOnly for security)
- Verify CORS configuration allows credentials
- Check browser console for cookie warnings

### User not found after login

**Cause**: Database not persisting user data
**Solutions**:
- Verify database connection in `.env`
- Check that Prisma is configured correctly
- Run `npm run db:push` to ensure schema is up to date
- Check database for user records

## Related Files

- `backend/src/auth/cas.ts` - CAS strategy configuration
- `backend/src/index.ts` - Authentication routes
- `src/components/SettingsModal.tsx` - Frontend login UI
- `src/components/Header.tsx` - Settings button navigation

## Additional Resources

- [Passport.js Documentation](http://www.passportjs.org/)
- [CAS Protocol](https://apereo.github.io/cas/6.0.x/protocol/CAS-Protocol.html)
- [Express Sessions](https://www.npmjs.com/package/express-session)
- [@coursetable/passport-cas](https://github.com/coursetable/passport-cas)
