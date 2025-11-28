import type { MenuItem, Order } from '../types';

export const mockMenuItems: MenuItem[] = [
  {
    id: '1',
    name: 'Classic Burger',
    price: 8.99,
    category: 'Main',
    hot: true,
    disabled: false,
    modifiers: [
      { id: 'm1', name: 'Extra Cheese', price: 1.00 },
      { id: 'm2', name: 'Bacon', price: 1.50 },
      { id: 'm3', name: 'Lettuce', price: 0 },
    ],
  },
  {
    id: '2',
    name: 'Grilled Cheese',
    price: 6.99,
    category: 'Main',
    hot: true,
    disabled: false,
    modifiers: [
      { id: 'm4', name: 'Tomato', price: 0.50 },
      { id: 'm5', name: 'Bacon', price: 1.50 },
    ],
  },
  {
    id: '3',
    name: 'Caesar Salad',
    price: 7.99,
    category: 'Salad',
    hot: false,
    disabled: false,
    modifiers: [
      { id: 'm6', name: 'Chicken', price: 2.00 },
      { id: 'm7', name: 'Extra Dressing', price: 0.50 },
    ],
  },
  {
    id: '4',
    name: 'Fries',
    price: 3.99,
    category: 'Side',
    hot: true,
    disabled: false,
    modifiers: [
      { id: 'm8', name: 'Cheese Sauce', price: 1.00 },
      { id: 'm9', name: 'Cajun Spice', price: 0.50 },
    ],
  },
  {
    id: '5',
    name: 'Milkshake',
    price: 5.99,
    category: 'Drinks',
    hot: false,
    disabled: false,
    modifiers: [
      { id: 'm10', name: 'Vanilla', price: 0 },
      { id: 'm11', name: 'Chocolate', price: 0 },
      { id: 'm12', name: 'Strawberry', price: 0 },
      { id: 'm13', name: 'Extra Whipped Cream', price: 0.50 },
    ],
  },
  {
    id: '6',
    name: 'Wings',
    price: 9.99,
    category: 'Main',
    hot: true,
    disabled: false,
    modifiers: [
      { id: 'm14', name: 'Buffalo', price: 0 },
      { id: 'm15', name: 'BBQ', price: 0 },
      { id: 'm16', name: 'Lemon Pepper', price: 0 },
      { id: 'm17', name: 'Extra Sauce', price: 0.50 },
    ],
  },
  {
    id: '7',
    name: 'Pizza Slice',
    price: 4.99,
    category: 'Main',
    hot: true,
    disabled: false,
    modifiers: [
      { id: 'm18', name: 'Pepperoni', price: 0.50 },
      { id: 'm19', name: 'Mushrooms', price: 0.50 },
    ],
  },
  {
    id: '8',
    name: 'Cookies',
    price: 2.99,
    category: 'Dessert',
    hot: false,
    disabled: false,
    modifiers: [
      { id: 'm20', name: 'Chocolate Chip', price: 0 },
      { id: 'm21', name: 'Oatmeal Raisin', price: 0 },
    ],
  },
];

export const generateMockOrder = (): Order => {
  const now = Date.now();
  return {
    id: `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    netId: 'student' + Math.floor(Math.random() * 1000),
    items: [
      {
        menuItemId: '1',
        name: 'Classic Burger',
        quantity: 1,
        price: 8.99,
        modifiers: ['Extra Cheese'],
      },
      {
        menuItemId: '4',
        name: 'Fries',
        quantity: 1,
        price: 3.99,
        modifiers: [],
      },
    ],
    totalPrice: 12.98,
    status: 'pending',
    placedAt: now,
  };
};
