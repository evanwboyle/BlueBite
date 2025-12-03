import type { Order, MenuItem } from '../types';

export const enrichOrdersWithMenuNames = (
  orders: Order[],
  menuItems: MenuItem[]
): Order[] => {
  const menuItemMap = new Map(menuItems.map(item => [item.id, item]));
  return orders.map((order) => ({
    ...order,
    items: (order.items || []).map(item => {
      const menuItem = menuItemMap.get(item.menuItemId);
      return {
        ...item,
        name: menuItem?.name || item.name || 'Unknown Item',
      };
    }),
  }));
};
