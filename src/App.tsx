import { useState, useEffect } from 'react';
import type { Order, OrderItem, MenuItem } from './types';
import { Header } from './components/Header';
import { MenuGrid } from './components/MenuGrid';
import { CartPanel } from './components/CartPanel';
import { OrderManager } from './components/OrderManager';
import { storage } from './utils/storage';
import { mockMenuItems } from './utils/mockData';
import { Bell } from 'lucide-react';

function App() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [passToCustomerMode, setPassToCustomerMode] = useState(false);

  // Initialize data from storage or mock
  useEffect(() => {
    const storedMenu = storage.getMenuItems();
    if (storedMenu.length === 0) {
      storage.setMenuItems(mockMenuItems);
      setMenuItems(mockMenuItems);
    } else {
      setMenuItems(storedMenu);
    }

    const storedOrders = storage.getOrders();
    setOrders(storedOrders);

    const storedCart = storage.getCart();
    setCartItems(storedCart.items || []);
  }, []);

  // Simulate real-time order updates
  useEffect(() => {
    const interval = setInterval(() => {
      setOrders(prevOrders =>
        prevOrders.map(order => {
          if (order.status === 'pending' && Math.random() > 0.7) {
            return { ...order, status: 'preparing' };
          }
          if (order.status === 'preparing' && Math.random() > 0.8) {
            return { ...order, status: 'ready' };
          }
          return order;
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleAddToCart = (item: OrderItem) => {
    const newCart = [...cartItems, item];
    setCartItems(newCart);
    storage.setCart({ items: newCart, total: calculateTotal(newCart) });
    setNotification(`Added ${item.name} to cart`);
    setTimeout(() => setNotification(null), 2000);
  };

  const handleRemoveFromCart = (index: number) => {
    const newCart = cartItems.filter((_, i) => i !== index);
    setCartItems(newCart);
    storage.setCart({ items: newCart, total: calculateTotal(newCart) });
  };

  const calculateTotal = (items: OrderItem[]) =>
    items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      setNotification('Cart is empty');
      return;
    }

    const newOrder: Order = {
      id: `ORD-${Date.now().toString(36).toUpperCase()}`,
      netId: 'worker1',
      items: cartItems,
      totalPrice: calculateTotal(cartItems),
      status: 'pending',
      placedAt: Date.now(),
    };

    const newOrders = [...orders, newOrder];
    setOrders(newOrders);
    storage.setOrders(newOrders);
    setCartItems([]);
    storage.setCart({ items: [], total: 0 });
    setNotification(`Order ${newOrder.id} placed!`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePassToCustomer = () => {
    setPassToCustomerMode(true);
    const timer = setTimeout(() => {
      setPassToCustomerMode(false);
      handleCheckout();
    }, 3000);

    return () => clearTimeout(timer);
  };

  const handleUpdateOrder = (id: string, status: Order['status']) => {
    const newOrders = orders.map(o =>
      o.id === id ? { ...o, status, completedAt: status === 'completed' ? Date.now() : o.completedAt } : o
    );
    setOrders(newOrders);
    storage.setOrders(newOrders);

    if (status === 'ready') {
      setNotification('Order ready for pickup!');
    } else if (status === 'completed') {
      setNotification('Order completed!');
    }
    setTimeout(() => setNotification(null), 2000);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Header />

      {/* Notification */}
      {notification && (
        <div className="bg-blue-500 text-white px-4 py-2 shadow flex items-center gap-2">
          <Bell size={18} />
          {notification}
        </div>
      )}

      {/* Pass to Customer Mode */}
      {passToCustomerMode && (
        <div className="bg-yellow-400 text-yellow-900 px-4 py-3 text-center font-bold shadow">
          Pass device to customer - Order will be placed in 3 seconds...
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4">
        {/* Left Panel - Ordering */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-white rounded-lg shadow border border-gray-200 flex-1 flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-4">
              <h2 className="text-lg font-bold">Menu</h2>
            </div>
            <MenuGrid items={menuItems} onAddToCart={handleAddToCart} />
          </div>
        </div>

        {/* Right Side - Cart and Orders */}
        <div className="w-96 flex flex-col gap-4 min-w-0">
          {/* Cart */}
          <div className="flex-1 min-h-0">
            <CartPanel
              items={cartItems}
              onRemoveItem={handleRemoveFromCart}
              onCheckout={handleCheckout}
              onPassToCustomer={handlePassToCustomer}
            />
          </div>

          {/* Order Manager */}
          <div className="flex-1 min-h-0">
            <OrderManager orders={orders} onUpdateOrder={handleUpdateOrder} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
