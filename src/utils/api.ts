import type { MenuItem, Order, OrderItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface BackendModifier {
  id: string;
  name: string;
  description: string | null;
  price: number;
  menuItemId: string;
  createdAt: string;
  updatedAt: string;
}

interface BackendMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  available: boolean;
  hot: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  modifiers: BackendModifier[];
}

/**
 * Transform backend MenuItem to frontend MenuItem
 */
function transformMenuItem(item: BackendMenuItem): MenuItem {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    category: item.category,
    hot: item.hot,
    disabled: !item.available,
    image: item.image || undefined,
    description: item.description || undefined,
    modifiers: item.modifiers.map(m => ({
      id: m.id,
      name: m.name,
      price: m.price,
      description: m.description || undefined,
    })),
  };
}

export const api = {
  /**
   * Fetch all menu items from the backend API
   * Optionally filter by buttery/residential college
   * Returns transformed MenuItem objects ready for frontend use
   */
  async fetchMenuItems(buttery?: string): Promise<MenuItem[]> {
    try {
      const url = buttery
        ? `${API_BASE_URL}/menu?buttery=${encodeURIComponent(buttery)}`
        : `${API_BASE_URL}/menu`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies/credentials if needed
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const backendItems: BackendMenuItem[] = await response.json();

      // Transform each item to frontend format
      return backendItems.map(transformMenuItem);
    } catch (error) {
      console.error('API Error - Failed to fetch menu items:', error);
      throw error;
    }
  },

  /**
   * Fetch list of all butteries/residential colleges with item counts
   */
  async fetchButteries(): Promise<Array<{name: string; itemCount: number}>> {
    try {
      const response = await fetch(`${API_BASE_URL}/butteries`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('API Error - Failed to fetch butteries:', error);
      throw error;
    }
  },

  /**
   * Create a new order on the backend
   */
  async createOrder(
    netId: string,
    items: OrderItem[],
    totalPrice: number,
    buttery?: string
  ): Promise<Order> {
    try {
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          netId,
          totalPrice,
          buttery: buttery || null,
          items: items.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.price,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const order = await response.json();
      return {
        id: order.id,
        netId: order.netId,
        buttery: order.buttery,
        items: order.orderItems || [],
        totalPrice: order.totalPrice,
        status: order.status as Order['status'],
        placedAt: new Date(order.createdAt).getTime(),
        completedAt: order.updatedAt ? new Date(order.updatedAt).getTime() : undefined,
      };
    } catch (error) {
      console.error('API Error - Failed to create order:', error);
      throw error;
    }
  },

  /**
   * Fetch all orders (staff/admin view), optionally filtered by buttery
   */
  async fetchAllOrders(buttery?: string): Promise<Order[]> {
    try {
      const url = buttery
        ? `${API_BASE_URL}/orders?buttery=${encodeURIComponent(buttery)}`
        : `${API_BASE_URL}/orders`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      interface BackendOrderItem {
        id: string;
        orderId: string;
        menuItemId: string;
        quantity: number;
        price: number;
        createdAt: string;
        updatedAt: string;
        modifiers: unknown[];
      }

      interface BackendOrder {
        id: string;
        netId: string;
        buttery: string | null;
        status: string;
        totalPrice: number;
        createdAt: string;
        updatedAt: string;
        orderItems: BackendOrderItem[];
      }
      const orders: BackendOrder[] = await response.json();
      return orders.map((o) => ({
        id: o.id,
        netId: o.netId,
        buttery: o.buttery,
        items: (o.orderItems || []) as unknown as OrderItem[],
        totalPrice: o.totalPrice,
        status: o.status as Order['status'],
        placedAt: new Date(o.createdAt).getTime(),
        completedAt: o.updatedAt ? new Date(o.updatedAt).getTime() : undefined,
      }));
    } catch (error) {
      console.error('API Error - Failed to fetch all orders:', error);
      throw error;
    }
  },

  /**
   * Fetch all orders for a user, optionally filtered by buttery
   */
  async fetchOrders(userId: string, buttery?: string): Promise<Order[]> {
    try {
      const url = buttery
        ? `${API_BASE_URL}/users/${userId}/orders?buttery=${encodeURIComponent(buttery)}`
        : `${API_BASE_URL}/users/${userId}/orders`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      interface BackendOrderItem {
        id: string;
        orderId: string;
        menuItemId: string;
        quantity: number;
        price: number;
        createdAt: string;
        updatedAt: string;
        modifiers: unknown[];
      }

      interface BackendOrder {
        id: string;
        netId: string;
        buttery: string | null;
        status: string;
        totalPrice: number;
        createdAt: string;
        updatedAt: string;
        orderItems: BackendOrderItem[];
      }
      const orders: BackendOrder[] = await response.json();
      return orders.map((o) => ({
        id: o.id,
        netId: o.netId,
        buttery: o.buttery,
        items: (o.orderItems || []) as unknown as OrderItem[],
        totalPrice: o.totalPrice,
        status: o.status as Order['status'],
        placedAt: new Date(o.createdAt).getTime(),
        completedAt: o.updatedAt ? new Date(o.updatedAt).getTime() : undefined,
      }));
    } catch (error) {
      console.error('API Error - Failed to fetch orders:', error);
      throw error;
    }
  },

  /**
   * Fetch orders and enrich with menu item names
   */
  async fetchOrdersWithMenuNames(userId: string, menuItems: MenuItem[], buttery?: string): Promise<Order[]> {
    try {
      const orders = await this.fetchOrders(userId, buttery);
      const menuItemMap = new Map(menuItems.map(item => [item.id, item]));

      return orders.map((o) => ({
        ...o,
        items: (o.items || []).map(item => {
          const menuItem = menuItemMap.get(item.menuItemId);
          return {
            ...item,
            name: menuItem?.name || item.name || 'Unknown Item',
          };
        }),
      }));
    } catch (error) {
      console.error('API Error - Failed to fetch orders with menu names:', error);
      throw error;
    }
  },

  /**
   * Update an order's status
   */
  async updateOrderStatus(orderId: string, status: Order['status']): Promise<Order> {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const order = await response.json();
      return {
        id: order.id,
        netId: order.netId,
        buttery: order.buttery,
        items: order.orderItems || [],
        totalPrice: order.totalPrice,
        status: order.status as Order['status'],
        placedAt: new Date(order.createdAt).getTime(),
        completedAt: order.updatedAt ? new Date(order.updatedAt).getTime() : undefined,
      };
    } catch (error) {
      console.error('API Error - Failed to update order:', error);
      throw error;
    }
  },
};
