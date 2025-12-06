import { useState, useMemo } from 'react';
import type { MenuItem, User } from '../types';
import { Search, Trash2 } from 'lucide-react';

interface MenuEditorTabProps {
  menuItems: MenuItem[];
  currentUser: User | null;
  selectedButtery: string | null;
  butteryOptions: Array<{ name: string; itemCount: number }>;
  isAdmin: boolean;
  onUpdateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  onDeleteMenuItem: (id: string) => void;
  onCreateMenuItem: (item: Omit<MenuItem, 'id'>) => void;
}

export function MenuEditorTab({
  menuItems,
  currentUser,
  selectedButtery,
  isAdmin,
  onUpdateMenuItem,
  onDeleteMenuItem,
}: MenuEditorTabProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter menu items by selected buttery and search query
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Filter by buttery
      const butteryMatch = !selectedButtery || item.buttery === selectedButtery;

      // Filter by search query
      const searchMatch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      return butteryMatch && searchMatch;
    });
  }, [menuItems, selectedButtery, searchQuery]);

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const groups = new Map<string, MenuItem[]>();

    filteredItems.forEach((item) => {
      const category = item.category || 'Uncategorized';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(item);
    });

    // Sort items within each category by name
    groups.forEach((items) => {
      items.sort((a, b) => a.name.localeCompare(b.name));
    });

    // Convert to array and sort categories alphabetically
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  const handleToggleAvailable = (item: MenuItem) => {
    onUpdateMenuItem(item.id, { disabled: !item.disabled });
  };

  const handleToggleHot = (item: MenuItem) => {
    onUpdateMenuItem(item.id, { hot: !item.hot });
  };

  const handleDelete = (item: MenuItem) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${item.name}"? This action cannot be undone.`
    );
    if (confirmed) {
      onDeleteMenuItem(item.id);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 h-full flex flex-col">
      {/* Header with Search */}
      <div className="bg-gray-50 border-b p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Menu Editor
          </h2>
          <span className="text-sm text-gray-600">
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Menu Items List */}
      <div className="flex-1 overflow-y-auto">
        {itemsByCategory.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-sm">No menu items found</p>
              {searchQuery && (
                <p className="text-xs mt-1">Try adjusting your search</p>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {itemsByCategory.map(([category, items]) => (
              <div key={category}>
                {/* Category Header */}
                <div className="bg-gray-100 border-b border-gray-300 px-4 py-2 sticky top-0 z-10">
                  <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">
                    {category}
                  </h3>
                </div>

                {/* Category Items */}
                <div className="divide-y">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center justify-between gap-4">
                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <span className="text-sm font-semibold text-blue-600">
                              ${item.price.toFixed(2)}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-4 flex-shrink-0">
                          {/* Available Toggle */}
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor={`available-${item.id}`}
                              className="text-xs font-medium text-gray-700 cursor-pointer"
                            >
                              Available
                            </label>
                            <button
                              id={`available-${item.id}`}
                              onClick={() => handleToggleAvailable(item)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                !item.disabled
                                  ? 'bg-blue-600'
                                  : 'bg-gray-300'
                              }`}
                              role="switch"
                              aria-checked={!item.disabled}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  !item.disabled
                                    ? 'translate-x-6'
                                    : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>

                          {/* Hot Toggle */}
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor={`hot-${item.id}`}
                              className="text-xs font-medium text-gray-700 cursor-pointer"
                            >
                              Hot
                            </label>
                            <button
                              id={`hot-${item.id}`}
                              onClick={() => handleToggleHot(item)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                item.hot
                                  ? 'bg-orange-500'
                                  : 'bg-gray-300'
                              }`}
                              role="switch"
                              aria-checked={item.hot}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  item.hot
                                    ? 'translate-x-6'
                                    : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>

                          {/* Delete Button (Admin Only) */}
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(item)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition"
                              aria-label={`Delete ${item.name}`}
                              title="Delete item"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Modifiers Display (if any) */}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="mt-2 pl-2 border-l-2 border-gray-200">
                          <p className="text-xs font-medium text-gray-700 mb-1">
                            Modifiers:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {item.modifiers.map((modifier) => (
                              <span
                                key={modifier.id}
                                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                              >
                                {modifier.name} (+${modifier.price.toFixed(2)})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {currentUser && (
        <div className="border-t bg-gray-50 px-4 py-2">
          <p className="text-xs text-gray-600">
            Logged in as: <span className="font-medium">{currentUser.name || currentUser.netId}</span>
            {isAdmin && <span className="ml-2 text-blue-600 font-semibold">(Admin)</span>}
          </p>
        </div>
      )}
    </div>
  );
}
