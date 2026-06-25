import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Trash2 } from 'lucide-react';
import { useRegisterStore } from '../stores/registerStore';
import { useCartStore } from '../stores/cartStore';
import apiClient from '../lib/axios';

export default function HeldTransactions() {
  const navigate = useNavigate();
  const session = useRegisterStore((state) => state.session);
  const { clearCart, addItem, setCustomer } = useCartStore();
  const [heldTransactions, setHeldTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHeldTransactions();
  }, []);

  const loadHeldTransactions = async () => {
    try {
      const response = await apiClient.get('/client/pos/sale/held', {
        params: { sessionId: session?.id },
      });
      const data = response.data?.held || response.data?.data || [];
      setHeldTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load held transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async (transactionId: number) => {
    try {
      const response = await apiClient.post(`/client/pos/sale/held/${transactionId}/recall`);
      if (response.data.status) {
        // Restore cart from held transaction
        const cartData = response.data.cartJSON;
        if (cartData) {
          clearCart();
          const parsed = typeof cartData === 'string' ? JSON.parse(cartData) : cartData;
          if (parsed.items) {
            parsed.items.forEach((item: any) => addItem(item));
          }
          if (parsed.customer) {
            setCustomer(parsed.customer);
          }
        }
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to recall transaction:', error);
    }
  };

  const handleDelete = async (transactionId: number) => {
    if (!confirm('Are you sure you want to delete this held transaction?')) return;

    try {
      await apiClient.delete(`/client/pos/sale/held/${transactionId}`);
      loadHeldTransactions();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
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
            <h1 className="text-2xl font-bold text-gray-800">Held Transactions</h1>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : heldTransactions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No held transactions</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {heldTransactions.map((transaction) => {
                const cart = typeof transaction.cartJSON === 'string'
                  ? JSON.parse(transaction.cartJSON)
                  : transaction.cartJSON;
                const itemCount = cart?.items?.length || 0;
                const total = cart?.items?.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0) || 0;
                const heldBy = transaction.HeldBy
                  ? `${transaction.HeldBy.firstName} ${transaction.HeldBy.lastName}`
                  : '';
                const customerName = transaction.Customer
                  ? `${transaction.Customer.billingFirstName} ${transaction.Customer.billingLastName}`
                  : '';

                return (
                  <div key={transaction.id} className="card flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        Transaction #{transaction.id}
                        {customerName && <span className="text-gray-500 ml-2">- {customerName}</span>}
                      </p>
                      <p className="text-sm text-gray-500">
                        {itemCount} items - £{total.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {heldBy && `${heldBy} - `}
                        {new Date(transaction.heldAt).toLocaleString('en-GB')}
                      </p>
                      {transaction.note && (
                        <p className="text-xs text-gray-400 mt-1">Note: {transaction.note}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResume(transaction.id)}
                        className="btn-primary"
                      >
                        Resume
                      </button>
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        className="btn-danger flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
