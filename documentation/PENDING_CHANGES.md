# Pending Changes - Frontend & Backend

**Last Updated**: December 1, 2025

## Overview

This document outlines all uncommitted changes to the BlueBite codebase. Changes span both frontend (React) and backend (Express/Prisma) and introduce a multi-buttery filtering system with API integration.

**Modified Files**: 8 files
**New Files**: 1 file
**Total Lines Changed**: 154 insertions, 25 deletions

---

## Backend Changes

### 1. Database Schema Updates (`backend/prisma/schema.prisma`)

**Summary**: Added buttery/residential college support to menu items and orders with database indexes for query optimization.

**Changes**:

#### MenuItem Model
- Added `buttery?: String` field to track which residential college an item belongs to
- Added database index on `buttery` field for fast filtering queries

#### Order Model
- Added `buttery?: String` field to track which buttery an order was placed for
- Added database index on `buttery` field for efficient order filtering and reporting

**Impact**: Enables filtering menu items and orders by residential college, supporting multi-buttery operations at Yale.

---

### 2. API Endpoints (`backend/src/index.ts`)

**Summary**: Expanded REST API with buttery filtering capabilities and new endpoints.

**New/Modified Endpoints**:

#### GET `/api/menu` (Enhanced)
- **Previous**: Returned all menu items
- **Now**: Supports optional `?buttery=` query parameter to filter by residential college
- **Example**: `/api/menu?buttery=Berkeley` returns only Berkeley Buttery items

#### POST `/api/orders` (Enhanced)
- **Previous**: Required `userId` and `totalPrice`
- **Now**: Accepts optional `buttery` field in request body
- **Stores**: Buttery information with order for tracking which college the order was for

#### GET `/api/users/:userId/orders` (Enhanced)
- **Previous**: Returned all user orders
- **Now**: Supports optional `?buttery=` query parameter to filter orders by residential college

#### GET `/api/butteries` (NEW)
- **Purpose**: Returns list of all active butteries with item counts
- **Response Format**:
  ```json
  [
    { "name": "Berkeley", "itemCount": 124 },
    { "name": "Davenport", "itemCount": 98 },
    { "name": "Timothy Dwight", "itemCount": 156 }
  ]
  ```
- **Implementation**: Queries unique `buttery` values from MenuItem model using `groupBy()`
- **Filters**: Excludes null/empty buttery values

**Middleware**:
- CORS configuration allows requests from frontend (default: `http://localhost:5173`)
- Supports credentials for secure authentication context

---

### 3. Database Seeding (`backend/src/seed.ts`)

**Summary**: Seed script populates database from Yale menus JSON file with intelligent categorization.

**Key Features**:

- **Data Source**: Reads from `yalemenus.json` (Yale Residential College menu data)
- **Batching**: Processes items in 50-item batches to prevent database overload
- **Validation**:
  - Skips items missing Name, Price, or Category
  - Validates numeric prices (≥0)
  - Silently skips duplicates

- **Smart Categorization**:
  - Standardizes diverse menu categories to 5 main types:
    - `Main`: Hot entrees, sandwiches, pizza, pasta, fried items
    - `Salad`: Salads and cold plates
    - `Side`: Fries, sides, vegetables
    - `Drinks`: Beverages, coffee, tea
    - `Dessert`: Sweets, ice cream, cookies

- **Hot/Cold Detection**:
  - Checks category keywords to determine if item is served hot
  - Hot items include: burgers, chicken, pizza, pasta, fries, etc.

- **Buttery Mapping**:
  - Maps "Residential College" field from JSON to `buttery` field in database
  - Preserves college affiliation for filtering

**Output**: Displays summary statistics after seeding:
```
✅ Seed completed!
   ✓ Successfully inserted: 2,341 items
   ⊘ Skipped (invalid/duplicate): 45 items

📊 Items by category:
   Main: 987
   Dessert: 445
   Side: 312
   Drinks: 456
   Salad: 141

🔥 Hot/Cold distribution:
   🔥 Hot: 1,234
   ❄️ Cold: 1,107
```

---

## Frontend Changes

### 1. Type Definitions (`src/types.ts`)

**Summary**: Added buttery support to MenuItem and Order interfaces.

