# Order Item Name Lookup - Architecture & Debugging Guide

## Overview

Orders in BlueBite are stored in the database with **only menu item IDs**, not item names. Item names must be looked up client-side from the menu data. This document explains how this works and how to debug issues.

## Architecture

### Data Flow

```
Backend Database (PostgreSQL)
    │
    ├─ MenuItem table (id, name, price, ...)
    └─ OrderItem table (menuItemId, quantity, price)
                ↓
        Backend API Returns
    Order { orderItems: [{ menuItemId, quantity, price }] }
                ↓
        Frontend Transforms (api.ts)
    Order { items: [{ menuItemId, name: '', quantity, price }] }
                ↓
        Enrichment (enrichOrdersWithMenuNames)
    Order { items: [{ menuItemId, name: 'Burger', quantity, price }] }
                ↓
        Display (OrderManager.tsx)
            "Burger x2"
```

### Key Components

1. **Backend API** (`backend/src/routes/orders.ts`)
   - Returns `OrderItem` with only `menuItemId` (no name)
   - This is normalized database design (avoid duplication)

2. **Frontend API Client** (`src/utils/api.ts`)
   - Transforms backend response to frontend `OrderItem` format
   - Sets `name: ''` as placeholder for enrichment
   - Functions: `fetchAllOrders()`, `fetchOrders()`, `createOrder()`, `updateOrderStatus()`

3. **Enrichment Function** (`src/utils/order.ts`)
   - `enrichOrdersWithMenuNames(orders, menuItems)`
   - Looks up item names from menu data using `menuItemId`
   - Provides fallback to "Unknown Item" if lookup fails
   - Logs detailed warnings when enrichment fails

4. **App Component** (`src/App.tsx`)
   - Manages menu and order loading lifecycle
   - Ensures menu loads before orders (prevents race condition)
   - Calls enrichment function with current menu state

5. **OrderManager Component** (`src/components/OrderManager.tsx`)
   - Displays order items with defensive null checks
   - Provides fallback display name if enrichment failed
   - Logs warnings when item names are missing

## Common Issues & Debugging

### Issue 1: Items Display as "1x" or "Unknown Item"

**Symptoms:**
- Order items show quantity but no name
- Display shows "1x" instead of "Burger x1"

**Root Causes:**
1. **Race Condition**: Orders loaded before menu items
   - Check browser console for: `[App.loadOrders] Waiting for menu items to load...`
   - Menu should load first, then orders

2. **Failed API Lookup**: Menu item doesn't exist
   - Check console for: `[enrichOrdersWithMenuNames] Failed to lookup names for menu item IDs`
   - Compare failed IDs with available menu item IDs in console

3. **Stale Cache**: Cached orders reference deleted menu items
   - Clear cache: `localStorage.removeItem('bluebite_cache_menu')`
   - Refresh page to fetch fresh data

4. **Backend Data Integrity**: OrderItem references invalid MenuItem
   - Check database for orphaned OrderItems
   - Verify foreign key constraints are enforced

**Debugging Steps:**
1. Open browser DevTools console
2. Look for tagged log messages:
   - `[App.loadOrders]` - Order loading lifecycle
   - `[enrichOrdersWithMenuNames]` - Enrichment process
   - `[OrderManager]` - Item display warnings
3. Check if menu loaded before orders:
   ```
   [App.loadOrders] Waiting for menu items to load...  ← Good!
   [App.loadOrders] Menu loaded, fetching orders...     ← Good!
   ```
4. Check for enrichment failures:
   ```
   [enrichOrdersWithMenuNames] Failed to lookup names for menu item IDs: ["abc123"]
   Available menu item IDs: ["def456", "ghi789"]
   ```
5. Inspect the actual order data in React DevTools:
   - Check if `order.items[0].name` exists
   - Check if `order.items[0].menuItemId` is valid

### Issue 2: Race Condition - Orders Load Before Menu

**Prevention (Already Implemented):**
```typescript
// App.tsx - Order loading effect
useEffect(() => {
  const loadOrders = async () => {
    // CRITICAL: Wait for menu to load first
    if (menuItems.length === 0) {
      console.log('[App.loadOrders] Waiting for menu items to load...');
      return; // Exit early, will retry when menuItems updates
    }

    // Safe to load orders now - menu is ready
    const orders = await api.fetchAllOrders();
    const enriched = enrichOrdersWithMenuNames(orders, menuItems);
    setOrders(enriched);
  };

  loadOrders();
}, [menuItems, selectedButtery]); // Re-runs when menuItems changes
```

**What This Prevents:**
- Orders rendering with empty names
- Failed lookups due to empty menu
- UI showing "1x" instead of item names

### Issue 3: Cache Contains Stale Data

**Symptoms:**
- Items show "Unknown Item" for valid menu items
- Issue persists after page refresh
- New menu items don't appear

**Solution:**
```javascript
// In browser console:
localStorage.clear(); // Nuclear option - clears everything
// OR targeted clear:
localStorage.removeItem('bluebite_cache_menu');
localStorage.removeItem('bluebite_cache_orders');
```

