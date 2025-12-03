/**
 * Optimistic Update Utility with Exponential Backoff Retry Logic
 *
 * This utility provides a pattern for implementing optimistic updates in the UI
 * while synchronizing changes to the backend asynchronously with automatic retry logic.
 *
 * Key Features:
 * - Immediate UI updates (optimistic)
 * - Background sync to backend
 * - Automatic retry with exponential backoff (3 attempts over 30 seconds: 0s, 10s, 20s)
 * - Silent success (no notification when sync succeeds)
 * - Error notification only after all retries are exhausted
 * - Maintains optimistic state even on failure
 *
 * @example
 * ```typescript
 * const optimisticUpdate = createOptimisticUpdate();
 *
 * optimisticUpdate.execute({
 *   // 1. Apply optimistic update immediately
 *   optimisticUpdate: () => {
 *     setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
 *   },
 *
 *   // 2. Sync to backend asynchronously
 *   syncFn: () => api.updateOrderStatus(orderId, newStatus),
 *
 *   // 3. Optional: Called on successful sync (usually not needed)
 *   onSuccess: (result) => {
 *     console.log('Order synced:', result);
 *   },
 *
 *   // 4. Called only after all retries fail
 *   onError: (error) => {
 *     setNotification(`Failed to sync order update: ${error.message}`);
 *   }
 * });
 * ```
 */

/**
 * Configuration for retry logic
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts (excluding initial attempt)
   * Default: 3
   */
  maxRetries?: number;

  /**
   * Retry delays in milliseconds [firstRetry, secondRetry, thirdRetry]
   * Default: [10000, 20000, 30000] = retries at 10s, 20s, 30s after initial attempt
   */
  retryDelays?: number[];

  /**
   * Whether to log retry attempts to console
   * Default: true in development
   */
  logRetries?: boolean;
}

/**
 * Options for executing an optimistic update
 */
export interface OptimisticUpdateOptions<T> {
  /**
   * Function to apply the optimistic update to local state
   * This is called immediately and synchronously
   */
  optimisticUpdate: () => void;

  /**
   * Async function to sync the change to the backend
   * This is called after optimisticUpdate, with automatic retry on failure
   */
  syncFn: () => Promise<T>;

  /**
   * Optional callback on successful sync (after all retries if needed)
   * By default, successful syncs are silent (no notification)
   */
  onSuccess?: (result: T) => void;

  /**
   * Callback when sync fails after all retry attempts
   * This is where you should show error notifications to the user
   */
  onError: (error: Error, attemptCount: number) => void;

  /**
   * Optional identifier for logging/debugging
   */
  id?: string;
}

/**
 * Internal state for tracking a pending sync operation
 */
interface PendingSync<T> {
  syncFn: () => Promise<T>;
  onSuccess?: (result: T) => void;
  onError: (error: Error, attemptCount: number) => void;
  id?: string;
  attemptCount: number;
  timeoutId?: number;
}

/**
 * Default retry configuration
 * Retries at: 10s, 20s, 30s after initial attempt (total 40 seconds from start)
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  retryDelays: [10000, 20000, 30000], // 10s, 20s, 30s
  logRetries: import.meta.env.DEV,
};

/**
 * Creates an optimistic update manager with retry logic
 */
export function createOptimisticUpdate(config: RetryConfig = {}) {
  const retryConfig: Required<RetryConfig> = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  // Track pending sync operations
  const pendingSyncs = new Map<string, PendingSync<unknown>>();

  /**
   * Attempt to sync data to backend with retry logic
   */
  async function attemptSync<T>(pendingSync: PendingSync<T>): Promise<void> {
    const { syncFn, onSuccess, onError, id, attemptCount } = pendingSync;

    if (retryConfig.logRetries) {
      console.log(
        `[OptimisticUpdate${id ? ` ${id}` : ''}] Attempt ${attemptCount}/${retryConfig.maxRetries + 1}`
      );
    }

    try {
      const result = await syncFn();

      // Success - remove from pending and call success callback
      if (id) {
        pendingSyncs.delete(id);
      }

      if (retryConfig.logRetries) {
        console.log(
          `[OptimisticUpdate${id ? ` ${id}` : ''}] Sync succeeded on attempt ${attemptCount}`
        );
      }

      // Call success callback if provided (typically not needed - silent success)
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attemptCount < retryConfig.maxRetries + 1) {
        const nextAttempt = attemptCount + 1;
        const delay = retryConfig.retryDelays[attemptCount - 1] || retryConfig.retryDelays[retryConfig.retryDelays.length - 1];

        if (retryConfig.logRetries) {
          console.warn(
            `[OptimisticUpdate${id ? ` ${id}` : ''}] Attempt ${attemptCount} failed, retrying in ${delay}ms`,
            err
          );
        }

        // Schedule retry
        pendingSync.attemptCount = nextAttempt;
        pendingSync.timeoutId = setTimeout(() => {
          attemptSync(pendingSync);
        }, delay);
      } else {
        // All retries exhausted - call error callback
        if (id) {
          pendingSyncs.delete(id);
        }

        if (retryConfig.logRetries) {
          console.error(
            `[OptimisticUpdate${id ? ` ${id}` : ''}] All ${attemptCount} attempts failed`,
            err
          );
        }

        onError(err, attemptCount);
      }
    }
  }

  /**
   * Execute an optimistic update with automatic retry logic
   */
  function execute<T>(options: OptimisticUpdateOptions<T>): void {
    const { optimisticUpdate, syncFn, onSuccess, onError, id } = options;

    // 1. Apply optimistic update immediately (synchronous)
    optimisticUpdate();

    // 2. Start async sync with retry logic
    const pendingSync: PendingSync<T> = {
      syncFn,
      onSuccess,
      onError,
      id,
      attemptCount: 1,
    };

    if (id) {
      // Cancel any pending sync with the same ID
      const existing = pendingSyncs.get(id);
      if (existing?.timeoutId) {
        clearTimeout(existing.timeoutId);
      }
      pendingSyncs.set(id, pendingSync as PendingSync<unknown>);
    }

    // Start first attempt immediately
    attemptSync(pendingSync);
  }

  /**
   * Cancel a pending sync operation by ID
   */
  function cancel(id: string): boolean {
    const pendingSync = pendingSyncs.get(id);
    if (!pendingSync) {
      return false;
    }

    if (pendingSync.timeoutId) {
      clearTimeout(pendingSync.timeoutId);
    }

    pendingSyncs.delete(id);

    if (retryConfig.logRetries) {
      console.log(`[OptimisticUpdate ${id}] Cancelled`);
    }

    return true;
  }

  /**
   * Cancel all pending sync operations
   */
  function cancelAll(): void {
    pendingSyncs.forEach((pendingSync, id) => {
      if (pendingSync.timeoutId) {
        clearTimeout(pendingSync.timeoutId);
      }
      if (retryConfig.logRetries) {
        console.log(`[OptimisticUpdate ${id}] Cancelled`);
      }
    });
    pendingSyncs.clear();
  }

  /**
   * Get count of pending sync operations
   */
  function getPendingCount(): number {
    return pendingSyncs.size;
  }

  return {
    execute,
    cancel,
    cancelAll,
    getPendingCount,
  };
}

/**
 * Global singleton instance for app-wide use
 * You can also create separate instances for different contexts if needed
 */
export const optimisticUpdate = createOptimisticUpdate();
