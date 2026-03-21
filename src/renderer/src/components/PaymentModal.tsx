import { useState } from 'react';
import { X, CreditCard, Banknote } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useRegisterStore } from '../stores/registerStore';
import apiClient from '../lib/axios';
import { getApiErrorMessage } from '../lib/getErrorMessage';

interface PaymentModalProps {
  onClose: () => void;
  onComplete: (sale: any) => void;
}

export default function PaymentModal({ onClose, onComplete }: PaymentModalProps) {
  const { items, customer, discount, getTotal, getSubtotal, clearCart } = useCartStore();
  const session = useRegisterStore((state) => state.session);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('card');
  const [cashReceived, setCashReceived] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const total = getTotal();

  const handlePayment = async () => {
    setProcessing(true);
    setError('');

    try {
      // Build payments array based on method
      let payments: { method: string; amount: number }[] = [];
      let cashTendered: number | undefined;
      let changeGiven: number | undefined;

      if (paymentMethod === 'cash') {
        const tendered = parseFloat(cashReceived);
        cashTendered = tendered;
        changeGiven = Math.max(0, tendered - total);
        payments = [{ method: 'cash', amount: total }];
      } else if (paymentMethod === 'card') {
        payments = [{ method: 'card', amount: total }];
      } else {
        // Split payment
        const cashAmount = parseFloat(splitCash) || 0;
        const cardAmount = total - cashAmount;
        cashTendered = cashAmount;
        changeGiven = 0;
        payments = [
          { method: 'cash', amount: cashAmount },
          { method: 'card', amount: cardAmount },
        ];
      }

      const response = await apiClient.post('/client/pos/sale/create', {
        items: items.map((item) => ({
          variationId: item.variationId,
          quantity: item.quantity,
          price: item.price,
        })),
        payments,
        cashTendered,
        changeGiven,
        customerId: customer?.id || null,
        sessionId: session?.id,
        discount: discount || undefined,
      });

      if (response.data.status) {
        clearCart();
        onComplete({
          id: response.data.orderId,
          orderNumber: response.data.orderNumber,
          total,
          paymentMethod,
          change: changeGiven || 0,
          receipt: response.data.receipt,
        });
      } else {
        setError(response.data.message || 'Payment failed');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Payment failed. Please try again.'));
    } finally {
      setProcessing(false);
    }
  };

  const change = paymentMethod === 'cash' && cashReceived
    ? Math.max(0, parseFloat(cashReceived) - total)
    : 0;

  const canProceed = (() => {
    if (paymentMethod === 'cash') return parseFloat(cashReceived) >= total;
    if (paymentMethod === 'split') return parseFloat(splitCash) > 0 && parseFloat(splitCash) < total;
    return true;
  })();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Amount Due</p>
            <p className="text-4xl font-bold">£{total.toFixed(2)}</p>
          </div>

          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 ${
                  paymentMethod === 'card'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CreditCard className="w-6 h-6" />
                <span className="text-sm font-medium">Card</span>
              </button>

              <button
                onClick={() => setPaymentMethod('cash')}
                className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 ${
                  paymentMethod === 'cash'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Banknote className="w-6 h-6" />
                <span className="text-sm font-medium">Cash</span>
              </button>

              <button
                onClick={() => setPaymentMethod('split')}
                className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 ${
                  paymentMethod === 'split'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CreditCard className="w-6 h-6" />
                <span className="text-sm font-medium">Split</span>
              </button>
            </div>
          </div>

          {paymentMethod === 'cash' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cash Received
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="input-field pl-8 text-lg"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              {cashReceived && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Change</p>
                  <p className="text-2xl font-bold text-success-600">
                    £{change.toFixed(2)}
                  </p>
                </div>
              )}
            </>
          )}

          {paymentMethod === 'split' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cash Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={total}
                    value={splitCash}
                    onChange={(e) => setSplitCash(e.target.value)}
                    className="input-field pl-8 text-lg"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>
              {splitCash && parseFloat(splitCash) > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Card Amount</p>
                  <p className="text-2xl font-bold">
                    £{Math.max(0, total - parseFloat(splitCash)).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handlePayment}
            disabled={!canProceed || processing}
            className="btn-success w-full text-lg py-3"
          >
            {processing ? 'Processing...' : 'Complete Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
