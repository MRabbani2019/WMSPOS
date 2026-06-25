import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, ShoppingBag, CheckCircle, Clock,
  AlertTriangle, User, MapPin, Package, X
} from 'lucide-react';
import apiClient from '../lib/axios';
import { getApiErrorMessage } from '../lib/getErrorMessage';

type BopisStatus = 'received' | 'picking' | 'ready' | 'partial_ready' | 'collected' | 'partial_collected' | 'cancelled' | 'expired';

interface BopisItem {
  orderProductId: number;
  variationId: number;
  name: string;
  sku: string;
  orderedQty: number;
  pickedQty: number;
  collectedQty: number;
  status: 'pending' | 'picked' | 'collected';
  pickLocation?: string;
}

interface BopisOrder {
  id: number;
  orderId: number;
  orderNumber: string;
  status: BopisStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  collectionCode: string;
  items: BopisItem[];
  createdAt: string;
  readyAt: string | null;
  expiresAt: string | null;
  notes: string | null;
}

const STATUS_CONFIG: Record<BopisStatus, { label: string; color: string; bg: string }> = {
  received: { label: 'Received', color: 'text-primary-700', bg: 'bg-primary-100' },
  picking: { label: 'Picking', color: 'text-warning-700', bg: 'bg-warning-100' },
  ready: { label: 'Ready', color: 'text-success-700', bg: 'bg-success-100' },
  partial_ready: { label: 'Partial Ready', color: 'text-warning-700', bg: 'bg-warning-100' },
  collected: { label: 'Collected', color: 'text-gray-700', bg: 'bg-gray-100' },
  partial_collected: { label: 'Partial Collected', color: 'text-primary-700', bg: 'bg-primary-100' },
  cancelled: { label: 'Cancelled', color: 'text-danger-700', bg: 'bg-danger-100' },
  expired: { label: 'Expired', color: 'text-danger-700', bg: 'bg-danger-100' },
};

