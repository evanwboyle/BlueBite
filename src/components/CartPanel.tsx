import type { OrderItem } from '../types';
import { Trash2, ShoppingCart } from 'lucide-react';
import { calculateCartTotal } from '../utils/cart';

interface CartPanelProps {
  items: OrderItem[];
  onRemoveItem: (index: number) => void;
  onCheckout: () => void;
}

export function CartPanel({ items, onRemoveItem, onCheckout }: CartPanelProps) {
  const total = calculateCartTotal(items);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 h-full flex flex-col">
      <div className="bg-gray-50 border-b p-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart size={20} />
          Cart
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ShoppingCart size={40} className="mx-auto mb-2 opacity-20" />
            <p>No items in cart</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={index} className="flex items-start justify-between gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                {item.modifiers.length > 0 && (
                  <p className="text-xs text-gray-600">
                    {item.modifiers.join(', ')}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    x{item.quantity}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onRemoveItem(index)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className="border-t bg-gray-50 p-4 space-y-3">
          <div className="flex justify-between items-center text-lg font-bold text-gray-900">
            <span>Total:</span>
            <span className="text-blue-600">${total.toFixed(2)}</span>
          </div>

          <button
            onClick={onCheckout}
            className="btn-primary w-full"
          >
            Confirm Order
          </button>
        </div>
      )}
    </div>
  );
}
