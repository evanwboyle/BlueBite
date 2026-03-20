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

} as const;
