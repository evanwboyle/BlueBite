# Optimistic Updates - Quick Reference

## TL;DR

Optimistic updates make the UI update **instantly** while syncing to the backend in the background with automatic retries.

## Basic Usage

```typescript
import { optimisticUpdate } from './utils/optimistic';

// Update order status
const handleUpdateOrder = (id: string, status: Order['status']) => {
  optimisticUpdate.execute({
    // 1. Update UI immediately
    optimisticUpdate: () => {
      const newOrders = orders.map(o =>
        o.id === id ? { ...o, status } : o
      );
      setOrders(newOrders);
    },

    // 2. Sync to backend
    syncFn: () => api.updateOrderStatus(id, status),

    // 3. Show error if all retries fail
    onError: (error) => {
      setNotification(`Failed to save: ${error.message}`);
    },

    id: `order-${id}`,
  });
};
```

## Retry Behavior

- **Attempts:** 4 total (initial + 3 retries)
- **Timing:** 0s, 10s, 20s, 30s (40s total)
- **On Success:** Silent (no notification)
- **On Failure:** Show warning toast, keep optimistic state

## When to Use

✅ **Use for:**
- Order status changes
- Cart modifications
- User preference updates
- Any user-initiated state change

❌ **Don't use for:**
- Initial data loading
- Polling/background updates
- Read-only operations
- Critical operations requiring confirmation

## Configuration

```typescript
import { createOptimisticUpdate } from './utils/optimistic';

// Custom retry timing
const customUpdate = createOptimisticUpdate({
  maxRetries: 5,
  retryDelays: [1000, 2000, 5000, 10000, 20000],
  logRetries: true,
});
```

## Testing

### Test Success Path
1. Make change in UI → should update instantly
2. Check DevTools → API request sent
3. No toast appears (silent success)

### Test Failure Path
1. Block API endpoint in DevTools
2. Make change in UI → updates instantly
3. Wait 40 seconds
4. Warning toast appears
5. UI keeps optimistic state

## Troubleshooting

**UI updates but backend doesn't sync:**
- Check DevTools Network tab for errors
- Verify backend is running
- Check authentication/CORS

**Multiple toasts appearing:**
- Use unique IDs for each update
- Cancel pending syncs on unmount

**Memory leak:**
```typescript
useEffect(() => {
  return () => optimisticUpdate.cancelAll();
}, []);
```

## Files Modified

- **`/src/utils/optimistic.ts`** - Core utility (new)
- **`/src/App.tsx`** - Uses optimistic updates for order status changes
- **`/documentation/OPTIMISTIC_UPDATES.md`** - Full documentation

## See Also

- [Full Documentation](/documentation/OPTIMISTIC_UPDATES.md) - Complete guide with examples
- [API Utils](/src/utils/api.ts) - Backend API calls
- [Storage Utils](/src/utils/storage.ts) - State persistence
