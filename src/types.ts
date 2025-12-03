export interface Modifier {
  id: string;
  name: string;
  price: number;
  description?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  hot: boolean;
  disabled: boolean;
  image?: string;
  description?: string;
  buttery?: string | null;
  modifiers: Modifier[];
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  modifiers: string[];
}

export interface Order {
  id: string;
  netId: string;
  buttery?: string | null;
  items: OrderItem[];
  totalPrice: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  placedAt: number;
  completedAt?: number;
  specialInstructions?: string;
}

export interface Resco {
  id: string;
  name: string;
  hoursOpen: string;
  coldFoodOnlyHours: string;
}

export interface User {
  netId: string;
  name?: string;
  picture?: string;
  phone?: string;
  currentResco?: string;
  role?: string;
}
