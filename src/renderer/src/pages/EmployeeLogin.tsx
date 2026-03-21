import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, User } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import apiClient from '../lib/axios';
import { getApiErrorMessage } from '../lib/getErrorMessage';

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const terminalConfig = useAuthStore((state) => state.terminalConfig);

  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim()) return;

    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/client/login-with-id', {
        employeeId: employeeId.trim(),
      });

      if (response.data.status === 200) {
        setAuth(response.data.access_token, response.data.user);
        navigate('/open-register');
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">COMBOSOFT POS</h1>
          <p className="text-sm text-gray-500 mt-1">
            {terminalConfig?.terminalName} — {terminalConfig?.warehouseName}
          </p>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <User className="w-8 h-8 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-800">Enter Employee ID</h2>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="input-field text-center text-2xl tracking-widest"
              placeholder="EMP042"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || !employeeId.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 h-14 text-lg"
          >
            <LogIn className="w-5 h-5" />
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-gray-400">
          {dateStr} {timeStr}
        </div>
      </div>
    </div>
  );
}
