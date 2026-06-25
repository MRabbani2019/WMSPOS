import { useState } from 'react';
import { X, Percent, DollarSign } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useSettingsStore } from '../stores/settingsStore';

interface DiscountModalProps {
  onClose: () => void;
}

export default function DiscountModal({ onClose }: DiscountModalProps) {
  const setDiscount = useCartStore((state) => state.setDiscount);
  const discountConfig = useSettingsStore((state) => state.discountConfig);
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');

  const handleApply = () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return;

    if (type === 'percentage' && numValue > 100) {
      alert('Percentage discount cannot exceed 100%');
      return;
    }

    if (type === 'percentage' && numValue > discountConfig.cashierMaxPercent) {
      alert(`Discount exceeds your limit of ${discountConfig.cashierMaxPercent}%. Manager approval required.`);
      return;
    }

    if (type === 'fixed') {
      const subtotal = useCartStore.getState().getSubtotal();
      const effectivePercent = subtotal > 0 ? (numValue / subtotal) * 100 : 0;
      if (effectivePercent > discountConfig.cashierMaxPercent) {
        alert(`Discount exceeds your limit of ${discountConfig.cashierMaxPercent}%. Manager approval required.`);
        return;
      }
    }

    setDiscount({ type, value: numValue });
    onClose();
  };

  const handleRemove = () => {
    setDiscount(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed top-0 right-0 bottom-0 w-[480px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#E1E3E5]">
          <h2 className="text-xl font-semibold">Apply Discount</h2>
          <button
            onClick={onClose}
            className="text-[#8C9196] hover:text-[#202223]"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Discount Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setType('percentage')}
                className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 ${
                  type === 'percentage'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Percent className="w-6 h-6" />
                <span className="text-sm font-medium">Percentage</span>
              </button>

              <button
                onClick={() => setType('fixed')}
                className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 ${
                  type === 'fixed'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <DollarSign className="w-6 h-6" />
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
              max={type === 'percentage' ? '100' : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="input-field text-lg"
              placeholder="0.00"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleApply}
              disabled={!value || parseFloat(value) <= 0}
              className="flex-1 btn-success"
            >
              Apply Discount
            </button>
            <button
              onClick={handleRemove}
              className="flex-1 btn-danger"
            >
              Remove Discount
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
