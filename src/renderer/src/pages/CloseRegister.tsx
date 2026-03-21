import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import TopBar from '../components/TopBar';
import { useRegisterStore } from '../stores/registerStore';
import { getApiErrorMessage } from '../lib/getErrorMessage';
import apiClient from '../lib/axios';

export default function CloseRegister() {
  const navigate = useNavigate();
  const session = useRegisterStore((state) => state.session);
  const clearSession = useRegisterStore((state) => state.clearSession);

  const [cashCount, setCashCount] = useState('');
  const [cardCount, setCardCount] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadXReport();
  }, []);

  const loadXReport = async () => {
    try {
      const response = await apiClient.get('/client/pos/register/x-report', {
        params: { sessionId: session?.id },
      });
      if (response.data.status) {
        setReport(response.data.report);
      }
    } catch (err) {
      console.error('Failed to load session summary:', err);
    }
  };

  const expectedCash = (() => {
    if (!report || !session) return 0;
    return session.openFloat + (report.cashSalesTotal || 0);
  })();

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/client/pos/register/close', {
        sessionId: session?.id,
        closeCash: parseFloat(cashCount) || 0,
        closeCard: parseFloat(cardCount) || 0,
      });

      if (response.data.status) {
        clearSession();
        navigate('/login');
      } else {
        setError(response.data.message || 'Failed to close register');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to close register'));
    } finally {
      setLoading(false);
    }
  };

  const variance = cashCount ? parseFloat(cashCount) - expectedCash : 0;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TopBar />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate('/')}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Close Register</h1>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {report && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="card">
                <p className="text-sm text-gray-500 mb-1">Gross Sales</p>
                <p className="text-2xl font-bold">£{(report.grossSales || 0).toFixed(2)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500 mb-1">Transactions</p>
                <p className="text-2xl font-bold">{report.transactionCount || 0}</p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500 mb-1">Cash Sales</p>
                <p className="text-2xl font-bold">£{(report.cashSalesTotal || 0).toFixed(2)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500 mb-1">Card Sales</p>
                <p className="text-2xl font-bold">£{(report.cardSalesTotal || 0).toFixed(2)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500 mb-1">Opening Float</p>
                <p className="text-2xl font-bold">£{(session?.openFloat || 0).toFixed(2)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500 mb-1">Expected Cash</p>
                <p className="text-2xl font-bold">£{expectedCash.toFixed(2)}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleCloseRegister} className="card">
            <h2 className="font-semibold mb-4">Cash Count</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Actual Cash in Drawer
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashCount}
                  onChange={(e) => setCashCount(e.target.value)}
                  className="input-field pl-8"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Card Takings (tally)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cardCount}
                  onChange={(e) => setCardCount(e.target.value)}
                  className="input-field pl-8"
                  placeholder="0.00"
                />
              </div>
            </div>

            {cashCount && (
              <div className={`p-4 rounded-lg mb-4 ${
                Math.abs(variance) < 0.01
                  ? 'bg-success-50 border border-success-200'
                  : 'bg-danger-50 border border-danger-200'
              }`}>
                <p className="text-sm font-medium mb-1">Cash Variance</p>
                <p className={`text-xl font-bold ${
                  variance >= 0 ? 'text-success-700' : 'text-danger-700'
                }`}>
                  {variance >= 0 ? '+' : ''}£{variance.toFixed(2)}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-danger w-full flex items-center justify-center gap-2"
            >
              <Lock className="w-5 h-5" />
              {loading ? 'Closing...' : 'Close Register'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