**Changes**:

#### MenuItem Interface
- Added `buttery?: string | null` field to store residential college affiliation

#### Order Interface
- Added `buttery?: string | null` field to track which buttery the order was placed for

---

### 2. API Service Layer (`src/utils/api.ts`)

**Summary**: New API service module with buttery filtering support.

**Features**:

#### Type Definitions
- `BackendModifier`: Represents modifier data from backend
- `BackendMenuItem`: Represents menu item data from backend
- Typed to match Prisma schema structure

#### Helper Function: `transformMenuItem()`
- Converts backend MenuItem to frontend MenuItem format
- Maps `available` → `disabled` (inverted boolean)
- Transforms modifiers to frontend format
- Handles null/undefined optional fields

#### API Methods

**`fetchMenuItems(buttery?: string): Promise<MenuItem[]>`**
- Fetches menu items from `/api/menu` endpoint
- **Parameters**:
  - `buttery` (optional): Filter items by residential college
- **Strategy**:
  - Query parameter encoded with `encodeURIComponent()`
  - Includes credentials for authenticated requests
  - Returns transformed MenuItem array
- **Error Handling**: Logs errors and throws for caller handling

**`fetchButteries(): Promise<Array<{name: string; itemCount: number}>>`**
- Fetches list of all butteries from `/api/butteries` endpoint
- **Returns**: Array of buttery objects with name and item count
- **Usage**: Populates buttery selector dropdown in UI

#### Configuration
- `API_BASE_URL`: Read from `VITE_API_URL` environment variable, defaults to `http://localhost:3000/api`
- Credentials: `credentials: 'include'` for secure requests

---

### 3. Storage Utilities (`src/utils/storage.ts`)

**Summary**: Enhanced localStorage wrapper with buttery selection persistence.

**New Methods**:

**`getSelectedButtery(): string | null`**
- Retrieves user's previously selected buttery from localStorage
- Key: `bluebite_selected_buttery`
- Returns null if not set

**`setSelectedButtery(buttery: string | null): void`**
- Saves buttery selection to localStorage
- Removes key if `buttery === null`
- Persists user preference across sessions

**Updated Methods**:

**`clear(): void`**
- Extended to also clear `bluebite_selected_buttery` key
- Ensures full app reset clears all stored data

---

### 4. Main Application (`src/App.tsx`)

**Summary**: Complete overhaul of state management and data flow for multi-buttery support.

**New State Variables**:

```typescript
const [selectedButtery, setSelectedButtery] = useState<string | null>(() =>
  storage.getSelectedButtery()
);
const [butteryOptions, setButteryOptions] = useState<
  Array<{name: string; itemCount: number}>
>([ ]);
```

**New Effects**:

**Initialization Effect** (replaces old single effect)
```typescript
useEffect(() => {
  // Fetch buttery options from API
  api.fetchButteries()
    .then(setButteryOptions)
    .catch(err => console.error('Failed to fetch butteries:', err));

  // Initialize orders and cart from storage
  const storedOrders = storage.getOrders();
  setOrders(storedOrders);

  const storedCart = storage.getCart();
  setCartItems(storedCart.items || []);
}, []);
```
- Runs once on mount
- Populates buttery dropdown options
- Restores persisted orders and cart

**Menu Loading Effect** (depends on `selectedButtery`)
```typescript
useEffect(() => {
  const loadMenuItems = async () => {
    // 1. Cache-first: Show cached menu immediately
    const cachedMenu = storage.getMenuItems();
    if (cachedMenu.length > 0) {
      const filtered = selectedButtery
        ? cachedMenu.filter(item => item.buttery === selectedButtery)
        : cachedMenu;
      setMenuItems(filtered);
    }

    // 2. Fetch fresh data in background
    try {
      const freshMenu = await api.fetchMenuItems(selectedButtery || undefined);
      setMenuItems(freshMenu);
      storage.setMenuItems(freshMenu);
    } catch (error) {
      // 3. Fallback to mock data if no cache and API fails
      if (cachedMenu.length === 0) {
        console.warn('Using mock data as fallback');
        storage.setMenuItems(mockMenuItems);
        setMenuItems(mockMenuItems);
      }
    }
  };
  loadMenuItems();
}, [selectedButtery]);
```
- Runs when `selectedButtery` changes
- Implements cache-first strategy for UX performance
- Filters cached menu by selected buttery
- Fetches fresh data from API in background
- Falls back to mock data if both cache and API fail

