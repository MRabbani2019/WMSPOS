import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, LogIn } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useRegisterStore } from '../stores/registerStore';
import { getApiErrorMessage } from '../lib/getErrorMessage';
import apiClient from '../lib/axios';

export default function OpenRegister() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const terminalConfig = useAuthStore((state) => state.terminalConfig);
  const setSession = useRegisterStore((state) => state.setSession);

  const [openFloat, setOpenFloat] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  // Check for existing active session on mount — resume if found
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const response = await apiClient.get('/client/pos/register/active', {
          params: { terminalId: terminalConfig?.terminalId },
        });
        if (response.data.status && response.data.session) {
          const s = response.data.session;
          setSession({
            id: s.id,
            openFloat: parseFloat(s.openFloat) || 0,
            openedAt: s.openedAt,
          });
          navigate('/');
          return;
        }
      } catch {
        // No active session or API unreachable — show the form
      } finally {
        setChecking(false);
      }
    };
    checkActiveSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/client/pos/register/open', {
        terminalId: terminalConfig?.terminalId,
        openFloat: parseFloat(openFloat),
      });

      if (response.data.status) {
        setSession({
          id: response.data.session.id,
          openFloat: parseFloat(openFloat),
          openedAt: response.data.session.openedAt,
        });
        navigate('/');
      } else {
        setError(response.data.message || 'Failed to open register');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to open register'));
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-success-600 to-success-800">
        <p className="text-white text-lg">Checking register status...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-success-600 to-success-800">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="w-8 h-8 text-success-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Open Register</h1>
            <p className="text-sm text-gray-500">
              {user?.firstName} {user?.lastName} - {terminalConfig?.terminalName}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opening Float
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">£</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={openFloat}
                onChange={(e) => setOpenFloat(e.target.value)}
                className="input-field pl-8"
                placeholder="0.00"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Enter the amount of cash in the register to start the day
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-success w-full flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            {loading ? 'Opening...' : 'Open Register'}
          </button>
        </form>
      </div>
    </div>
  );
}
