import { useState, useEffect, useMemo } from 'react';
import type { Order } from '../types';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { yalies, type YaliesUser } from '../utils/yalies';
import { yaliesCache } from '../utils/yaliesCache';

interface OrderManagerProps {
  orders: Order[];
  onUpdateOrder: (id: string, status: Order['status']) => void;
}

export function OrderManager({ orders, onUpdateOrder }: OrderManagerProps) {
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<Array<{ orderId: string; previousStatus: Order['status'] }>>([]);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [userCache, setUserCache] = useState<Map<string, YaliesUser | null>>(new Map());
  const [checkedItems, setCheckedItems] = useState<Map<string, Set<number>>>(new Map());

  // Filter to past 12 hours and sort oldest to newest
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  const now = Date.now();

  const ordersWithinPast12h = [...orders]
    .filter(o => (now - o.placedAt) <= TWELVE_HOURS_MS)
    .sort((a, b) => a.placedAt - b.placedAt); // oldest first

  // Create map of order ID to sequential number (for labeling)
  const orderNumberMap = new Map(
    ordersWithinPast12h.map((order, index) => [order.id, index + 1])
  );

  // Apply hideCompleted filter for display
  const sortedOrders = ordersWithinPast12h.filter(o => !hideCompleted || o.status !== 'completed');

  // Memoize netIds to avoid unnecessary effect reruns
  const netIds = useMemo(
    () => ordersWithinPast12h.map(o => o.netId),
    [ordersWithinPast12h]
  );

  // Fetch Yalies user data for orders
  useEffect(() => {
    const fetchYaliesData = async () => {
      const newCache = new Map(userCache);
      let cacheUpdated = false;

      for (const order of ordersWithinPast12h) {
        // Check persistent cache first
        const cachedUser = yaliesCache.get(order.netId);

        if (cachedUser !== undefined) {
          // Cache hit - use cached data
          if (!newCache.has(order.netId)) {
            newCache.set(order.netId, cachedUser);
            cacheUpdated = true;
          }
        } else {
          // Cache miss - fetch from API
          if (!newCache.has(order.netId)) {
            const user = await yalies.fetchUserByNetId(order.netId);
            newCache.set(order.netId, user);
            yaliesCache.set(order.netId, user); // Store in persistent cache
            cacheUpdated = true;
          }
        }
      }

      if (cacheUpdated) {
        setUserCache(newCache);
      }
    };

    if (ordersWithinPast12h.length > 0) {
      fetchYaliesData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netIds]);

  const getCustomerDisplayName = (netId: string): string => {
    const user = userCache.get(netId);
    if (user) {
      const lastInitial = user.last_name.charAt(0).toUpperCase();
      return `${user.first_name} ${lastInitial}`;
    }
    return netId;
  };

  // Track mouse position for specular highlight effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mouse-x', `${x}%`);
    card.style.setProperty('--mouse-y', `${y}%`);
  };

  const handleStatusChange = (order: Order, newStatus: Order['status']) => {
    setUndoStack([...undoStack, { orderId: order.id, previousStatus: order.status }]);
    onUpdateOrder(order.id, newStatus);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    onUpdateOrder(last.orderId, last.previousStatus);
    setUndoStack(undoStack.slice(0, -1));
  };

  const getStatusButtons = (order: Order) => {
    const transitions: Record<Order['status'], Order['status'][]> = {
      pending: ['preparing', 'cancelled'],
      preparing: ['ready', 'pending'],
      ready: ['completed', 'pending'],
      completed: [],
      cancelled: ['pending'],
    };

    return transitions[order.status] || [];
  };

  return (
    <div className="glass-container rounded-xl h-full flex flex-col">
      {/* Header */}
      <div className="glass-header p-5 flex items-center justify-between rounded-t-xl">
        <h2 className="text-xl font-extrabold text-white tracking-wide">
          Orders <span className="text-gray-400 font-semibold">({sortedOrders.length}/{ordersWithinPast12h.length})</span>
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setHideCompleted(!hideCompleted)}
            className={`glass-button ${hideCompleted ? 'glass-button-active' : ''} px-4 py-2 rounded-lg text-sm flex items-center gap-2`}
            title="Toggle completed orders visibility"
          >
            {hideCompleted ? 'Show Completed' : 'Hide Completed'}
          </button>
          {undoStack.length > 0 && (
            <button
              onClick={handleUndo}
              className="glass-button px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              title="Undo last action"
            >
              <RotateCcw size={16} />
              Undo
            </button>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto p-3">
        {sortedOrders.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-base text-gray-400 font-medium">No orders yet</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedOrders.map(order => (
              <div
                key={order.id}
                className="glass-order-card rounded-xl overflow-hidden"
                onMouseMove={handleMouseMove}
              >
                {/* Order Header */}
                <button
                  onClick={() => {
                    const newExpanded = new Set(expandedOrders);
                    if (newExpanded.has(order.id)) {
                      newExpanded.delete(order.id);
                    } else {
                      newExpanded.add(order.id);
                    }
                    setExpandedOrders(newExpanded);
                  }}
                  className="w-full p-4 transition-all text-left flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="order-number">Order #{orderNumberMap.get(order.id)}</p>
                      <span className={`status-badge status-${order.status}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-300">
                      <span>Customer: <span className="customer-name">{getCustomerDisplayName(order.netId)}</span></span>
                      <span className="text-white font-bold">${order.totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                  {expandedOrders.has(order.id) ? (
                    <ChevronUp size={22} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={22} className="text-gray-400" />
                  )}
                </button>

                {/* Order Details */}
                {expandedOrders.has(order.id) && (
                  <div className="glass-expanded-details p-4 space-y-4">
                    {/* Customer Profile Image */}
                    <div className="glass-profile-card flex items-center gap-4 p-3 rounded-lg">
                      <img
                        src={userCache.get(order.netId)?.image || '/src/assets/no_image.png'}
                        alt={getCustomerDisplayName(order.netId)}
                        className="w-20 h-20 rounded-full object-cover border-2 border-white/10 shadow-lg"
                      />
                      <div>
                        <p className="text-sm font-bold text-white tracking-wide">{getCustomerDisplayName(order.netId)}</p>
                        <p className="text-xs text-gray-400 mt-1">{order.netId}</p>
                      </div>
                    </div>

                    {/* Items */}
                    <div>
                      <h4 className="text-xs font-extrabold text-gray-300 mb-3 uppercase tracking-widest">Items</h4>
                      <div className="space-y-2">
                        {order.items.map((item, idx) => {
                          // Defensive check: ensure item name exists, provide fallback
                          const itemName = item.name || `Item ${item.menuItemId?.substring(0, 8) || 'Unknown'}`;

                          // Log warning if name is missing (indicates enrichment failure)
                          if (!item.name) {
                            console.warn('[OrderManager] Order item missing name:', {
                              orderId: order.id,
                              itemIndex: idx,
                              menuItemId: item.menuItemId,
                              item
                            });
                          }

                          const orderCheckedItems = checkedItems.get(order.id) || new Set();
                          const isChecked = orderCheckedItems.has(idx);

                          const handleCheckChange = () => {
                            const newCheckedItems = new Map(checkedItems);
                            const orderItems = new Set(newCheckedItems.get(order.id) || []);

                            if (isChecked) {
                              orderItems.delete(idx);
                            } else {
                              orderItems.add(idx);
                            }

                            newCheckedItems.set(order.id, orderItems);
                            setCheckedItems(newCheckedItems);
                          };

                          return (
                            <div key={idx} className="text-sm text-gray-200 bg-white/5 rounded-lg p-2">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={handleCheckChange}
                                    className="w-4 h-4 cursor-pointer"
                                  />
                                  <span className={`font-semibold ${isChecked ? 'line-through text-gray-400' : ''}`}>
                                    {itemName} <span className="text-gray-400">x{item.quantity}</span>
                                  </span>
                                </div>
                                <span className="font-bold text-white">${(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                              {item.modifiers && item.modifiers.length > 0 && (
                                <div className="text-gray-400 ml-7 text-xs mt-1">
                                  {item.modifiers.join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Notes Section - Only show if there are special instructions */}
                    {order.specialInstructions && order.specialInstructions.trim() && (
                      <div className="glass-notes p-3 rounded-lg">
                        <p className="text-xs font-bold text-yellow-300 uppercase tracking-wide">Special Instructions:</p>
                        <p className="text-sm text-yellow-100 mt-2 leading-relaxed">{order.specialInstructions}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      {getStatusButtons(order).map(nextStatus => (
                        <button
                          key={nextStatus}
                          onClick={() => handleStatusChange(order, nextStatus)}
                          className={`flex-1 text-sm font-semibold py-2.5 px-4 rounded-lg transition-all ${
                            nextStatus === 'preparing'
                              ? 'glass-button-primary'
                              : nextStatus === 'ready'
                              ? 'bg-gradient-to-r from-green-500/30 to-green-600/30 border border-green-500/50 text-green-300 hover:from-green-500/40 hover:to-green-600/40 shadow-lg shadow-green-500/20'
                              : nextStatus === 'completed'
                              ? 'bg-gradient-to-r from-gray-500/30 to-gray-600/30 border border-gray-500/50 text-gray-300 hover:from-gray-500/40 hover:to-gray-600/40'
                              : nextStatus === 'cancelled'
                              ? 'bg-gradient-to-r from-red-500/30 to-red-600/30 border border-red-500/50 text-red-300 hover:from-red-500/40 hover:to-red-600/40 shadow-lg shadow-red-500/20'
                              : 'glass-button'
                          }`}
                        >
                          {nextStatus === 'preparing' && <span>Start</span>}
                          {nextStatus === 'ready' && <span>Mark Ready</span>}
                          {nextStatus === 'completed' && <span>Complete</span>}
                          {nextStatus === 'cancelled' && <span>Cancel</span>}
                          {nextStatus === 'pending' && <span>Back</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
