export interface Modifier {
  id: string;
  name: string;
  price: number;
  description?: string;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number | null;
  displayOrder: number;
  modifiers: Modifier[];
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
  modifierGroups?: ModifierGroup[];
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  modifiers: string[];
}

export type OrderStatus =
  | 'awaiting_payment'
  | 'payment_failed'
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export interface Order {
  id: string;
  netId: string;
  buttery?: string | null;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  placedAt: number;
  completedAt?: number;
  specialInstructions?: string;
  phone?: string;
  comments?: string;
}

export type PaymentStatus =
  | 'requested'
  | 'awaiting_device'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'error'
  | 'expired'
  | 'bypassed';

export interface Payment {
  id: string;
  orderId: string;
  provider: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  errorMessage?: string | null;
}

export interface User {
  netId: string;
  name?: string;
  picture?: string;
  phone?: string;
  role?: string;
}
