import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Truck, Package, CheckCircle, X, Clock,
  MapPin, Printer, AlertTriangle
} from 'lucide-react';
import apiClient from '../lib/axios';
import { getApiErrorMessage } from '../lib/getErrorMessage';

type ShipStatus = 'pending' | 'accepted' | 'picking' | 'packed' | 'shipped' | 'rejected';

interface ShipItem {
  id: number;
  variationId: number;
  name: string;
  sku: string;
  quantity: number;
  pickLocation: string;
  picked: boolean;
}

interface ShipOrder {
  id: number;
  orderId: number;
  orderNumber: string;
  status: ShipStatus;
  customerName: string;
  customerAddress: string;
  items: ShipItem[];
  acceptDeadline: string;
  createdAt: string;
  shippedAt: string | null;
  trackingNumber: string | null;
  courierName: string | null;
}

const STATUS_BADGE: Record<ShipStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-warning-700', bg: 'bg-warning-100' },
  accepted: { label: 'Accepted', color: 'text-primary-700', bg: 'bg-primary-100' },
  picking: { label: 'Picking', color: 'text-primary-700', bg: 'bg-primary-100' },
  packed: { label: 'Packed', color: 'text-success-700', bg: 'bg-success-100' },
  shipped: { label: 'Shipped', color: 'text-gray-700', bg: 'bg-gray-100' },
  rejected: { label: 'Rejected', color: 'text-danger-700', bg: 'bg-danger-100' },
};

