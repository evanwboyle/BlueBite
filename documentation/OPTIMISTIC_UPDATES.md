# Optimistic Updates with Retry Logic

## Overview

This document describes the optimistic update pattern implemented in the BlueBite application. Optimistic updates provide instant UI feedback by applying changes immediately in the UI while synchronizing to the backend asynchronously with automatic retry logic.

## Problem Statement

**Before optimistic updates:**
1. User clicks "Mark Ready" on an order
2. UI waits for server response (network latency)
3. Visible delay/desync between user action and UI update
4. Poor user experience, especially on slow connections

**After optimistic updates:**
1. User clicks "Mark Ready" on an order
2. UI updates **instantly** (optimistic)
3. Backend sync happens in background with automatic retries
4. No visible delay - smooth, responsive UX

## Architecture

### Core Components

```
/src/utils/optimistic.ts    - Optimistic update utility with retry logic
/src/App.tsx                 - Uses optimistic updates for order status changes
/src/components/OrderManager.tsx - Triggers optimistic updates via callback
```

### Data Flow

```
User Action (OrderManager)
    ↓
onUpdateOrder callback (App.tsx)
    ↓
optimisticUpdate.execute()
    ↓
    ├─→ [Immediate] Apply optimistic update to local state
    │       └─→ setOrders() updates UI instantly
    │
    └─→ [Async] Sync to backend with retry logic
            ├─→ Attempt 1: immediate
            ├─→ Attempt 2: 10s delay (if attempt 1 fails)
            ├─→ Attempt 3: 20s delay (if attempt 2 fails)
            └─→ Attempt 4: 30s delay (if attempt 3 fails)
                    ├─→ Success: Silent (no notification)
                    └─→ Failure: Show toast warning
```

### Timeline Diagram

```
Time    UI State           Backend Sync          User Experience
────────────────────────────────────────────────────────────────
0s      Status: pending    (none)                [User clicks "Start"]
        ↓
0s      Status: preparing  Attempt 1 → FAIL      ✓ UI updates instantly
        (optimistic)       (network error)
        ↓
10s     Status: preparing  Attempt 2 → FAIL      ✓ No visible change
        (kept)             (network error)        (user continues working)
        ↓
20s     Status: preparing  Attempt 3 → FAIL      ✓ No visible change
        (kept)             (network error)        (user continues working)
        ↓
30s     Status: preparing  Attempt 4 → SUCCESS   ✓ No visible change
        (confirmed)        ✅ Synced to DB        (silent success)

────────────────────────────────────────────────────────────────

Alternative: All attempts fail
────────────────────────────────────────────────────────────────
0s      Status: pending    (none)                [User clicks "Start"]
        ↓
0s      Status: preparing  Attempt 1 → FAIL      ✓ UI updates instantly
        (optimistic)       (server down)
        ↓
10s     Status: preparing  Attempt 2 → FAIL      ✓ No visible change
        (kept)             (server down)
        ↓
20s     Status: preparing  Attempt 3 → FAIL      ✓ No visible change
        (kept)             (server down)
        ↓
30s     Status: preparing  Attempt 4 → FAIL      ⚠️ Warning toast appears
        (kept)             ❌ All attempts failed  "Status may not be saved"
        ↓
        Status: preparing  (no more retries)      User sees warning,
        (persisted)                               but UI keeps new state
```

## Implementation Details

### Retry Strategy

The implementation uses **exponential backoff with fixed delays**:

- **Total attempts:** 4 (initial + 3 retries)
- **Retry delays:** 10s, 20s, 30s
- **Total time window:** 40 seconds from first attempt
- **Behavior on failure:** Keep optimistic state, show warning toast

**Why these delays?**
- 10s: Handles temporary network glitches
- 20s: Allows for brief server outages
- 30s: Final attempt for extended issues
- If all fail: Likely indicates persistent problem requiring user/admin intervention

### Key Features

#### 1. Immediate UI Updates
```typescript
optimisticUpdate: () => {
  // Update local state immediately
  const newOrders = orders.map(o =>
    o.id === id ? { ...o, status } : o
  );
  setOrders(newOrders);
}
```

