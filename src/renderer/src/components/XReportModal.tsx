import { useState, useEffect } from 'react';
import { X, FileBarChart } from 'lucide-react';
import { useRegisterStore } from '../stores/registerStore';
import apiClient from '../lib/axios';

interface XReportModalProps {
  onClose: () => void;
}

export default function XReportModal({ onClose }: XReportModalProps) {
  const session = useRegisterStore((state) => state.session);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      const response = await apiClient.get('/client/pos/register/x-report', {
        params: { sessionId: session?.id },
      });
      if (response.data.status) {
        setReport(response.data.report);
      }
    } catch (error) {
      console.error('Failed to load X report:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-primary-600" />
            <h2 className="text-xl font-semibold">X Report</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading report...</p>
            </div>
          ) : report ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="card">
                  <p className="text-sm text-gray-500 mb-1">Gross Sales</p>
                  <p className="text-2xl font-bold">£{(report.grossSales || 0).toFixed(2)}</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500 mb-1">Transactions</p>
                  <p className="text-2xl font-bold">{report.transactionCount || 0}</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500 mb-1">Net Sales</p>
                  <p className="text-2xl font-bold">£{(report.netSales || 0).toFixed(2)}</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500 mb-1">Total Discounts</p>
                  <p className="text-2xl font-bold">£{(report.totalDiscounts || 0).toFixed(2)}</p>
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold mb-3">Payment Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cash ({report.cashSalesCount || 0} sales)</span>
                    <span className="font-medium">£{(report.cashSalesTotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Card ({report.cardSalesCount || 0} sales)</span>
                    <span className="font-medium">£{(report.cardSalesTotal || 0).toFixed(2)}</span>
                  </div>
                  {(report.splitSalesCount || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Split ({report.splitSalesCount} sales)</span>
                      <span className="font-medium">£{(report.splitSalesTotal || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold mb-3">Returns & Voids</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Returns ({report.returnsCount || 0})</span>
                    <span className="font-medium text-danger-600">
                      -£{(report.returnsTotal || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Voids</span>
                    <span className="font-medium">{report.voidsCount || 0}</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold mb-3">Session Info</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Opening Float</span>
                    <span className="font-medium">£{(session?.openFloat || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Opened At</span>
                    <span className="font-medium">
                      {session?.openedAt ? new Date(session.openedAt).toLocaleString('en-GB') : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
