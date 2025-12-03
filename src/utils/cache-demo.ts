/**
 * Demonstration of the localStorage caching system
 *
 * This file demonstrates type safety and usage patterns.
 * Can be imported and used directly in App.tsx or run in browser console.
 */

import { storage } from './storage';
import type { MenuItem, Order } from '../types';

/**
 * Example: Progressive loading pattern for menu items
 */
export async function loadMenuWithCache(
  buttery: string | null,
  fetchFreshMenu: () => Promise<MenuItem[]>
): Promise<{ cached: MenuItem[] | null; fresh: MenuItem[] }> {
  // 1. Load cached menu immediately (if available)
  const cachedMenu = storage.getCachedMenu(buttery);

  if (cachedMenu && cachedMenu.length > 0) {
    console.log(`✓ Loaded ${cachedMenu.length} menu items from cache`);
  }

  // 2. Fetch fresh menu from API in background
  let freshMenu: MenuItem[] = [];
  try {
    freshMenu = await fetchFreshMenu();
    console.log(`✓ Fetched ${freshMenu.length} fresh menu items from API`);

    // Update cache for next time
    storage.setCachedMenu(freshMenu, buttery);
  } catch (error) {
    console.error('✗ Failed to fetch menu from API:', error);

    // If we have cached data, keep using it
    if (cachedMenu && cachedMenu.length > 0) {
      console.warn('⚠ Using cached menu due to API failure');
      freshMenu = cachedMenu;
    }
  }

  return { cached: cachedMenu, fresh: freshMenu };
}

/**
 * Example: Progressive loading pattern for orders
 */
export async function loadOrdersWithCache(
  buttery: string | null,
  fetchFreshOrders: () => Promise<Order[]>
): Promise<{ cached: Order[] | null; fresh: Order[] }> {
  // 1. Load cached orders immediately (if available)
  const cachedOrders = storage.getCachedOrders(buttery);

  if (cachedOrders && cachedOrders.length > 0) {
    console.log(`✓ Loaded ${cachedOrders.length} orders from cache`);
  }

  // 2. Fetch fresh orders from API in background
  let freshOrders: Order[] = [];
  try {
    freshOrders = await fetchFreshOrders();
    console.log(`✓ Fetched ${freshOrders.length} fresh orders from API`);

    // Update cache for next time
    storage.setCachedOrders(freshOrders, buttery);
  } catch (error) {
    console.error('✗ Failed to fetch orders from API:', error);

    // If we have cached data, keep using it
    if (cachedOrders && cachedOrders.length > 0) {
      console.warn('⚠ Using cached orders due to API failure');
      freshOrders = cachedOrders;
    }
  }

  return { cached: cachedOrders, fresh: freshOrders };
}

/**
 * Example: Type-safe cache operations
 */
export function demonstrateTypeSafety(): void {
  // TypeScript ensures correct types at compile time

  // ✓ Valid: MenuItem[] type
  const menu: MenuItem[] = [
    {
      id: '1',
      name: 'Pizza',
      price: 5.99,
      category: 'Food',
      hot: true,
      disabled: false,
      modifiers: [{ id: 'm1', name: 'Extra Cheese', price: 1.0 }],
    },
  ];
  storage.setCachedMenu(menu, 'Berkeley');

  // ✓ Valid: Retrieval returns MenuItem[] | null
  const cached: MenuItem[] | null = storage.getCachedMenu('Berkeley');

  // ✓ Valid: Type narrowing with null check
  if (cached) {
    const firstItem: MenuItem = cached[0];
    const itemName: string = firstItem.name;
    const modifierPrice: number = firstItem.modifiers[0].price;

    console.log('Item:', itemName, 'Modifier:', modifierPrice);
  }

  // ✗ Invalid: Type mismatch (TypeScript will catch this at compile time)
  // storage.setCachedMenu("wrong type" as any, 'Berkeley');  // Error!
  // const wrongType: string = storage.getCachedMenu();       // Error!
}

/**
 * Example: Cache metadata inspection
 */
export function inspectCacheMetadata(): void {
  const menuInfo = storage.getMenuCacheInfo();
  const ordersInfo = storage.getOrdersCacheInfo();

  if (menuInfo) {
    const age = Date.now() - menuInfo.timestamp;
    const ageMinutes = Math.round(age / 1000 / 60);

    console.log('Menu Cache:');
    console.log(`  Age: ${ageMinutes} minutes`);
    console.log(`  Buttery: ${menuInfo.buttery || 'All'}`);
  } else {
    console.log('Menu Cache: Empty');
  }

  if (ordersInfo) {
    const age = Date.now() - ordersInfo.timestamp;
    const ageMinutes = Math.round(age / 1000 / 60);

    console.log('Orders Cache:');
    console.log(`  Age: ${ageMinutes} minutes`);
    console.log(`  Buttery: ${ordersInfo.buttery || 'All'}`);
  } else {
    console.log('Orders Cache: Empty');
  }
}

/**
 * Example: Cache management
 */
export function demonstrateCacheManagement(): void {
  // Clear only cache (preserve cart and settings)
  storage.clearCache();
  console.log('✓ Cleared cache (cart and settings preserved)');

  // Clear everything including cache
  storage.clear();
  console.log('✓ Cleared all storage');
}

/**
 * Example: Buttery-specific caching
 */
export function demonstrateButteryFiltering(): void {
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

  // Cache for different butteries
  storage.setCachedMenu(berkeleyMenu, 'Berkeley');
  storage.setCachedMenu(yaleMenu, 'Yale');

  // Retrieve buttery-specific cache
  const cachedBerkeley = storage.getCachedMenu('Berkeley');
  const cachedYale = storage.getCachedMenu('Yale');

  console.log('Berkeley Menu:', cachedBerkeley?.[0]?.name);
  console.log('Yale Menu:', cachedYale?.[0]?.name);

  // Wrong buttery returns null
  const wrongButtery = storage.getCachedMenu('Princeton');
  console.log('Princeton Menu (should be null):', wrongButtery);
}

/**
 * Example: Error handling for corrupted cache
 */
export function demonstrateErrorHandling(): void {
  // Simulate corrupted cache
  try {
    localStorage.setItem('bluebite_cache_menu', 'corrupted-json{');

    // Cache utility handles this gracefully
    const cached = storage.getCachedMenu();

    if (cached === null) {
      console.log('✓ Corrupted cache handled gracefully (returned null)');
    }
  } catch (error) {
    console.error('✗ Unexpected error:', error);
  }
}

/**
 * Run all demonstrations
 */
export function runAllDemos(): void {
  console.group('🔍 Cache System Demonstrations');

  console.group('Type Safety');
  demonstrateTypeSafety();
  console.groupEnd();

  console.group('Cache Metadata');
  inspectCacheMetadata();
  console.groupEnd();

  console.group('Buttery Filtering');
  demonstrateButteryFiltering();
  console.groupEnd();

  console.group('Error Handling');
  demonstrateErrorHandling();
  console.groupEnd();

  console.groupEnd();
}

/**
 * Browser console usage:
 *
 * import { runAllDemos } from './utils/cache-demo';
 * runAllDemos();
 */