**Impact**: Eliminates data fetching on every render, improves performance with background updates

**New Handler: `handleButteryChange()`**
```typescript
const handleButteryChange = (buttery: string | null) => {
  setSelectedButtery(buttery);
  storage.setSelectedButtery(buttery);
  // Clear cart when switching butteries
  setCartItems([]);
  storage.setCart({ items: [], total: 0 });
};
```
- Updates selected buttery state
- Persists selection to storage
- Clears cart to prevent cross-buttery orders
- Triggers menu reload effect

**Updated: Order Creation**
```typescript
const newOrder: Order = {
  // ... existing fields ...
  buttery: selectedButtery || undefined,
  // ... rest of fields ...
};
```
- Includes selected buttery in new orders

**Updated: Order Filtering**
```typescript
const filteredOrders = selectedButtery
  ? orders.filter(o => o.buttery === selectedButtery)
  : orders;
```
- Orders panel shows only orders from selected buttery
- Shows all orders when "All Butteries" selected

**Updated: Header Props**
```typescript
<Header
  selectedButtery={selectedButtery}
  butteryOptions={butteryOptions}
  onButteryChange={handleButteryChange}
/>
```
- Passes buttery state and handlers to Header component

**Data Flow Summary**:
```
API/Storage → App State → Components → User Actions → Handlers → State Update → Storage → UI Re-render
```

---

### 5. Header Component (`src/components/Header.tsx`)

**Summary**: Updated to display buttery selector in header.

**Changes**:

**New Props**:
```typescript
interface HeaderProps {
  selectedButtery: string | null;
  butteryOptions: Array<{name: string; itemCount: number}>;
  onButteryChange: (buttery: string | null) => void;
}
```

**New Element**:
```tsx
<ButterySelector
  selected={selectedButtery}
  options={butteryOptions}
  onChange={onButteryChange}
/>
```
- Positioned in header center
- Allows user to switch between butteries
- Updates all filtered content dynamically

---

### 6. New Component: `src/components/ButterySelector.tsx`

**Summary**: Dropdown menu for selecting residential college/buttery.

**Features**:

**UI Elements**:
- Button displaying current selection or "All Butteries"
- Chevron icon that rotates when open
- Dropdown menu with scrollable options

**Functionality**:
- Toggles open/closed state on button click
- "All Butteries" option clears filter
- Individual buttery options with item counts
- Highlighted selection (blue background)
- Closes after selection
- Styled with Tailwind CSS using bluebite theme colors

**Props**:
```typescript
interface ButterySelectorProps {
  selected: string | null;        // Currently selected buttery
  options: ButteryOption[];       // List of available butteries
  onChange: (buttery: string | null) => void;  // Selection handler
}
```

**Styling**:
- White button with gray border
- Blue highlight for selected option
- Smooth hover transitions
- Mobile-friendly scrollable list (max-height: 400px)
- Z-index: 50 for proper overlay stacking

---

## Feature: Multi-Buttery System

### Architecture

The multi-buttery feature allows BlueBite to operate across Yale's residential colleges:

