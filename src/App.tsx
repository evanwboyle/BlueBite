import { useState, useEffect } from 'react';
import type { Order, OrderItem, MenuItem } from './types';
import { Header } from './components/Header';
import { MenuGrid } from './components/MenuGrid';
import { CartModal } from './components/CartModal';
import { OrderManager } from './components/OrderManager';
import { storage } from './utils/storage';
import { api } from './utils/api';
import { Bell } from 'lucide-react';

function App() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cartItems, setCartItems] = useState<OrderItem[]>(() => {
    const storedCart = storage.getCart();
    return storedCart.items || [];
  });
  const [notification, setNotification] = useState<string | null>(null);
  const [passToCustomerMode, setPassToCustomerMode] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(65);
  const [selectedButtery, setSelectedButtery] = useState<string | null>(() => storage.getSelectedButtery());
  const [butteryOptions, setButteryOptions] = useState<Array<{name: string; itemCount: number}>>([ ]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      // Fetch buttery options
      try {
        const butteries = await api.fetchButteries();
        setButteryOptions(butteries);
      } catch (err) {
        console.error('Failed to fetch butteries:', err);
      }
    };

    init();
  }, []);

  // Load menu items when buttery changes
  useEffect(() => {
    const loadMenuItems = async () => {
      try {
        const freshMenu = await api.fetchMenuItems(selectedButtery || undefined);
        setMenuItems(freshMenu);
      } catch (error) {
        console.error('Failed to fetch menu from API:', error);
        setNotification(`Error loading menu: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setMenuItems([]);
      }
    };

    loadMenuItems();
  }, [selectedButtery]);

  // Fetch all orders (staff/admin view) after menu items are loaded
  useEffect(() => {
    const loadOrders = async () => {
      try {
        console.log('Fetching all orders for buttery:', selectedButtery);
        const allOrders = await api.fetchAllOrders(selectedButtery || undefined);
        console.log('Orders fetched:', allOrders);

        // Enrich orders with menu item names
        const menuItemMap = new Map(menuItems.map(item => [item.id, item]));
        const enrichedOrders = allOrders.map((o) => ({
          ...o,
          items: (o.items || []).map(item => {
            const menuItem = menuItemMap.get(item.menuItemId);
            return {
              ...item,
              name: menuItem?.name || item.name || 'Unknown Item',
            };
          }),
        }));

        setOrders(enrichedOrders);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
        setOrders([]);
      }
    };

    loadOrders();
  }, [menuItems, selectedButtery]);

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

  const handleCheckout = async (netId: string) => {
    if (cartItems.length === 0) {
      setNotification('Cart is empty');
      return;
    }

    try {
      const totalPrice = calculateTotal(cartItems);
      const newOrder = await api.createOrder(
        netId,
        cartItems,
        totalPrice,
        selectedButtery || undefined
      );

      const newOrders = [...orders, newOrder];
      setOrders(newOrders);
      setCartItems([]);
      storage.setCart({ items: [], total: 0 });
      setIsCartOpen(false);
      setNotification(`Order ${newOrder.id} placed!`);
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Failed to create order:', error);
      setNotification('Failed to place order');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handlePassToCustomer = () => {
    setPassToCustomerMode(true);
    const timer = setTimeout(() => {
      setPassToCustomerMode(false);
      handleCheckout();
    }, 3000);

    return () => clearTimeout(timer);
  };

  const handleUpdateOrder = async (id: string, status: Order['status']) => {
    try {
      const updatedOrder = await api.updateOrderStatus(id, status);
      const newOrders = orders.map(o => o.id === id ? updatedOrder : o);
      setOrders(newOrders);

      if (status === 'ready') {
        setNotification('Order ready for pickup!');
      } else if (status === 'completed') {
        setNotification('Order completed!');
      }
      setTimeout(() => setNotification(null), 2000);
    } catch (error) {
      console.error('Failed to update order:', error);
      setNotification('Failed to update order');
      setTimeout(() => setNotification(null), 2000);
    }
  };

  const handleButteryChange = (buttery: string | null) => {
    setSelectedButtery(buttery);
    storage.setSelectedButtery(buttery);
    // Clear cart when switching butteries
    setCartItems([]);
    storage.setCart({ items: [], total: 0 });
  };

  const filteredOrders = selectedButtery
    ? orders.filter(o => o.buttery === selectedButtery)
    : orders;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Header selectedButtery={selectedButtery} butteryOptions={butteryOptions} onButteryChange={handleButteryChange} />

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
          <OrderManager orders={filteredOrders} onUpdateOrder={handleUpdateOrder} />
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
