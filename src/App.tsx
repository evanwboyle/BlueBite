import { useState, useEffect, useRef } from 'react';
import type { Order, OrderItem, MenuItem, User } from './types';
import { Header } from './components/Header';
import { MenuGrid } from './components/MenuGrid';
import { CartModal } from './components/CartModal';
import { SettingsModal } from './components/SettingsModal';
import { OrderManager } from './components/OrderManager';
import { LoginPage } from './components/LoginPage';
import { ButterySelectionPage } from './components/ButterySelectionPage';
import { storage } from './utils/storage';
import { api } from './utils/api';
import { API_BASE_URL } from './utils/config';
import { calculateCartTotal } from './utils/cart';
import { enrichOrdersWithMenuNames } from './utils/order';
import { optimisticUpdate } from './utils/optimistic';
import { connectRealtime } from './utils/realtime';
import type { RealtimeEventType } from './utils/realtime';
import { Bell } from 'lucide-react';
import { GlassPanel } from './components/ui';
import { MarbleBackground } from './components/MarbleBackground';

function App() {
  // Detect if this is a popout view (menu-only or orders-only)
  const searchParams = new URLSearchParams(window.location.search);
  const popoutView = searchParams.get('view'); // 'menu' or 'orders'
  const isPopout = popoutView === 'menu' || popoutView === 'orders';

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
  const [butteryOptions, setButteryOptions] = useState<Array<{name: string; itemCount: number}>>(() => {
    const cachedNames = storage.getCachedButteryNames();
    return cachedNames ? cachedNames.map(name => ({ name, itemCount: -1 })) : [];
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  // Track orders with in-flight optimistic mutations.
  // Realtime re-fetches will preserve the optimistic status for these orders
  // instead of overwriting them with stale server state.
  const pendingOrderUpdates = useRef<Map<string, Order['status']>>(new Map());

  // Refs so Realtime handler always has current data without
  // being in the useEffect dependency array (which would cause reconnects).
  const menuItemsRef = useRef<MenuItem[]>(menuItems);
  menuItemsRef.current = menuItems;
  const ordersRef = useRef<Order[]>(orders);
  ordersRef.current = orders;

  // Initialize on mount — fetch butteries and auth status in parallel
  useEffect(() => {
    const fetchButteries = async () => {
      try {
        const butteries = await api.fetchButteries();
        setButteryOptions(butteries);
        // Cache just the buttery names for instant display next time
        storage.setCachedButteryNames(butteries.map(b => b.name));
      } catch (err) {
        console.error('Failed to fetch butteries:', err);
      }
    };

    const fetchAuth = async () => {
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
      } finally {
        setAuthLoading(false);
      }
    };

    fetchButteries();
    fetchAuth();
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
        // Preserve client-only fields (phone) from existing state
        setOrders(prev => enrichedOrders.map(order => {
          const existing = prev.find(o => o.id === order.id);
          return existing?.phone ? { ...order, phone: existing.phone } : order;
        }));

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

  // Supabase Realtime: live updates from the database
  useEffect(() => {
    let menuDebounce: ReturnType<typeof setTimeout> | null = null;

    const connection = connectRealtime(selectedButtery, (type: RealtimeEventType, data: unknown) => {
      const row = data as Record<string, unknown> | null;

      if (type === 'order:updated' && row?.id) {
        // Apply status change instantly from the Realtime payload — no API round-trip
        const pendingStatus = pendingOrderUpdates.current.get(row.id as string);
        setOrders(prev => {
          const updated = prev.map(o => {
            if (o.id !== row.id) return o;
            return {
              ...o,
              // Preserve optimistic status if there's a pending mutation
              status: pendingStatus ?? (row.status as Order['status']) ?? o.status,
              comments: (row.comments as string | null) ?? o.comments,
              totalPrice: (row.totalPrice as number) ?? o.totalPrice,
            };
          });
          storage.setCachedOrders(updated, selectedButtery);
          return updated;
        });
      } else if (type === 'order:created') {
        // New orders need a full fetch to get orderItems (not in the Order table payload)
        api.fetchAllOrders(selectedButtery || undefined).then(freshOrders => {
          const enriched = enrichOrdersWithMenuNames(freshOrders, menuItemsRef.current);
          const merged = enriched.map(order => {
            const pendingStatus = pendingOrderUpdates.current.get(order.id);
            const existing = ordersRef.current.find(o => o.id === order.id);
            return {
              ...order,
              ...(pendingStatus ? { status: pendingStatus } : {}),
              ...(existing?.phone ? { phone: existing.phone } : {}),
            };
          });
          setOrders(merged);
          storage.setCachedOrders(merged, selectedButtery);
        }).catch(err => {
          console.error('[Realtime] Failed to refresh orders after new order:', err);
        });
      } else if (type === 'menu:created' || type === 'menu:updated' || type === 'menu:deleted') {
        if (menuDebounce) clearTimeout(menuDebounce);
        menuDebounce = setTimeout(() => {
          api.fetchMenuItems(selectedButtery || undefined).then(freshMenu => {
            setMenuItems(freshMenu);
            storage.setCachedMenu(freshMenu, selectedButtery);
          }).catch(err => {
            console.error('[Realtime] Failed to refresh menu after event:', err);
          });
        }, 100);
      }
    });

    return () => {
      if (menuDebounce) clearTimeout(menuDebounce);
      connection.close();
    };
  }, [selectedButtery]);

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

  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleCheckout = async (netId: string, phone?: string) => {
    if (cartItems.length === 0) {
      setNotification('Cart is empty');
      return;
    }

    setCheckoutError(null);
    setIsCheckingOut(true);

    const totalPrice = calculateCartTotal(cartItems);
    const tempId = `temp-${Date.now()}`;

    // Build optimistic order immediately
    const optimisticOrder: Order = {
      id: tempId,
      netId,
      buttery: selectedButtery,
      items: cartItems.map(item => ({
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        modifiers: item.modifiers,
      })),
      totalPrice,
      status: 'pending',
      placedAt: Date.now(),
      phone: phone || undefined,
    };

    // Optimistically add the order, clear cart, close modal
    setOrders(prev => [...prev, optimisticOrder]);
    setCartItems([]);
    storage.setCart({ items: [], total: 0 });
    setIsCartOpen(false);
    setIsCheckingOut(false);
    setNotification('Order placed!');
    setTimeout(() => setNotification(null), 3000);

    try {
      const newOrder = await api.createOrder(
        netId,
        optimisticOrder.items,
        totalPrice,
        selectedButtery || undefined,
        phone
      );

      // Replace temp order with real server order
      const enrichedOrders = enrichOrdersWithMenuNames([newOrder], menuItems);
      setOrders(prev => {
        const updated = prev.map(o => o.id === tempId ? enrichedOrders[0] : o);
        storage.setCachedOrders(updated, selectedButtery);
        return updated;
      });
    } catch (error) {
      console.error('Failed to create order:', error);

      // Remove the optimistic order
      setOrders(prev => {
        const updated = prev.filter(o => o.id !== tempId);
        storage.setCachedOrders(updated, selectedButtery);
        return updated;
      });

      // Restore cart items so the user can retry
      setCartItems(optimisticOrder.items);
      storage.setCart({ items: optimisticOrder.items, total: totalPrice });

      // Show error in notification and set checkout error for modal
      const message = error instanceof Error ? error.message : 'Unknown error';
      setCheckoutError(`Order failed: ${message}. Your cart has been restored.`);
      setIsCartOpen(true);
      setNotification(`Failed to place order: ${message}`);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleUpdateOrder = (id: string, status: Order['status']) => {
    // Mark this order as having a pending optimistic mutation.
    // Realtime re-fetches will preserve this status until the sync confirms it.
    pendingOrderUpdates.current.set(id, status);

    // Use optimistic update pattern with retry logic
    optimisticUpdate.execute({
      // 1. Apply optimistic update immediately - UI updates instantly
      optimisticUpdate: () => {
        setOrders(prev => {
          const newOrders = prev.map(o =>
            o.id === id ? { ...o, status } : o
          );
          storage.setCachedOrders(newOrders, selectedButtery);
          return newOrders;
        });

      },

      // 2. Sync to backend asynchronously with automatic retry (3 attempts over 30s)
      syncFn: () => api.updateOrderStatus(id, status),

      // 3. On success - clear pending flag, let Realtime handle final state
      onSuccess: () => {
        // Only clear if our status is still the pending one (not overwritten by a newer click)
        if (pendingOrderUpdates.current.get(id) === status) {
          pendingOrderUpdates.current.delete(id);
        }
      },

      // 4. On error (after all 3 retries exhausted) - show warning but keep optimistic state
      onError: (error, attemptCount) => {
        // Clear pending flag on error too
        if (pendingOrderUpdates.current.get(id) === status) {
          pendingOrderUpdates.current.delete(id);
        }
        console.error(`Failed to sync order update after ${attemptCount} attempts:`, error);
        setNotification(`Warning: Order status change may not be saved (${error.message})`);
        setTimeout(() => setNotification(null), 5000);
      },

      // 5. Unique ID for this update — use just the order ID so rapid changes
      // to the same order cancel the previous pending sync
      id: `order-${id}`,
    });
  };

  const handleUpdateComments = (id: string, comments: string) => {
    setOrders(prev => prev.map(o =>
      o.id === id ? { ...o, comments } : o
    ));
    api.updateOrderComments(id, comments).catch((error) => {
      console.error('Failed to update comments:', error);
    });
  };

  const handleUpdateMenuItem = (itemId: string, updates: Partial<MenuItem>) => {
    // Store reference to original item for potential rollback
    const originalItem = menuItems.find(item => item.id === itemId);

    // Use optimistic update pattern with retry logic
    optimisticUpdate.execute({
      // 1. Apply optimistic update immediately - UI updates instantly
      optimisticUpdate: () => {
        setMenuItems(prev => {
          const newMenuItems = prev.map(item =>
            item.id === itemId ? { ...item, ...updates } : item
          );
          storage.setCachedMenu(newMenuItems, selectedButtery);
          return newMenuItems;
        });

        setNotification('Menu item updated!');
        setTimeout(() => setNotification(null), 2000);
      },

      // 2. Sync to backend asynchronously with automatic retry (3 attempts over 30s)
      syncFn: async () => {
        // Determine which API endpoint to use based on user role and update type
        const isToggleOnly = Object.keys(updates).every(key =>
          key === 'disabled' || key === 'hot'
        );

        if (isToggleOnly) {
          // Staff can use toggle endpoint for available/hot
          return api.toggleMenuItem(itemId, {
            available: updates.disabled !== undefined ? !updates.disabled : undefined,
            hot: updates.hot,
          });
        } else {
          // Admin can use full update endpoint
          return api.updateMenuItem(itemId, updates);
        }
      },

      // 3. On success - verify server state matches optimistic state
      onSuccess: (updatedItem) => {
        setMenuItems(prev => {
          const newMenuItems = prev.map(item =>
            item.id === itemId ? updatedItem : item
          );
          storage.setCachedMenu(newMenuItems, selectedButtery);
          return newMenuItems;
        });
      },

      // 4. On error (after all 3 retries exhausted) - show warning and restore item
      onError: (error, attemptCount) => {
        console.error(`Failed to sync menu item update after ${attemptCount} attempts:`, error);
        setNotification(`Warning: Menu item update failed (${error.message})`);
        setTimeout(() => setNotification(null), 5000);

        // Restore the original item if we still have a reference
        if (originalItem) {
          setMenuItems(prev => {
            const restoredMenuItems = prev.map(item =>
              item.id === itemId ? originalItem : item
            );
            storage.setCachedMenu(restoredMenuItems, selectedButtery);
            return restoredMenuItems;
          });
        }
      },

      // 5. Unique ID for this update
      id: `menu-item-${itemId}-update`,
    });
  };

  const handleCreateMenuItem = (item: Omit<MenuItem, 'id'>) => {
    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempItem: MenuItem = { ...item, id: tempId };

    // Use optimistic update pattern with retry logic
    optimisticUpdate.execute({
      // 1. Apply optimistic update immediately - UI updates instantly
      optimisticUpdate: () => {
        setMenuItems(prev => {
          const newMenuItems = [...prev, tempItem];
          storage.setCachedMenu(newMenuItems, selectedButtery);
          return newMenuItems;
        });

        setNotification('Menu item created!');
        setTimeout(() => setNotification(null), 2000);
      },

      // 2. Sync to backend asynchronously with automatic retry (3 attempts over 30s)
      syncFn: () => api.createMenuItem(item),

      // 3. On success - replace temp item with server item (has real ID)
      onSuccess: (createdItem) => {
        setMenuItems(prev => {
          const newMenuItems = prev.filter(i => i.id !== tempId);
          newMenuItems.push(createdItem);
          storage.setCachedMenu(newMenuItems, selectedButtery);
          return newMenuItems;
        });
      },

      // 4. On error (after all 3 retries exhausted) - show warning and remove temp item
      onError: (error, attemptCount) => {
        console.error(`Failed to sync menu item creation after ${attemptCount} attempts:`, error);
        setNotification(`Warning: Menu item creation failed (${error.message})`);
        setTimeout(() => setNotification(null), 5000);

        // Remove the temporary item
        setMenuItems(prev => {
          const restoredMenuItems = prev.filter(item => item.id !== tempId);
          storage.setCachedMenu(restoredMenuItems, selectedButtery);
          return restoredMenuItems;
        });
      },

      // 5. Unique ID for this update
      id: `menu-item-create-${tempId}`,
    });
  };

  const handleDeleteMenuItem = (itemId: string) => {
    // Store reference to deleted item for potential rollback
    const deletedItem = menuItems.find(item => item.id === itemId);

    // Use optimistic update pattern with retry logic
    optimisticUpdate.execute({
      // 1. Apply optimistic update immediately - UI updates instantly
      optimisticUpdate: () => {
        setMenuItems(prev => {
          const newMenuItems = prev.filter(item => item.id !== itemId);
          storage.setCachedMenu(newMenuItems, selectedButtery);
          return newMenuItems;
        });

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
          setMenuItems(prev => {
            const restoredMenuItems = [...prev, deletedItem];
            storage.setCachedMenu(restoredMenuItems, selectedButtery);
            return restoredMenuItems;
          });
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

  // Wait for auth check before rendering anything to avoid login page flash
  if (authLoading) {
    return null;
  }

  // Gate: must be logged in
  if (!currentUser) {
    return <LoginPage />;
  }

  // Gate: must have a buttery selected (unless popout)
  if (!selectedButtery && !isPopout) {
    return (
      <ButterySelectionPage
        currentUser={currentUser}
        butteryOptions={butteryOptions}
        onSelectButtery={(buttery) => handleButteryChange(buttery)}
      />
    );
  }

  // Popout view for menu only
  if (popoutView === 'menu') {
    return (
      <div className="relative h-screen w-full overflow-hidden">
        {/* <MarbleBackground slow={6} /> */}
        <div className="relative h-full flex flex-col p-3 gap-3" style={{ zIndex: 10 }}>
          <Header onSettingsClick={() => setIsSettingsOpen(true)} currentUser={currentUser} selectedButtery={selectedButtery} />
          <GlassPanel level="modal" className="flex-1 overflow-hidden" style={{ padding: 0 }}>
            <MenuGrid
              items={menuItems}
              onAddToCart={handleAddToCart}
              cartCount={cartItems.length}
              onCartClick={() => setIsCartOpen(true)}
              isEditMode={isEditMode}
              currentUser={currentUser}
              onUpdateMenuItem={handleUpdateMenuItem}
              onCreateMenuItem={handleCreateMenuItem}
              onDeleteMenuItem={handleDeleteMenuItem}
            />
          </GlassPanel>
        </div>

        {isCartOpen && (
          <CartModal items={cartItems} onClose={() => { setIsCartOpen(false); setCheckoutError(null); }} onRemoveItem={handleRemoveFromCart} onCheckout={handleCheckout} isSubmitting={isCheckingOut} error={checkoutError} />
        )}
        {isSettingsOpen && (
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentUser={currentUser} onUserLogout={() => { setCurrentUser(null); setSelectedButtery(null); storage.setSelectedButtery(null); }} isEditMode={isEditMode} onToggleEditMode={(enabled) => setIsEditMode(enabled)} />
        )}
      </div>
    );
  }

  // Popout view for orders only
  if (popoutView === 'orders') {
    return (
      <div className="relative h-screen w-full overflow-hidden">
        {/* <MarbleBackground slow={6} /> */}
        <div className="relative h-full flex flex-col p-3 gap-3" style={{ zIndex: 10 }}>
          <Header onSettingsClick={() => setIsSettingsOpen(true)} currentUser={currentUser} selectedButtery={selectedButtery} />
          <div className="flex-1 overflow-hidden">
            <OrderManager orders={filteredOrders} onUpdateOrder={handleUpdateOrder} onUpdateComments={handleUpdateComments} />
          </div>
        </div>

        {isSettingsOpen && (
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentUser={currentUser} onUserLogout={() => { setCurrentUser(null); setSelectedButtery(null); storage.setSelectedButtery(null); }} isEditMode={isEditMode} onToggleEditMode={(enabled) => setIsEditMode(enabled)} />
        )}
      </div>
    );
  }

  // Normal dual-panel view
  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Marble background */}
      <MarbleBackground slow={6} />

      {/* Content layer — generous padding so panels float over the marble background */}
      <div className="relative h-full flex flex-col gap-4" style={{ zIndex: 10, padding: 'clamp(24px, 4vw, 72px)' }}>
        {/* Glass Header */}
        <Header
          onSettingsClick={() => setIsSettingsOpen(true)}
          currentUser={currentUser}
          selectedButtery={selectedButtery}
        />

        {/* Notification Overlay */}
        {notification && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fadeIn pointer-events-none">
            <div
              className="px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 pointer-events-auto"
              style={{
                background: 'var(--glass-fog)',
                backdropFilter: 'var(--blur-lg)',
                border: 'var(--border-glass-bright)',
                color: 'var(--text-primary)',
              }}
            >
              <Bell size={18} />
              {notification}
            </div>
          </div>
        )}

        {/* Main Layout with Resizable Divider
             Divider is 6px wide, gaps are 16px each (gap-4). Total non-panel space = 6 + 16 + 16 = 38px.
             Each panel gets its share of the remaining space. */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left Panel - Menu */}
          <GlassPanel
            level="modal"
            className="flex flex-col overflow-hidden"
            style={{ padding: 0, flex: `0 0 calc(${leftPanelWidth}% - 19px)`, minWidth: 0 }}
          >
            <MenuGrid
              items={menuItems}
              onAddToCart={handleAddToCart}
              cartCount={cartItems.length}
              onCartClick={() => setIsCartOpen(true)}
              isEditMode={isEditMode}
              currentUser={currentUser}
              onUpdateMenuItem={handleUpdateMenuItem}
              onCreateMenuItem={handleCreateMenuItem}
              onDeleteMenuItem={handleDeleteMenuItem}
            />
          </GlassPanel>

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
            className="w-1.5 cursor-col-resize flex-shrink-0 rounded-full transition-colors duration-200"
            style={{
              background: 'rgba(120, 180, 255, 0.15)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(120, 180, 255, 0.35)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(120, 180, 255, 0.15)')}
          />

          {/* Right Panel - Orders */}
          <div
            style={{ flex: `0 0 calc(${100 - leftPanelWidth}% - 19px)`, minWidth: 0 }}
          >
            <OrderManager orders={filteredOrders} onUpdateOrder={handleUpdateOrder} onUpdateComments={handleUpdateComments} />
          </div>
        </div>
      </div>

      {/* Overlays - rendered outside main layout */}
      {isCartOpen && (
        <CartModal
          items={cartItems}
          onClose={() => { setIsCartOpen(false); setCheckoutError(null); }}
          onRemoveItem={handleRemoveFromCart}
          onCheckout={handleCheckout}
          isSubmitting={isCheckingOut}
          error={checkoutError}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentUser={currentUser}
          onUserLogout={() => {
              setCurrentUser(null);
              setSelectedButtery(null);
              storage.setSelectedButtery(null);
            }}
          isEditMode={isEditMode}
          onToggleEditMode={(enabled) => setIsEditMode(enabled)}
        />
      )}
    </div>
  );
}

export default App;
