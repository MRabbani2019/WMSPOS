import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, ShoppingCart, Users, DollarSign,
  BarChart3, Clock
} from 'lucide-react';
import apiClient from '../lib/axios';

interface DashboardData {
  todaySales: number;
  todayTransactions: number;
  todayAvgBasket: number;
  todayCustomers: number;
  todayRefunds: number;
  todayDiscounts: number;
  hourlyData: Array<{ hour: number; sales: number; transactions: number }>;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
  paymentBreakdown: { cash: number; card: number; split: number; giftCard: number; storeCredit: number };
  staffPerformance: Array<{ name: string; transactions: number; sales: number; avgBasket: number }>;
  weekComparison: { thisWeek: number; lastWeek: number; change: number };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    loadDashboard();
  }, [period]);

  const emptyDashboard: DashboardData = {
    todaySales: 0, todayTransactions: 0, todayAvgBasket: 0,
    todayCustomers: 0, todayRefunds: 0, todayDiscounts: 0,
    hourlyData: [], topProducts: [],
    paymentBreakdown: { cash: 0, card: 0, split: 0, giftCard: 0, storeCredit: 0 },
    staffPerformance: [],
    weekComparison: { thisWeek: 0, lastWeek: 0, change: 0 },
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/client/pos/dashboard', { params: { period } });
      const result = response.data?.data || response.data;
      setData(result && typeof result === 'object' && 'todaySales' in result ? result : emptyDashboard);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setData(emptyDashboard);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => `£${(val || 0).toFixed(2)}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/')} className="btn-secondary flex items-center gap-2">
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
              <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['today', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    period === p ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-gray-500 text-center py-12">Loading dashboard...</p>
          ) : !data ? (
            <p className="text-gray-500 text-center py-12">No data available</p>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <div className="card">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-success-600" />
                    <p className="text-xs text-gray-500">Sales</p>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(data.todaySales)}</p>
                </div>
                <div className="card">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="w-4 h-4 text-primary-600" />
                    <p className="text-xs text-gray-500">Transactions</p>
                  </div>
                  <p className="text-xl font-bold">{data.todayTransactions}</p>
                </div>
                <div className="card">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-primary-600" />
                    <p className="text-xs text-gray-500">Avg Basket</p>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(data.todayAvgBasket)}</p>
                </div>
                <div className="card">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-primary-600" />
                    <p className="text-xs text-gray-500">Customers</p>
                  </div>
                  <p className="text-xl font-bold">{data.todayCustomers}</p>
                </div>
                <div className="card">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-danger-600" />
                    <p className="text-xs text-gray-500">Refunds</p>
                  </div>
                  <p className="text-xl font-bold text-danger-600">{formatCurrency(data.todayRefunds)}</p>
                </div>
                <div className="card">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-warning-600" />
                    <p className="text-xs text-gray-500">Discounts</p>
                  </div>
                  <p className="text-xl font-bold text-warning-600">{formatCurrency(data.todayDiscounts)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Hourly Sales */}
                {data.hourlyData && data.hourlyData.length > 0 && (
                  <div className="card">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Hourly Sales
                    </h3>
                    <div className="flex items-end gap-1 h-32">
                      {data.hourlyData
                        .filter((h) => h.sales > 0 || h.transactions > 0)
                        .map((h) => {
                          const maxSales = Math.max(...data.hourlyData.map((d) => d.sales), 1);
                          const height = (h.sales / maxSales) * 100;
                          return (
                            <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                              <div
                                className="w-full bg-primary-500 rounded-t min-h-[2px]"
                                style={{ height: `${Math.max(height, 2)}%` }}
                                title={`${h.hour}:00 — £${h.sales.toFixed(0)} (${h.transactions} txn)`}
                              />
                              <span className="text-[10px] text-gray-400">{h.hour}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Payment Breakdown */}
                <div className="card">
                  <h3 className="font-semibold mb-3">Payment Methods</h3>
                  <div className="space-y-2">
                    {Object.entries(data.paymentBreakdown).map(([method, amount]) => {
                      const total = Object.values(data.paymentBreakdown).reduce((s, v) => s + v, 0);
                      const pct = total > 0 ? (amount / total) * 100 : 0;
                      return (
                        <div key={method}>
                          <div className="flex justify-between text-sm mb-0.5">
                            <span className="capitalize text-gray-600">{method.replace(/([A-Z])/g, ' $1')}</span>
                            <span className="font-medium">{formatCurrency(amount)} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Top Products */}
                {data.topProducts && data.topProducts.length > 0 && (
                  <div className="card">
                    <h3 className="font-semibold mb-3">Top Products</h3>
                    <div className="space-y-2">
                      {data.topProducts.slice(0, 10).map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                              {i + 1}
                            </span>
                            <span className="truncate">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-4 ml-2">
                            <span className="text-gray-400 text-xs">x{p.qty}</span>
                            <span className="font-medium">{formatCurrency(p.revenue)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Staff Performance */}
                {data.staffPerformance && data.staffPerformance.length > 0 && (
                  <div className="card">
                    <h3 className="font-semibold mb-3">Staff Performance</h3>
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 border-b border-gray-100">
                            <th className="text-left py-2 font-medium">Staff</th>
                            <th className="text-right py-2 font-medium">Txn</th>
                            <th className="text-right py-2 font-medium">Sales</th>
                            <th className="text-right py-2 font-medium">Avg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.staffPerformance.map((s, i) => (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="py-2">{s.name}</td>
                              <td className="py-2 text-right">{s.transactions}</td>
                              <td className="py-2 text-right font-medium">{formatCurrency(s.sales)}</td>
                              <td className="py-2 text-right text-gray-500">{formatCurrency(s.avgBasket)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Week Comparison */}
              {data.weekComparison && (
                <div className="mt-6 card flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Week-over-week comparison</p>
                    <p className="text-lg font-bold">
                      This week: {formatCurrency(data.weekComparison.thisWeek)} vs Last week: {formatCurrency(data.weekComparison.lastWeek)}
                    </p>
                  </div>
                  <div className={`text-lg font-bold ${data.weekComparison.change >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {data.weekComparison.change >= 0 ? '+' : ''}{data.weekComparison.change.toFixed(1)}%
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
