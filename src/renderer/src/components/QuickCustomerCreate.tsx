import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import apiClient from '../lib/axios';
import { getApiErrorMessage } from '../lib/getErrorMessage';

interface QuickCustomerCreateProps {
  onClose: () => void;
}

export default function QuickCustomerCreate({ onClose }: QuickCustomerCreateProps) {
  const setCustomer = useCartStore((state) => state.setCustomer);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/client/pos/customer/quick-create', formData);
      if (response.data.status) {
        setCustomer(response.data.customer);
        onClose();
      } else {
        setError(response.data.message || 'Failed to create customer');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create customer'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed top-0 right-0 bottom-0 w-[400px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#E1E3E5]">
          <h2 className="text-xl font-semibold">New Customer</h2>
          <button onClick={onClose} className="text-[#8C9196] hover:text-[#202223]">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="m-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input-field"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-success w-full flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Creating...' : 'Create Customer'}
          </button>
        </form>
      </div>
    </div>
  );
}