#### 2. Silent Success
When sync succeeds, no notification is shown. The UI already reflects the correct state.

#### 3. Warning on Failure
Only after all 4 attempts fail, a warning toast appears:
```typescript
onError: (error, attemptCount) => {
  setNotification(`Warning: Order status change may not be saved (${error.message})`);
}
```

#### 4. Preserved Optimistic State
Even if sync fails, the UI keeps the updated state. This prevents confusing UX where the order status flips back and forth.

### Type Safety

The utility is fully type-safe with TypeScript generics:

```typescript
interface OptimisticUpdateOptions<T> {
  optimisticUpdate: () => void;
  syncFn: () => Promise<T>;
  onSuccess?: (result: T) => void;
  onError: (error: Error, attemptCount: number) => void;
  id?: string;
}
```

## Usage Examples

### Example 1: Order Status Update (Current Implementation)

```typescript
// In App.tsx
const handleUpdateOrder = (id: string, status: Order['status']) => {
  const order = orders.find(o => o.id === id);

  optimisticUpdate.execute({
    // 1. Apply optimistic update
    optimisticUpdate: () => {
      const newOrders = orders.map(o =>
        o.id === id ? { ...o, status } : o
      );
      setOrders(newOrders);
      storage.setCachedOrders(newOrders, selectedButtery);
    },

    // 2. Sync to backend
    syncFn: () => api.updateOrderStatus(id, status),

    // 3. On success (optional - for verification)
    onSuccess: (updatedOrder) => {
      const newOrders = orders.map(o =>
        o.id === id ? updatedOrder : o
      );
      setOrders(newOrders);
    },

    // 4. On error (after all retries)
    onError: (error, attemptCount) => {
      console.error(`Failed after ${attemptCount} attempts:`, error);
      setNotification(`Warning: Order status change may not be saved`);
    },

    // 5. Unique ID
    id: `order-${id}-${order?.status}-to-${status}`,
  });
};
```

### Example 2: Adding Modifiers to Order (Future Feature)

```typescript
const handleAddModifier = (orderId: string, modifierId: string) => {
  optimisticUpdate.execute({
    optimisticUpdate: () => {
      // Update order with modifier in local state
      const newOrders = orders.map(o => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          items: o.items.map(item => ({
            ...item,
            modifiers: [...item.modifiers, modifierId],
          })),
        };
      });
      setOrders(newOrders);
    },

    syncFn: () => api.addModifierToOrder(orderId, modifierId),

    onError: (error) => {
      setNotification(`Failed to add modifier: ${error.message}`);
    },

    id: `order-${orderId}-add-modifier-${modifierId}`,
  });
};
```

### Example 3: Cart Item Quantity Update

```typescript
const handleUpdateCartQuantity = (itemIndex: number, newQuantity: number) => {
  optimisticUpdate.execute({
    optimisticUpdate: () => {
      const newCart = [...cartItems];
      newCart[itemIndex].quantity = newQuantity;
      setCartItems(newCart);
      storage.setCart({ items: newCart, total: calculateCartTotal(newCart) });
    },

    syncFn: async () => {
      // If cart is persisted to backend
      await api.updateCart(cartItems[itemIndex].id, newQuantity);
    },

    onError: (error) => {
      setNotification('Failed to update cart');
      // Could revert here if desired
    },

    id: `cart-item-${itemIndex}-quantity`,
  });
};
```

## Advanced Features

### Creating Custom Instances

You can create separate optimistic update managers with different configurations:

```typescript
import { createOptimisticUpdate } from './utils/optimistic';

// Fast retries for critical operations
const criticalUpdates = createOptimisticUpdate({
  maxRetries: 5,
  retryDelays: [1000, 2000, 5000, 10000, 20000],
  logRetries: true,
});

// Slower retries for non-critical operations
const backgroundUpdates = createOptimisticUpdate({
  maxRetries: 2,
  retryDelays: [30000, 60000],
  logRetries: false,
});
```

### Cancelling Pending Syncs

```typescript
// Cancel a specific pending sync
optimisticUpdate.cancel('order-123-pending-to-preparing');

// Cancel all pending syncs (e.g., on component unmount)
useEffect(() => {
  return () => {
    optimisticUpdate.cancelAll();
  };
}, []);

// Check pending sync count
const pendingCount = optimisticUpdate.getPendingCount();
console.log(`${pendingCount} syncs pending`);
```

