import type { Order, MenuItem } from '../types';

export const storage = {
  // Orders
  getOrders: (): Order[] => {
    const orders = localStorage.getItem('bluebite_orders');
    return orders ? JSON.parse(orders) : [];
  },

  setOrders: (orders: Order[]): void => {
    localStorage.setItem('bluebite_orders', JSON.stringify(orders));
  },

  addOrder: (order: Order): void => {
    const orders = storage.getOrders();
    orders.push(order);
    storage.setOrders(orders);
  },

  updateOrder: (id: string, updates: Partial<Order>): void => {
    const orders = storage.getOrders();
    const index = orders.findIndex(o => o.id === id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      storage.setOrders(orders);
    }
  },

  // Menu items
  getMenuItems: (): MenuItem[] => {
    const items = localStorage.getItem('bluebite_menu_items');
    return items ? JSON.parse(items) : [];
  },

  setMenuItems: (items: MenuItem[]): void => {
    localStorage.setItem('bluebite_menu_items', JSON.stringify(items));
  },

  // Current cart
  getCart: () => {
    const cart = localStorage.getItem('bluebite_cart');
    return cart ? JSON.parse(cart) : { items: [], total: 0 };
  },

  setCart: (cart: any): void => {
    localStorage.setItem('bluebite_cart', JSON.stringify(cart));
  },

  // Clear all
  clear: (): void => {
    localStorage.removeItem('bluebite_orders');
    localStorage.removeItem('bluebite_menu_items');
    localStorage.removeItem('bluebite_cart');
  },
};
