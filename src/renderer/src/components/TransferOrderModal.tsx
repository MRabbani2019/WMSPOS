import { useState } from 'react';
import { X, Truck, CheckCircle } from 'lucide-react';
import apiClient from '../lib/axios';
import { getApiErrorMessage } from '../lib/getErrorMessage';

interface WarehouseStock {
  warehouseId: number;
  warehouseName: string;
  quantity: number;
}

interface TransferOrderModalProps {
  product: { variationId: number; name: string; sku: string };
  availableWarehouses: WarehouseStock[];
  destinationWarehouseId: number;
  destinationWarehouseName: string;
  onClose: () => void;
}

export default function TransferOrderModal({
  product,
  availableWarehouses,
  destinationWarehouseId,
  destinationWarehouseName,
  onClose,
}: TransferOrderModalProps) {
  const [sourceWarehouseId, setSourceWarehouseId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('1');
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const sourceWarehouses = availableWarehouses.filter(
    (w) => w.warehouseId !== destinationWarehouseId && w.quantity > 0
  );

  const selectedSource = sourceWarehouses.find((w) => w.warehouseId === sourceWarehouseId);
  const maxQty = selectedSource?.quantity || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceWarehouseId || !quantity) return;

    setProcessing(true);
    setError('');

    try {
      const response = await apiClient.post('/client/pos/transfer-order/create', {
        variationId: product.variationId,
        sourceWarehouseId,
        destinationWarehouseId,
        quantity: parseInt(quantity),
        urgency,
        customerNotification: customerName ? {
          name: customerName,
          phone: customerPhone,
        } : undefined,
      });

      if (response.data.status) {
        setSuccess(true);
      } else {
        setError(response.data.message || 'Failed to create transfer order');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create transfer order'));
    } finally {
      setProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50" onClick={onClose}>
        <div className="fixed inset-0 bg-black/30" />
        <div className="fixed top-0 right-0 bottom-0 w-[480px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] flex flex-col items-center justify-center p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-success-600" />
          </div>
          <h2 className="text-lg font-bold mb-1">Transfer Requested</h2>
          <p className="text-sm text-gray-500 mb-1">{product.name}</p>
          <p className="text-sm text-gray-500 mb-4">
            {quantity} unit{parseInt(quantity) !== 1 ? 's' : ''} from {selectedSource?.warehouseName} to {destinationWarehouseName}
          </p>
          {customerName && (
            <p className="text-xs text-gray-400 mb-4">
              Customer {customerName} will be notified on arrival
            </p>
          )}
          <button onClick={onClose} className="btn-primary w-full">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed top-0 right-0 bottom-0 w-[480px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#E1E3E5]">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary-600" />
            <div>
              <h2 className="text-lg font-semibold">Request Stock Transfer</h2>
              <p className="text-xs text-gray-500">{product.name} ({product.sku})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8C9196] hover:text-[#202223]">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-auto">
          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">{error}</div>
          )}

          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="text-gray-500">Transfer to:</p>
            <p className="font-medium">{destinationWarehouseName}</p>
          </div>

          {sourceWarehouses.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              No other locations have this product in stock
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Location</label>
                <select
                  value={sourceWarehouseId}
                  onChange={(e) => setSourceWarehouseId(parseInt(e.target.value) || '')}
                  className="input-field"
                  required
                >
                  <option value="">Select source...</option>
                  {sourceWarehouses.map((w) => (
                    <option key={w.warehouseId} value={w.warehouseId}>
                      {w.warehouseName} ({w.quantity} available)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max={maxQty}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="input-field"
                  required
                />
                {maxQty > 0 && (
                  <p className="text-xs text-gray-400 mt-1">Max available: {maxQty}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUrgency('normal')}
                    className={`p-2 border-2 rounded-lg text-sm font-medium ${
                      urgency === 'normal' ? 'border-primary-600 bg-primary-50' : 'border-gray-200'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrgency('urgent')}
                    className={`p-2 border-2 rounded-lg text-sm font-medium ${
                      urgency === 'urgent' ? 'border-danger-600 bg-danger-50' : 'border-gray-200'
                    }`}
                  >
                    Urgent
                  </button>
                </div>
              </div>

              {/* Optional: link customer for notification */}
              <div className="border-t border-[#E1E3E5] pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Notify customer on arrival (optional)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="input-field text-sm"
                    placeholder="Customer name"
                  />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="input-field text-sm"
                    placeholder="Phone number"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={processing || !sourceWarehouseId}
                className="btn-primary w-full"
              >
                {processing ? 'Requesting...' : 'Request Transfer'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