### Custom Retry Logic

```typescript
const customRetryUpdate = createOptimisticUpdate({
  maxRetries: 3,
  retryDelays: [5000, 15000, 45000], // Custom exponential backoff
  logRetries: import.meta.env.DEV, // Only log in development
});
```

## Testing

### Manual Testing Scenarios

#### Scenario 1: Normal Operation (Success)
1. Open DevTools Network tab
2. Update order status in UI
3. Observe:
   - UI updates immediately
   - Network request sent
   - No toast notification (silent success)
   - Console shows: `[OptimisticUpdate order-X] Sync succeeded on attempt 1`

#### Scenario 2: Network Failure with Recovery
1. Open DevTools Network tab
2. Throttle network to "Offline" or "Slow 3G"
3. Update order status in UI
4. Observe:
   - UI updates immediately
   - Console shows retry attempts every 10s
5. Restore network before 40s
6. Observe: Sync succeeds, no error toast

#### Scenario 3: Persistent Failure
1. Open DevTools Network tab
2. Block the API endpoint: `/api/orders/*`
3. Update order status in UI
4. Wait 40 seconds
5. Observe:
   - UI keeps optimistic state
   - After 4 failed attempts, error toast appears
   - Console shows: `[OptimisticUpdate] All 4 attempts failed`

#### Scenario 4: Multiple Rapid Updates
1. Rapidly change order status multiple times
2. Observe:
   - Each update applies immediately
   - Previous pending syncs are cancelled
   - Only the latest sync is attempted

### Automated Testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createOptimisticUpdate } from './optimistic';