**Why It Happens:**
- Menu items deleted but cached orders still reference them
- Cache persists across page reloads
- Cache doesn't auto-invalidate when backend data changes

**Prevention:**
- Cache has 24-hour TTL (automatic expiration)
- API failures fallback to cache (graceful degradation)
- Fresh API data always overwrites cache

## Testing the Fix

### Test Case 1: Normal Flow (Happy Path)
1. Clear cache: `localStorage.clear()`
2. Refresh page
3. Expected console logs:
   ```
   Loaded X menu items from cache (or Fetched X fresh menu items)
   [App.loadOrders] Menu loaded, fetching orders...
   [App.loadOrders] Fetched X fresh orders from API
   ```
4. Verify orders display with full item names

### Test Case 2: Menu Loads Slowly (Race Condition Test)
1. Open DevTools → Network tab
2. Throttle to "Slow 3G"
3. Refresh page
4. Expected behavior:
   - Menu starts loading
   - Orders wait (console shows "Waiting for menu items...")
   - Menu finishes loading
   - Orders load and enrich successfully
5. No "Unknown Item" should appear

### Test Case 3: Invalid Menu Item ID (Data Integrity Test)
1. Manually create order with invalid menuItemId in database:
   ```sql
   INSERT INTO "OrderItem" (id, "orderId", "menuItemId", quantity, price)
   VALUES ('test', 'order123', 'invalid-id', 1, 10.00);
   ```
2. Refresh frontend
3. Expected behavior:
   - Console shows: `[enrichOrdersWithMenuNames] Failed to lookup names for menu item IDs: ["invalid-id"]`
   - UI displays: "Unknown Item (ID: invalid-i...)"
   - Other items display correctly

### Test Case 4: API Failure with Cache Fallback
1. Stop backend server
2. Refresh page (with existing cache)
3. Expected behavior:
   - Console shows: `Failed to fetch menu from API`
   - Console shows: `Using cached menu due to API failure`
   - UI still works with cached data
4. Start backend server
5. Refresh page
6. Fresh data loads and updates cache

## Performance Considerations

### Lookup Complexity
- Menu items stored in `Map` for O(1) lookup time
- 1000 orders × 5 items each = 5000 lookups in ~1ms
- No performance concerns for typical scale

### Cache Strategy
- **Progressive caching**: Show cached data immediately, fetch fresh in background
- **Stale-while-revalidate**: UI never blocks on API calls
- **24-hour TTL**: Prevents indefinite stale data

### Memory Usage
- Menu cache: ~100KB for 500 items
- Order cache: ~50KB for 100 orders
- Total: <1MB localStorage usage

## Future Improvements

### Option 1: Backend Includes Names (Denormalized)
**Pros:**
- No client-side enrichment needed
- Simpler frontend logic
- Faster initial render

**Cons:**
- Data duplication in database
- Stale names if menu item renamed
- Larger API payloads

### Option 2: GraphQL with Nested Queries
**Pros:**
- Backend resolves relationships
- Client requests exactly what it needs
- Type-safe with codegen

**Cons:**
- Requires GraphQL server
- More complex backend
- Overkill for current scale

### Option 3: Server-Sent Events for Real-Time Updates
**Pros:**
- Live order updates without polling
- Cache automatically invalidated on changes
- Better UX for staff view

**Cons:**
- Requires WebSocket/SSE infrastructure
- More complex state management
- Higher server load

## Related Files

- `/src/utils/order.ts` - Enrichment function
- `/src/utils/api.ts` - API client with transformations
- `/src/App.tsx` - Order and menu loading lifecycle
- `/src/components/OrderManager.tsx` - Order display with fallbacks
- `/src/types.ts` - TypeScript interfaces
- `/backend/prisma/schema.prisma` - Database schema

## Troubleshooting Checklist

When debugging order item name issues:

- [ ] Check browser console for `[enrichOrdersWithMenuNames]` warnings
- [ ] Verify menu loaded before orders (`[App.loadOrders] Menu loaded...`)
- [ ] Inspect React DevTools: `order.items[0].name` should have value
- [ ] Check if `order.items[0].menuItemId` matches any `menuItems[].id`
- [ ] Clear localStorage cache and retry
- [ ] Verify backend returns valid menuItemId in OrderItem
- [ ] Check database for orphaned OrderItems (foreign key violations)
- [ ] Test with Network tab throttling to simulate slow connections
- [ ] Review recent menu changes (deleted items?)

## Key Takeaways

1. **Menu must load before orders** - This is enforced in `App.tsx`
2. **Backend returns IDs only** - Names resolved client-side
3. **Enrichment adds names** - `enrichOrdersWithMenuNames()` is critical
4. **Defensive fallbacks** - Multiple layers prevent display issues
5. **Detailed logging** - Console shows exactly what went wrong
6. **Cache considerations** - Can cause stale data issues
