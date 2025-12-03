import type { YaliesUser } from './yalies';

/**
 * Cache entry with TTL support
 */
interface CacheEntry {
  user: YaliesUser | null;
  timestamp: number;
}

/**
 * Yalies API cache configuration
 */
const CACHE_CONFIG = {
  STORAGE_KEY: 'bluebite_yalies_cache',
  TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

/**
 * In-memory cache for fast access during the same session
 * Maps netId -> YaliesUser | null
 */
const memoryCache = new Map<string, YaliesUser | null>();

/**
 * Yalies cache utility providing persistent, type-safe caching of user data
 *
 * Features:
 * - In-memory cache for fast access within the same session
 * - localStorage persistence across sessions
 * - Automatic TTL-based cache invalidation (24 hours)
 * - Thread-safe operations (synchronous API)
 * - Type-safe with full TypeScript support
 *
 * Usage:
 * ```ts
 * // Check cache before fetching
 * const cachedUser = yaliesCache.get('ewb28');
 * if (cachedUser !== undefined) {
 *   // Use cached data
 * } else {
 *   // Fetch from API and cache
 *   const user = await yalies.fetchUserByNetId('ewb28');
 *   yaliesCache.set('ewb28', user);
 * }
 * ```
 */
export const yaliesCache = {
  /**
   * Retrieve user from cache
   * @param netId - Yale NetID
   * @returns YaliesUser if found and not expired, null if explicitly cached as not found, undefined if not in cache
   */
  get(netId: string): YaliesUser | null | undefined {
    // Check memory cache first (fast path)
    if (memoryCache.has(netId)) {
      return memoryCache.get(netId);
    }

    // Check localStorage cache
    try {
      const stored = localStorage.getItem(CACHE_CONFIG.STORAGE_KEY);
      if (!stored) return undefined;

      const cache = JSON.parse(stored) as Record<string, CacheEntry>;
      const entry = cache[netId];

      if (!entry) return undefined;

      // Check if entry is expired
      const age = Date.now() - entry.timestamp;
      if (age > CACHE_CONFIG.TTL_MS) {
        // Entry expired, remove it
        delete cache[netId];
        localStorage.setItem(CACHE_CONFIG.STORAGE_KEY, JSON.stringify(cache));
        return undefined;
      }

      // Valid entry found, populate memory cache and return
      memoryCache.set(netId, entry.user);
      return entry.user;
    } catch (error) {
      console.error('Failed to read from Yalies cache:', error);
      return undefined;
    }
  },

  /**
   * Store user in cache
   * @param netId - Yale NetID
   * @param user - YaliesUser object or null if user not found
   */
  set(netId: string, user: YaliesUser | null): void {
    // Update memory cache
    memoryCache.set(netId, user);

    // Update localStorage cache
    try {
      const stored = localStorage.getItem(CACHE_CONFIG.STORAGE_KEY);
      const cache = stored ? (JSON.parse(stored) as Record<string, CacheEntry>) : {};

      cache[netId] = {
        user,
        timestamp: Date.now(),
      };

      localStorage.setItem(CACHE_CONFIG.STORAGE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to write to Yalies cache:', error);
    }
  },

  /**
   * Check if a netId exists in cache (without retrieving it)
   * @param netId - Yale NetID
   * @returns true if cached and not expired, false otherwise
   */
  has(netId: string): boolean {
    return this.get(netId) !== undefined;
  },

  /**
   * Remove a specific user from cache
   * @param netId - Yale NetID
   */
  delete(netId: string): void {
    memoryCache.delete(netId);

    try {
      const stored = localStorage.getItem(CACHE_CONFIG.STORAGE_KEY);
      if (!stored) return;

      const cache = JSON.parse(stored) as Record<string, CacheEntry>;
      delete cache[netId];
      localStorage.setItem(CACHE_CONFIG.STORAGE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to delete from Yalies cache:', error);
    }
  },

  /**
   * Clear entire cache (both memory and localStorage)
   */
  clear(): void {
    memoryCache.clear();
    try {
      localStorage.removeItem(CACHE_CONFIG.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear Yalies cache:', error);
    }
  },

  /**
   * Get all cached netIds (for debugging/admin purposes)
   * @returns Array of cached netIds
   */
  keys(): string[] {
    try {
      const stored = localStorage.getItem(CACHE_CONFIG.STORAGE_KEY);
      if (!stored) return [];

      const cache = JSON.parse(stored) as Record<string, CacheEntry>;
      return Object.keys(cache);
    } catch (error) {
      console.error('Failed to get cache keys:', error);
      return [];
    }
  },

  /**
   * Get cache statistics (for debugging/monitoring)
   * @returns Object with cache stats
   */
  stats(): { memorySize: number; storageSize: number; totalSize: number } {
    const memorySize = memoryCache.size;
    let storageSize = 0;

    try {
      const stored = localStorage.getItem(CACHE_CONFIG.STORAGE_KEY);
      if (stored) {
        const cache = JSON.parse(stored) as Record<string, CacheEntry>;
        storageSize = Object.keys(cache).length;
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error);
    }

    return {
      memorySize,
      storageSize,
      totalSize: Math.max(memorySize, storageSize),
    };
  },

  /**
   * Prune expired entries from localStorage
   * @returns Number of entries removed
   */
  prune(): number {
    try {
      const stored = localStorage.getItem(CACHE_CONFIG.STORAGE_KEY);
      if (!stored) return 0;

      const cache = JSON.parse(stored) as Record<string, CacheEntry>;
      const now = Date.now();
      let removed = 0;

      for (const [netId, entry] of Object.entries(cache)) {
        const age = now - entry.timestamp;
        if (age > CACHE_CONFIG.TTL_MS) {
          delete cache[netId];
          removed++;
        }
      }

      if (removed > 0) {
        localStorage.setItem(CACHE_CONFIG.STORAGE_KEY, JSON.stringify(cache));
      }

      return removed;
    } catch (error) {
      console.error('Failed to prune Yalies cache:', error);
      return 0;
    }
  },
} as const;

/**
 * Type guard to check if a cache result is a cache hit
 * @param result - Result from yaliesCache.get()
 * @returns true if result is a cache hit (user found or explicitly null)
 */
export function isCacheHit(result: YaliesUser | null | undefined): result is YaliesUser | null {
  return result !== undefined;
}
