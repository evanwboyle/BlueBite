import { useState, useEffect } from 'react';
import type { Order, OrderItem, MenuItem, User } from './types';
import { Header } from './components/Header';
import { MenuGrid } from './components/MenuGrid';
import { CartModal } from './components/CartModal';
import { SettingsModal } from './components/SettingsModal';
import { OrderManager } from './components/OrderManager';
import { storage } from './utils/storage';
import { api } from './utils/api';
import { API_BASE_URL } from './utils/config';
import { calculateCartTotal } from './utils/cart';
import { enrichOrdersWithMenuNames } from './utils/order';
import { optimisticUpdate } from './utils/optimistic';
import { Bell } from 'lucide-react';

function App() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cartItems, setCartItems] = useState<OrderItem[]>(() => {
    const storedCart = storage.getCart();
    return storedCart.items || [];
  });
  const [notification, setNotification] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(65);
  const [selectedButtery, setSelectedButtery] = useState<string | null>(() => storage.getSelectedButtery());
  const [butteryOptions, setButteryOptions] = useState<Array<{name: string; itemCount: number}>>([ ]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

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

      // Fetch current user login status
      try {
        const response = await fetch(`${API_BASE_URL}/auth/user`, {
          credentials: 'include',
        });
        if (response.ok) {
          const user = await response.json();
          setCurrentUser(user);
        }
      } catch (err) {
        console.error('Failed to check authentication status:', err);
        setNotification('Unable to check authentication status');
        setTimeout(() => setNotification(null), 3000);
      }
    };

    init();
  }, []);

  // Load menu items when buttery changes - with progressive caching
  useEffect(() => {
    const loadMenuItems = async () => {
      // 1. Load cached menu immediately (if available)
      const cachedMenu = storage.getCachedMenu(selectedButtery);
      if (cachedMenu && cachedMenu.length > 0) {
        console.log(`Loaded ${cachedMenu.length} menu items from cache`);
        setMenuItems(cachedMenu);
      }

      // 2. Fetch fresh menu from API in background
      try {
        const freshMenu = await api.fetchMenuItems(selectedButtery || undefined);
        console.log(`Fetched ${freshMenu.length} fresh menu items from API`);

        // Update state with fresh data
        setMenuItems(freshMenu);

        // Update cache for next time
        storage.setCachedMenu(freshMenu, selectedButtery);
      } catch (error) {
        console.error('Failed to fetch menu from API:', error);

        // If we have cached data, keep using it silently
        if (cachedMenu && cachedMenu.length > 0) {
          console.warn('Using cached menu due to API failure');
        } else {
          // Only show error if no cached data available
          setNotification(`Error loading menu: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setMenuItems([]);
        }
      }
    };

    loadMenuItems();
  }, [selectedButtery]);

  // Fetch all orders (staff/admin view) after menu items are loaded - with progressive caching
  useEffect(() => {
    const loadOrders = async () => {
      // Skip if menu items haven't loaded yet (need them for enrichment)
      // This prevents race condition where orders load before menu
      if (menuItems.length === 0) {
        console.log('[App.loadOrders] Waiting for menu items to load before fetching orders...');
        return;
      }

      console.log('[App.loadOrders] Menu loaded, fetching orders...');

      // 1. Load cached orders immediately (if available)
      const cachedOrders = storage.getCachedOrders(selectedButtery);
      if (cachedOrders && cachedOrders.length > 0) {
        console.log(`[App.loadOrders] Loaded ${cachedOrders.length} orders from cache`);
        // CRITICAL: Use current menuItems state for enrichment, not stale data
        const enrichedCachedOrders = enrichOrdersWithMenuNames(cachedOrders, menuItems);
        setOrders(enrichedCachedOrders);
      }

      // 2. Fetch fresh orders from API in background
      try {
        console.log('[App.loadOrders] Fetching all orders for buttery:', selectedButtery);
        const allOrders = await api.fetchAllOrders(selectedButtery || undefined);
        console.log(`[App.loadOrders] Fetched ${allOrders.length} fresh orders from API`);

        // CRITICAL: Enrich with current menu items (may have updated since cached orders)
        const enrichedOrders = enrichOrdersWithMenuNames(allOrders, menuItems);
        setOrders(enrichedOrders);

        // Update cache for next time
        storage.setCachedOrders(allOrders, selectedButtery);
      } catch (err) {
        console.error('[App.loadOrders] Failed to fetch orders:', err);

        // If we have cached data, keep using it silently
        if (cachedOrders && cachedOrders.length > 0) {
          console.warn('[App.loadOrders] Using cached orders due to API failure');
        } else {
          // Only clear orders if no cached data available
          console.warn('[App.loadOrders] No orders available (API failed, no cache)');
          setOrders([]);
        }
      }
    };

    loadOrders();
  }, [menuItems, selectedButtery]);

  const handleAddToCart = (item: OrderItem) => {
    const newCart = [...cartItems, item];
    setCartItems(newCart);
    storage.setCart({ items: newCart, total: calculateCartTotal(newCart) });
    setNotification(`Added ${item.name} to cart`);
    setTimeout(() => setNotification(null), 2000);
  };

  const handleRemoveFromCart = (index: number) => {
    const newCart = cartItems.filter((_, i) => i !== index);
    setCartItems(newCart);
    storage.setCart({ items: newCart, total: calculateCartTotal(newCart) });
  };

  const handleCheckout = async (netId: string) => {
    if (cartItems.length === 0) {
      setNotification('Cart is empty');
      return;
    }

    try {
      const totalPrice = calculateCartTotal(cartItems);
      const newOrder = await api.createOrder(
        netId,
        cartItems,
        totalPrice,
        selectedButtery || undefined
      );

      const enrichedOrders = enrichOrdersWithMenuNames([newOrder], menuItems);
      const newOrders = [...orders, enrichedOrders[0]];
      setOrders(newOrders);

      // Update cache with new order
      storage.setCachedOrders(newOrders, selectedButtery);

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

  const handleUpdateOrder = (id: string, status: Order['status']) => {
    // Find the order to get its current status for logging
    const order = orders.find(o => o.id === id);
    const previousStatus = order?.status;

    // Use optimistic update pattern with retry logic
    optimisticUpdate.execute({
      // 1. Apply optimistic update immediately - UI updates instantly
      optimisticUpdate: () => {
        const newOrders = orders.map(o =>
          o.id === id ? { ...o, status } : o
        );
        setOrders(newOrders);

        // Update cache with optimistic state
        storage.setCachedOrders(newOrders, selectedButtery);

        // Show success notification for certain status changes
        if (status === 'ready') {
          setNotification('Order ready for pickup!');
          setTimeout(() => setNotification(null), 2000);
        } else if (status === 'completed') {
          setNotification('Order completed!');
          setTimeout(() => setNotification(null), 2000);
        }
      },

      // 2. Sync to backend asynchronously with automatic retry (3 attempts over 30s)
      syncFn: () => api.updateOrderStatus(id, status),

      // 3. On success - silent (no additional action needed, optimistic update already applied)
      onSuccess: (updatedOrder) => {
        // CRITICAL: Re-enrich the server response with menu names
        // Server returns only item IDs, so we must look up names from current menu state
        const enrichedOrder = enrichOrdersWithMenuNames([updatedOrder], menuItems)[0];

        // Verify server state matches optimistic state
        const newOrders = orders.map(o =>
          o.id === id ? enrichedOrder : o
        );
        setOrders(newOrders);
        storage.setCachedOrders(newOrders, selectedButtery);
      },

      // 4. On error (after all 3 retries exhausted) - show warning but keep optimistic state
      onError: (error, attemptCount) => {
        console.error(`Failed to sync order update after ${attemptCount} attempts:`, error);
        setNotification(`Warning: Order status change may not be saved (${error.message})`);
        setTimeout(() => setNotification(null), 5000);

        // Note: We intentionally DO NOT revert the optimistic update
        // The UI keeps the new status even if sync fails
        // This prevents confusing UX where the status flips back and forth
      },

      // 5. Unique ID for this update (allows cancellation if needed)
      id: `order-${id}-${previousStatus}-to-${status}`,
    });
  };

  const handleDeleteMenuItem = (itemId: string) => {
    // Store reference to deleted item for potential rollback
    const deletedItem = menuItems.find(item => item.id === itemId);

    // Use optimistic update pattern with retry logic
    optimisticUpdate.execute({
      // 1. Apply optimistic update immediately - UI updates instantly
      optimisticUpdate: () => {
        const newMenuItems = menuItems.filter(item => item.id !== itemId);
        setMenuItems(newMenuItems);

        // Update cache with optimistic state
        storage.setCachedMenu(newMenuItems, selectedButtery);

        setNotification('Menu item deleted!');
        setTimeout(() => setNotification(null), 2000);
      },

      // 2. Sync to backend asynchronously with automatic retry (3 attempts over 30s)
      syncFn: () => api.deleteMenuItem(itemId),

      // 3. On success - silent (optimistic update already applied)
      onSuccess: () => {
        // Deletion confirmed by server, no additional action needed
      },

      // 4. On error (after all 3 retries exhausted) - show warning and restore item
      onError: (error, attemptCount) => {
        console.error(`Failed to sync menu item deletion after ${attemptCount} attempts:`, error);
        setNotification(`Warning: Menu item deletion failed (${error.message})`);
        setTimeout(() => setNotification(null), 5000);

        // Restore the deleted item if we still have a reference
        if (deletedItem) {
          const restoredMenuItems = [...menuItems, deletedItem];
          setMenuItems(restoredMenuItems);
          storage.setCachedMenu(restoredMenuItems, selectedButtery);
        }
      },

      // 5. Unique ID for this update
      id: `menu-item-${itemId}-delete`,
    });
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
      <Header selectedButtery={selectedButtery} butteryOptions={butteryOptions} onButteryChange={handleButteryChange} onSettingsClick={() => setIsSettingsOpen(true)} />

      {/* Notification Overlay */}
      {notification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fadeIn pointer-events-none">
          <div className="bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 pointer-events-auto">
            <Bell size={18} />
            {notification}
          </div>
        </div>
      )}

      {/* Main Layout with Resizable Divider */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4">
        {/* Left Panel - Ordering */}
        <div style={{ flex: `0 0 ${leftPanelWidth}%` }} className="flex flex-col min-w-0">
          <div className="bg-white shadow border border-gray-200 flex-1 flex flex-col overflow-hidden">
            <MenuGrid
              items={menuItems}
              onAddToCart={handleAddToCart}
              cartCount={cartItems.length}
              onCartClick={() => setIsCartOpen(true)}
              isEditMode={isEditMode}
              currentUser={currentUser}
              onDeleteMenuItem={handleDeleteMenuItem}
            />
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
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentUser={currentUser}
          onUserLogout={() => setCurrentUser(null)}
          isEditMode={isEditMode}
          onToggleEditMode={(enabled) => setIsEditMode(enabled)}
          selectedButtery={selectedButtery}
          butteryOptions={butteryOptions}
          onButteryChange={handleButteryChange}
        />
      )}
    </div>
  );
}

export default App;
