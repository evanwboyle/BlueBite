import type { MenuItem, Modifier } from '../types';

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
   * Returns transformed MenuItem objects ready for frontend use
   */
  async fetchMenuItems(): Promise<MenuItem[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/menu`, {
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
};