export default function ShipFromStore() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ShipOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ShipOrder | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    try {
      const response = await apiClient.get('/client/pos/ship-from-store/orders');
      const data = response.data?.data || [];
      setOrders(data);
      return data;
    } catch (err) {
      console.error('Failed to load ship-from-store orders:', err);
    } finally {
      setLoading(false);
    }
    return [];
  };

  const handleAccept = async (order: ShipOrder) => {
    setProcessing(true);
    setError('');
    try {
      await apiClient.post(`/client/pos/ship-from-store/${order.id}/accept`);
      await loadOrders();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to accept order'));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (order: ShipOrder) => {
    if (!rejectReason) {
      setError('Please provide a reason for rejecting');
      return;
    }
    setProcessing(true);
    setError('');
    try {
      await apiClient.post(`/client/pos/ship-from-store/${order.id}/reject`, {
        reason: rejectReason,
      });
      setShowReject(false);
      setRejectReason('');
      await loadOrders();
      setSelected(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to reject order'));
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPicked = async (order: ShipOrder, itemId: number) => {
    try {
      await apiClient.post(`/client/pos/ship-from-store/${order.id}/pick-item`, {
        itemId,
      });
      const refreshedOrders = await loadOrders();
      const refreshed = refreshedOrders.find((o: ShipOrder) => o.id === order.id);
      if (refreshed) setSelected(refreshed);
    } catch (err) {
      console.error('Failed to mark item picked:', err);
    }
  };

  const handleMarkPacked = async (order: ShipOrder) => {
    setProcessing(true);
    try {
      await apiClient.post(`/client/pos/ship-from-store/${order.id}/pack`);
      await loadOrders();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to mark as packed'));
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateLabel = async (order: ShipOrder) => {
    setProcessing(true);
    try {
      const response = await apiClient.post(`/client/pos/ship-from-store/${order.id}/generate-label`);
      if (response.data?.trackingNumber) {
        await loadOrders();
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to generate shipping label'));
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkShipped = async (order: ShipOrder) => {
    setProcessing(true);
    try {
      await apiClient.post(`/client/pos/ship-from-store/${order.id}/ship`);
      await loadOrders();
      setSelected(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to mark as shipped'));
    } finally {
      setProcessing(false);
    }
  };

  const getTimeRemaining = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return 'Overdue';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="flex-1 flex overflow-hidden">
        {/* Order List */}
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => navigate('/')} className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Ship from Store</h1>
              <p className="text-sm text-gray-500">
                {pendingCount > 0 ? `${pendingCount} orders awaiting acceptance` : 'No pending orders'}
              </p>
            </div>
          </div>

          {error && !selected && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">{error}</div>
          )}

          {loading ? (
            <p className="text-gray-500 text-center py-8">Loading...</p>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No ship-from-store orders</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const badge = STATUS_BADGE[order.status];
                return (
                  <div
                    key={order.id}
                    onClick={() => { setSelected(order); setError(''); setShowReject(false); }}
                    className={`card cursor-pointer hover:shadow-md transition-shadow ${
                      selected?.id === order.id ? 'ring-2 ring-primary-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">{order.orderNumber}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color} ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{order.customerName}</p>
                        <p className="text-xs text-gray-400">{order.items.length} items</p>
                      </div>
                      {order.status === 'pending' && (
                        <div className="flex items-center gap-1 text-warning-600 text-xs">
                          <Clock className="w-3 h-3" />
                          {getTimeRemaining(order.acceptDeadline)}
                        </div>
                      )}
                      {order.trackingNumber && (
                        <p className="text-xs text-gray-500">
                          {order.courierName}: {order.trackingNumber}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-[420px] border-l border-gray-200 bg-white overflow-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{selected.orderNumber}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[selected.status].color} ${STATUS_BADGE[selected.status].bg}`}>
                  {STATUS_BADGE[selected.status].label}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="p-2 bg-danger-50 border border-danger-200 text-danger-700 rounded text-sm">{error}</div>
              )}

              {/* Shipping Address */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Ship To</p>
                <p className="text-sm font-medium">{selected.customerName}</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{selected.customerAddress}</p>
              </div>

              {/* Pick List */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Pick List</h3>
                <div className="space-y-2">
                  {selected.items.map((item) => (
                    <div key={item.id} className={`border rounded-lg p-3 ${item.picked ? 'border-success-200 bg-success-50/50' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.sku} | Qty: {item.quantity}</p>
                          <p className="text-xs text-primary-600 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {item.pickLocation}
                          </p>
                        </div>
                        {item.picked ? (
                          <CheckCircle className="w-5 h-5 text-success-600" />
                        ) : ['accepted', 'picking'].includes(selected.status) ? (
                          <button
                            onClick={() => handleMarkPicked(selected, item.id)}
                            className="btn-secondary text-xs"
                          >
                            Pick
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2 border-t border-gray-200">
                {selected.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleAccept(selected)}
                      disabled={processing}
                      className="btn-success w-full"
                    >
                      {processing ? 'Accepting...' : 'Accept Order'}
                    </button>
                    {!showReject ? (
                      <button
                        onClick={() => setShowReject(true)}
                        className="btn-danger w-full"
                      >
                        Reject Order
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <select
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="input-field text-sm"
                        >
                          <option value="">Select reason...</option>
                          <option value="Item not found in store">Item not found in store</option>
                          <option value="Item damaged">Item damaged</option>
                          <option value="Insufficient stock">Insufficient stock</option>
                          <option value="Store too busy">Store too busy</option>
                        </select>
                        <button
                          onClick={() => handleReject(selected)}
                          disabled={processing || !rejectReason}
                          className="btn-danger w-full"
                        >
                          Confirm Reject
                        </button>
                      </div>
                    )}
                  </>
                )}

                {['accepted', 'picking'].includes(selected.status) && selected.items.every((i) => i.picked) && (
                  <button
                    onClick={() => handleMarkPacked(selected)}
                    disabled={processing}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Package className="w-4 h-4" />
                    Mark as Packed
                  </button>
                )}

                {selected.status === 'packed' && !selected.trackingNumber && (
                  <button
                    onClick={() => handleGenerateLabel(selected)}
                    disabled={processing}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Generate Shipping Label
                  </button>
                )}

                {selected.status === 'packed' && selected.trackingNumber && (
                  <button
                    onClick={() => handleMarkShipped(selected)}
                    disabled={processing}
                    className="btn-success w-full flex items-center justify-center gap-2"
                  >
                    <Truck className="w-4 h-4" />
                    Mark as Shipped
                  </button>
                )}

                {selected.trackingNumber && (
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <p className="text-xs text-gray-500">Tracking</p>
                    <p className="text-sm font-medium">{selected.courierName}: {selected.trackingNumber}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