describe('Optimistic Updates', () => {
  it('should apply optimistic update immediately', () => {
    const optimisticUpdate = createOptimisticUpdate();
    let state = 'pending';

    optimisticUpdate.execute({
      optimisticUpdate: () => { state = 'ready'; },
      syncFn: async () => ({}),
      onError: () => {},
    });

    expect(state).toBe('ready'); // Immediate
  });

  it('should retry on failure', async () => {
    const optimisticUpdate = createOptimisticUpdate({
      maxRetries: 2,
      retryDelays: [100, 200],
    });

    let attempts = 0;
    const syncFn = vi.fn(async () => {
      attempts++;
      if (attempts < 3) throw new Error('Fail');
      return { success: true };
    });

    const onError = vi.fn();

    optimisticUpdate.execute({
      optimisticUpdate: () => {},
      syncFn,
      onError,
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    expect(syncFn).toHaveBeenCalledTimes(3);
    expect(onError).not.toHaveBeenCalled();
  });
});
```

## Troubleshooting

### Issue: Order status not syncing to backend

**Symptoms:**
- UI shows updated status
- Warning toast appears after 40 seconds
- Backend shows old status

**Possible Causes:**
1. **Network issue:** Check DevTools Network tab for failed requests
2. **API endpoint down:** Verify backend is running
3. **Authentication issue:** Check if session expired
4. **CORS issue:** Verify CORS headers on backend

**Solution:**
```typescript
// Add more detailed error logging
onError: (error, attemptCount) => {
  console.error('Sync failed:', {
    error: error.message,
    attempts: attemptCount,
    orderId: id,
    status: status,
  });
  setNotification(`Warning: ${error.message}`);
}
```

### Issue: UI flashing/flickering

**Symptoms:**
- Status changes briefly then reverts
- Multiple toasts appear

**Possible Cause:**
- Conflicting state updates from multiple sources (e.g., polling + optimistic update)

**Solution:**
```typescript
// Debounce polling or skip updates for optimistically changed orders
const [pendingOptimisticUpdates, setPendingOptimisticUpdates] = useState<Set<string>>(new Set());

// Track optimistic update
optimisticUpdate.execute({
  optimisticUpdate: () => {
    setPendingOptimisticUpdates(prev => new Set(prev).add(id));
    // ... apply update
  },
  onSuccess: () => {
    setPendingOptimisticUpdates(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  },
});

// Skip polling updates for pending orders
const newOrders = polledOrders.filter(o => !pendingOptimisticUpdates.has(o.id));
```

### Issue: Memory leak from pending syncs

**Symptoms:**
- Browser memory usage increases over time
- DevTools shows many pending timeouts

**Solution:**
```typescript
// Cancel all pending syncs on unmount
useEffect(() => {
  return () => {
    optimisticUpdate.cancelAll();
  };
}, []);
```

## Best Practices

### 1. Always Provide Unique IDs
```typescript
// Good: Unique ID allows cancellation
id: `order-${orderId}-${timestamp}-${action}`

// Bad: No ID means can't cancel pending sync
id: undefined
```

### 2. Keep Optimistic State on Failure
```typescript
// Good: Don't revert, show warning
onError: (error) => {
  setNotification(`Warning: ${error.message}`);
  // Keep optimistic state
}

// Bad: Reverting creates confusing UX
onError: (error) => {
  setOrders(previousOrders); // Don't do this!
}
```

### 3. Silent Success, Loud Failure
```typescript
// Good: Only notify on error
onSuccess: undefined, // Silent
onError: (error) => setNotification(error.message),

// Bad: Notifying on success is redundant
onSuccess: () => setNotification('Saved!'), // Annoying
```

### 4. Sync localStorage with Optimistic State
```typescript
optimisticUpdate: () => {
  setOrders(newOrders);
  storage.setCachedOrders(newOrders); // Keep cache in sync
}
```

### 5. Use Type Guards for Safety
```typescript
const handleUpdateOrder = (id: string, status: Order['status']) => {
  const order = orders.find(o => o.id === id);
  if (!order) {
    console.error('Order not found:', id);
    return; // Early return prevents errors
  }

  optimisticUpdate.execute({
    // ...
  });
};
```

## Performance Considerations

### Memory Usage
- Each pending sync stores: function references, error callback, timeout ID
- **Impact:** Minimal (~1KB per pending sync)
- **Recommendation:** Cancel syncs on component unmount

### Network Usage
- Retries use exponential backoff to avoid overwhelming server
- **Total requests per update:** 1-4 (depending on success/failure)
- **Recommendation:** Use unique IDs to prevent duplicate syncs

### CPU Usage
- Optimistic updates are synchronous (instant)
- Retries use setTimeout (negligible CPU overhead)
- **Impact:** Minimal
- **Recommendation:** No special optimization needed

## Future Enhancements

### 1. Conflict Resolution
When backend state differs from optimistic state:
```typescript
onSuccess: (serverOrder) => {
  if (serverOrder.status !== localOrder.status) {
    // Server won - show notification
    setNotification('Order status updated by another user');
    setOrders(orders.map(o => o.id === serverOrder.id ? serverOrder : o));
  }
}
```

### 2. Offline Queue
Store failed updates for retry when connection restored:
```typescript
if (navigator.onLine) {
  optimisticUpdate.execute({...});
} else {
  offlineQueue.add({...});
}
```

### 3. Rollback on User Request
Allow users to manually revert optimistic changes:
```typescript
const revertUpdate = (updateId: string) => {
  optimisticUpdate.cancel(updateId);
  // Restore from server state
};
```

### 4. Real-time Sync with WebSockets
Replace polling with WebSocket updates, preserving optimistic updates:
```typescript
socket.on('order_updated', (serverOrder) => {
  if (!pendingOptimisticUpdates.has(serverOrder.id)) {
    // Only update if not optimistically updated
    setOrders(orders.map(o => o.id === serverOrder.id ? serverOrder : o));
  }
});
```

## Related Documentation

- [API Documentation](/documentation/API.md) - Backend API endpoints
- [State Management](/documentation/STATE_MANAGEMENT.md) - App state flow
- [Storage Utility](/src/utils/storage.ts) - localStorage abstraction
- [Order Utility](/src/utils/order.ts) - Order enrichment helpers

## Changelog

### v1.0.0 (2025-12-03)
- Initial implementation of optimistic updates
- Retry logic with exponential backoff (3 retries over 30s)
- Silent success, error toast on failure
- Preserved optimistic state on failure
- Full TypeScript type safety
- Comprehensive documentation and examples
