export interface Modifier {
  id: string;
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  hot: boolean;
  disabled: boolean;
  image?: string;
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
  items: OrderItem[];
  totalPrice: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  placedAt: number;
  completedAt?: number;
}

export interface Resco {
  id: string;
  name: string;
  hoursOpen: string;
  coldFoodOnlyHours: string;
}

export interface User {
  netId: string;
  name: string;
  picture?: string;
  phone?: string;
  currentResco: string;
}
