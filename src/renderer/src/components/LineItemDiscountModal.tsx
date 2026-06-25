import { useState } from 'react';
import { X, Percent, DollarSign } from 'lucide-react';
import { useCartStore, CartItem, ItemDiscount } from '../stores/cartStore';
import { useSettingsStore } from '../stores/settingsStore';

interface LineItemDiscountModalProps {
  item: CartItem;
  onClose: () => void;
}

export default function LineItemDiscountModal({ item, onClose }: LineItemDiscountModalProps) {
  const setItemDiscount = useCartStore((state) => state.setItemDiscount);
  const discountConfig = useSettingsStore((state) => state.discountConfig);

  const [type, setType] = useState<'percentage' | 'fixed'>(item.discount?.type || 'percentage');
  const [value, setValue] = useState(item.discount?.value?.toString() || '');
  const [reason, setReason] = useState(item.discount?.reason || '');
  const [error, setError] = useState('');

  const lineGross = item.price * item.quantity;

  const handleApply = () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      setError('Please enter a valid discount amount');
      return;
    }

    if (type === 'percentage' && numValue > 100) {
      setError('Percentage cannot exceed 100%');
      return;
    }

    if (type === 'fixed' && numValue > lineGross) {
      setError('Discount cannot exceed line total');
      return;
    }

    if (!reason) {
      setError('Please select a reason');
      return;
    }

    // Check if discount exceeds cashier ceiling
    const effectivePercent = type === 'percentage'
      ? numValue
      : (numValue / lineGross) * 100;

    if (effectivePercent > discountConfig.cashierMaxPercent) {
      setError(`Discount of ${effectivePercent.toFixed(1)}% exceeds your limit of ${discountConfig.cashierMaxPercent}%. Manager approval required.`);
      return;
    }

    const discount: ItemDiscount = { type, value: numValue, reason };
    setItemDiscount(item.variationId, discount);
    onClose();
  };

  const handleRemove = () => {
    setItemDiscount(item.variationId, undefined);
    onClose();
  };

  // Preview the discount effect
  const previewDiscount = (() => {
    const numValue = parseFloat(value) || 0;
    if (type === 'percentage') {
      return lineGross * (numValue / 100);
    }
    return Math.min(numValue, lineGross);
  })();

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed top-0 right-0 bottom-0 w-[480px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#E1E3E5]">
          <div>
            <h2 className="text-lg font-semibold">Line Item Discount</h2>
            <p className="text-sm text-gray-500 mt-0.5">{item.name}</p>
            <p className="text-xs text-gray-400">{item.quantity} x £{item.price.toFixed(2)} = £{lineGross.toFixed(2)}</p>
          </div>
          <button onClick={onClose} className="text-[#8C9196] hover:text-[#202223]">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-auto">
          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Discount Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setType('percentage'); setError(''); }}
                className={`p-3 border-2 rounded-lg flex items-center justify-center gap-2 ${
                  type === 'percentage'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Percent className="w-5 h-5" />
                <span className="text-sm font-medium">Percentage</span>
              </button>
              <button
                onClick={() => { setType('fixed'); setError(''); }}
                className={`p-3 border-2 rounded-lg flex items-center justify-center gap-2 ${
                  type === 'fixed'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <DollarSign className="w-5 h-5" />
                <span className="text-sm font-medium">Fixed Amount</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {type === 'percentage' ? 'Percentage (%)' : 'Amount (£)'}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={type === 'percentage' ? '100' : lineGross.toString()}
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(''); }}
              className="input-field text-lg"
              placeholder="0.00"
              autoFocus
            />
            {value && parseFloat(value) > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Saves customer £{previewDiscount.toFixed(2)} — new line total: £{(lineGross - previewDiscount).toFixed(2)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-danger-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(''); }}
              className="input-field"
            >
              <option value="">Select reason...</option>
              {discountConfig.reasonCodes.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleApply}
              disabled={!value || parseFloat(value) <= 0 || !reason}
              className="flex-1 btn-success"
            >
              Apply Discount
            </button>
            <button
              onClick={handleRemove}
              className="flex-1 btn-danger"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
