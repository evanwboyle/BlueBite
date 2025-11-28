import { useState } from 'react';
import type { MenuItem, OrderItem } from '../types';
import { X, Plus, Minus } from 'lucide-react';

interface ItemDetailModalProps {
  item: MenuItem;
  onAddToCart: (item: OrderItem) => void;
  onClose: () => void;
}

export function ItemDetailModal({ item, onAddToCart, onClose }: ItemDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);

  const modifierPrice = item.modifiers
    .filter(m => selectedModifiers.includes(m.name))
    .reduce((sum, m) => sum + m.price, 0);

  const totalPrice = (item.price + modifierPrice) * quantity;

  const handleToggleModifier = (modifierName: string) => {
    setSelectedModifiers(prev =>
      prev.includes(modifierName)
        ? prev.filter(m => m !== modifierName)
        : [...prev, modifierName]
    );
  };

  const handleAddToCart = () => {
    onAddToCart({
      menuItemId: item.id,
      name: item.name,
      quantity,
      price: item.price + modifierPrice,
      modifiers: selectedModifiers,
    });
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(107, 114, 128, 0.3)' }} onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header with Close */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b bg-white">
          <h2 className="text-2xl font-bold text-gray-900">{item.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Image */}
          <div className="h-48 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg overflow-hidden">
            {item.image ? (
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <span>No image available</span>
              </div>
            )}
          </div>

          {/* Item Info */}
          <div>
            <p className="text-gray-600 mb-2">
              {item.hot && (
                <span className="inline-block text-xs bg-red-100 text-red-700 rounded px-2 py-1 mr-2">
                  Hot
                </span>
              )}
            </p>
            <p className="text-3xl font-bold text-blue-600">${item.price.toFixed(2)}</p>
          </div>

          {/* Modifiers */}
          {item.modifiers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Add-ons</h3>
              <div className="space-y-2">
                {item.modifiers.map(modifier => (
                  <label
                    key={modifier.id}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModifiers.includes(modifier.name)}
                      onChange={() => handleToggleModifier(modifier.name)}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{modifier.name}</p>
                    </div>
                    <p className="text-blue-600 font-semibold">+${modifier.price.toFixed(2)}</p>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Quantity</p>
            <div className="flex items-center gap-4 w-fit">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-full border border-gray-300 hover:border-gray-400 flex items-center justify-center transition"
              >
                <Minus size={18} />
              </button>
              <span className="text-xl font-semibold w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-full border border-gray-300 hover:border-gray-400 flex items-center justify-center transition"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer with Total and Add Button */}
        <div className="sticky bottom-0 border-t p-6 bg-gray-50 flex items-center justify-between gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-1">Total Price</p>
            <p className="text-2xl font-bold text-blue-600">${totalPrice.toFixed(2)}</p>
          </div>
          <button
            onClick={handleAddToCart}
            className="btn-primary flex-1 py-3 text-lg"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
