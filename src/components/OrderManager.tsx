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
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Array<{ orderId: string; previousStatus: Order['status'] }>>([]);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [userCache, setUserCache] = useState<Map<string, YaliesUser | null>>(new Map());

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

  const statusColors: Record<Order['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    preparing: 'bg-blue-100 text-blue-800 border-blue-300',
    ready: 'bg-green-100 text-green-800 border-green-300',
    completed: 'bg-gray-100 text-gray-800 border-gray-300',
    cancelled: 'bg-red-100 text-red-800 border-red-300',
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
    <div className="bg-white rounded-lg shadow border border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-50 border-b p-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">
          Orders ({sortedOrders.length}/{ordersWithinPast12h.length})
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHideCompleted(!hideCompleted)}
            className={`btn-small ${hideCompleted ? 'bg-blue-600 text-white hover:bg-blue-700' : 'btn-secondary'} flex items-center gap-1`}
            title="Toggle completed orders visibility"
          >
            {hideCompleted ? 'Show Completed' : 'Hide Completed'}
          </button>
          {undoStack.length > 0 && (
            <button
              onClick={handleUndo}
              className="btn-small btn-secondary flex items-center gap-1"
              title="Undo last action"
            >
              <RotateCcw size={14} />
              Undo
            </button>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto">
        {sortedOrders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-sm">No orders yet</p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {sortedOrders.map(order => (
              <div key={order.id} className="border-b">
                {/* Order Header */}
                <button
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  className="w-full p-3 hover:bg-gray-50 transition text-left flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 text-sm">Order #{orderNumberMap.get(order.id)}</p>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${statusColors[order.status]}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                      <span>Customer: <span className="font-medium">{getCustomerDisplayName(order.netId)}</span></span>
                      <span>${order.totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                  {expandedOrder === order.id ? (
                    <ChevronUp size={20} className="text-gray-500" />
                  ) : (
                    <ChevronDown size={20} className="text-gray-500" />
                  )}
                </button>

                {/* Order Details */}
                {expandedOrder === order.id && (
                  <div className="bg-gray-50 p-3 border-t space-y-3">
                    {/* Customer Profile Image */}
                    <div className="flex items-center gap-3">
                      <img
                        src={userCache.get(order.netId)?.image || '/src/assets/no_image.png'}
                        alt={getCustomerDisplayName(order.netId)}
                        className="w-16 h-16 rounded-full object-cover bg-gray-200"
                      />
                      <div>
                        <p className="text-xs font-bold text-gray-900">{getCustomerDisplayName(order.netId)}</p>
                        <p className="text-xs text-gray-600">{order.netId}</p>
                      </div>
                    </div>

                    {/* Items */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 mb-2 uppercase">Items</h4>
                      <div className="space-y-1">
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

                          return (
                            <div key={idx} className="text-xs text-gray-700">
                              <div className="flex justify-between">
                                <span>{itemName} x{item.quantity}</span>
                                <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                              {item.modifiers && item.modifiers.length > 0 && (
                                <div className="text-gray-600 ml-2 text-xs">
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
                      <div className="bg-white p-2 rounded border border-gray-200">
                        <p className="text-xs font-medium text-gray-700">Special Instructions:</p>
                        <p className="text-xs text-gray-600 mt-1">{order.specialInstructions}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {getStatusButtons(order).map(nextStatus => (
                        <button
                          key={nextStatus}
                          onClick={() => handleStatusChange(order, nextStatus)}
                          className={`btn-small flex-1 text-xs ${
                            nextStatus === 'preparing'
                              ? 'btn-primary'
                              : nextStatus === 'ready'
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : nextStatus === 'completed'
                              ? 'bg-gray-400 text-white hover:bg-gray-500'
                              : 'btn-secondary'
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
