import type { OrderItem } from '../types';

export const calculateCartTotal = (items: OrderItem[]): number =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);
