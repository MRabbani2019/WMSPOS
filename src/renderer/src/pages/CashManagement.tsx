import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Vault,
  DollarSign, Clock
} from 'lucide-react';
import { useRegisterStore } from '../stores/registerStore';
import apiClient from '../lib/axios';
import { getApiErrorMessage } from '../lib/getErrorMessage';

type MovementType = 'safe_drop' | 'pay_in' | 'pay_out' | 'petty_cash';

interface CashMovement {
  id: number;
  type: MovementType;
  amount: number;
  reason: string;
  createdAt: string;
  staffName: string;
}

const MOVEMENT_LABELS: Record<MovementType, { label: string; color: string }> = {
  safe_drop: { label: 'Safe Drop', color: 'text-primary-600' },
  pay_in: { label: 'Pay In', color: 'text-success-600' },
  pay_out: { label: 'Pay Out', color: 'text-danger-600' },
  petty_cash: { label: 'Petty Cash', color: 'text-warning-600' },
};

const REASON_CODES: Record<MovementType, string[]> = {
  safe_drop: ['Routine safe drop', 'Till limit exceeded', 'End of shift'],
  pay_in: ['Change float top-up', 'Cash from other till', 'Correction'],
  pay_out: ['Supplier COD payment', 'Staff expense', 'Correction'],
  petty_cash: ['Office supplies', 'Cleaning supplies', 'Customer refund (manual)', 'Parking', 'Other'],
};

export default function CashManagement() {
  const navigate = useNavigate();
  const session = useRegisterStore((state) => state.session);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [activeType, setActiveType] = useState<MovementType | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadMovements();
  }, []);

  const loadMovements = async () => {
    try {
      const response = await apiClient.get('/client/pos/cash-movements', {
        params: { sessionId: session?.id },
      });
      setMovements(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load cash movements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeType || !amount || !reason) return;

    setProcessing(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiClient.post('/client/pos/cash-movement', {
        sessionId: session?.id,
        type: activeType,
        amount: parseFloat(amount),
        reason: reason === 'Other' ? customReason : reason,
      });

      if (response.data.status) {
        setSuccess(`${MOVEMENT_LABELS[activeType].label} of £${parseFloat(amount).toFixed(2)} recorded`);
        setActiveType(null);
        setAmount('');
        setReason('');
        setCustomReason('');
        loadMovements();
      } else {
        setError(response.data.message || 'Failed to record cash movement');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to record cash movement'));
    } finally {
      setProcessing(false);
    }
  };

  const totalIn = movements
    .filter((m) => m.type === 'pay_in')
    .reduce((sum, m) => sum + m.amount, 0);
  const totalOut = movements
    .filter((m) => m.type !== 'pay_in')
    .reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => navigate('/')} className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Cash Management</h1>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">{error}</div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-success-50 border border-success-200 text-success-700 rounded-lg text-sm">{success}</div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card">
              <p className="text-sm text-gray-500 mb-1">Cash In (Today)</p>
              <p className="text-2xl font-bold text-success-600">£{totalIn.toFixed(2)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 mb-1">Cash Out (Today)</p>
              <p className="text-2xl font-bold text-danger-600">£{totalOut.toFixed(2)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 mb-1">Net Movement</p>
              <p className={`text-2xl font-bold ${totalIn - totalOut >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {totalIn - totalOut >= 0 ? '+' : ''}£{(totalIn - totalOut).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Action Buttons + Form */}
            <div>
              <h2 className="font-semibold mb-3">Record Movement</h2>

              {/* Type Selection */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {([
                  { type: 'safe_drop' as const, icon: Vault, label: 'Safe Drop' },
                  { type: 'pay_in' as const, icon: ArrowDownToLine, label: 'Pay In' },
                  { type: 'pay_out' as const, icon: ArrowUpFromLine, label: 'Pay Out' },
                  { type: 'petty_cash' as const, icon: DollarSign, label: 'Petty Cash' },
                ]).map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() => { setActiveType(type); setReason(''); setAmount(''); }}
                    className={`p-3 border-2 rounded-lg flex items-center gap-2 text-sm font-medium ${
                      activeType === type
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Movement Form */}
              {activeType && (
                <form onSubmit={handleSubmit} className="card space-y-3">
                  <h3 className="font-medium text-sm text-primary-600">
                    {MOVEMENT_LABELS[activeType].label}
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">£</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="input-field pl-8"
                        placeholder="0.00"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="input-field text-sm"
                      required
                    >
                      <option value="">Select reason...</option>
                      {REASON_CODES[activeType].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {reason === 'Other' && (
                    <div>
                      <input
                        type="text"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        className="input-field text-sm"
                        placeholder="Describe reason..."
                        required
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={processing || !amount || !reason}
                      className="flex-1 btn-primary"
                    >
                      {processing ? 'Recording...' : 'Record'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveType(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Movement History */}
            <div>
              <h2 className="font-semibold mb-3">Today's Movements</h2>
              {loading ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : movements.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No cash movements this session</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-auto">
                  {movements.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className={`text-sm font-medium ${MOVEMENT_LABELS[m.type]?.color || ''}`}>
                            {MOVEMENT_LABELS[m.type]?.label || m.type}
                          </p>
                          <p className="text-xs text-gray-500">{m.reason}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(m.createdAt).toLocaleTimeString('en-GB')} — {m.staffName}
                          </p>
                        </div>
                      </div>
                      <p className={`font-bold ${m.type === 'pay_in' ? 'text-success-600' : 'text-danger-600'}`}>
                        {m.type === 'pay_in' ? '+' : '-'}£{m.amount.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
