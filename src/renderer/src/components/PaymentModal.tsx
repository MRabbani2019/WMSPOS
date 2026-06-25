import { useState, useRef } from 'react';
import { X, CreditCard, Banknote, ShoppingBag, Clock, Truck } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useRegisterStore } from '../stores/registerStore';
import { useAuthStore } from '../stores/authStore';
import { useOfflineStore } from '../stores/offlineStore';
import apiClient from '../lib/axios';
import { getApiErrorMessage } from '../lib/getErrorMessage';

type FulfillmentType = 'take_now' | 'collect_wait' | 'ship_to_address';

interface PaymentModalProps {
  onClose: () => void;
  onComplete: (sale: any) => void;
}

export default function PaymentModal({ onClose, onComplete }: PaymentModalProps) {
  const {
    items, customer, discount, getTotal, getSubtotal,
    getDiscountAmount, getTaxBreakdown, getVAT,
    getItemLineTotal,
    clearCart,
  } = useCartStore();
  const session = useRegisterStore((state) => state.session);
  const user = useAuthStore((state) => state.user);
  const terminalConfig = useAuthStore((state) => state.terminalConfig);
  const isOnline = useOfflineStore((state) => state.isOnline);

  // Double-submit guard
  const isSubmitting = useRef(false);

  // Step 1: Fulfillment type
  const [step, setStep] = useState<'fulfillment' | 'shipping' | 'payment'>('fulfillment');
  const [fulfillment, setFulfillment] = useState<FulfillmentType>('take_now');

  // Shipping address (for ship_to_address)
  const [shippingAddress, setShippingAddress] = useState({
    line1: '',
    line2: '',
    city: '',
    county: '',
    postcode: '',
    phone: '',
  });

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('card');
  const [cashReceived, setCashReceived] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const total = getTotal();

  const handleFulfillmentNext = () => {
    if (fulfillment === 'ship_to_address') {
      if (!customer) {
        setError('Customer must be added before shipping. Go back and attach a customer.');
        return;
      }
      setStep('shipping');
    } else {
      setStep('payment');
    }
    setError('');
  };

  const handleShippingNext = () => {
    if (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.postcode) {
      setError('Address line 1, city, and postcode are required');
      return;
    }
    setError('');
    setStep('payment');
  };

  const handlePayment = async () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;

    setProcessing(true);
    setError('');

    try {
      let payments: { method: string; amount: number }[] = [];
      let cashTendered: number | undefined;
      let changeGiven: number | undefined;

      if (paymentMethod === 'cash') {
        const tendered = parseFloat(cashReceived);
        if (isNaN(tendered) || tendered < total) {
          setError('Cash received must be at least the total amount');
          setProcessing(false);
          isSubmitting.current = false;
          return;
        }
        cashTendered = tendered;
        changeGiven = Math.max(0, tendered - total);
        payments = [{ method: 'cash', amount: total }];
      } else if (paymentMethod === 'card') {
        payments = [{ method: 'card', amount: total }];
      } else {
        const cashAmount = parseFloat(splitCash) || 0;
        const cardAmount = total - cashAmount;
        cashTendered = cashAmount;
        changeGiven = 0;
        payments = [
          { method: 'cash', amount: cashAmount },
          { method: 'card', amount: cardAmount },
        ];
      }

      const taxBreakdown = getTaxBreakdown();

      const response = await apiClient.post('/client/pos/sale/create', {
        items: items.map((item) => ({
          variationId: item.variationId,
          quantity: item.quantity,
          price: item.price,
          taxRate: item.taxRate,
          discount: item.discount || undefined,
        })),
        payments,
        cashTendered,
        changeGiven,
        customerId: customer?.id || null,
        sessionId: session?.id,
        discount: discount || undefined,
        taxBreakdown: taxBreakdown.map((t) => ({
          rate: t.rate,
          name: t.name,
          taxableAmount: t.taxableAmount,
          taxAmount: t.taxAmount,
        })),
        // Fulfillment info
        fulfillmentType: fulfillment,
        shippingAddress: fulfillment === 'ship_to_address' ? shippingAddress : undefined,
      });

      if (response.data.status) {
        const receiptData = {
          orderId: response.data.orderId,
          orderNumber: response.data.orderNumber,
          date: new Date().toISOString(),
          cashierName: user ? `${user.firstName} ${user.lastName}` : 'Staff',
          terminalName: terminalConfig?.terminalName || 'Terminal',
          items: items.map((item) => ({
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.price,
            lineTotal: getItemLineTotal(item),
            taxRate: item.taxRate,
            discount: item.discount ? {
              type: item.discount.type,
              value: item.discount.value,
              reason: item.discount.reason,
            } : undefined,
          })),
          subtotal: getSubtotal(),
          discountTotal: getDiscountAmount(),
          taxLines: taxBreakdown,
          taxTotal: getVAT(),
          total,
          paymentMethod,
          cashTendered,
          changeGiven,
          customerName: customer?.name,
          customerEmail: customer?.email,
        };

        try { localStorage.setItem('pos_last_sale', JSON.stringify(receiptData)); } catch {}
        clearCart();
        onComplete({
          id: response.data.orderId,
          orderNumber: response.data.orderNumber,
          total,
          paymentMethod,
          fulfillmentType: fulfillment,
          change: changeGiven || 0,
          receipt: receiptData,
        });
      } else {
        setError(response.data.message || 'Payment failed');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Payment failed. Please try again.'));
    } finally {
      setProcessing(false);
      isSubmitting.current = false;
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
          <div>
            <h2 className="text-xl font-semibold">
              {step === 'fulfillment' ? 'How is the customer getting this?' : step === 'shipping' ? 'Shipping Address' : 'Payment'}
            </h2>
            {step !== 'fulfillment' && (
              <p className="text-xs text-gray-500 mt-0.5">
                {fulfillment === 'take_now' && 'Taking now from shelf'}
                {fulfillment === 'collect_wait' && 'Collecting in store — warehouse will pick'}
                {fulfillment === 'ship_to_address' && 'Shipping to customer address'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Amount */}
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Amount Due</p>
            <p className="text-4xl font-bold">£{total.toFixed(2)}</p>
          </div>

          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* ─── Step 1: Fulfillment Type ─── */}
          {step === 'fulfillment' && (
            <>
              <div className="space-y-2">
                <button
                  onClick={() => setFulfillment('take_now')}
                  className={`w-full p-4 border-2 rounded-lg flex items-center gap-4 text-left transition-colors ${
                    fulfillment === 'take_now'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <ShoppingBag className="w-8 h-8 text-success-600 shrink-0" />
                  <div>
                    <p className="font-semibold">Take Now</p>
                    <p className="text-xs text-gray-500">Customer picks item off display shelf and takes it</p>
                  </div>
                </button>

                <button
                  onClick={() => setFulfillment('collect_wait')}
                  className={`w-full p-4 border-2 rounded-lg flex items-center gap-4 text-left transition-colors ${
                    fulfillment === 'collect_wait'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Clock className="w-8 h-8 text-warning-600 shrink-0" />
                  <div>
                    <p className="font-semibold">Collect & Wait</p>
                    <p className="text-xs text-gray-500">Warehouse picks the item — customer waits or comes back</p>
                  </div>
                </button>

                <button
                  onClick={() => setFulfillment('ship_to_address')}
                  className={`w-full p-4 border-2 rounded-lg flex items-center gap-4 text-left transition-colors ${
                    fulfillment === 'ship_to_address'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Truck className="w-8 h-8 text-primary-600 shrink-0" />
                  <div>
                    <p className="font-semibold">Ship to Address</p>
                    <p className="text-xs text-gray-500">Warehouse picks, packs, and ships to customer</p>
                  </div>
                </button>
              </div>

              <button
                onClick={handleFulfillmentNext}
                className="btn-primary w-full text-lg py-3"
              >
                Continue to {fulfillment === 'ship_to_address' ? 'Address' : 'Payment'}
              </button>
            </>
          )}

          {/* ─── Step 2: Shipping Address (ship_to_address only) ─── */}
          {step === 'shipping' && (
            <>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                  <input
                    type="text"
                    value={shippingAddress.line1}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, line1: e.target.value })}
                    className="input-field"
                    placeholder="123 High Street"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={shippingAddress.line2}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, line2: e.target.value })}
                    className="input-field"
                    placeholder="Flat 2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                      type="text"
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                      className="input-field"
                      placeholder="London"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
                    <input
                      type="text"
                      value={shippingAddress.county}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, county: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                    <input
                      type="text"
                      value={shippingAddress.postcode}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, postcode: e.target.value })}
                      className="input-field"
                      placeholder="SW1A 1AA"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={shippingAddress.phone}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                      className="input-field"
                      placeholder="07..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep('fulfillment')} className="flex-1 btn-secondary">
                  Back
                </button>
                <button onClick={handleShippingNext} className="flex-1 btn-primary">
                  Continue to Payment
                </button>
              </div>
            </>
          )}

          {/* ─── Step 3: Payment ─── */}
          {step === 'payment' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPaymentMethod('card')}
                    disabled={!isOnline}
                    className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 ${
                      !isOnline
                        ? 'border-gray-200 opacity-40 cursor-not-allowed'
                        : paymentMethod === 'card'
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
                    disabled={!isOnline}
                    className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 ${
                      !isOnline
                        ? 'border-gray-200 opacity-40 cursor-not-allowed'
                        : paymentMethod === 'split'
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <CreditCard className="w-6 h-6" />
                    <span className="text-sm font-medium">Split</span>
                  </button>
                </div>

                {!isOnline && (
                  <p className="text-xs text-warning-600 text-center mt-2">Cash only while offline</p>
                )}
              </div>

              {paymentMethod === 'cash' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cash Received</label>
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
                      <p className="text-2xl font-bold text-success-600">£{change.toFixed(2)}</p>
                    </div>
                  )}
                </>
              )}

              {paymentMethod === 'split' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cash Amount</label>
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
                      <p className="text-2xl font-bold">£{Math.max(0, total - parseFloat(splitCash)).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(fulfillment === 'ship_to_address' ? 'shipping' : 'fulfillment')}
                  className="btn-secondary"
                >
                  Back
                </button>
                <button
                  onClick={handlePayment}
                  disabled={!canProceed || processing}
                  className="flex-1 btn-success text-lg py-3"
                >
                  {processing ? 'Processing...' : 'Complete Payment'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
