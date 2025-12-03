# Order Item Data Flow - Visual Reference

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (PostgreSQL)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  MenuItem Table              OrderItem Table                             │
│  ┌──────────────┐           ┌─────────────────┐                        │
│  │ id           │           │ id              │                        │
│  │ name         │◄──────────│ menuItemId (FK) │                        │
│  │ price        │           │ orderId         │                        │
│  │ category     │           │ quantity        │                        │
│  │ ...          │           │ price           │                        │
│  └──────────────┘           └─────────────────┘                        │
│       ▲                              │                                   │
│       │                              │                                   │
│       │ GET /api/menu               │ GET /api/orders                   │
│       │                              │                                   │
└───────┼──────────────────────────────┼───────────────────────────────────┘
        │                              │
        │                              ▼
┌───────┼──────────────────────────────┼───────────────────────────────────┐
│       │                              │        BACKEND API LAYER           │
│       │                              │                                    │
│       │                         Returns JSON:                             │
│       │                         {                                         │
│       │                           id: "order1",                           │
│       │                           orderItems: [                           │
│       │                             {                                     │
│       │                               menuItemId: "item123",  ← ID only!  │
│       │                               quantity: 2,                        │
│       │                               price: 10.00                        │
│       │                             }                                     │
│       │                           ]                                       │
│       │                         }                                         │
│       │                              │                                    │
└───────┼──────────────────────────────┼────────────────────────────────────┘
        │                              │
        │ Returns:                     │ Returns:
        │ [{ id, name,                 │ [{ id, orderItems: [{
        │    price, ... }]             │    menuItemId, quantity, price }] }]
        │                              │
        ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       FRONTEND API CLIENT (api.ts)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  fetchMenuItems()              fetchAllOrders()                          │
│       │                              │                                    │
│       │ Transform:                   │ Transform:                        │
│       │ BackendMenuItem              │ BackendOrderItem → OrderItem      │
│       │   → MenuItem                 │                                   │
│       │                              │ CRITICAL STEP:                    │
│       │                              │ items: orderItems.map(item => ({  │
│       │                              │   menuItemId: item.menuItemId,    │
│       │                              │   name: '',  ← Empty placeholder! │
│       │                              │   quantity: item.quantity,        │
│       │                              │   price: item.price,              │
│       │                              │   modifiers: []                   │
│       │                              │ }))                               │
│       │                              │                                   │
│       └──────────┬───────────────────┘                                   │
│                  │                                                        │
└──────────────────┼────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         APP COMPONENT (App.tsx)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  useEffect #1: Load Menu Items                                           │
│  ┌─────────────────────────────────────────────┐                        │
│  │ 1. Load cached menu (instant)                │                        │
│  │ 2. Fetch fresh menu from API (background)    │                        │
│  │ 3. Update menuItems state                    │  ─────────┐            │
│  └─────────────────────────────────────────────┘           │            │
│                                                             │            │
│  useEffect #2: Load Orders (depends on menuItems) ◄────────┘            │
│  ┌──────────────────────────────────────────────────────┐               │
│  │ if (menuItems.length === 0) return; ← Race Prevention│               │
│  │                                                       │               │
│  │ 1. Load cached orders                                │               │
│  │ 2. Enrich with menuItems  ─────────────┐            │               │
│  │ 3. Fetch fresh orders                   │            │               │
│  │ 4. Enrich with menuItems  ──────────────┼────────────┘               │
│  └──────────────────────────────────────────┘            │               │
│                                                           │               │
└───────────────────────────────────────────────────────────┼───────────────┘
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               ENRICHMENT FUNCTION (enrichOrdersWithMenuNames)            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Input: orders, menuItems                                                │
│                                                                           │
│  Process:                                                                │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │ 1. Validate inputs                                          │         │
│  │    - Check orders exist                                     │         │
│  │    - Check menuItems exist (warn if empty)                 │         │
│  │                                                             │         │
│  │ 2. Create lookup map: menuItemId → MenuItem                │         │
│  │    const menuItemMap = new Map(                            │         │
│  │      menuItems.map(item => [item.id, item])                │         │
│  │    );                                                       │         │
│  │                                                             │         │
│  │ 3. For each order item:                                    │         │
│  │    a. Validate menuItemId exists                           │         │
│  │    b. Lookup: menuItem = menuItemMap.get(item.menuItemId)  │         │
│  │    c. If found: item.name = menuItem.name                  │         │
│  │    d. If not found:                                        │         │
│  │       - Log warning                                        │         │
│  │       - Fallback: "Unknown Item (ID: abc123...)"           │         │
│  │                                                             │         │
│  │ 4. Log summary of any failures                             │         │
│  └────────────────────────────────────────────────────────────┘         │
│                                                                           │
│  Output: orders with item.name populated                                 │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      ORDER MANAGER COMPONENT                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Display Logic:                                                          │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │ For each order.items:                                     │           │
│  │                                                           │           │
│  │   // Defensive fallback                                  │           │
│  │   const itemName = item.name ||                          │           │
│  │     `Item ${item.menuItemId?.substring(0, 8)}`;          │           │
│  │                                                           │           │
│  │   // Log if name is missing (shouldn't happen!)          │           │
│  │   if (!item.name) {                                      │           │
│  │     console.warn('[OrderManager] Missing name', item);   │           │
│  │   }                                                      │           │
│  │                                                           │           │
│  │   return <span>{itemName} x{item.quantity}</span>;       │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                           │
│  UI Display:                                                             │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  Order #1                                                 │           │
│  │  ├─ Burger x2              $20.00                        │           │
│  │  ├─ Fries x1               $5.00                         │           │
│  │  └─ Soda x2                $6.00                         │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Race Condition Prevention

