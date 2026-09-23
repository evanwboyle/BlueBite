import { useEffect, useRef, useState } from 'react';
import { CreditCard, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { Order, Payment } from '../types';
import { api } from '../utils/api';
import { GlassPanel, GlassButton } from './ui';

interface PaymentModalProps {
  order: Order;
  onClose: () => void;
}

const POLL_INTERVAL_MS = 1500;

const TERMINAL_STATUSES = new Set<Payment['status']>([
  'succeeded',
  'failed',
  'cancelled',
  'error',
  'expired',
  'bypassed',
]);

/**
 * Shown right after an order is placed. Sends the "tap to pay" request to
 * the payment device and polls until the customer completes, declines, or
 * cancels. The order isn't sent to the kitchen until this reports success -
 * see backend/src/routes/payments.ts for the server-side gate.
 */
export function PaymentModal({ order, onClose }: PaymentModalProps) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const latest = await api.getPaymentStatus(order.id);
        if (latest) {
          setPayment(latest);
          if (TERMINAL_STATUSES.has(latest.status)) {
            stopPolling();
          }
        }
      } catch {
        // Transient network hiccup while polling - keep trying silently.
      }
    }, POLL_INTERVAL_MS);
  };

  const requestPayment = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await api.initiatePayment(order.id);
      setPayment(result);
      if (!TERMINAL_STATUSES.has(result.status)) {
        startPolling();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach the payment terminal');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    requestPayment();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const handleCancel = async () => {
    setBusy(true);
    try {
      const result = await api.cancelPayment(order.id);
      setPayment(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel payment');
    } finally {
      stopPolling();
      setBusy(false);
    }
  };

  const status = payment?.status;
  const isWaiting = !status || status === 'requested' || status === 'awaiting_device';
  const isSuccess = status === 'succeeded' || status === 'bypassed';
  const isFailure = status === 'failed' || status === 'error' || status === 'expired';
  const isCancelled = status === 'cancelled';

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <GlassPanel level="modal" className="max-w-md w-full text-center" style={{ padding: '2.5rem 2rem' }}>
        {isWaiting && (
          <>
            <Loader2 size={48} className="mx-auto mb-4 text-blue-400 animate-spin" />
            <h2 className="text-xl font-bold text-white mb-2">Tap or Insert Card</h2>
            <p className="text-gray-400 mb-1">
              {busy ? 'Sending payment request...' : 'Waiting for the customer to pay on the terminal'}
            </p>
            <p className="text-2xl font-bold text-blue-400 mt-4 mb-6">${order.totalPrice.toFixed(2)}</p>
            <GlassButton variant="ghost" onClick={handleCancel} disabled={busy} className="w-full py-3">
              Cancel
            </GlassButton>
          </>
        )}

        {isSuccess && (
          <>
            <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400" />
            <h2 className="text-xl font-bold text-white mb-2">Payment Confirmed</h2>
            <p className="text-gray-400 mb-6">Order #{order.id.slice(-6)} has been sent to the kitchen.</p>
            <GlassButton variant="primary" onClick={onClose} className="w-full py-3">
              Done
            </GlassButton>
          </>
        )}

        {isCancelled && (
          <>
            <XCircle size={48} className="mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-bold text-white mb-2">Payment Cancelled</h2>
            <p className="text-gray-400 mb-6">No charge was made. You can try again.</p>
            <div className="flex gap-3">
              <GlassButton variant="ghost" onClick={onClose} className="flex-1 py-3">
                Close
              </GlassButton>
              <GlassButton variant="primary" onClick={requestPayment} className="flex-1 py-3">
                Try Again
              </GlassButton>
            </div>
          </>
        )}

        {isFailure && (
          <>
            <XCircle size={48} className="mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-bold text-white mb-2">Payment Failed</h2>
            <p className="text-gray-400 mb-6">{payment?.errorMessage || 'The payment could not be completed.'}</p>
            <div className="flex gap-3">
              <GlassButton variant="ghost" onClick={onClose} className="flex-1 py-3">
                Close
              </GlassButton>
              <GlassButton variant="primary" onClick={requestPayment} className="flex-1 py-3">
                <CreditCard size={16} className="inline mr-1" />
                Retry
              </GlassButton>
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-red-400 mt-4">{error}</p>
        )}
      </GlassPanel>
    </div>
  );
}
