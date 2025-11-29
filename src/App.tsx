import { useState, useEffect } from 'react';
import type { Order, OrderItem, MenuItem } from './types';
import { Header } from './components/Header';
import { MenuGrid } from './components/MenuGrid';
import { CartModal } from './components/CartModal';
import { OrderManager } from './components/OrderManager';
import { storage } from './utils/storage';
import { mockMenuItems } from './utils/mockData';
import { api } from './utils/api';
import { Bell } from 'lucide-react';

function App() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [passToCustomerMode, setPassToCustomerMode] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(65);

  // Initialize data from cache-first strategy
  useEffect(() => {
    const loadMenuItems = async () => {
      // 1. Load from localStorage cache immediately for fast UX
      const cachedMenu = storage.getMenuItems();
      if (cachedMenu.length > 0) {
        setMenuItems(cachedMenu);
      }

      // 2. Fetch fresh data from API in background
      try {
        const freshMenu = await api.fetchMenuItems();
        setMenuItems(freshMenu);
        storage.setMenuItems(freshMenu); // Update cache
      } catch (error) {
        console.error('Failed to fetch menu from API:', error);

        // 3. If no cache and API fails, fall back to mock data
        if (cachedMenu.length === 0) {
          console.warn('Using mock data as fallback');
          storage.setMenuItems(mockMenuItems);
          setMenuItems(mockMenuItems);
        }
      }
    };

    loadMenuItems();

    // Initialize orders and cart
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
    setIsCartOpen(false);
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

      {/* Notification Overlay */}
      {notification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fadeIn pointer-events-none">
          <div className="bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 pointer-events-auto">
            <Bell size={18} />
            {notification}
          </div>
        </div>
      )}

      {/* Pass to Customer Mode */}
      {passToCustomerMode && (
        <div className="bg-yellow-400 text-yellow-900 px-4 py-3 text-center font-bold shadow">
          Pass device to customer - Order will be placed in 3 seconds...
        </div>
      )}

      {/* Main Layout with Resizable Divider */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4">
        {/* Left Panel - Ordering */}
        <div style={{ flex: `0 0 ${leftPanelWidth}%` }} className="flex flex-col min-w-0">
          <div className="bg-white shadow border border-gray-200 flex-1 flex flex-col overflow-hidden">
            <MenuGrid items={menuItems} onAddToCart={handleAddToCart} cartCount={cartItems.length} onCartClick={() => setIsCartOpen(true)} />
          </div>
        </div>

        {/* Resizable Divider */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = leftPanelWidth;
            const container = (e.currentTarget.parentElement as HTMLElement);
            const containerWidth = container.clientWidth;

            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaX = moveEvent.clientX - startX;
              const deltaPercent = (deltaX / containerWidth) * 100;
              const newWidth = Math.max(20, Math.min(80, startWidth + deltaPercent));
              setLeftPanelWidth(newWidth);
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
          className="w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors duration-200 flex-shrink-0"
        />

        {/* Right Side - Order Manager */}
        <div style={{ flex: `0 0 ${100 - leftPanelWidth}%` }} className="flex flex-col min-w-0">
          <OrderManager orders={orders} onUpdateOrder={handleUpdateOrder} />
        </div>
      </div>

      {/* Overlays - rendered outside main layout */}
      {isCartOpen && (
        <CartModal
          items={cartItems}
          onClose={() => setIsCartOpen(false)}
          onRemoveItem={handleRemoveFromCart}
          onCheckout={handleCheckout}
          onPassToCustomer={handlePassToCustomer}
        />
      )}
    </div>
  );
}

export default App;