### Without Fix (BROKEN):
```
Time →
┌──────────┬──────────┬──────────┬──────────┐
│  Page    │  Orders  │  Menu    │  Result  │
│  Load    │  Fetch   │  Fetch   │          │
├──────────┼──────────┼──────────┼──────────┤
│  t=0ms   │          │          │          │
│  t=10ms  │ Start    │ Start    │          │
│  t=50ms  │ Complete │          │ ❌ RACE! │
│          │ Enrich   │          │          │
│          │ (empty!) │          │          │
│  t=100ms │          │ Complete │ Too late │
└──────────┴──────────┴──────────┴──────────┘

Orders enriched with empty menuItems → "1x" display bug!
```

### With Fix (WORKING):
```
Time →
┌──────────┬──────────┬──────────┬──────────┐
│  Page    │  Menu    │  Orders  │  Result  │
│  Load    │  Fetch   │  Fetch   │          │
├──────────┼──────────┼──────────┼──────────┤
│  t=0ms   │          │          │          │
│  t=10ms  │ Start    │ Waiting  │          │
│  t=100ms │ Complete │          │          │
│  t=110ms │          │ Start    │ ✅ SAFE  │
│  t=150ms │          │ Complete │          │
│          │          │ Enrich   │          │
│          │          │ (full!)  │          │
└──────────┴──────────┴──────────┴──────────┘

Orders wait for menu → enrichment always has data!
```

## Error Scenarios & Handling

### Scenario 1: Valid Data (Happy Path)
```
Backend:  orderItem.menuItemId = "burger123"
Menu:     menuItems = [{ id: "burger123", name: "Burger" }]
Lookup:   menuItemMap.get("burger123") → { name: "Burger" }
Result:   item.name = "Burger" ✅
Display:  "Burger x2"
```

### Scenario 2: Missing Menu Item
```
Backend:  orderItem.menuItemId = "deleted456"
Menu:     menuItems = [{ id: "burger123", name: "Burger" }]
Lookup:   menuItemMap.get("deleted456") → undefined
Fallback: item.name = "Unknown Item (ID: deleted4...)"
Logging:  console.error with detailed info
Display:  "Unknown Item (ID: deleted4...) x2" ⚠️
```

### Scenario 3: Race Condition (Fixed)
```
Backend:  orderItem.menuItemId = "burger123"
Menu:     menuItems = [] (not loaded yet)
Check:    if (menuItems.length === 0) return; ← Prevents fetch
Wait:     Effect will re-run when menuItems updates
Result:   Orders fetch delayed until menu ready ✅
Display:  Waits, then shows "Burger x2"
```

