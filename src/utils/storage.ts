import type { OrderItem, MenuItem, Order } from '../types';

interface Cart {
  items: OrderItem[];
  total: number;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
  buttery?: string | null;
}

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  // Cache version for invalidation when data structure changes
  VERSION: '1.0.0',
  // Cache keys
  KEYS: {
    MENU_ITEMS: 'bluebite_cache_menu',
    ORDERS: 'bluebite_cache_orders',
    VERSION: 'bluebite_cache_version',
  },
  // Cache expiration (optional - we always fetch fresh data, but this can help with cleanup)
  MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

/**
 * Type-safe cache operations with validation and error handling
 */
const cache = {
  /**
   * Store data in cache with metadata
   */
  set<T>(key: string, data: T, buttery?: string | null): void {
    try {
      const cachedData: CachedData<T> = {
        data,
        timestamp: Date.now(),
        buttery,
      };
      localStorage.setItem(key, JSON.stringify(cachedData));
    } catch (error) {
      console.warn(`Failed to cache data for key "${key}":`, error);
      // Gracefully handle quota exceeded or other storage errors
    }
  },

  /**
   * Retrieve data from cache with validation
   * Returns null if cache is invalid, expired, or buttery doesn't match
   */
  get<T>(key: string, buttery?: string | null): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const cached: CachedData<T> = JSON.parse(item);

      // Validate cache structure
      if (!cached.data || typeof cached.timestamp !== 'number') {
        console.warn(`Invalid cache structure for key "${key}"`);
        this.remove(key);
        return null;
      }

      // Check if buttery matches (if provided)
      if (buttery !== undefined && cached.buttery !== buttery) {
        return null; // Cache is for different buttery
      }

      // Optional: Check cache age
      const age = Date.now() - cached.timestamp;
      if (age > CACHE_CONFIG.MAX_AGE_MS) {
        console.log(`Cache expired for key "${key}" (age: ${Math.round(age / 1000 / 60)} minutes)`);
        this.remove(key);
        return null;
      }

      return cached.data;
    } catch (error) {
      console.warn(`Failed to retrieve cache for key "${key}":`, error);
      return null;
    }
  },

  /**
   * Check if cache exists and is valid
   */
  has(key: string, buttery?: string | null): boolean {
    return this.get(key, buttery) !== null;
  },

  /**
   * Remove specific cache entry
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove cache for key "${key}":`, error);
    }
  },

  /**
   * Clear all cache entries
   */
  clear(): void {
    Object.values(CACHE_CONFIG.KEYS).forEach(key => this.remove(key));
  },

  /**
   * Get cache metadata (timestamp, buttery)
   */
  getMetadata(key: string): Pick<CachedData<unknown>, 'timestamp' | 'buttery'> | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const cached: CachedData<unknown> = JSON.parse(item);
      return {
        timestamp: cached.timestamp,
        buttery: cached.buttery,
      };
    } catch {
      return null;
    }
  },
};

/**
 * Main storage utility with cart, buttery selection, and progressive caching
 */
export const storage = {
  // Current cart (temporary, until checkout)
  getCart: (): Cart => {
    const cart = localStorage.getItem('bluebite_cart');
    return cart ? JSON.parse(cart) : { items: [], total: 0 };
  },

  setCart: (cart: Cart): void => {
    localStorage.setItem('bluebite_cart', JSON.stringify(cart));
  },

  // Selected buttery (user preference)
  getSelectedButtery: (): string | null => {
    return localStorage.getItem('bluebite_selected_buttery');
  },

  setSelectedButtery: (buttery: string | null): void => {
    if (buttery === null) {
      localStorage.removeItem('bluebite_selected_buttery');
    } else {
      localStorage.setItem('bluebite_selected_buttery', buttery);
    }
  },

  // Cache management for menu items
  getCachedMenu: (buttery?: string | null): MenuItem[] | null => {
    return cache.get<MenuItem[]>(CACHE_CONFIG.KEYS.MENU_ITEMS, buttery);
  },

  setCachedMenu: (menuItems: MenuItem[], buttery?: string | null): void => {
    cache.set(CACHE_CONFIG.KEYS.MENU_ITEMS, menuItems, buttery);
  },

  // Cache management for orders
  getCachedOrders: (buttery?: string | null): Order[] | null => {
    return cache.get<Order[]>(CACHE_CONFIG.KEYS.ORDERS, buttery);
  },

  setCachedOrders: (orders: Order[], buttery?: string | null): void => {
    cache.set(CACHE_CONFIG.KEYS.ORDERS, orders, buttery);
  },

  // Get cache metadata
  getMenuCacheInfo: () => cache.getMetadata(CACHE_CONFIG.KEYS.MENU_ITEMS),
  getOrdersCacheInfo: () => cache.getMetadata(CACHE_CONFIG.KEYS.ORDERS),

  // Clear all storage including cache
  clear: (): void => {
    localStorage.removeItem('bluebite_cart');
    localStorage.removeItem('bluebite_selected_buttery');
    cache.clear();
  },

  // Clear only cache (preserve cart and settings)
  clearCache: (): void => {
    cache.clear();
  },
};
