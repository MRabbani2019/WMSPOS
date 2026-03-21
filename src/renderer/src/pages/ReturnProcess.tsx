import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import TopBar from '../components/TopBar';
import apiClient from '../lib/axios';
import { getApiErrorMessage } from '../lib/getErrorMessage';

export default function ReturnProcess() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      // Use the order detail endpoint
      const response = await apiClient.get(`/client/order/${orderId}`);
      const data = response.data?.order || response.data?.data || response.data;
      setOrder(data);
    } catch (err) {
      console.error('Failed to load order:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleVoidSale = async () => {
    if (!confirm('Are you sure you want to void this sale? Stock will be restored.')) return;

    setProcessing(true);
    setError('');
    try {
      const response = await apiClient.post(`/client/pos/sale/${orderId}/void`);
      if (response.data.status) {
        navigate('/returns');
      } else {
        setError(response.data.message || 'Failed to void sale');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to process return'));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <TopBar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const items = order?.orderProducts || order?.items || [];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TopBar />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate('/returns')}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Process Return</h1>
              <p className="text-sm text-gray-500">Order #{order?.orderNumber}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="card mb-6">
            <h2 className="font-semibold mb-4">Order Items</h2>
            <div className="space-y-2">
              {items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{item.name || item.sku || 'Product'}</p>
                    <p className="text-sm text-gray-500">
                      Qty: {item.quantity} x £{parseFloat(item.price || 0).toFixed(2)}
                    </p>
                  </div>
                  <p className="font-medium">
                    £{(parseFloat(item.price || 0) * (item.quantity || 1)).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg">
                £{parseFloat(order?.totalPrice || 0).toFixed(2)}
              </span>
            </div>
          </div>

          <button
            onClick={handleVoidSale}
            disabled={processing || order?.status === 'cancelled'}
            className="btn-danger w-full flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {processing ? 'Processing...' : 'Void Sale & Restore Stock'}
          </button>

          {order?.status === 'cancelled' && (
            <p className="text-center text-danger-600 mt-3 text-sm">This sale has already been voided.</p>
          )}
        </div>
      </div>
    </div>
  );
}
