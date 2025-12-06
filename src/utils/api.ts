import type { MenuItem, Modifier, Order, OrderItem } from '../types';

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

      interface BackendCreatedOrderItem {
        id: string;
        menuItemId: string;
        quantity: number;
        price: number;
      }

      const order = await response.json();
      return {
        id: order.id,
        netId: order.netId,
        buttery: order.buttery,
        // Transform backend items to frontend OrderItem format
        items: (order.orderItems || []).map((backendItem: BackendCreatedOrderItem) => ({
          menuItemId: backendItem.menuItemId,
          name: '', // Empty - will be enriched by enrichOrdersWithMenuNames()
          quantity: backendItem.quantity,
          price: backendItem.price,
          modifiers: [],
        })),
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
        // Transform backend items to frontend OrderItem format
        // CRITICAL: Backend items only have menuItemId, NOT name
        // Name will be populated by enrichOrdersWithMenuNames() function
        items: (o.orderItems || []).map(backendItem => ({
          menuItemId: backendItem.menuItemId,
          name: '', // Empty - will be enriched by enrichOrdersWithMenuNames()
          quantity: backendItem.quantity,
          price: backendItem.price,
          modifiers: [], // TODO: Transform modifiers when backend implements them
        })),
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
        // Transform backend items to frontend OrderItem format
        // CRITICAL: Backend items only have menuItemId, NOT name
        // Name will be populated by enrichOrdersWithMenuNames() function
        items: (o.orderItems || []).map(backendItem => ({
          menuItemId: backendItem.menuItemId,
          name: '', // Empty - will be enriched by enrichOrdersWithMenuNames()
          quantity: backendItem.quantity,
          price: backendItem.price,
          modifiers: [], // TODO: Transform modifiers when backend implements them
        })),
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

      interface BackendUpdatedOrderItem {
        id: string;
        menuItemId: string;
        quantity: number;
        price: number;
      }

      const order = await response.json();
      return {
        id: order.id,
        netId: order.netId,
        buttery: order.buttery,
        // Transform backend items to frontend OrderItem format
        items: (order.orderItems || []).map((backendItem: BackendUpdatedOrderItem) => ({
          menuItemId: backendItem.menuItemId,
          name: '', // Empty - will be enriched by enrichOrdersWithMenuNames()
          quantity: backendItem.quantity,
          price: backendItem.price,
          modifiers: [],
        })),
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

  /**
   * Create a new menu item (admin only)
   */
  async createMenuItem(item: Omit<MenuItem, 'id'>): Promise<MenuItem> {
    try {
      const response = await fetch(`${API_BASE_URL}/menu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: item.name,
          description: item.description || null,
          price: item.price,
          category: item.category,
          hot: item.hot,
          available: !item.disabled,
          image: item.image || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const backendItem: BackendMenuItem = await response.json();
      return transformMenuItem(backendItem);
    } catch (error) {
      console.error('API Error - Failed to create menu item:', error);
      throw error;
    }
  },

  /**
   * Update a menu item (full update, admin only)
   */
  async updateMenuItem(id: string, updates: Partial<Omit<MenuItem, 'id'>>): Promise<MenuItem> {
    try {
      const response = await fetch(`${API_BASE_URL}/menu/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: updates.name,
          description: updates.description || null,
          price: updates.price,
          category: updates.category,
          hot: updates.hot,
          available: updates.disabled !== undefined ? !updates.disabled : undefined,
          image: updates.image || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const backendItem: BackendMenuItem = await response.json();
      return transformMenuItem(backendItem);
    } catch (error) {
      console.error('API Error - Failed to update menu item:', error);
      throw error;
    }
  },

  /**
   * Toggle menu item availability or hot status (staff+admin)
   */
  async toggleMenuItem(
    id: string,
    updates: { available?: boolean; hot?: boolean }
  ): Promise<MenuItem> {
    try {
      const response = await fetch(`${API_BASE_URL}/menu/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const backendItem: BackendMenuItem = await response.json();
      return transformMenuItem(backendItem);
    } catch (error) {
      console.error('API Error - Failed to toggle menu item:', error);
      throw error;
    }
  },

  /**
   * Delete a menu item (admin only)
   */
  async deleteMenuItem(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/menu/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('API Error - Failed to delete menu item:', error);
      throw error;
    }
  },

  /**
   * Update a modifier for a menu item (admin only)
   */
  async updateModifier(
    itemId: string,
    modifierId: string,
    updates: Partial<Modifier>
  ): Promise<Modifier> {
    try {
      const response = await fetch(`${API_BASE_URL}/menu/${itemId}/modifiers/${modifierId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: updates.name,
          description: updates.description || null,
          price: updates.price,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      interface BackendModifierResponse {
        id: string;
        name: string;
        description: string | null;
        price: number;
      }

      const modifier: BackendModifierResponse = await response.json();
      return {
        id: modifier.id,
        name: modifier.name,
        price: modifier.price,
        description: modifier.description || undefined,
      };
    } catch (error) {
      console.error('API Error - Failed to update modifier:', error);
      throw error;
    }
  },

  /**
   * Delete a modifier from a menu item (admin only)
   */
  async deleteModifier(itemId: string, modifierId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/menu/${itemId}/modifiers/${modifierId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('API Error - Failed to delete modifier:', error);
      throw error;
    }
  },
};
