/**
 * Test suite for localStorage caching functionality
 *
 * This file demonstrates the type safety and functionality of the caching system.
 * Run these tests with: npm test (if Jest is configured)
 * Or manually validate types with: npx tsc --noEmit
 */

import { storage } from './storage';
import type { MenuItem, Order, OrderItem } from '../types';

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Replace global localStorage with mock
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Storage Caching System', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Type Safety', () => {
    it('should handle MenuItem[] type correctly', () => {
      const menuItems: MenuItem[] = [
        {
          id: '1',
          name: 'Pizza',
          price: 5.99,
          category: 'Food',
          hot: true,
          disabled: false,
          buttery: 'Berkeley',
          modifiers: [
            { id: 'm1', name: 'Extra Cheese', price: 1.0 },
          ],
        },
      ];

      storage.setCachedMenu(menuItems, 'Berkeley');
      const cached = storage.getCachedMenu('Berkeley');

      // TypeScript ensures cached is MenuItem[] | null
      expect(cached).not.toBeNull();
      if (cached) {
        expect(cached[0].name).toBe('Pizza');
        expect(cached[0].modifiers[0].name).toBe('Extra Cheese');
      }
    });

    it('should handle Order[] type correctly', () => {
      const orders: Order[] = [
        {
          id: 'order-1',
          netId: 'abc123',
          buttery: 'Berkeley',
          items: [
            {
              menuItemId: '1',
              name: 'Pizza',
              quantity: 2,
              price: 5.99,
              modifiers: ['Extra Cheese'],
            },
          ],
          totalPrice: 12.98,
          status: 'pending',
          placedAt: Date.now(),
        },
      ];

      storage.setCachedOrders(orders, 'Berkeley');
      const cached = storage.getCachedOrders('Berkeley');

      // TypeScript ensures cached is Order[] | null
      expect(cached).not.toBeNull();
      if (cached) {
        expect(cached[0].status).toBe('pending');
        expect(cached[0].items[0].name).toBe('Pizza');
      }
    });
  });

  describe('Cache Operations', () => {
    it('should cache and retrieve menu items', () => {
      const menuItems: MenuItem[] = [
        {
          id: '1',
          name: 'Burger',
          price: 8.99,
          category: 'Food',
          hot: true,
          disabled: false,
          modifiers: [],
        },
      ];

      storage.setCachedMenu(menuItems);
      const cached = storage.getCachedMenu();

      expect(cached).toEqual(menuItems);
    });

    it('should cache and retrieve orders', () => {
      const orders: Order[] = [
        {
          id: 'order-1',
          netId: 'user123',
          items: [],
          totalPrice: 10.0,
          status: 'completed',
          placedAt: Date.now(),
        },
      ];

      storage.setCachedOrders(orders);
      const cached = storage.getCachedOrders();

      expect(cached).toEqual(orders);
    });

    it('should return null for non-existent cache', () => {
      const cached = storage.getCachedMenu();
      expect(cached).toBeNull();
    });

    it('should handle buttery filtering', () => {
      const berkeleyMenu: MenuItem[] = [
        {
          id: '1',
          name: 'Berkeley Pizza',
          price: 5.99,
          category: 'Food',
          hot: true,
          disabled: false,
          buttery: 'Berkeley',
          modifiers: [],
        },
      ];

      const yaleMenu: MenuItem[] = [
        {
          id: '2',
          name: 'Yale Pizza',
          price: 6.99,
          category: 'Food',
          hot: true,
          disabled: false,
          buttery: 'Yale',
          modifiers: [],
        },
      ];

      storage.setCachedMenu(berkeleyMenu, 'Berkeley');
      storage.setCachedMenu(yaleMenu, 'Yale');

      const cachedBerkeley = storage.getCachedMenu('Berkeley');
      const cachedYale = storage.getCachedMenu('Yale');

      expect(cachedBerkeley).toEqual(berkeleyMenu);
      expect(cachedYale).toEqual(yaleMenu);
      expect(cachedBerkeley).not.toEqual(cachedYale);
    });
  });

  describe('Cache Metadata', () => {
    it('should store and retrieve cache metadata', () => {
      const menuItems: MenuItem[] = [
        {
          id: '1',
          name: 'Item',
          price: 1.0,
          category: 'Test',
          hot: false,
          disabled: false,
          modifiers: [],
        },
      ];

      const beforeCache = Date.now();
      storage.setCachedMenu(menuItems, 'Berkeley');
      const afterCache = Date.now();

      const metadata = storage.getMenuCacheInfo();

      expect(metadata).not.toBeNull();
      if (metadata) {
        expect(metadata.timestamp).toBeGreaterThanOrEqual(beforeCache);
        expect(metadata.timestamp).toBeLessThanOrEqual(afterCache);
        expect(metadata.buttery).toBe('Berkeley');
      }
    });
  });

  describe('Cache Clearing', () => {
    it('should clear only cache data', () => {
      const menuItems: MenuItem[] = [
        {
          id: '1',
          name: 'Item',
          price: 1.0,
          category: 'Test',
          hot: false,
          disabled: false,
          modifiers: [],
        },
      ];

      const cartItems: OrderItem[] = [
        {
          menuItemId: '1',
          name: 'Item',
          quantity: 1,
          price: 1.0,
          modifiers: [],
        },
      ];

      storage.setCachedMenu(menuItems);
      storage.setCart({ items: cartItems, total: 1.0 });

      storage.clearCache();

      expect(storage.getCachedMenu()).toBeNull();
      expect(storage.getCart().items).toEqual(cartItems);
    });

    it('should clear all storage including cache', () => {
      const menuItems: MenuItem[] = [
        {
          id: '1',
          name: 'Item',
          price: 1.0,
          category: 'Test',
          hot: false,
          disabled: false,
          modifiers: [],
        },
      ];

      storage.setCachedMenu(menuItems);
      storage.setCart({ items: [], total: 0 });
      storage.setSelectedButtery('Berkeley');

      storage.clear();

      expect(storage.getCachedMenu()).toBeNull();
      expect(storage.getCart().items).toEqual([]);
      expect(storage.getSelectedButtery()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted cache gracefully', () => {
      // Simulate corrupted data
      localStorage.setItem('bluebite_cache_menu', 'invalid-json{');

      const cached = storage.getCachedMenu();
      expect(cached).toBeNull();
    });

    it('should handle quota exceeded errors', () => {
      // Mock setItem to throw quota exceeded error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      const menuItems: MenuItem[] = [
        {
          id: '1',
          name: 'Item',
          price: 1.0,
          category: 'Test',
          hot: false,
          disabled: false,
          modifiers: [],
        },
      ];

      // Should not throw, should handle gracefully
      expect(() => storage.setCachedMenu(menuItems)).not.toThrow();

      // Restore original setItem
      localStorage.setItem = originalSetItem;
    });
  });

  describe('Cache Expiration', () => {
    it('should respect cache expiration time', () => {
      const menuItems: MenuItem[] = [
        {
          id: '1',
          name: 'Item',
          price: 1.0,
          category: 'Test',
          hot: false,
          disabled: false,
          modifiers: [],
        },
      ];

      // Manually set cache with old timestamp
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      localStorage.setItem('bluebite_cache_menu', JSON.stringify({
        data: menuItems,
        timestamp: oldTimestamp,
        buttery: null,
      }));

      const cached = storage.getCachedMenu();
      // Cache should be expired and return null
      expect(cached).toBeNull();
    });

    it('should return valid cache within expiration time', () => {
      const menuItems: MenuItem[] = [
        {
          id: '1',
          name: 'Item',
          price: 1.0,
          category: 'Test',
          hot: false,
          disabled: false,
          modifiers: [],
        },
      ];

      // Set cache with recent timestamp
      const recentTimestamp = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
      localStorage.setItem('bluebite_cache_menu', JSON.stringify({
        data: menuItems,
        timestamp: recentTimestamp,
        buttery: null,
      }));

      const cached = storage.getCachedMenu();
      // Cache should still be valid
      expect(cached).toEqual(menuItems);
    });
  });
});

