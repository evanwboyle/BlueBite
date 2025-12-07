import { useState } from 'react';
import type { MenuItem, OrderItem, User } from '../types';
import { Plus, Pencil, ExternalLink } from 'lucide-react';
import { ItemDetailModal } from './ItemDetailModal';
import { useColorPalette } from '../hooks/useColorPalette';

interface MenuGridProps {
  items: MenuItem[];
  selectedButtery: string | null;
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
  selectedButtery,
  onAddToCart,
  cartCount = 0,
  onCartClick,
  isEditMode = false,
  currentUser = null,
  onDeleteMenuItem,
  onUpdateMenuItem,
  onCreateMenuItem
}: MenuGridProps) {
  const { lightColors } = useColorPalette(selectedButtery);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isCreatingItem, setIsCreatingItem] = useState(false);

  const handleAddItem = (item: MenuItem) => {
    setSelectedItem(item);
  };

  const handleEditClick = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    setSelectedItem(item);
  };

  const handleCreateClick = () => {
    setIsCreatingItem(true);
  };

  const isAdminOrStaff = currentUser?.role === 'admin' || currentUser?.role === 'staff';
  const showEditControls = isEditMode && isAdminOrStaff;

  const categories = [...new Set(items.map(i => i.category))];

  return (
    <div className="h-full flex flex-col glass-container">
      {/* Menu Header with Cart Button / Add Item Button */}
      <div className="flex-shrink-0 glass-header px-4 py-8 flex items-center justify-between rounded-t-none h-[40px]">
        <h2 className="text-lg font-bold text-white">Menu</h2>
        <div className="flex items-center gap-3 pr-6">
          <button
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('view', 'menu');
              window.open(url.toString(), '_blank');
            }}
            className="glass-button px-3 py-2 rounded transition flex items-center gap-2"
            aria-label="Open in new window"
            title="Open in new window"
          >
            <ExternalLink size={18} />
          </button>
          {showEditControls && onCreateMenuItem && (
            <button
              onClick={handleCreateClick}
              className="glass-button px-3 py-2 rounded transition flex items-center gap-2"
              aria-label="Add new item"
            >
              <Plus size={20} />
              <span className="text-sm font-medium">Add Item</span>
            </button>
          )}
          {onCartClick && !showEditControls && (
            <button
              onClick={onCartClick}
              className="relative glass-button px-16 py-2 rounded transition inline-block"
              aria-label="Shopping cart"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1H5L7.68 14.39C7.77 14.8 8.02 15.15 8.37 15.37C8.72 15.59 9.13 15.72 9.55 15.72H20.4C20.9 15.72 21.33 15.31 21.42 14.82L23 6.51C23.08 6.15 22.99 5.77 22.77 5.49C22.55 5.21 22.23 5.04 21.89 5.04H5.21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 20C9 20.5304 8.78929 21.0391 8.41421 21.4142C8.03914 21.7893 7.53043 22 7 22C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20C5 19.4696 5.21071 18.9609 5.58579 18.5858C5.96086 18.2107 6.46957 18 7 18C7.53043 18 8.03914 18.2107 8.41421 18.5858C8.78929 18.9609 9 19.4696 9 20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20 20C20 20.5304 19.7893 21.0391 19.4142 21.4142C19.0391 21.7893 18.5304 22 18 22C17.4696 22 16.9609 21.7893 16.5858 21.4142C16.2107 21.0391 16 20.5304 16 20C16 19.4696 16.2107 18.9609 16.5858 18.5858C16.9609 18.2107 17.4696 18 18 18C18.5304 18 19.0391 18.2107 19.4142 18.5858C19.7893 18.9609 20 19.4696 20 20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-sm font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8" style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
        {categories.map(category => (
          <div key={category}>
            <h3 className="text-xl font-bold text-gray-200 mb-4">{category}</h3>
            <div className="grid grid-cols-3 gap-4">
              {items
                .filter(item => item.category === category && !item.disabled)
                .map(item => (
                  <div
                    key={item.id}
                    className="relative group"
                  >
                    <div className={`glass-order-card rounded-lg shadow hover:shadow-lg transition overflow-hidden h-full flex flex-col ${showEditControls ? 'opacity-90' : ''}`}>
                      <div className="h-32 bg-gradient-to-br from-gray-700 to-gray-800 rounded-t-lg overflow-hidden relative">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500">
                            <span className="text-sm">No image</span>
                          </div>
                        )}

                        {/* Edit mode controls in top-right of image */}
                        {showEditControls && (
                          <div className="absolute top-2 right-2 flex gap-1">
                            <button
                              onClick={(e) => handleEditClick(e, item)}
                              className="w-8 h-8 glass-button-primary rounded-full flex items-center justify-center transition transform hover:scale-110"
                              style={{
                                backgroundColor: lightColors[0],
                                color: '#000000',
                                boxShadow: `0 0 12px ${lightColors[0]}80`,
                              }}
                              aria-label={`Edit ${item.name}`}
                              title="Edit item"
                            >
                              <Pencil size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <h4 className="font-semibold text-sm text-white line-clamp-2">{item.name}</h4>
                        <p className="font-bold text-lg mt-2" style={{ color: lightColors[lightColors.length > 1 ? 1 : 0] }}>${item.price.toFixed(2)}</p>
                        {item.hot && (
                          <span className="inline-block text-xs bg-red-500/20 text-red-400 border border-red-500/40 rounded px-2 py-1 mt-2 w-fit">
                            Hot
                          </span>
                        )}
                        <div className="mt-auto" />
                      </div>

                      {/* Only show add button when NOT in edit mode */}
                      {!showEditControls && (
                        <button
                          onClick={() => handleAddItem(item)}
                          className="absolute bottom-3 right-3 w-10 h-10 glass-button-primary rounded-full flex items-center justify-center transition transform hover:scale-110"
                          style={{
                            backgroundColor: lightColors[0],
                            color: '#000000',
                            boxShadow: `0 0 16px ${lightColors[0]}A0`,
                          }}
                          aria-label={`Add ${item.name}`}
                        >
                          <Plus size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          isEditMode={isEditMode}
          currentUser={currentUser}
          selectedButtery={selectedButtery}
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
          selectedButtery={selectedButtery}
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