```
┌─────────────────────────────────────────┐
│         Frontend (React)                 │
│  ┌──────────────────────────────────┐   │
│  │   ButterySelector Component       │   │
│  │   (Dropdown: All / Berkeley /...  │   │
│  │    Davenport / Timothy Dwight)    │   │
│  └──────────────────────────────────┘   │
│           ↓ selectedButtery              │
│  ┌──────────────────────────────────┐   │
│  │  Filter Menu Items & Orders      │   │
│  │  by selected buttery             │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
              ↓ API Calls
┌─────────────────────────────────────────┐
│    Backend (Express + Prisma)           │
│  ┌──────────────────────────────────┐   │
│  │ GET /api/menu?buttery=Berkeley   │ → │ Query menuItem by buttery
│  │ GET /api/butteries               │ → │ List unique butteries
│  │ POST /api/orders                 │ → │ Create order with buttery
│  │ GET /api/users/:id/orders        │ → │ Filter orders by buttery
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
              ↓ Database
┌─────────────────────────────────────────┐
│   PostgreSQL Database (Prisma ORM)      │
│  ┌──────────────────────────────────┐   │
│  │ MenuItem { id, name, buttery,... │ → │ @@index([buttery])
│  │ Order { id, userId, buttery,... }│ → │ @@index([buttery])
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### User Experience Flow

1. **Initial Load**:
   - App fetches list of butteries via `/api/butteries`
   - Populates dropdown with names and item counts
   - Loads previously selected buttery from localStorage

2. **Buttery Selection**:
   - User clicks buttery selector dropdown
   - Selects "Berkeley" or another college
   - App filters menu items, clears cart, updates orders view

3. **Background Sync**:
   - Shows cached menu immediately (cache-first strategy)
   - Fetches fresh data from API for latest availability
   - Updates cache after API succeeds
   - Falls back to mock data if API unavailable

4. **Ordering**:
   - Items shown are only from selected buttery
   - Cart restricted to single buttery (cleared on switch)
   - Orders include buttery field for tracking
   - Order manager shows only orders for selected buttery

---

## Testing Checklist

### Frontend Tests
- [ ] Buttery selector dropdown opens/closes correctly
- [ ] Selection persists across page refreshes (localStorage)
- [ ] Switching butteries clears cart
- [ ] Menu filters correctly by selected buttery
- [ ] Orders panel shows only selected buttery's orders
- [ ] API fallback uses mock data when offline
- [ ] Item counts in dropdown match actual items

### Backend Tests
- [ ] `GET /api/butteries` returns all unique butteries with counts
- [ ] `GET /api/menu?buttery=X` filters correctly
- [ ] `POST /api/orders` accepts and stores buttery field
- [ ] `GET /api/users/:userId/orders?buttery=X` filters correctly
- [ ] Database indexes on buttery field exist
- [ ] Seed script populates buttery field from JSON

### Integration Tests
- [ ] Frontend loads butteries list from backend
- [ ] Selecting buttery in UI triggers API calls
- [ ] Order created with buttery field
- [ ] Orders fetched show correct buttery association

---

## Database Migration Notes

To apply schema changes to an existing PostgreSQL database:

```bash
cd backend
npx prisma migrate dev --name add_buttery_support
```

Or for production:
```bash
npx prisma migrate deploy
```

This creates:
- `buttery` field on `MenuItem` table with index
- `buttery` field on `Order` table with index
- Data migration (existing items/orders will have NULL buttery)

---

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/bluebite
CORS_ORIGIN=http://localhost:5173
PORT=3000
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000/api
```

---

## Deployment Notes

### Before Going Live

1. **Database**:
   - Run migration scripts on production database
   - Verify indexes created successfully
   - Consider backfilling existing data with buttery associations if needed

2. **Backend**:
   - Deploy updated Express server with new endpoints
   - Verify CORS configuration for production domain
   - Test API endpoints with sample requests

3. **Frontend**:
   - Set `VITE_API_URL` to production backend URL
   - Deploy React app with new components
   - Clear browser cache to load updated code

4. **Data**:
   - Run seed script to populate menu items with buttery data
   - Validate that butteries dropdown populates correctly
   - Check that item filters work as expected

---

## Performance Considerations

- **Database Indexes**: `buttery` indexes on MenuItem and Order enable fast filtering
- **API Caching**: localStorage cache-first strategy reduces API calls
- **Lazy Loading**: Menus loaded on demand when buttery selected
- **Batch Seeding**: 50-item batches prevent memory exhaustion during data import

---

## Known Limitations & Future Work

### Current Limitations
- Cart limited to single buttery (by design to prevent cross-college complexity)
- No cross-buttery order history search (user must switch buttery)
- Mock data fallback doesn't support real buttery names

### Future Enhancements
- [ ] Add multi-buttery order support (group items by buttery)
- [ ] Global order search across all butteries
- [ ] Buttery-specific pricing/discounts
- [ ] Operating hours per buttery
- [ ] Preference for default buttery selection
- [ ] Analytics dashboard by buttery
