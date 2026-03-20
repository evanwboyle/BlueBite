import { useState } from 'react';
import type { MenuItem } from '../types';
import { X, Check } from 'lucide-react';
import { GlassPanel } from './ui';

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
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <GlassPanel
        level="modal"
        className="max-w-md w-full max-h-[90vh] overflow-y-auto"
        style={{ padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-header sticky top-0 flex items-center justify-between p-4">
          <h2 className="text-lg font-bold text-white">{item.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Price Display */}
          <div className="text-lg font-bold text-blue-400">
            ${totalPrice.toFixed(2)}
          </div>

          {/* Modifiers */}
          <div>
            <h3 className="font-semibold text-white mb-3">Add-ons</h3>
            <div className="space-y-2">
              {item.modifiers.map(modifier => (
                <label key={modifier.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={selectedModifiers.includes(modifier.name)}
                    onChange={() => toggleModifier(modifier.name)}
                    className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-white">{modifier.name}</p>
                  </div>
                  {modifier.price > 0 && (
                    <p className="text-sm text-blue-400">+${modifier.price.toFixed(2)}</p>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Quantity Info */}
          <GlassPanel level="surface">
            <p className="text-sm text-gray-400">
              Quantity: <span className="font-bold text-white">{quantity}</span>
            </p>
          </GlassPanel>
        </div>

        {/* Action Buttons */}
        <div className="glass-header sticky bottom-0 p-4 flex gap-3">
          <button
            onClick={onClose}
            className="glass-button flex-1 py-2 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedModifiers)}
            className="glass-button-primary flex-1 py-2 rounded-lg flex items-center justify-center gap-2"
          >
            <Check size={18} />
            Add to Cart
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
