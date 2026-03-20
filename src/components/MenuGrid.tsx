import { useState } from 'react';
import type { MenuItem, OrderItem, User } from '../types';
import { Plus, Pencil } from 'lucide-react';
import { ItemDetailModal } from './ItemDetailModal';

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
      {/* Add Item button for edit mode */}
      {showEditControls && onCreateMenuItem && (
        <div className="flex-shrink-0 px-6 pt-4 pb-2">
          <button
            onClick={() => setIsCreatingItem(true)}
            className="glass-button px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <Plus size={18} />
            <span className="text-sm font-medium">Add Item</span>
          </button>
        </div>
      )}

      {/* Scrollable menu content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {categories.map(category => (
          <div key={category}>
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.5rem',
                color: 'var(--text-primary)',
                marginBottom: '1rem',
              }}
            >
              {category}
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {items
                .filter(item => item.category === category && !item.disabled)
                .map(item => (
                  <div
                    key={item.id}
                    className="relative group cursor-pointer"
                    onClick={() => !showEditControls && handleAddItem(item)}
                  >
                    <div
                      className="glass-order-card rounded-xl overflow-hidden h-full flex flex-col"
                      style={{ minHeight: '200px' }}
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
                            className="absolute top-2 right-2 text-xs font-semibold px-2 py-1 rounded"
                            style={{
                              background: 'rgba(239, 68, 68, 0.7)',
                              color: '#fff',
                              backdropFilter: 'blur(4px)',
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

                      {/* Info overlay at bottom */}
                      <div className="p-3 flex-1 flex flex-col justify-end">
                        <h4
                          className="line-clamp-2"
                          style={{
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {item.name}
                        </h4>
                        <div className="flex items-center justify-between mt-1.5">
                          <span
                            style={{
                              color: '#60a5fa',
                              fontWeight: 700,
                              fontSize: '1rem',
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
                              className="w-8 h-8 glass-button-primary text-blue-300 rounded-full flex items-center justify-center transition transform hover:scale-110"
                              aria-label={`Add ${item.name}`}
                            >
                              <Plus size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
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
