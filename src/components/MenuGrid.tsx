import { useState } from 'react';
import type { MenuItem, OrderItem, User } from '../types';
import { Plus, Pencil, ShoppingCart } from 'lucide-react';
import { ItemDetailModal } from './ItemDetailModal';
import { GlassPanel } from './ui';

interface MenuGridProps {
  items: MenuItem[];
  onAddToCart: (item: OrderItem) => void;
  cartCount?: number;
  onCartClick?: () => void;
  isEditMode?: boolean;
  currentUser?: User | null;
  onDeleteMenuItem?: (id: string) => void;
  onUpdateMenuItem?: (id: string, updates: Partial<MenuItem>) => void;
  onCreateMenuItem?: (item: Omit<MenuItem, 'id'>) => void;
}

export function MenuGrid({
  items,
  onAddToCart,
  cartCount = 0,
  onCartClick,
  isEditMode = false,
  currentUser = null,
  onDeleteMenuItem,
  onUpdateMenuItem,
  onCreateMenuItem
}: MenuGridProps) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isCreatingItem, setIsCreatingItem] = useState(false);

  const handleAddItem = (item: MenuItem) => {
    setSelectedItem(item);
  };

  const handleEditClick = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    setSelectedItem(item);
  };

  const isAdminOrStaff = currentUser?.role === 'admin' || currentUser?.role === 'staff';
  const showEditControls = isEditMode && isAdminOrStaff;

  const categories = [...new Set(items.map(i => i.category))];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Menu Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between"
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
          Menu
        </h2>
        <div className="flex items-center gap-3">
          {showEditControls && onCreateMenuItem && (
            <button
              onClick={() => setIsCreatingItem(true)}
              className="glass-button px-4 py-3 rounded-xl transition flex items-center gap-2"
            >
              <Plus size={24} />
              <span className="font-medium">Add Item</span>
            </button>
          )}
          {onCartClick && (
            <button
              onClick={onCartClick}
              className="glass-button px-4 py-3 rounded-xl transition relative"
              title="Cart"
            >
              <ShoppingCart size={28} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Scrollable menu content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {categories.map(category => (
          <div key={category}>
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '2rem',
                color: 'var(--text-primary)',
                marginBottom: '1rem',
              }}
            >
              {category}
            </h3>
            <div className="flex flex-wrap gap-4">
              {items
                .filter(item => item.category === category && !item.disabled)
                .map(item => (
                  <div
                    key={item.id}
                    className="relative group cursor-pointer"
                    style={{ width: '220px' }}
                    onClick={() => !showEditControls && handleAddItem(item)}
                  >
                    <GlassPanel
                      level="surface"
                      className="h-full flex flex-col overflow-hidden"
                      style={{ padding: 0, minHeight: '200px' }}
                    >
                      {/* Image */}
                      <div className="h-32 overflow-hidden relative rounded-t-xl">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{ background: 'rgba(20, 40, 70, 0.5)' }}
                          >
                            <span style={{ color: 'var(--text-whisper)', fontSize: '0.875rem' }}>
                              No image
                            </span>
                          </div>
                        )}

                        {/* Hot badge */}
                        {item.hot && (
                          <span
                            className="absolute top-3 right-3 text-xs font-semibold px-3 py-1.5 rounded-lg"
                            style={{
                              background: 'rgba(239, 68, 68, 0.7)',
                              color: '#fff',
                            }}
                          >
                            Hot
                          </span>
                        )}

                        {/* Edit button overlay */}
                        {showEditControls && (
                          <button
                            onClick={(e) => handleEditClick(e, item)}
                            className="absolute top-2 right-2 w-8 h-8 glass-button-primary text-blue-300 rounded-full flex items-center justify-center shadow-md transition transform hover:scale-110"
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      </div>

                      {/* Info area */}
                      <div className="px-6 py-4 flex-1 flex flex-col justify-end">
                        <h4
                          className="line-clamp-2"
                          style={{
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {item.name}
                        </h4>
                        <div className="flex items-center justify-between mt-2">
                          <span
                            style={{
                              color: '#60a5fa',
                              fontWeight: 700,
                              fontSize: '1.05rem',
                            }}
                          >
                            ${item.price.toFixed(2)}
                          </span>

                          {!showEditControls && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddItem(item);
                              }}
                              className="w-10 h-10 glass-button-primary text-blue-300 rounded-full flex items-center justify-center transition transform hover:scale-110"
                              aria-label={`Add ${item.name}`}
                            >
                              <Plus size={20} />
                            </button>
                          )}
                        </div>
                      </div>
                    </GlassPanel>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          isEditMode={isEditMode}
          currentUser={currentUser}
          onAddToCart={(orderItem) => {
            onAddToCart(orderItem);
            setSelectedItem(null);
          }}
          onUpdateMenuItem={onUpdateMenuItem}
          onDeleteMenuItem={onDeleteMenuItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {isCreatingItem && onCreateMenuItem && (
        <ItemDetailModal
          item={null}
          isEditMode={true}
          currentUser={currentUser}
          onAddToCart={() => {}}
          onCreateMenuItem={(item) => {
            onCreateMenuItem(item);
            setIsCreatingItem(false);
          }}
          onClose={() => setIsCreatingItem(false)}
        />
      )}
    </div>
  );
}
