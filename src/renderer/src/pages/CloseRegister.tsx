import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, FileBarChart, Printer } from 'lucide-react';
import { useRegisterStore } from '../stores/registerStore';
import { useAuthStore } from '../stores/authStore';
import { getApiErrorMessage } from '../lib/getErrorMessage';
import apiClient from '../lib/axios';

interface ZReportData {
  grossSales: number;
  netSales: number;
  transactionCount: number;
  totalDiscounts: number;
  cashSalesTotal: number;
  cashSalesCount: number;
  cardSalesTotal: number;
  cardSalesCount: number;
  splitSalesTotal: number;
  splitSalesCount: number;
  returnsTotal: number;
  cashReturnsTotal?: number;
  returnsCount: number;
  voidsCount: number;
  cashIn?: number;
  cashOut?: number;
  // Enhanced Phase 2 fields
  taxBreakdown?: Array<{ name: string; rate: number; taxableAmount: number; taxAmount: number }>;
  discountBreakdown?: { lineDiscounts: number; cartDiscounts: number; total: number };
  hourlyBreakdown?: Array<{ hour: number; saleCount: number; saleTotal: number }>;
  topProducts?: Array<{ name: string; qty: number; total: number }>;
}

export default function CloseRegister() {
  const navigate = useNavigate();
  const session = useRegisterStore((state) => state.session);
  const clearSession = useRegisterStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);
  const terminalConfig = useAuthStore((state) => state.terminalConfig);

  const [cashCount, setCashCount] = useState('');
  const [cardCount, setCardCount] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [report, setReport] = useState<ZReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showZReport, setShowZReport] = useState(false);

  const varianceReasons = [
    'No variance',
    'Customer gave wrong change',
    'Cashier counting error',
    'Customer dispute',
    'Counterfeit note',
    'Rounding differences',
    'Other',
  ];

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
    const cashIn = report.cashIn || 0;
    const cashOut = report.cashOut || 0;
    const cashRefunds = report.cashReturnsTotal || report.returnsTotal || 0;
    return session.openFloat + (report.cashSalesTotal || 0) + cashIn - cashOut - cashRefunds;
  })();

  const variance = cashCount ? parseFloat(cashCount) - expectedCash : 0;
  const varianceAboveThreshold = Math.abs(variance) > 5; // £5 threshold

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Require reason if variance exceeds threshold
    if (varianceAboveThreshold && !varianceReason) {
      setError('Cash variance exceeds £5.00 — please provide a reason');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/client/pos/register/close', {
        sessionId: session?.id,
        closeCash: parseFloat(cashCount) || 0,
        closeCard: parseFloat(cardCount) || 0,
        cashVariance: variance,
        varianceReason: varianceAboveThreshold ? varianceReason : undefined,
        // Z-Report data sent for immutable storage
        zReportData: {
          ...report,
          openingFloat: session?.openFloat,
          closingCash: parseFloat(cashCount) || 0,
          expectedCash,
          cashDifference: variance,
          generatedBy: user?.id,
          terminalId: terminalConfig?.terminalId,
          warehouseId: terminalConfig?.warehouseId,
        },
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="btn-secondary flex items-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
              <h1 className="text-2xl font-bold text-gray-800">Close Register</h1>
            </div>
            <button
              onClick={() => setShowZReport(!showZReport)}
              className="btn-secondary flex items-center gap-2"
            >
              <FileBarChart className="w-4 h-4" />
              {showZReport ? 'Hide Z-Report' : 'View Z-Report'}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Summary Cards */}
          {report && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
                <p className="text-xs text-gray-400">{report.cashSalesCount || 0} transactions</p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500 mb-1">Card Sales</p>
                <p className="text-2xl font-bold">£{(report.cardSalesTotal || 0).toFixed(2)}</p>
                <p className="text-xs text-gray-400">{report.cardSalesCount || 0} transactions</p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500 mb-1">Returns</p>
                <p className="text-2xl font-bold text-danger-600">
                  £{(report.returnsTotal || 0).toFixed(2)}
                </p>
                <p className="text-xs text-gray-400">{report.returnsCount || 0} returns, {report.voidsCount || 0} voids</p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500 mb-1">Discounts Given</p>
                <p className="text-2xl font-bold text-warning-600">
                  £{(report.totalDiscounts || 0).toFixed(2)}
                </p>
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

          {/* Z-Report Detail */}
          {showZReport && report && (
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Z-Report Detail</h2>
                <button className="btn-secondary flex items-center gap-2 text-sm">
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Tax Breakdown */}
                {report.taxBreakdown && report.taxBreakdown.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Tax Breakdown</h3>
                    <div className="space-y-1">
                      {report.taxBreakdown.map((tax, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-600">{tax.name} ({(tax.rate * 100).toFixed(0)}%)</span>
                          <span>£{tax.taxAmount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Products */}
                {report.topProducts && report.topProducts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Top Products</h3>
                    <div className="space-y-1">
                      {report.topProducts.slice(0, 5).map((p, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-600 truncate flex-1 mr-2">{p.name}</span>
                          <span className="text-gray-400 mr-2">x{p.qty}</span>
                          <span>£{p.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hourly Breakdown */}
                {report.hourlyBreakdown && report.hourlyBreakdown.length > 0 && (
                  <div className="col-span-2">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Hourly Sales</h3>
                    <div className="grid grid-cols-6 gap-2">
                      {report.hourlyBreakdown
                        .filter((h) => h.saleCount > 0)
                        .map((h, i) => (
                          <div key={i} className="bg-gray-50 rounded p-2 text-center">
                            <p className="text-xs text-gray-500">{h.hour}:00</p>
                            <p className="font-medium text-sm">{h.saleCount}</p>
                            <p className="text-xs text-gray-400">£{h.saleTotal.toFixed(0)}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cash Count Form */}
          <form onSubmit={handleCloseRegister} className="card">
            <h2 className="font-semibold mb-4">Cash Count</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
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

              <div>
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
            </div>

            {cashCount && (
              <div className={`p-4 rounded-lg mb-4 ${
                Math.abs(variance) < 0.01
                  ? 'bg-success-50 border border-success-200'
                  : varianceAboveThreshold
                    ? 'bg-danger-50 border border-danger-200'
                    : 'bg-warning-50 border border-warning-200'
              }`}>
                <p className="text-sm font-medium mb-1">Cash Variance</p>
                <p className={`text-xl font-bold ${
                  Math.abs(variance) < 0.01
                    ? 'text-success-700'
                    : variance >= 0 ? 'text-warning-700' : 'text-danger-700'
                }`}>
                  {variance >= 0 ? '+' : ''}£{variance.toFixed(2)}
                </p>

                {varianceAboveThreshold && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Variance Reason <span className="text-danger-500">*</span>
                    </label>
                    <select
                      value={varianceReason}
                      onChange={(e) => setVarianceReason(e.target.value)}
                      className="input-field text-sm"
                      required
                    >
                      <option value="">Select reason...</option>
                      {varianceReasons.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (varianceAboveThreshold && !varianceReason)}
              className="btn-danger w-full flex items-center justify-center gap-2"
            >
              <Lock className="w-5 h-5" />
              {loading ? 'Closing...' : 'Close Register & Generate Z-Report'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
