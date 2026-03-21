import { useState } from 'react';
import { X, Search, UserPlus } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import QuickCustomerCreate from './QuickCustomerCreate';
import apiClient from '../lib/axios';

interface CustomerSearchProps {
  onClose: () => void;
}

export default function CustomerSearch({ onClose }: CustomerSearchProps) {
  const setCustomer = useCartStore((state) => state.setCustomer);
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const response = await apiClient.get('/client/customer/list', {
        params: { search: searchTerm, take: 20 },
      });
      const data = response.data?.data || response.data?.customers || response.data || [];
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to search customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = (customer: any) => {
    setCustomer({
      id: customer.id,
      name: `${customer.billingFirstName || customer.shippingFirstName || ''} ${customer.billingLastName || customer.shippingLastName || ''}`.trim(),
      email: customer.billingEmail || customer.shippingEmail || '',
      phone: customer.billingPhone || customer.shippingPhone || '',
    });
    onClose();
  };

  if (showCreate) {
    return <QuickCustomerCreate onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Customer Search</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, phone, or postcode..."
                className="input-field pl-10"
                autoFocus
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          <button
            onClick={() => setShowCreate(true)}
            className="btn-secondary w-full flex items-center justify-center gap-2 mt-3"
          >
            <UserPlus className="w-4 h-4" />
            Create New Customer
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {customers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Search for customers or create a new one</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map((customer) => {
                const name = `${customer.billingFirstName || customer.shippingFirstName || ''} ${customer.billingLastName || customer.shippingLastName || ''}`.trim();
                const email = customer.billingEmail || customer.shippingEmail || '';
                const phone = customer.billingPhone || customer.shippingPhone || '';
                return (
                  <button
                    key={customer.id}
                    onClick={() => handleSelectCustomer(customer)}
                    className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium">{name || 'Unnamed'}</p>
                    {email && <p className="text-sm text-gray-500">{email}</p>}
                    {phone && <p className="text-sm text-gray-500">{phone}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
