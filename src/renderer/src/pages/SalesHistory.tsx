import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { useRegisterStore } from '../stores/registerStore';
import apiClient from '../lib/axios';

export default function SalesHistory() {
  const navigate = useNavigate();
  const session = useRegisterStore((state) => state.session);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('session');

  useEffect(() => {
    loadSalesHistory();
  }, [dateFilter]);

  const loadSalesHistory = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };

      if (dateFilter === 'session' && session?.id) {
        params.sessionId = session.id;
      } else if (dateFilter === 'today') {
        const today = new Date();
        params.startDate = today.toISOString().slice(0, 10);
        params.endDate = today.toISOString().slice(0, 10);
      }

      const response = await apiClient.get('/client/pos/sale/history', { params });
      const data = response.data?.sales || response.data?.data || [];
      setSales(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load sales history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate('/')}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Sales History</h1>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by period
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input-field max-w-xs"
            >
              <option value="session">This Session</option>
              <option value="today">Today</option>
              <option value="all">All POS Sales</option>
            </select>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No sales found</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {sales.map((sale) => {
                const customerName = sale.customer
                  ? `${sale.customer.billingFirstName || ''} ${sale.customer.billingLastName || ''}`.trim()
                  : 'Walk-in';
                const itemCount = sale.orderProducts?.length || 0;

                return (
                  <div key={sale.id} className="card flex items-center justify-between">
                    <div>
                      <p className="font-medium">{sale.orderNumber}</p>
                      <p className="text-sm text-gray-500">
                        {customerName} - {itemCount} items - {sale.paymentMethod}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(sale.orderDate).toLocaleString('en-GB')}
                      </p>
                      <p className={`text-xs ${sale.status === 'cancelled' ? 'text-danger-600' : 'text-success-600'}`}>
                        {sale.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-bold">£{parseFloat(sale.totalPrice || 0).toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
