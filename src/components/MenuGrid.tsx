import { useState } from 'react';
import type { MenuItem, OrderItem, User } from '../types';
import { Plus, Pencil, ShoppingCart, X, Check, List, LayoutGrid } from 'lucide-react';
import { ItemDetailModal } from './ItemDetailModal';
import { GlassPanel } from './ui';
import { storage } from '../utils/storage';
import type { MenuView } from '../utils/storage';

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
  onToggleModifier?: (itemId: string, modifierId: string, available: boolean) => void;
  /** False when the menu lives in the Google Sheet: no creating, deleting or full edits here. */
  menuEditable?: boolean;
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
  onCreateMenuItem,
  onToggleModifier,
  menuEditable = true
}: MenuGridProps) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [chosenView, setChosenView] = useState<MenuView | null>(() => storage.getMenuView());

  const handleViewChange = (next: MenuView) => {
    setChosenView(next);
    storage.setMenuView(next);
  };

  // Without an explicit choice, show the photo grid only when at least half of
  // the orderable items have images - otherwise the grid is mostly placeholders
  const orderableItems = items.filter(item => !item.disabled);
  const itemsWithImages = orderableItems.filter(item => item.image).length;
  const autoView: MenuView =
    orderableItems.length > 0 && itemsWithImages * 2 >= orderableItems.length ? 'grid' : 'list';
  const view = chosenView ?? autoView;

  const handleAddItem = (item: MenuItem) => {
    setSelectedItem(item);
  };

  const handleEditClick = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    setSelectedItem(item);
  };

  const handleToggleDisabled = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    onUpdateMenuItem?.(item.id, { disabled: !item.disabled });
  };

  const isAdminOrStaff = currentUser?.role === 'admin' || currentUser?.role === 'staff';
  const showEditControls = isEditMode && isAdminOrStaff;

  const categories = [...new Set(items.map(i => i.category))];

  // Customers never see disabled items; staff in edit mode see them dimmed
  const visibleItems = (category: string) =>
    items.filter(item => item.category === category && (showEditControls || !item.disabled));

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
          <div className="flex items-center gap-1" role="group" aria-label="Menu layout">
            <button
              onClick={() => handleViewChange('list')}
              className={`glass-button p-2 rounded-lg transition ${view === 'list' ? 'glass-button-active' : ''}`}
              aria-label="List view"
              aria-pressed={view === 'list'}
              title="List view"
            >
              <List size={20} />
            </button>
            <button
              onClick={() => handleViewChange('grid')}
              className={`glass-button p-2 rounded-lg transition ${view === 'grid' ? 'glass-button-active' : ''}`}
              aria-label="Grid view with photos"
              aria-pressed={view === 'grid'}
              title="Grid view with photos"
            >
              <LayoutGrid size={20} />
            </button>
          </div>
          {showEditControls && menuEditable && onCreateMenuItem && (
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
            {view === 'list' ? (
              <GlassPanel level="surface" className="overflow-hidden" style={{ padding: 0 }}>
                {visibleItems(category).map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 cursor-pointer transition hover:bg-white/5"
                    style={{
                      padding: '14px 20px',
                      borderTop: index === 0 ? 'none' : '1px solid var(--border-color-default)',
                      opacity: item.disabled && showEditControls ? 0.5 : 1,
                    }}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4
                          className="truncate"
                          style={{
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            color: item.disabled && showEditControls ? 'var(--text-whisper)' : 'var(--text-primary)',
                          }}
                        >
                          {item.name}
                        </h4>
                        {item.hot && !item.disabled && (
                          <span
                            className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded"
                            style={{ background: 'rgba(239, 68, 68, 0.7)', color: '#fff' }}
                          >
                            Hot
                          </span>
                        )}
                        {item.disabled && showEditControls && (
                          <span
                            className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded"
                            style={{ background: 'rgba(100, 100, 100, 0.85)', color: '#ccc' }}
                          >
                            Off
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p
                          className="truncate"
                          style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '2px' }}
                        >
                          {item.description}
                        </p>
                      )}
                    </div>

                    <span
                      className="flex-shrink-0"
                      style={{
                        color: item.disabled && showEditControls ? '#6b7280' : '#60a5fa',
                        fontWeight: 700,
                        fontSize: '1rem',
                      }}
                    >
                      ${item.price.toFixed(2)}
                    </span>

                    {showEditControls ? (
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <button
                          onClick={(e) => handleEditClick(e, item)}
                          className="w-8 h-8 glass-button-primary text-blue-300 rounded-full flex items-center justify-center transition transform hover:scale-110"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <AvailabilityToggle item={item} onToggle={handleToggleDisabled} />
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddItem(item);
                        }}
                        className="flex-shrink-0 w-9 h-9 glass-button-primary text-blue-300 rounded-full flex items-center justify-center transition transform hover:scale-110"
                        aria-label={`Add ${item.name}`}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </GlassPanel>
            ) : (
              <div className="flex flex-wrap gap-4">
                {visibleItems(category).map(item => (
                    <div
                      key={item.id}
                      className="relative group cursor-pointer"
                      style={{ width: '220px' }}
                      onClick={() => !showEditControls && handleAddItem(item)}
                    >
                      <GlassPanel
                        level="surface"
                        className="h-full flex flex-col overflow-hidden"
                        style={{
                          padding: 0,
                          minHeight: '200px',
                          opacity: item.disabled && showEditControls ? 0.5 : 1,
                          transition: 'opacity 0.2s',
                        }}
                      >
                        {/* Image */}
                        <div className="h-32 overflow-hidden relative rounded-t-xl">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              style={{ filter: item.disabled && showEditControls ? 'grayscale(80%)' : 'none' }}
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
                          {item.hot && !item.disabled && (
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

                          {/* Out of stock badge (edit mode only) */}
                          {item.disabled && showEditControls && (
                            <span
                              className="absolute top-3 left-3 text-xs font-semibold px-2 py-1 rounded-lg"
                              style={{
                                background: 'rgba(100, 100, 100, 0.85)',
                                color: '#ccc',
                              }}
                            >
                              Off
                            </span>
                          )}

                          {/* Edit (pencil) button — top-left in edit mode */}
                          {showEditControls && (
                            <button
                              onClick={(e) => handleEditClick(e, item)}
                              className="absolute top-2 left-2 w-8 h-8 glass-button-primary text-blue-300 rounded-full flex items-center justify-center shadow-md transition transform hover:scale-110"
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
                              color: item.disabled && showEditControls ? 'var(--text-whisper)' : 'var(--text-primary)',
                            }}
                          >
                            {item.name}
                          </h4>
                          <div className="flex items-center justify-between mt-2">
                            <span
                              style={{
                                color: item.disabled && showEditControls ? '#6b7280' : '#60a5fa',
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

                      {/* Disable/enable toggle button — top-right corner of card */}
                      {showEditControls && (
                        <AvailabilityToggle
                          item={item}
                          onToggle={handleToggleDisabled}
                          style={{ position: 'absolute', top: '-8px', right: '-8px', zIndex: 10 }}
                        />
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          isEditMode={isEditMode}
          currentUser={currentUser}
          menuEditable={menuEditable}
          onAddToCart={(orderItem) => {
            onAddToCart(orderItem);
            setSelectedItem(null);
          }}
          onUpdateMenuItem={onUpdateMenuItem}
          onDeleteMenuItem={onDeleteMenuItem}
          onToggleModifier={onToggleModifier}
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
          onToggleModifier={onToggleModifier}
          onClose={() => setIsCreatingItem(false)}
        />
      )}
    </div>
  );
}

interface AvailabilityToggleProps {
  item: MenuItem;
  onToggle: (e: React.MouseEvent, item: MenuItem) => void;
  style?: React.CSSProperties;
}

// Red X turns an item off, green check turns it back on (staff edit mode)
function AvailabilityToggle({ item, onToggle, style }: AvailabilityToggleProps) {
  return (
    <button
      onClick={(e) => onToggle(e, item)}
      aria-label={item.disabled ? `Enable ${item.name}` : `Disable ${item.name}`}
      style={{
        width: '26px',
        height: '26px',
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: item.disabled ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
        color: '#fff',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        transition: 'transform 0.15s, background 0.15s',
        ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {item.disabled ? <Check size={14} /> : <X size={14} />}
    </button>
  );
}
