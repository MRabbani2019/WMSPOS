import { useState, useRef } from 'react';
import { X, Gift, CheckCircle } from 'lucide-react';
import apiClient from '../lib/axios';
import { getApiErrorMessage } from '../lib/getErrorMessage';

interface GiftCardModalProps {
  mode: 'sell' | 'check';
  onClose: () => void;
  onActivated?: (card: { number: string; balance: number }) => void;
}

export default function GiftCardModal({ mode, onClose, onActivated }: GiftCardModalProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardInfo, setCardInfo] = useState<{ number: string; balance: number; expiresAt: string | null } | null>(null);
  const [activated, setActivated] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const handleCheckBalance = async () => {
    if (!cardNumber.trim()) return;
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.get(`/client/pos/gift-card/${cardNumber}`);
      const data = response.data?.data || response.data;
      if (data) {
        setCardInfo({
          number: data.cardNumber || cardNumber,
          balance: parseFloat(data.balance) || 0,
          expiresAt: data.expiresAt || null,
        });
      } else {
        setError('Gift card not found');
      }
    } catch (err) {
      setError('Gift card not found. Please check the number.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    const value = parseFloat(amount);
    if (!cardNumber.trim() || isNaN(value) || value < 5 || value > 500) {
      setError('Please enter a valid amount between £5.00 and £500.00');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/client/pos/gift-card/activate', {
        cardNumber,
        amount: value,
      });

      if (response.data.status) {
        setActivated(true);
        onActivated?.({ number: cardNumber, balance: value });
      } else {
        setError(response.data.message || 'Failed to activate gift card');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to activate gift card'));
    } finally {
      setLoading(false);
    }
  };

  if (activated) {
    return (
      <div className="fixed inset-0 z-50" onClick={onClose}>
        <div className="fixed inset-0 bg-black/30" />
        <div className="fixed top-0 right-0 bottom-0 w-[480px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] flex flex-col items-center justify-center p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-success-600" />
          </div>
          <h2 className="text-lg font-bold mb-1">Gift Card Activated</h2>
          <p className="text-sm text-gray-500 mb-1">Card: ****{cardNumber.slice(-4)}</p>
          <p className="text-2xl font-bold text-success-600 mb-4">£{parseFloat(amount).toFixed(2)}</p>
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
            <Gift className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold">
              {mode === 'sell' ? 'Sell Gift Card' : 'Check Gift Card Balance'}
            </h2>
          </div>
          <button onClick={onClose} className="text-[#8C9196] hover:text-[#202223]">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-auto">
          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Card Number (scan or enter)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => { setCardNumber(e.target.value); setError(''); setCardInfo(null); }}
                className="input-field flex-1"
                placeholder="Scan gift card barcode..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (mode === 'check') handleCheckBalance();
                  else if (mode === 'sell' && cardNumber.trim()) amountRef.current?.focus();
                }}
              />
              {mode === 'check' && (
                <button onClick={handleCheckBalance} disabled={loading} className="btn-primary">
                  {loading ? '...' : 'Check'}
                </button>
              )}
            </div>
          </div>

          {/* Balance check result */}
          {cardInfo && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-center">
              <p className="text-sm text-primary-600 mb-1">Card ****{cardInfo.number.slice(-4)}</p>
              <p className="text-3xl font-bold text-primary-700">£{cardInfo.balance.toFixed(2)}</p>
              {cardInfo.expiresAt && (
                <p className="text-xs text-primary-500 mt-1">
                  Expires: {new Date(cardInfo.expiresAt).toLocaleDateString('en-GB')}
                </p>
              )}
            </div>
          )}

          {/* Sell mode: amount input */}
          {mode === 'sell' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Load Amount (£5 - £500)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">£</span>
                  <input
                    ref={amountRef}
                    type="number"
                    step="1"
                    min="5"
                    max="500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input-field pl-8 text-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-2">
                {[10, 25, 50, 100].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val.toString())}
                    className={`p-2 border rounded-lg text-sm font-medium ${
                      amount === val.toString()
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    £{val}
                  </button>
                ))}
              </div>

              <button
                onClick={handleActivate}
                disabled={loading || !cardNumber || !amount}
                className="btn-success w-full text-lg py-3"
              >
                {loading ? 'Activating...' : `Activate Gift Card — £${parseFloat(amount || '0').toFixed(2)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
