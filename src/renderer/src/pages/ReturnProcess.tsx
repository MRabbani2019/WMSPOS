import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, RotateCcw, ArrowRightLeft } from 'lucide-react';
import apiClient from '../lib/axios';
import { getApiErrorMessage } from '../lib/getErrorMessage';

interface OrderItem {
  id: number;
  variationId: number;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  quantityRefunded?: number;
}

interface RefundLineItem {
  orderItemId: number;
  variationId: number;
  name: string;
  sku: string;
  unitPrice: number;
  originalQty: number;
  refundableQty: number;
  selectedQty: number;
  condition: 'sellable' | 'damaged';
}

type RefundMethod = 'original' | 'cash' | 'store_credit';
type RefundMode = 'refund' | 'exchange' | 'void';

export default function ReturnProcess() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Refund state
  const [mode, setMode] = useState<RefundMode>('refund');
  const [refundLines, setRefundLines] = useState<RefundLineItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('original');
  const [reason, setReason] = useState('');

  const reasonCodes = [
    'Customer changed mind',
    'Wrong size/colour',
    'Defective/damaged product',
    'Wrong item delivered',
    'Price adjustment',
    'Duplicate purchase',
    'Other',
  ];

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const response = await apiClient.get(`/client/order/${orderId}`);
      const data = response.data?.order || response.data?.data || response.data;
      setOrder(data);

      // Build refundable lines
      const items: OrderItem[] = data.orderProducts || data.items || [];
      const lines: RefundLineItem[] = items.map((item) => ({
        orderItemId: item.id,
        variationId: item.variationId,
        name: item.name || item.sku || 'Product',
        sku: item.sku || '',
        unitPrice: parseFloat(String(item.price)) || 0,
        originalQty: item.quantity || 1,
        refundableQty: (item.quantity || 1) - (item.quantityRefunded || 0),
        selectedQty: 0,
        condition: 'sellable',
      }));
      setRefundLines(lines);
    } catch (err) {
      console.error('Failed to load order:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const updateLineQty = (index: number, qty: number) => {
    setRefundLines((prev) =>
      prev.map((line, i) =>
        i === index
          ? { ...line, selectedQty: Math.min(Math.max(0, qty), line.refundableQty) }
          : line
      )
    );
  };

  const updateLineCondition = (index: number, condition: 'sellable' | 'damaged') => {
    setRefundLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, condition } : line
      )
    );
  };

  const selectAll = () => {
    setRefundLines((prev) =>
      prev.map((line) => ({ ...line, selectedQty: line.refundableQty }))
    );
  };

  const clearSelection = () => {
    setRefundLines((prev) =>
      prev.map((line) => ({ ...line, selectedQty: 0 }))
    );
  };

  const selectedLines = refundLines.filter((l) => l.selectedQty > 0);
  const refundSubtotal = selectedLines.reduce(
    (sum, l) => sum + l.unitPrice * l.selectedQty, 0
  );

  // Calculate pro-rata discount reversal
  const orderTotalDiscount = parseFloat(order?.totalDiscount || '0');
  const orderSubtotal = refundLines.reduce(
    (sum, l) => sum + l.unitPrice * l.originalQty, 0
  );
  const orderDiscountPercent = orderSubtotal > 0
    ? Math.max(0, orderTotalDiscount / orderSubtotal)
    : 0;
  const refundAfterDiscount = refundSubtotal * (1 - orderDiscountPercent);

  const handleVoidSale = async () => {
    if (!confirm('Are you sure you want to void the entire sale? All stock will be restored.')) return;

    setProcessing(true);
    setError('');
    try {
      const response = await apiClient.post(`/client/pos/sale/${orderId}/void`);
      if (response.data.status) {
        setSuccess(true);
      } else {
        setError(response.data.message || 'Failed to void sale');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to void sale'));
    } finally {
      setProcessing(false);
    }
  };

  const handlePartialRefund = async () => {
    if (selectedLines.length === 0) {
      setError('Please select at least one item to refund');
      return;
    }
    if (!reason) {
      setError('Please select a reason');
      return;
    }

    setProcessing(true);
    setError('');
    try {
      const response = await apiClient.post('/client/pos/refund/create', {
        originalOrderId: orderId,
        type: mode,
        reason,
        refundMethod,
        items: selectedLines.map((line) => ({
          orderItemId: line.orderItemId,
          variationId: line.variationId,
          quantity: line.selectedQty,
          unitPrice: line.unitPrice,
          condition: line.condition,
        })),
        subtotalRefunded: refundSubtotal,
        totalRefunded: refundAfterDiscount,
      });

      if (response.data.status) {
        setSuccess(true);
      } else {
        setError(response.data.message || 'Failed to process refund');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to process refund'));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-success-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {mode === 'void' ? 'Sale Voided' : 'Refund Processed'}
          </h2>
          <p className="text-gray-500 mb-2">Order #{order?.orderNumber}</p>
          {mode !== 'void' && (
            <p className="text-lg font-semibold text-success-700 mb-4">
              Refund: £{refundAfterDiscount.toFixed(2)} via {refundMethod.replace('_', ' ')}
            </p>
          )}
          <button
            onClick={() => navigate('/returns')}
            className="btn-primary"
          >
            Back to Returns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate('/returns')}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Process Return</h1>
              <p className="text-sm text-gray-500">Order #{order?.orderNumber}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {order?.status === 'cancelled' && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
              This sale has already been voided.
            </div>
          )}

          {/* Mode Selection */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <button
              onClick={() => setMode('refund')}
              className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 ${
                mode === 'refund' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <RotateCcw className="w-6 h-6" />
              <span className="font-medium">Partial Refund</span>
              <span className="text-xs text-gray-500">Return selected items</span>
            </button>
            <button
              onClick={() => setMode('exchange')}
              className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 ${
                mode === 'exchange' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <ArrowRightLeft className="w-6 h-6" />
              <span className="font-medium">Exchange</span>
              <span className="text-xs text-gray-500">Swap for different items</span>
            </button>
            <button
              onClick={() => setMode('void')}
              disabled={order?.status === 'cancelled'}
              className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 disabled:opacity-50 ${
                mode === 'void' ? 'border-danger-600 bg-danger-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <CheckCircle className="w-6 h-6" />
              <span className="font-medium">Full Void</span>
              <span className="text-xs text-gray-500">Cancel entire sale</span>
            </button>
          </div>

          {/* Full Void Mode */}
          {mode === 'void' && (
            <div className="card">
              <h2 className="font-semibold mb-2">Void Entire Sale</h2>
              <p className="text-sm text-gray-500 mb-4">
                This will reverse the full transaction of £{parseFloat(order?.totalPrice || 0).toFixed(2)} and restore all stock.
              </p>
              <button
                onClick={handleVoidSale}
                disabled={processing || order?.status === 'cancelled'}
                className="btn-danger w-full"
              >
                {processing ? 'Processing...' : 'Void Sale & Restore Stock'}
              </button>
            </div>
          )}

          {/* Partial Refund / Exchange Mode */}
          {(mode === 'refund' || mode === 'exchange') && (
            <div className="grid grid-cols-3 gap-6">
              {/* Item Selection */}
              <div className="col-span-2">
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold">Select Items to Return</h2>
                    <div className="flex gap-2">
                      <button onClick={selectAll} className="text-xs text-primary-600 hover:underline">Select All</button>
                      <button onClick={clearSelection} className="text-xs text-gray-500 hover:underline">Clear</button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {refundLines.map((line, index) => (
                      <div
                        key={line.orderItemId}
                        className={`border rounded-lg p-3 transition-colors ${
                          line.selectedQty > 0
                            ? 'border-primary-300 bg-primary-50/50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm">{line.name}</p>
                            <p className="text-xs text-gray-500">
                              {line.sku} - £{line.unitPrice.toFixed(2)} each
                            </p>
                            <p className="text-xs text-gray-400">
                              Purchased: {line.originalQty} | Refundable: {line.refundableQty}
                            </p>
                          </div>
                          <p className="font-bold">
                            £{(line.unitPrice * line.selectedQty).toFixed(2)}
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-600">Qty:</label>
                            <input
                              type="number"
                              min="0"
                              max={line.refundableQty}
                              value={line.selectedQty}
                              onChange={(e) => updateLineQty(index, parseInt(e.target.value) || 0)}
                              className="w-16 input-field text-center text-sm py-1"
                            />
                            <span className="text-xs text-gray-400">/ {line.refundableQty}</span>
                          </div>

                          {line.selectedQty > 0 && (
                            <select
                              value={line.condition}
                              onChange={(e) => updateLineCondition(index, e.target.value as 'sellable' | 'damaged')}
                              className="text-xs input-field py-1 w-auto"
                            >
                              <option value="sellable">Sellable</option>
                              <option value="damaged">Damaged</option>
                            </select>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Refund Summary */}
              <div>
                <div className="card sticky top-4">
                  <h2 className="font-semibold mb-4">
                    {mode === 'refund' ? 'Refund Summary' : 'Exchange Summary'}
                  </h2>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Items selected</span>
                      <span>{selectedLines.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span>£{refundSubtotal.toFixed(2)}</span>
                    </div>
                    {orderDiscountPercent > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Pro-rata discount ({(orderDiscountPercent * 100).toFixed(1)}%)</span>
                        <span>-£{(refundSubtotal - refundAfterDiscount).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold pt-2 border-t border-gray-200">
                      <span>Refund Amount</span>
                      <span className="text-success-700">£{refundAfterDiscount.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason <span className="text-danger-500">*</span>
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="">Select reason...</option>
                      {reasonCodes.map((code) => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                  </div>

                  {/* Refund Method */}
                  {mode === 'refund' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Refund To
                      </label>
                      <select
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                        className="input-field text-sm"
                      >
                        <option value="original">Original Payment Method</option>
                        <option value="cash">Cash</option>
                        <option value="store_credit">Store Credit</option>
                      </select>
                    </div>
                  )}

                  <button
                    onClick={handlePartialRefund}
                    disabled={processing || selectedLines.length === 0 || !reason}
                    className={`w-full ${mode === 'exchange' ? 'btn-primary' : 'btn-danger'}`}
                  >
                    {processing
                      ? 'Processing...'
                      : mode === 'exchange'
                        ? `Process Exchange (£${refundAfterDiscount.toFixed(2)} credit)`
                        : `Refund £${refundAfterDiscount.toFixed(2)}`
                    }
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
