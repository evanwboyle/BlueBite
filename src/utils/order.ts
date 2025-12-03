import type { Order, MenuItem } from '../types';

/**
 * Enriches orders with menu item names by looking up menuItemId in the provided menu.
 * This is critical because backend orders only contain item IDs, not names.
 *
 * @param orders - Orders from backend (items may have missing names)
 * @param menuItems - Menu items to lookup names from
 * @returns Orders with fully populated item names
 *
 * **Defensive Programming**:
 * - Validates menu items exist before enrichment
 * - Logs warnings when item lookups fail for debugging
 * - Provides fallback to "Unknown Item" with item ID
 * - Handles edge cases (null/undefined items, empty arrays)
 */
export const enrichOrdersWithMenuNames = (
  orders: Order[],
  menuItems: MenuItem[]
): Order[] => {
  // Early return if no orders to process
  if (!orders || orders.length === 0) {
    return [];
  }

  // Warn if menu is empty (this indicates a race condition or API failure)
  if (!menuItems || menuItems.length === 0) {
    console.warn('[enrichOrdersWithMenuNames] No menu items available for enrichment. Orders will show "Unknown Item".');
    console.warn('This usually indicates a race condition where orders loaded before menu items.');
  }

  // Create fast lookup map for O(1) item access
  const menuItemMap = new Map(menuItems.map(item => [item.id, item]));

  // Track failed lookups for debugging
  const failedLookups = new Set<string>();

  const enrichedOrders = orders.map((order) => ({
    ...order,
    items: (order.items || []).map((item, index) => {
      // Validate item has required menuItemId
      if (!item.menuItemId) {
        console.error(`[enrichOrdersWithMenuNames] Order ${order.id} has item at index ${index} with missing menuItemId:`, item);
        return {
          ...item,
          name: 'Invalid Item (missing ID)',
        };
      }

      // Lookup menu item by ID
      const menuItem = menuItemMap.get(item.menuItemId);

      // If lookup succeeds, use menu item name
      if (menuItem?.name) {
        return {
          ...item,
          name: menuItem.name,
        };
      }

      // Lookup failed - use fallback logic with detailed logging
      // Check if item already has a name (from previous enrichment or backend)
      if (item.name && item.name !== 'Unknown Item') {
        return item; // Keep existing name
      }

      // Track this failed lookup for summary logging
      failedLookups.add(item.menuItemId);

      // Return with descriptive fallback name
      return {
        ...item,
        name: `Unknown Item (ID: ${item.menuItemId.substring(0, 8)}...)`,
      };
    }),
  }));

  // Log summary of failed lookups for debugging
  if (failedLookups.size > 0) {
    console.error('[enrichOrdersWithMenuNames] Failed to lookup names for menu item IDs:', Array.from(failedLookups));
    console.error('Available menu item IDs:', menuItems.map(m => m.id));
    console.error('This may indicate:');
    console.error('  1. Race condition: Orders fetched before menu loaded');
    console.error('  2. Data mismatch: Order references deleted/missing menu items');
    console.error('  3. Cache issue: Stale menu cache missing new items');
  }

  return enrichedOrders;
};