export default function BOPIS() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<BopisOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<BopisStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<BopisOrder | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [verificationInput, setVerificationInput] = useState('');
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    loadOrders();
    // Poll every 30 seconds for new BOPIS orders
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    try {
      const response = await apiClient.get('/client/pos/bopis/orders');
      const data = response.data?.data || [];
      setOrders(data);
      return data;
    } catch (err) {
      console.error('Failed to load BOPIS orders:', err);
    } finally {
      setLoading(false);
    }
    return [];
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = !searchTerm ||
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.collectionCode.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = orders.filter((o) =>
    ['received', 'picking', 'ready', 'partial_ready'].includes(o.status)
  ).length;

  const handleVerify = () => {
    if (!selectedOrder) return;
    const phone = selectedOrder.customerPhone || '';
    const lastFour = phone.slice(-4);
    if (
      verificationInput === selectedOrder.collectionCode ||
      verificationInput === lastFour
    ) {
      setVerified(true);
      setError('');
    } else {
      setError('Verification failed. Please check the collection code or last 4 digits of phone number.');
    }
  };

  const handleMarkPicked = async (order: BopisOrder) => {
    setProcessing(true);
    try {
      await apiClient.post(`/client/pos/bopis/${order.id}/pick`);
      const refreshedOrders = await loadOrders();
      if (selectedOrder?.id === order.id) {
        const refreshed = refreshedOrders.find((o: BopisOrder) => o.id === order.id);
        if (refreshed) setSelectedOrder(refreshed);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update order'));
    } finally {
      setProcessing(false);
    }
  };

  const handleCollectItem = async (order: BopisOrder, itemId: number) => {
    setProcessing(true);
    try {
      await apiClient.post(`/client/pos/bopis/${order.id}/collect-item`, {
        orderProductId: itemId,
      });
      const refreshedOrders = await loadOrders();
      const refreshed = refreshedOrders.find((o: BopisOrder) => o.id === order.id);
      if (refreshed) setSelectedOrder(refreshed);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to collect item'));
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteCollection = async (order: BopisOrder) => {
    setProcessing(true);
    try {
      await apiClient.post(`/client/pos/bopis/${order.id}/complete`);
      await loadOrders();
      setSelectedOrder(null);
      setVerified(false);
      setVerificationInput('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to complete collection'));
    } finally {
      setProcessing(false);
    }
  };

  const getDaysUntilExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

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
              <h1 className="text-2xl font-bold text-gray-800">Click & Collect</h1>
              <p className="text-sm text-gray-500">{pendingCount} orders pending</p>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by order number, name, or pickup code..."
                className="input-field pl-10"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as BopisStatus | 'all')}
              className="input-field w-auto"
            >
              <option value="all">All Status</option>
              <option value="received">Received</option>
              <option value="picking">Picking</option>
              <option value="ready">Ready</option>
              <option value="partial_collected">Partial Collected</option>
              <option value="collected">Collected</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {/* Orders */}
          {loading ? (
            <p className="text-gray-500 text-center py-8">Loading orders...</p>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No BOPIS orders found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const statusCfg = STATUS_CONFIG[order.status];
                const daysToExpiry = getDaysUntilExpiry(order.expiresAt);
                return (
                  <div
                    key={order.id}
                    onClick={() => { setSelectedOrder(order); setVerified(false); setVerificationInput(''); setError(''); }}
                    className={`card cursor-pointer hover:shadow-md transition-shadow ${
                      selectedOrder?.id === order.id ? 'ring-2 ring-primary-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">{order.orderNumber}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color} ${statusCfg.bg}`}>
                            {statusCfg.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <User className="w-3 h-3" /> {order.customerName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {order.items.length} items | Code: {order.collectionCode}
                        </p>
                        <p className="text-xs text-gray-400">
                          Placed: {new Date(order.createdAt).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <div className="text-right">
                        {daysToExpiry !== null && daysToExpiry <= 2 && order.status !== 'collected' && (
                          <div className="flex items-center gap-1 text-danger-600 text-xs mb-1">
                            <AlertTriangle className="w-3 h-3" />
                            {daysToExpiry <= 0 ? 'Expired' : `Expires in ${daysToExpiry}d`}
                          </div>
                        )}
                        {order.status === 'ready' && (
                          <span className="text-xs text-success-600">
                            Ready since {order.readyAt ? new Date(order.readyAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Order Detail Panel */}
        {selectedOrder && (
          <div className="w-[420px] border-l border-gray-200 bg-white overflow-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{selectedOrder.orderNumber}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[selectedOrder.status].color} ${STATUS_CONFIG[selectedOrder.status].bg}`}>
                  {STATUS_CONFIG[selectedOrder.status].label}
                </span>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="p-2 bg-danger-50 border border-danger-200 text-danger-700 rounded text-sm">{error}</div>
              )}

              {/* Paid Online Notice */}
              <div className="bg-success-50 border border-success-200 rounded-lg p-3 text-center">
                <p className="text-success-700 font-medium text-sm">Paid Online - No Payment Required</p>
              </div>

              {/* Customer Info */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="font-medium text-sm">{selectedOrder.customerName}</p>
                <p className="text-xs text-gray-500">{selectedOrder.customerPhone}</p>
                <p className="text-xs text-gray-500">{selectedOrder.customerEmail}</p>
              </div>

              {/* Identity Verification */}
              {!verified && ['ready', 'partial_ready', 'partial_collected'].includes(selectedOrder.status) && (
                <div className="border border-warning-200 bg-warning-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-warning-800 mb-2">Verify Customer Identity</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={verificationInput}
                      onChange={(e) => setVerificationInput(e.target.value)}
                      placeholder="Pickup code or last 4 of phone"
                      className="input-field text-sm flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                    />
                    <button onClick={handleVerify} className="btn-primary text-sm">Verify</button>
                  </div>
                </div>
              )}

              {verified && (
                <div className="flex items-center gap-2 text-success-700 bg-success-50 rounded-lg p-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Identity Verified</span>
                </div>
              )}

              {/* Items */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Order Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.orderProductId} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.sku}</p>
                          {item.pickLocation && (
                            <p className="text-xs text-primary-600 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" /> {item.pickLocation}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm">Qty: {item.orderedQty}</p>
                          {item.status === 'collected' ? (
                            <span className="text-xs text-success-600 flex items-center gap-0.5">
                              <CheckCircle className="w-3 h-3" /> Collected
                            </span>
                          ) : item.status === 'picked' ? (
                            <span className="text-xs text-primary-600">Picked</span>
                          ) : (
                            <span className="text-xs text-gray-400">Pending</span>
                          )}
                        </div>
                      </div>

                      {verified && item.status !== 'collected' && (
                        <button
                          onClick={() => handleCollectItem(selectedOrder, item.orderProductId)}
                          disabled={processing}
                          className="btn-success text-xs w-full mt-2"
                        >
                          Mark Collected
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2 border-t border-gray-200">
                {['received', 'picking'].includes(selectedOrder.status) && (
                  <button
                    onClick={() => handleMarkPicked(selectedOrder)}
                    disabled={processing}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Package className="w-4 h-4" />
                    {processing ? 'Updating...' : 'Mark as Ready for Collection'}
                  </button>
                )}

                {verified && selectedOrder.items.every((i) => i.status === 'collected') && (
                  <button
                    onClick={() => handleCompleteCollection(selectedOrder)}
                    disabled={processing}
                    className="btn-success w-full flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {processing ? 'Completing...' : 'Complete Collection'}
                  </button>
                )}
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-600 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
