import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Order } from '../types';
import { RotateCcw, Lock, LockOpen, Eye, EyeOff, Phone, MessageSquare } from 'lucide-react';
import { yalies, type YaliesUser } from '../utils/yalies';
import { yaliesCache } from '../utils/yaliesCache';
import { GlassPanel } from './ui';

interface OrderManagerProps {
  orders: Order[];
  onUpdateOrder: (id: string, status: Order['status']) => void;
  onUpdateComments: (id: string, comments: string) => void;
}

export function OrderManager({ orders, onUpdateOrder, onUpdateComments }: OrderManagerProps) {
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<Array<{ orderId: string; previousStatus: Order['status'] }>>([]);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [userCache, setUserCache] = useState<Map<string, YaliesUser | null>>(new Map());
  const [checkedItems, setCheckedItems] = useState<Map<string, Set<number>>>(new Map());
  const [locked, setLocked] = useState(false);
  const [unlockCountdown, setUnlockCountdown] = useState<number | null>(null);
  const [lockJiggle, setLockJiggle] = useState(false);
  const lockRef = useRef<HTMLButtonElement>(null);
  const [tick, setTick] = useState(0);
  const [draftComments, setDraftComments] = useState<Map<string, string>>(new Map());
  const commentTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Tick every second for order timers
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatElapsed = useCallback((placedAt: number, endAt?: number): string => {
    const end = endAt ?? Date.now();
    const elapsed = Math.max(0, Math.floor((end - placedAt) / 1000));
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const playDeniedSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Two-tone descending "nope" sound
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();
      osc1.connect(gain1); gain1.connect(ctx.destination);
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.value = 440;
      osc2.frequency.value = 330;
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.001, ctx.currentTime);
      gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.12);
      osc2.start(ctx.currentTime + 0.1);
      osc2.stop(ctx.currentTime + 0.22);
    } catch {}
  }, []);

  const triggerLockJiggle = useCallback(() => {
    playDeniedSound();
    setLockJiggle(true);
    setTimeout(() => setLockJiggle(false), 500);
  }, [playDeniedSound]);

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

  // Handle unlock countdown timer
  useEffect(() => {
    if (unlockCountdown === null) return;

    if (unlockCountdown === 0) {
      setLocked(false);
      setUnlockCountdown(null);
      return;
    }

    // Play beep sound on each tick
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 1000;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);

    const timer = setTimeout(() => {
      setUnlockCountdown(unlockCountdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [unlockCountdown]);

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

  const handleCommentChange = (orderId: string, value: string) => {
    setDraftComments(prev => new Map(prev).set(orderId, value));

    // Debounce: save after 800ms of no typing
    const existing = commentTimers.current.get(orderId);
    if (existing) clearTimeout(existing);
    commentTimers.current.set(orderId, setTimeout(() => {
      onUpdateComments(orderId, value);
      commentTimers.current.delete(orderId);
    }, 800));
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
    <GlassPanel
      level="modal"
      className="h-full w-full flex flex-col relative"
      style={{ padding: 0 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(120, 180, 255, 0.10)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '2rem',
            color: 'var(--text-primary)',
          }}
        >
          Orders <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '1.1rem' }}>({sortedOrders.length}/{ordersWithinPast12h.length})</span>
        </h2>
        <div className="flex items-center gap-3">
          <button
            ref={lockRef}
            onClick={() => {
              if (locked) {
                setUnlockCountdown(5);
              } else {
                setLocked(true);
                setExpandedOrders(new Set());
              }
            }}
            className={`glass-button ${locked ? 'glass-button-active' : ''} px-4 py-3 rounded-xl flex items-center gap-2`}
            style={lockJiggle ? {
              background: 'rgba(234, 179, 8, 0.5)',
              boxShadow: '0 0 20px rgba(234, 179, 8, 0.6)',
              transition: 'none',
            } : {}}
            title={locked ? 'Click to unlock (5 second countdown)' : 'Lock orders while you order'}
            disabled={unlockCountdown !== null}
          >
            {unlockCountdown !== null ? (
              <span className="font-bold text-lg">{unlockCountdown}</span>
            ) : locked ? (
              <Lock size={28} />
            ) : (
              <LockOpen size={28} />
            )}
          </button>
          <button
            onClick={() => setHideCompleted(!hideCompleted)}
            className={`glass-button ${hideCompleted ? 'glass-button-active' : ''} px-4 py-3 rounded-xl flex items-center gap-2`}
            title={hideCompleted ? 'Show completed orders' : 'Hide completed orders'}
          >
            {hideCompleted ? <EyeOff size={28} /> : <Eye size={28} />}
          </button>
          {undoStack.length > 0 && (
            <button
              onClick={handleUndo}
              className="glass-button px-4 py-3 rounded-xl flex items-center gap-2"
              title="Undo last action"
            >
              <RotateCcw size={28} />
            </button>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 overflow-y-auto p-4 transition-all">
        {sortedOrders.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-base text-gray-400 font-medium">No orders yet</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedOrders.map((order, sortedIdx) => {
              const isExpanded = !locked && expandedOrders.has(order.id);
              const customerName = locked ? `Customer ${sortedIdx + 1}` : getCustomerDisplayName(order.netId);
              const profileImg = userCache.get(order.netId)?.image || '/src/assets/no_image.png';
              const itemSummary = order.items
                .map(i => i.name || `Item ${i.menuItemId?.substring(0, 8) || '?'}`)
                .join(', ');

              return (
                <GlassPanel
                  key={order.id}
                  level="surface"
                  className="overflow-hidden"
                  style={{ padding: 0 }}
                  onMouseMove={handleMouseMove}
                >
                  {isExpanded ? (
                    /* ── Expanded card ── */
                    <div className="glass-expanded-details" style={{ padding: '24px' }}>
                      {/* Profile photo + name centered — click to collapse */}
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedOrders);
                          newExpanded.delete(order.id);
                          setExpandedOrders(newExpanded);
                        }}
                        className="w-full flex flex-col items-center mb-4 cursor-pointer"
                      >
                        <img
                          src={profileImg}
                          alt={customerName}
                          className="w-16 h-16 rounded-full object-cover border-2 border-white/10 shadow-lg mb-3"
                        />
                        <p className="order-number text-xl">Order #{orderNumberMap.get(order.id)}</p>
                        <p className="text-sm text-gray-400 mt-1">{customerName}</p>
                        {order.phone && (
                          <p className="text-sm text-blue-300/70 mt-1 flex items-center gap-1">
                            <Phone size={13} />
                            {order.phone}
                          </p>
                        )}
                      </button>

                      {/* Segmented status control */}
                      <div
                        className="flex rounded-lg overflow-hidden mb-5"
                        style={{
                          border: '1px solid rgba(120, 180, 255, 0.15)',
                          background: 'rgba(5, 12, 30, 0.5)',
                        }}
                      >
                        {(['pending', 'preparing', 'ready'] as const).map(s => {
                          const isActive = order.status === s;
                          const label = s === 'pending' ? 'PENDING' : s === 'preparing' ? 'PROGRESS' : 'READY';
                          return (
                            <button
                              key={s}
                              onClick={() => {
                                if (!isActive) handleStatusChange(order, s);
                              }}
                              className="flex-1 py-2.5 text-xs font-bold tracking-wider uppercase transition-all"
                              style={{
                                background: isActive ? 'rgba(0, 102, 255, 0.35)' : 'transparent',
                                color: isActive ? '#93c5fd' : 'rgba(255,255,255,0.4)',
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Item checklist */}
                      <div className="space-y-1 mb-4">
                        {order.items.map((item, idx) => {
                          const itemName = item.name || `Item ${item.menuItemId?.substring(0, 8) || 'Unknown'}`;
                          const orderCheckedItems = checkedItems.get(order.id) || new Set();
                          const isChecked = orderCheckedItems.has(idx);

                          const handleCheckChange = () => {
                            const newCheckedItems = new Map(checkedItems);
                            const orderItems = new Set(newCheckedItems.get(order.id) || []);
                            if (isChecked) orderItems.delete(idx); else orderItems.add(idx);
                            newCheckedItems.set(order.id, orderItems);
                            setCheckedItems(newCheckedItems);
                          };

                          return (
                            <label
                              key={idx}
                              className="flex items-center gap-3 py-2.5 px-1 cursor-pointer text-sm"
                              style={{ borderBottom: idx < order.items.length - 1 ? '1px solid rgba(120, 180, 255, 0.06)' : 'none' }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={handleCheckChange}
                                className="w-5 h-5 rounded cursor-pointer accent-blue-500"
                              />
                              <span className={`font-medium ${isChecked ? 'line-through text-gray-500' : 'text-white'}`}>
                                {itemName}
                                {item.quantity > 1 && <span className="text-gray-400"> x{item.quantity}</span>}
                              </span>
                              {item.modifiers && item.modifiers.length > 0 && (
                                <span className="text-gray-500 text-xs ml-auto">{item.modifiers.join(', ')}</span>
                              )}
                            </label>
                          );
                        })}
                      </div>

                      {/* Special instructions */}
                      {order.specialInstructions && order.specialInstructions.trim() && (
                        <div className="glass-notes p-3 rounded-lg mb-4">
                          <p className="text-xs font-bold text-yellow-300 uppercase tracking-wide">Special Instructions:</p>
                          <p className="text-sm text-yellow-100 mt-2 leading-relaxed">{order.specialInstructions}</p>
                        </div>
                      )}

                      {/* Comments */}
                      <div className="mb-4">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                          <MessageSquare size={13} />
                          Comments
                        </label>
                        <textarea
                          value={draftComments.has(order.id) ? draftComments.get(order.id) : (order.comments || '')}
                          onChange={(e) => handleCommentChange(order.id, e.target.value)}
                          placeholder="Add a note..."
                          rows={2}
                          className="w-full text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                          style={{
                            background: 'rgba(5, 12, 30, 0.5)',
                            border: '1px solid rgba(120, 180, 255, 0.15)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>

                      {/* Bottom actions row: cancel + complete + timer */}
                      <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid rgba(120, 180, 255, 0.08)' }}>
                        {getStatusButtons(order).includes('cancelled') && (
                          <button
                            onClick={() => handleStatusChange(order, 'cancelled')}
                            className="text-xs font-semibold py-2 px-4 rounded-lg transition-all bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25"
                          >
                            Cancel
                          </button>
                        )}
                        {getStatusButtons(order).includes('completed') && (
                          <button
                            onClick={() => handleStatusChange(order, 'completed')}
                            className="text-xs font-semibold py-2 px-4 rounded-lg transition-all bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25"
                          >
                            Complete
                          </button>
                        )}
                        <span className="ml-auto text-sm font-mono tabular-nums text-gray-500">
                          {order.status === 'completed' || order.status === 'cancelled'
                            ? formatElapsed(order.placedAt, order.completedAt)
                            : formatElapsed(order.placedAt)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* ── Collapsed card ── */
                    <button
                      onClick={() => {
                        if (locked) {
                          triggerLockJiggle();
                          return;
                        }
                        const newExpanded = new Set(expandedOrders);
                        newExpanded.add(order.id);
                        setExpandedOrders(newExpanded);
                      }}
                      className="w-full text-left px-6 py-4 transition-all"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="order-number">Order #{orderNumberMap.get(order.id)}</p>
                        <div className="flex items-center gap-3">
                          {!locked && (
                            <span className="text-xs font-mono tabular-nums text-gray-500">
                              {order.status === 'completed' || order.status === 'cancelled'
                                ? formatElapsed(order.placedAt, order.completedAt)
                                : formatElapsed(order.placedAt)}
                            </span>
                          )}
                          <span
                            className="text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full"
                            style={{
                              color: order.status === 'pending' ? '#fde047'
                                : order.status === 'preparing' ? '#60a5fa'
                                : order.status === 'ready' ? '#4ade80'
                                : order.status === 'completed' ? '#9ca3af'
                                : '#f87171',
                              background: order.status === 'pending' ? 'rgba(234, 179, 8, 0.2)'
                                : order.status === 'preparing' ? 'rgba(0, 102, 255, 0.2)'
                                : order.status === 'ready' ? 'rgba(34, 197, 94, 0.2)'
                                : order.status === 'completed' ? 'rgba(107, 114, 128, 0.2)'
                                : 'rgba(239, 68, 68, 0.2)',
                              border: `1px solid ${
                                order.status === 'pending' ? 'rgba(234, 179, 8, 0.4)'
                                : order.status === 'preparing' ? 'rgba(0, 102, 255, 0.4)'
                                : order.status === 'ready' ? 'rgba(34, 197, 94, 0.4)'
                                : order.status === 'completed' ? 'rgba(107, 114, 128, 0.4)'
                                : 'rgba(239, 68, 68, 0.4)'
                              }`,
                            }}
                          >
                            {order.status}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mb-1">{locked ? `Customer ${sortedIdx + 1}` : `Customer: ${customerName}`}</p>
                      {!locked && (
                        <p className="text-sm text-blue-300/60 truncate">{itemSummary}</p>
                      )}
                    </button>
                  )}
                </GlassPanel>
              );
            })}
          </div>
        )}
        </div>

      </div>

    </GlassPanel>
  );
}
