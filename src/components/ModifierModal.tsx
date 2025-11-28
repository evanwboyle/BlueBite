import { useState } from 'react';
import type { MenuItem } from '../types';
import { X, Check } from 'lucide-react';

interface ModifierModalProps {
  item: MenuItem;
  quantity: number;
  onConfirm: (modifiers: string[]) => void;
  onClose: () => void;
}

export function ModifierModal({ item, quantity, onConfirm, onClose }: ModifierModalProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);

  const toggleModifier = (modifierName: string) => {
    setSelectedModifiers(prev =>
      prev.includes(modifierName)
        ? prev.filter(m => m !== modifierName)
        : [...prev, modifierName]
    );
  };

  const modifierPrice = item.modifiers
    .filter(m => selectedModifiers.includes(m.name))
    .reduce((sum, m) => sum + m.price, 0);

  const totalPrice = (item.price + modifierPrice) * quantity;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
      <div className="bg-white w-full rounded-t-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b flex items-center justify-between p-4">
          <h2 className="text-lg font-bold text-gray-900">{item.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Price Display */}
          <div className="text-lg font-bold text-blue-600">
            ${totalPrice.toFixed(2)}
          </div>

          {/* Modifiers */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Add-ons</h3>
            <div className="space-y-2">
              {item.modifiers.map(modifier => (
                <label key={modifier.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedModifiers.includes(modifier.name)}
                    onChange={() => toggleModifier(modifier.name)}
                    className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{modifier.name}</p>
                  </div>
                  {modifier.price > 0 && (
                    <p className="text-sm text-gray-600">+${modifier.price.toFixed(2)}</p>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Quantity Info */}
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">
              Quantity: <span className="font-bold text-gray-900">{quantity}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white border-t p-4 flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedModifiers)}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Check size={18} />
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
