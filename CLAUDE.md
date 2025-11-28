# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

- **Start dev server**: `npm run dev` (starts Vite on http://localhost:5173 or next available port)
- **Build for production**: `npm run build` (TypeScript type check + Vite build to /dist)
- **Lint code**: `npm run lint` (ESLint with TypeScript support)
- **Preview production build**: `npm run preview`

## Project Architecture

BlueBite is a **React 19 web application** for a Yale Buttery ordering system. The frontend is feature-complete with a modern component-based architecture. The backend is scaffolded but not yet implemented.

### Frontend Stack
- **React 19** with TypeScript 5.9 (strict mode)
- **Vite 7** for bundling and dev server
- **Tailwind CSS 4** for styling with custom theme
- **shadcn/ui** for component library
- **Lucide React** for icons
- **localStorage** for state persistence (no backend API yet)

### Directory Structure

```
BlueBite/
├── src/                         # Frontend source (React application)
│   ├── components/              # 7 main React components
│   │   ├── Header.tsx           # Top navigation
│   │   ├── MenuGrid.tsx         # Menu item display
│   │   ├── ItemDetailModal.tsx  # Item details & modifiers
│   │   ├── ModifierModal.tsx    # Add-on selection
│   │   ├── CartModal.tsx        # Shopping cart & checkout
│   │   ├── CartPanel.tsx        # Cart summary
│   │   └── OrderManager.tsx     # Order tracking
│   ├── utils/
│   │   ├── storage.ts           # localStorage abstraction (keys: bluebite_orders, bluebite_menu_items, bluebite_cart)
│   │   └── mockData.ts          # Development data
│   ├── types.ts                 # TypeScript interfaces: MenuItem, Modifier, Order (status: pending|preparing|ready|completed|cancelled), User, etc.
│   ├── App.tsx                  # Main app with split-screen layout
│   ├── App.css & index.css      # Styling
│   └── main.tsx                 # React root
├── backend/                     # Backend (scaffolded, not yet implemented)
│   ├── src/routes/              # Backend routes (empty)
│   ├── prisma/                  # Prisma ORM schema
│   └── generated/               # Generated types from Prisma
├── public/                      # Static assets
├── dist/                        # Built output (Vite)
├── node_modules/                # Dependencies
├── documentation/               # Project docs
└── Configuration files
    ├── package.json             # Root dependencies
    ├── vite.config.ts           # Vite config
    ├── tsconfig.json            # TypeScript config
    ├── tailwind.config.js       # Tailwind theme
    ├── postcss.config.js        # PostCSS config
    └── eslint.config.js         # ESLint config
```

## State Management & Data Flow

- **Unidirectional flow**: App.tsx manages all state, passes data down as props, receives updates via callbacks (onAddToCart, onUpdateOrder, etc.)
- **No external state management** - uses React hooks (useState, useEffect)
- **Persistence**: localStorage with keys `bluebite_orders`, `bluebite_menu_items`, `bluebite_cart`
- **Mock data**: initialized on first run from `mockData.ts`

## Key Features

- **Split-screen layout**: Resizable left panel (ordering) and right panel (order management)
- **Order statuses**: pending → preparing → ready → completed (or cancelled)
- **Real-time order tracking**: 5-second polling intervals for status updates
- **Modifiers system**: Items can have add-ons/customizations
- **UI Polish**: Semi-transparent blurred backgrounds, color-coded status badges, fade-in animations
- **"Pass to Customer" mode**: 3-second countdown for device handoff
- **Undo functionality**: Revert recent order status changes

## Styling & Theme

- **Tailwind CSS 4** with custom brand colors in `tailwind.config.js`:
  - `bluebite-primary: #0066FF`
  - `bluebite-dark: #003DB3`
  - `bluebite-light: #4D99FF`
- **Responsive design** with mobile-first approach
- **PostCSS** with autoprefixer for browser compatibility
- **Babel React Compiler** enabled for performance optimization

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

- **HMR (Hot Module Replacement)** is enabled - changes reflect immediately in browser
- **Browser compatibility**: Modern browsers (ES2022+), use autoprefixer for legacy support if needed
- **Component organization**: Each component handles its own local state; larger state shared via App.tsx
- **Imports**: Use explicit relative paths (e.g., `./ItemDetailModal`), not index exports
- **Storage utility**: Use `storage.ts` for any localStorage operations to maintain consistency

## Common Workflows

**Adding a new menu item type**:
1. Update `MenuItem` interface in `types.ts`
2. Modify mock data in `mockData.ts` if needed
3. Update components that render items (MenuGrid, ItemDetailModal)
4. Test with `npm run dev`

**Modifying order flow**:
1. Check order status enum in `types.ts`
2. Update OrderManager logic if needed
3. Ensure state updates propagate through App.tsx callbacks
4. Test order status transitions

**Styling changes**:
1. Use Tailwind utility classes in JSX
2. For component-specific styles, add to `App.css` or component file
3. Custom colors available via `bluebite-*` classes
4. Run `npm run lint` to ensure no styling conflicts

## Backend (Not Yet Implemented)

- Prisma schema exists in `backend/prisma/` but no implementation
- No database connection or API endpoints currently active
- Frontend currently uses localStorage for all persistence
- When backend is ready, replace localStorage calls with API calls via fetch/axios

## Recent Changes

- Modal overlays with semi-transparent blurred background
- Aesthetic and functional frontend improvements
- Project structure flattened (no nested BlueBite directories)
