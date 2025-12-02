import { useState } from 'react';
import type { OrderItem } from '../types';
import { X, Trash2, ShoppingCart } from 'lucide-react';

interface CartModalProps {
  items: OrderItem[];
  onClose: () => void;
  onRemoveItem: (index: number) => void;
  onCheckout: (netId: string) => void;
  onPassToCustomer?: () => void;
}

export function CartModal({
  items,
  onClose,
  onRemoveItem,
  onCheckout,
}: CartModalProps) {
  const [netId, setNetId] = useState('');
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handlePlaceOrder = () => {
    if (!netId.trim()) {
      alert('Please enter your NetID');
      return;
    }
    onCheckout(netId);
    setNetId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(107, 114, 128, 0.3)' }} onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header with Close */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b bg-white">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart size={24} />
            Cart
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart size={48} className="mx-auto mb-2 opacity-20" />
              <p className="text-lg font-medium">No items in cart</p>
              <p className="text-sm">Add items from the menu to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.modifiers.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        {item.modifiers.join(', ')}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                        x{item.quantity}
                      </span>
                      <span className="text-base font-semibold text-gray-900">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveItem(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition flex-shrink-0"
                    aria-label="Remove item"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with NetID Input and Total */}
        {items.length > 0 && (
          <div className="sticky bottom-0 border-t p-6 bg-gray-50 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total:</span>
              <span className="text-2xl font-bold text-blue-600">${total.toFixed(2)}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter your NetID
              </label>
              <input
                type="text"
                value={netId}
                onChange={(e) => setNetId(e.target.value)}
                placeholder="Ex. abc12"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePlaceOrder();
                  }
                }}
                autoFocus
              />
            </div>

            <button
              onClick={handlePlaceOrder}
              className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!netId.trim()}
            >
              Place Order
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
