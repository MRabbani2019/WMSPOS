import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import TopBar from '../components/TopBar';
import apiClient from '../lib/axios';

export default function Returns() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      // Search POS sales history for the order
      const response = await apiClient.get('/client/pos/sale/history', {
        params: { search: searchTerm },
      });
      const data = response.data?.sales || response.data?.data || [];
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to search orders:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TopBar />

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
            <h1 className="text-2xl font-bold text-gray-800">Returns</h1>
          </div>

          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by order number (e.g. POS-20260320-A1B2)..."
                  className="input-field pl-10"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {orders.length > 0 && (
            <div className="grid gap-4">
              {orders.map((order) => {
                const customerName = order.customer
                  ? `${order.customer.billingFirstName || ''} ${order.customer.billingLastName || ''}`.trim()
                  : 'Walk-in';
                const itemCount = order.orderProducts?.length || 0;

                return (
                  <div key={order.id} className="card flex items-center justify-between">
                    <div>
                      <p className="font-medium">Order #{order.orderNumber}</p>
                      <p className="text-sm text-gray-500">{customerName}</p>
                      <p className="text-sm text-gray-500">
                        {itemCount} items - £{parseFloat(order.totalPrice || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.orderDate).toLocaleString('en-GB')}
                      </p>
                      <p className={`text-xs mt-1 ${order.status === 'cancelled' ? 'text-danger-600' : 'text-success-600'}`}>
                        {order.status}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/returns/${order.id}`)}
                      className="btn-primary"
                      disabled={order.status === 'cancelled'}
                    >
                      Process Return
                    </button>
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
