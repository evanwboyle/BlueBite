import { useState } from 'react';
import type { MenuItem, OrderItem } from '../types';
import { Plus, Minus } from 'lucide-react';
import { ModifierModal } from './ModifierModal';

interface MenuGridProps {
  items: MenuItem[];
  onAddToCart: (item: OrderItem) => void;
}

export function MenuGrid({ items, onAddToCart }: MenuGridProps) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleAddToCart = (item: MenuItem) => {
    if (item.modifiers.length > 0) {
      setSelectedItem(item);
    } else {
      const quantity = quantities[item.id] || 1;
      onAddToCart({
        menuItemId: item.id,
        name: item.name,
        quantity,
        price: item.price,
        modifiers: [],
      });
      setQuantities({ ...quantities, [item.id]: 0 });
    }
  };

  const handleQuantityChange = (itemId: string, delta: number) => {
    const current = quantities[itemId] || 0;
    const newQuantity = Math.max(0, current + delta);
    setQuantities({ ...quantities, [itemId]: newQuantity });
  };

  const categories = [...new Set(items.map(i => i.category))];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {categories.map(category => (
          <div key={category}>
            <h3 className="text-lg font-bold text-gray-800 mb-3">{category}</h3>
            <div className="grid grid-cols-2 gap-3">
              {items
                .filter(item => item.category === category && !item.disabled)
                .map(item => (
                  <div
                    key={item.id}
                    className="bg-white rounded-lg shadow hover:shadow-md transition border border-gray-200"
                  >
                    {item.image && (
                      <div className="h-24 bg-gray-200 rounded-t-lg overflow-hidden">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-3">
                      <h4 className="font-semibold text-sm text-gray-900 line-clamp-2">{item.name}</h4>
                      <p className="text-blue-600 font-bold text-sm mt-1">${item.price.toFixed(2)}</p>
                      {item.hot && (
                        <span className="inline-block text-xs bg-red-100 text-red-700 rounded px-2 py-1 mt-2">
                          Hot
                        </span>
                      )}

                      <div className="flex items-center justify-between mt-3 gap-2">
                        <div className="flex items-center gap-1 bg-gray-100 rounded">
                          <button
                            onClick={() => handleQuantityChange(item.id, -1)}
                            className="p-1 hover:bg-gray-200"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-sm font-medium">
                            {quantities[item.id] || 0}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(item.id, 1)}
                            className="p-1 hover:bg-gray-200"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          onClick={() => handleAddToCart(item)}
                          className="btn-small btn-primary flex-1"
                          disabled={item.disabled || (quantities[item.id] || 0) === 0}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {selectedItem && (
        <ModifierModal
          item={selectedItem}
          quantity={quantities[selectedItem.id] || 1}
          onConfirm={(modifiers) => {
            const quantity = quantities[selectedItem.id] || 1;
            onAddToCart({
              menuItemId: selectedItem.id,
              name: selectedItem.name,
              quantity,
              price: selectedItem.price,
              modifiers,
            });
            setQuantities({ ...quantities, [selectedItem.id]: 0 });
            setSelectedItem(null);
          }}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
