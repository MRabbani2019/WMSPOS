import { useState } from 'react';
import { X, UserCheck } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import apiClient from '../lib/axios';

interface EmployeeDiscountModalProps {
  onClose: () => void;
}

export default function EmployeeDiscountModal({ onClose }: EmployeeDiscountModalProps) {
  const setDiscount = useCartStore((state) => state.setDiscount);
  const [employeeId, setEmployeeId] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [staffInfo, setStaffInfo] = useState<{
    name: string;
    discountPercent: number;
    monthlyLimit: number;
    monthlyUsed: number;
  } | null>(null);

  const handleLookup = async () => {
    if (!employeeId.trim()) return;
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.get(`/client/pos/employee-discount/${employeeId}`);
      const data = response.data?.data || response.data;
      if (data && data.discountPercent > 0) {
        setStaffInfo({
          name: data.name,
          discountPercent: data.discountPercent,
          monthlyLimit: data.monthlyLimit || 0,
          monthlyUsed: data.monthlyUsed || 0,
        });
      } else {
        setError('No employee discount configured for this ID');
      }
    } catch (err) {
      setError('Employee not found or not eligible for staff discount');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!staffInfo || !managerPin) {
      setError('Manager PIN required to approve staff discount');
      return;
    }

    // Check monthly limit
    if (staffInfo.monthlyLimit > 0 && staffInfo.monthlyUsed >= staffInfo.monthlyLimit) {
      setError(`Monthly staff discount limit reached (£${staffInfo.monthlyLimit.toFixed(2)})`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Validate manager PIN
      const response = await apiClient.post('/client/pos/discount/validate-override', {
        pin: managerPin,
        type: 'staff_discount',
        employeeId,
      });

      if (response.data.status) {
        setDiscount({
          type: 'percentage',
          value: staffInfo.discountPercent,
          reason: `Staff Purchase — ${staffInfo.name} (ID: ${employeeId})`,
        });
        onClose();
      } else {
        setError(response.data.message || 'Invalid manager PIN');
      }
    } catch (err) {
      setError('Failed to validate manager approval');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed top-0 right-0 bottom-0 w-[480px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#E1E3E5]">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold">Employee Discount</h2>
          </div>
          <button onClick={onClose} className="text-[#8C9196] hover:text-[#202223]">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-auto">
          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Employee Lookup */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={employeeId}
                onChange={(e) => { setEmployeeId(e.target.value); setError(''); }}
                className="input-field flex-1"
                placeholder="Enter employee ID..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              />
              <button
                onClick={handleLookup}
                disabled={loading || !employeeId.trim()}
                className="btn-primary"
              >
                {loading ? '...' : 'Lookup'}
              </button>
            </div>
          </div>

          {/* Staff Info */}
          {staffInfo && (
            <>
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <p className="font-medium">{staffInfo.name}</p>
                <p className="text-sm text-primary-700">Discount: {staffInfo.discountPercent}%</p>
                {staffInfo.monthlyLimit > 0 && (
                  <p className="text-xs text-primary-600 mt-1">
                    Monthly usage: £{staffInfo.monthlyUsed.toFixed(2)} / £{staffInfo.monthlyLimit.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Manager Approval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manager PIN (required)
                </label>
                <input
                  type="password"
                  value={managerPin}
                  onChange={(e) => { setManagerPin(e.target.value); setError(''); }}
                  className="input-field"
                  placeholder="Enter manager PIN..."
                  maxLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Staff cannot apply their own discount. Manager confirmation required.
                </p>
              </div>

              <button
                onClick={handleApply}
                disabled={loading || !managerPin}
                className="btn-success w-full"
              >
                {loading ? 'Verifying...' : `Apply ${staffInfo.discountPercent}% Staff Discount`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