### Scenario 4: Invalid menuItemId
```
Backend:  orderItem.menuItemId = null
Menu:     menuItems = [{ id: "burger123", name: "Burger" }]
Validate: if (!item.menuItemId) → error branch
Fallback: item.name = "Invalid Item (missing ID)"
Logging:  console.error with order ID and item index
Display:  "Invalid Item (missing ID) x2" ⚠️
```

## Cache Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CACHE STRATEGY                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Progressive Loading (Stale-While-Revalidate):                           │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  1. Check localStorage cache                              │           │
│  │     ├─ Hit: Load immediately (instant UI) ────┐          │           │
│  │     └─ Miss: Show loading state                │          │           │
│  │                                                 │          │           │
│  │  2. Fetch from API (always, even on cache hit) │          │           │
│  │     ├─ Success: Update state & cache ◄─────────┘          │           │
│  │     └─ Error: Keep using cached data                     │           │
│  │                                                           │           │
│  │  3. Enrich orders with CURRENT menuItems                 │           │
│  │     ├─ Cached orders + fresh menu = correct names        │           │
│  │     └─ Fresh orders + fresh menu = correct names         │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                           │
│  Cache Invalidation:                                                     │
│  ├─ Time-based: 24 hour TTL                                              │
│  ├─ Buttery change: Separate cache per buttery                           │
│  └─ Manual: localStorage.clear() or clearCache()                         │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Type Flow

```typescript
// Backend Response Type
interface BackendOrderItem {
  id: string;
  orderId: string;
  menuItemId: string;    // ← Only has ID, no name!
  quantity: number;
  price: number;
}

// Transform in api.ts
const orderItem: OrderItem = {
  menuItemId: backendItem.menuItemId,
  name: '',                // ← Empty placeholder
  quantity: backendItem.quantity,
  price: backendItem.price,
  modifiers: [],
};

// Enrich in enrichOrdersWithMenuNames()
const enrichedItem: OrderItem = {
  menuItemId: item.menuItemId,
  name: menuItem.name,     // ← Name from menu lookup!
  quantity: item.quantity,
  price: item.price,
  modifiers: item.modifiers,
};

// Frontend Type
interface OrderItem {
  menuItemId: string;
  name: string;            // ← Must be populated by enrichment
  quantity: number;
  price: number;
  modifiers: string[];
}
```

## Logging Sequence (Console Output)

### Normal Successful Flow:
```
[1] Loaded 45 menu items from cache
[2] Fetched 45 fresh menu items from API
[3] [App.loadOrders] Menu loaded, fetching orders...
[4] [App.loadOrders] Loaded 10 orders from cache
[5] [App.loadOrders] Fetched 10 fresh orders from API
```

### Race Condition Prevented:
```
[1] [App.loadOrders] Waiting for menu items to load before fetching orders...
[2] Fetched 45 fresh menu items from API
[3] [App.loadOrders] Menu loaded, fetching orders...
[4] [App.loadOrders] Fetched 10 fresh orders from API
```

### Enrichment Failure:
```
[1] [enrichOrdersWithMenuNames] Failed to lookup names for menu item IDs: ["deleted123"]
[2] Available menu item IDs: ["burger123", "fries456", ...]
[3] This may indicate:
[4]   1. Race condition: Orders fetched before menu loaded
[5]   2. Data mismatch: Order references deleted/missing menu items
[6]   3. Cache issue: Stale menu cache missing new items
[7] [OrderManager] Order item missing name: {orderId: "order1", menuItemId: "deleted123", ...}
```

## Key Takeaways

1. **Backend returns IDs only** - Names must be looked up client-side
2. **Race condition prevented** - Menu loads before orders
3. **Enrichment is critical** - Transforms IDs to names
4. **Multiple fallback layers** - Graceful degradation
5. **Comprehensive logging** - Easy to debug issues
6. **Type safety enforced** - No unsafe casts
