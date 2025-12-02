import type { OrderItem } from '../types';

interface Cart {
  items: OrderItem[];
  total: number;
}

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

  // Clear all
  clear: (): void => {
    localStorage.removeItem('bluebite_cart');
    localStorage.removeItem('bluebite_selected_buttery');
  },
};
