import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Save, LogIn } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import apiClient from '../lib/axios';
import { getApiErrorMessage } from '../lib/getErrorMessage';

export default function TerminalSetup() {
  const navigate = useNavigate();
  const { setTerminalConfig, setAuth, token } = useAuthStore();

  // Step 1: Manager login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Step 2: Terminal config
  const [terminalName, setTerminalName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load warehouses after login
  useEffect(() => {
    if (isLoggedIn && token) {
      loadWarehouses();
    }
  }, [isLoggedIn, token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoginLoading(true);

    try {
      const response = await apiClient.post('/client/login', { email, password });
      if (response.data.status === 200) {
        setAuth(response.data.access_token, response.data.user);
        setIsLoggedIn(true);
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Login failed'));
    } finally {
      setLoginLoading(false);
    }
  };

  const loadWarehouses = async () => {
    try {
      const response = await apiClient.get('/client/warehouse');
      const data = response.data?.data || response.data?.warehouses || response.data || [];
      setWarehouses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load warehouses:', err);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const registerResponse = await apiClient.post('/client/pos/terminal/register', {
        name: terminalName,
        warehouseId: parseInt(warehouseId),
      });

      const terminal = registerResponse.data.terminal;
      const config = {
        terminalId: terminal.id,
        terminalName: terminal.name,
        warehouseId: terminal.warehouseId,
        warehouseName: terminal.warehouseName,
        shelfId: terminal.shelfId,
        shelfName: terminal.shelfName,
      };

      await window.electronAPI.saveTerminalConfig(config);
      setTerminalConfig(config);
      navigate('/login');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to register terminal'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Terminal Setup</h1>
            <p className="text-sm text-gray-500">
              {isLoggedIn ? 'Configure this terminal' : 'Manager login required'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {!isLoggedIn ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manager Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="manager@store.co.uk"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 h-12"
            >
              <LogIn className="w-5 h-5" />
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Terminal Name
              </label>
              <input
                type="text"
                value={terminalName}
                onChange={(e) => setTerminalName(e.target.value)}
                className="input-field"
                placeholder="e.g., Till 1"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Retail Location
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="input-field"
                required
              >
                <option value="">Select location...</option>
                {warehouses.map((wh: any) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full flex items-center justify-center gap-2 h-12"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Registering...' : 'Register Terminal'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
