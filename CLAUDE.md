# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

### Frontend (React + Vite)
- **Start dev server**: `npm run dev` (starts Vite on http://localhost:5173 or next available port)
- **Build for production**: `npm run build` (TypeScript type check + Vite build to /dist)
- **Lint code**: `npm run lint` (ESLint with TypeScript support)
- **Preview production build**: `npm run preview`

### Backend (Express + Prisma)
All commands must be run from the `backend/` directory:
- **Start dev server**: `npm run dev` (nodemon with ts-node on http://localhost:3000)
- **Build for production**: `npm run build` (TypeScript compilation to /dist)
- **Run production build**: `npm start` (runs compiled JavaScript)
- **Push Prisma schema to database**: `npm run db:push` (syncs schema.prisma with PostgreSQL)
- **Pull database schema**: `npm run db:pull` (generates schema from existing database)
- **Seed database**: `npm run seed` (runs seed.ts to populate initial data)

## Project Architecture

BlueBite is a **full-stack React 19 web application** for a Yale Buttery ordering system with an Express backend, PostgreSQL database, and Yale CAS authentication.

### Tech Stack

**Frontend:**
- **React 19** with TypeScript 5.9 (strict mode)
- **Vite 7** for bundling and dev server
- **Tailwind CSS 4** for styling with custom theme
- **Lucide React** for icons
- **localStorage** for caching menu items and orders (progressive enhancement)

**Backend:**
- **Express 5** with TypeScript
- **Prisma ORM** for database access
- **PostgreSQL** (hosted on Supabase)
- **Passport.js** with Yale CAS authentication strategy
- **express-session** for session management
- **CORS** enabled for frontend communication

### Directory Structure

```
BlueBite/
├── src/                         # Frontend source (React application)
│   ├── components/              # React components
│   │   ├── ui/                  # Reusable UI primitives (see ui/README.md)
│   │   │   ├── GlassPanel.tsx   # Glass container with coordinated radius/padding
│   │   │   ├── GlassButton.tsx  # Button with CSS hover states (4 variants)
│   │   │   ├── GlassButton.css  # Button hover/focus styles
│   │   │   ├── Text.tsx         # Typography (6 variants, enforces font rules)
│   │   │   ├── GlassDivider.tsx # Luminous horizontal separator
│   │   │   └── index.ts        # Barrel export
│   │   ├── Header.tsx           # Top navigation
│   │   ├── MenuGrid.tsx         # Menu item display
│   │   ├── ItemDetailModal.tsx  # Item details & modifiers
│   │   ├── CartModal.tsx        # Shopping cart & checkout
│   │   ├── OrderManager.tsx     # Order tracking & management
│   │   ├── LoginPage.tsx        # CAS authentication login page
│   │   ├── ButterySelectionPage.tsx # Buttery picker
│   │   ├── SettingsModal.tsx    # User settings
│   │   └── MarbleBackground.tsx # Animated background effect
│   ├── styles/
│   │   └── tokens.css           # CSS custom properties (design tokens)
│   ├── utils/
│   │   ├── api.ts               # Backend API client (fetch wrappers for all endpoints)
│   │   ├── config.ts            # App config (API_BASE_URL from VITE_API_URL)
│   │   ├── sse.ts               # Server-Sent Events client (real-time order/menu updates)
│   │   ├── storage.ts           # localStorage cache abstraction
│   │   ├── cart.ts              # Cart total calculation
│   │   ├── order.ts             # Order enrichment (menu name lookups)
│   │   ├── optimistic.ts        # Optimistic UI update helpers
│   │   ├── yalies.ts            # Yalies API integration
│   │   └── yaliesCache.ts       # Yalies data caching
│   ├── types.ts                 # Shared TypeScript interfaces
│   ├── App.tsx                  # Main app with split-screen layout
│   └── main.tsx                 # React root
├── backend/                     # Backend (Express + Prisma)
│   ├── src/
│   │   ├── index.ts             # Express server with all API routes
│   │   ├── auth/
│   │   │   ├── cas.ts           # Passport CAS strategy configuration
│   │   │   └── cas-wrapper.ts   # CAS authentication wrapper
│   │   ├── middleware/
│   │   │   ├── auth.ts          # requireAuth, requireStaff, requireAdmin middleware
│   │   │   ├── security.ts      # Security middleware
│   │   │   └── fieldAuthorization.ts # Field-level authorization
│   │   ├── routes/
│   │   │   └── menu.ts          # Menu route handlers
│   │   └── seed.ts              # Database seeding script
│   ├── prisma/
│   │   └── schema.prisma        # Prisma schema
│   └── package.json             # Backend dependencies
├── documentation/               # Project documentation (plans, integration guides)
└── Configuration files
    ├── package.json             # Frontend dependencies
    ├── vite.config.ts           # Vite bundler config
    ├── tsconfig.json            # TypeScript root config
    ├── tailwind.config.js       # Tailwind CSS theme
    └── eslint.config.js         # ESLint config
```

## Data Flow & API Integration

### Frontend State Management
- **Unidirectional flow**: App.tsx manages all state, passes data down as props, receives updates via callbacks
- **No external state management** - uses React hooks (useState, useEffect)
- **Real-time updates via SSE**: `src/utils/sse.ts` connects to `/api/events` for order and menu change events (singleton EventSource pattern)
- **Optimistic updates**: `src/utils/optimistic.ts` provides instant UI feedback before server confirmation
- **API client**: `src/utils/api.ts` wraps all backend calls with type-safe response mapping
- **Progressive caching**: localStorage caches API responses (menu items, orders) with buttery-aware invalidation
- **Cache keys**: `bluebite_cache_menu`, `bluebite_cache_orders`, `bluebite_cart`, `bluebite_selected_buttery`

### Backend API Endpoints
All endpoints are defined in `backend/src/index.ts`:

**Real-time:**
- `GET /api/events` - SSE stream for order and menu change events

**Authentication (Yale CAS):**
- `GET /api/auth/login` - Initiates CAS login and handles callback with ticket validation
- `POST /api/auth/logout` - Destroys session
- `GET /api/auth/user` - Returns current authenticated user

**Users:**
- `POST /api/users` - Create user by NetID (auto-created during order placement)

**Menu Items:**
- `GET /api/menu` - Get all menu items (optional `?buttery=` filter)
- `POST /api/menu` - Create menu item (requires admin)
- `GET /api/menu/category/:category` - Get items by category
- `GET /api/menu/:itemId` - Get single menu item with modifiers
- `PUT /api/menu/:itemId` - Update menu item (requires admin)
- `DELETE /api/menu/:itemId` - Delete menu item (requires admin)
- `PATCH /api/menu/:itemId/toggle` - Toggle item availability (requires staff)

**Modifiers:**
- `POST /api/menu/:itemId/modifiers` - Create modifier (requires admin)
- `GET /api/menu/:itemId/modifiers` - Get all modifiers for menu item
- `PUT /api/menu/:itemId/modifiers/:modifierId` - Update modifier (requires admin)
- `DELETE /api/menu/:itemId/modifiers/:modifierId` - Delete modifier (requires admin)

**Orders:**
- `POST /api/orders` - Create order with items (auto-creates user if needed)
- `GET /api/orders` - Get all orders (optional `?buttery=` filter)
- `GET /api/users/:netId/orders` - Get user's orders (optional `?buttery=` filter)
- `PATCH /api/orders/:orderId` - Update order status

**Butteries:**
- `GET /api/butteries` - Get list of all butteries (grouped from menu items)

## Database Schema (Prisma)

**Key models in `backend/prisma/schema.prisma`:**
- **User** - Identified by NetID (Yale unique identifier), role (customer/staff/admin)
- **MenuItem** - Menu items with category, price, hot/cold flag, buttery association, availability
- **Modifier** - Add-ons for menu items (many-to-one with MenuItem)
- **Order** - User orders with status, totalPrice, buttery association
- **OrderItem** - Junction table for Order ↔ MenuItem (quantity, price snapshot)
- **OrderItemModifier** - Junction table for OrderItem ↔ Modifier (many-to-many)

**Order status flow**: `pending` → `preparing` → `ready` → `completed` (or `cancelled`)

## Authentication & Authorization

- **Yale CAS (Central Authentication Service)** integration via `@coursetable/passport-cas`
- CAS server: `https://secure-tst.its.yale.edu/cas` (test environment)
- Session-based authentication using `express-session`
- Users are auto-created in database on first CAS login
- NetID is the primary identifier throughout the system
- **Role-based middleware** in `backend/src/middleware/auth.ts`: `requireAuth`, `requireStaff`, `requireAdmin`
- **Field-level authorization** in `backend/src/middleware/fieldAuthorization.ts`
- Admin-only: create/update/delete menu items and modifiers; Staff+: toggle item availability

## Key Frontend Features

- **Split-screen layout**: Resizable left panel (ordering) and right panel (order management)
- **Real-time order tracking**: Server-Sent Events (SSE) for live status updates
- **Modifiers system**: Items can have add-ons/customizations
- **Buttery filtering**: Multi-buttery support with user preference persistence
- **UI Polish**: Semi-transparent blurred backgrounds, color-coded status badges, animations
- **"Pass to Customer" mode**: Countdown for device handoff
- **Undo functionality**: Revert recent order status changes
- **Progressive caching**: Fast UI with localStorage fallback when API is slow

## Styling & Theme

- **Tailwind CSS 4** with custom brand colors in `tailwind.config.js`:
  - `bluebite-primary: #0066FF`
  - `bluebite-dark: #003DB3`
  - `bluebite-light: #4D99FF`
- **Responsive design** with mobile-first approach
- **PostCSS** with autoprefixer for browser compatibility
- **Babel React Compiler** enabled for performance optimization

### UI Component Library (`src/components/ui/`)

Reusable primitives that encode the DESIGN.md glassmorphism rules. **Always use these instead of inline styles for glass effects, typography, and buttons.** Full docs in `src/components/ui/README.md`.

- **`<GlassPanel level="modal|card|surface">`** — Glass container with coordinated border-radius and padding (content never clips corners). Use `modal` for top-level panels, `card` for content containers, `surface` for nested inner sections.
- **`<GlassButton variant="default|primary|accent|ghost">`** — Button with hover states in CSS, not JS event handlers.
- **`<Text variant="brand|heading|title|body|label|whisper">`** — Typography enforcing Yeseva One (headings) / DM Sans (body) and the white opacity scale.
- **`<GlassDivider>`** — 1px luminous separator.

### Design Tokens (`src/styles/tokens.css`)

All glassmorphism values (colors, blur, radii, shadows, text opacity) are CSS custom properties. Use `var(--token-name)` instead of hardcoded `rgba(...)` values. Key tokens:
- `--glass-whisper` through `--glass-fog` — surface backgrounds
- `--blur-sm` through `--blur-xl` — backdrop filter intensities
- `--radius-modal`, `--radius-card`, `--radius-button` — corner rounding (coordinated with `--padding-*`)
- `--text-primary` through `--text-whisper` — white opacity text scale
- `--font-heading` (Yeseva One), `--font-body` (DM Sans)

## TypeScript Configuration

- **tsconfig.json**: Root config with references to app and node configs
- **tsconfig.app.json**: ES2022 target, DOM libs, strict mode, JSX support
- **tsconfig.node.json**: Build tool configuration
- All files use strict type checking; avoid `any` types

## Linting & Code Quality

**ESLint config** (`eslint.config.js`):
- Flat config format with recommended presets
- React Hooks plugin enabled (enforces rules of hooks)
- React Refresh plugin for HMR support
- Run with `npm run lint`

## Development Notes

### Frontend
- **HMR (Hot Module Replacement)** is enabled - changes reflect immediately in browser
- **Component organization**: Each component handles its own local state; shared state managed in App.tsx
- **Imports**: Use explicit relative paths (e.g., `./ItemDetailModal`), not index exports
- **Storage utility**: Always use `src/utils/storage.ts` for localStorage operations (cache management, cart, buttery selection)
- **Popout views**: App supports `?view=menu` and `?view=orders` query params for separate windows

### Backend
- **Prisma workflow**: After modifying `schema.prisma`, run `npm run db:push` (from `backend/`) to sync with database
- **Type generation**: Prisma Client types are auto-generated after db:push in `node_modules/.prisma/client`
- **Error handling**: All routes use try/catch with appropriate HTTP status codes
- **Session secret**: Set `SESSION_SECRET` environment variable in production
- **CORS configuration**: Frontend origin is configured via `CORS_ORIGIN` environment variable (defaults to localhost:5173)
- **Database connection**: Requires `DATABASE_URL` and `DIRECT_URL` environment variables for Supabase PostgreSQL
- **Tests**: Middleware tests in `backend/src/middleware/__tests__/` (auth, field authorization)

## Common Workflows

### Adding a New Prisma Model Field
1. Update model in `backend/prisma/schema.prisma`
2. Run `cd backend && npm run db:push` to sync database
3. Update TypeScript interfaces in `src/types.ts` if needed for frontend
4. Update relevant API endpoints in `backend/src/index.ts`
5. Update frontend components that display the data

### Adding a New API Endpoint
1. Add route handler in `backend/src/index.ts` (all routes are in one file)
2. Use Prisma Client methods for database operations
3. Add proper error handling (try/catch with HTTP status codes)
4. Test endpoint with curl or Postman
5. Update frontend to call the new endpoint

### Modifying Order Flow
1. Update order status enum in `backend/prisma/schema.prisma` if adding new statuses
2. Run `cd backend && npm run db:push` to sync changes
3. Update `Order` interface in `src/types.ts`
4. Update OrderManager component logic
5. Test order status transitions in UI

### Styling Changes
1. Use Tailwind utility classes in JSX
2. Custom colors available via `bluebite-*` classes (primary, dark, light)
3. For component-specific styles, add to `App.css`
4. Run `npm run lint` to check for issues

### Database Seeding
1. Modify `backend/src/seed.ts` with initial data
2. Run `cd backend && npm run seed` to populate database
3. Verify data via API endpoints or database client

## Environment Variables

### Frontend (.env in project root)
Optional (Vite exposes these via `import.meta.env`):
- `VITE_API_URL` - Backend API base URL (default: "http://localhost:3000/api")
- `VITE_YALIES_KEY` - Yalies API key for student directory lookups

### Backend (.env in backend/)
Required:
- `DATABASE_URL` - PostgreSQL connection string (Supabase)
- `DIRECT_URL` - Direct PostgreSQL connection (Supabase, bypasses connection pooler)

Optional:
- `PORT` - Backend port (default: 3000)
- `SESSION_SECRET` - Session encryption key (default: "bluebite-dev-secret")
- `CORS_ORIGIN` - Frontend URL (default: "http://localhost:5173")
- `SERVER_BASE_URL` - Backend base URL for CAS callback (default: "http://localhost:3000")
- `NODE_ENV` - Environment (production/development)