/**
 * Example usage demonstrating progressive loading pattern
 */
function demonstrateProgressiveLoading() {
  // This is how App.tsx uses the caching system

  // 1. On app load, check cache first
  const cachedMenu = storage.getCachedMenu('Berkeley');
  if (cachedMenu) {
    console.log('Display cached menu immediately:', cachedMenu);
  }

  // 2. Fetch fresh data in background
  async function fetchFreshData() {
    try {
      // Simulated API call
      const freshMenu: MenuItem[] = await Promise.resolve([
        {
          id: '1',
          name: 'Fresh Pizza',
          price: 5.99,
          category: 'Food',
          hot: true,
          disabled: false,
          modifiers: [],
        },
      ]);

      // 3. Update cache with fresh data
      storage.setCachedMenu(freshMenu, 'Berkeley');

      console.log('Updated with fresh menu:', freshMenu);
    } catch (error) {
      console.error('API failed, using cached data');
    }
  }

  void fetchFreshData();
}

// Type checks to ensure API compatibility
function typeChecks() {
  // Ensure getCachedMenu returns correct type
  const menu: MenuItem[] | null = storage.getCachedMenu();

  // Ensure getCachedOrders returns correct type
  const orders: Order[] | null = storage.getCachedOrders();

  // Ensure metadata functions return correct types
  const menuInfo: { timestamp: number; buttery?: string | null } | null = storage.getMenuCacheInfo();
  const ordersInfo: { timestamp: number; buttery?: string | null } | null = storage.getOrdersCacheInfo();

  // Prevent unused variable warnings
  void menu;
  void orders;
  void menuInfo;
  void ordersInfo;
}

// Export for documentation
export { demonstrateProgressiveLoading, typeChecks };
