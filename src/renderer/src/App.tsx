import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useRegisterStore } from './stores/registerStore';
import { useCartStore } from './stores/cartStore';
import { useSettingsStore } from './stores/settingsStore';
import { useOfflineStore } from './stores/offlineStore';
import { usePromotionsStore } from './stores/promotionsStore';
import apiClient from './lib/axios';

// Layout
import AppLayout from './components/AppLayout';

// Pages
import TerminalSetup from './pages/TerminalSetup';
import EmployeeLogin from './pages/EmployeeLogin';
import OpenRegister from './pages/OpenRegister';
import MainPOS from './pages/MainPOS';
import HeldTransactions from './pages/HeldTransactions';
import Returns from './pages/Returns';
import ReturnProcess from './pages/ReturnProcess';
import StockLookup from './pages/StockLookup';
import SalesHistory from './pages/SalesHistory';
import CloseRegister from './pages/CloseRegister';
import CashManagement from './pages/CashManagement';
import BOPIS from './pages/BOPIS';
import ShipFromStore from './pages/ShipFromStore';
import Dashboard from './pages/Dashboard';

function ProtectedRoute() {
  const terminalConfig = useAuthStore((state) => state.terminalConfig);
  const token = useAuthStore((state) => state.token);
  const session = useRegisterStore((state) => state.session);
  const location = useLocation();

  if (!terminalConfig) {
    return <Navigate to="/setup" replace />;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!session && location.pathname !== '/open-register') {
    return <Navigate to="/open-register" replace />;
  }

  return <Outlet />;
}

function App() {
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await window.electronAPI.getTerminalConfig();
        if (config) {
          useAuthStore.getState().setTerminalConfig(config);

          // Load stored token if exists
          const token = await window.electronAPI.getStoredToken();
          if (token && config.user) {
            useAuthStore.getState().setAuth(token, config.user);

            // Validate token is still accepted by the server
            try {
              await apiClient.get('/client/pos/ping', { timeout: 5000 });
            } catch (err: any) {
              if (err?.response?.status === 401) {
                useAuthStore.getState().clearAuth();
                return;
              }
            }

            // Fetch POS settings (tax rates, receipt template, promotions, etc.)
            useSettingsStore.getState().fetchSettings();
            usePromotionsStore.getState().fetchPromotions();

            // Restore training mode
            const trainingMode = localStorage.getItem('pos_training_mode') === 'true';
            if (trainingMode) {
              const { useTrainingStore } = await import('./stores/trainingStore');
              useTrainingStore.getState().enableTrainingMode();
            }
          }
        }
      } catch (error) {
        console.error('Failed to load terminal config:', error);
      }
    };

    loadConfig();

    // Handle auth token expiry from the axios interceptor
    const handleAuthExpired = () => {
      useAuthStore.getState().clearAuth();
      useCartStore.getState().clearCart();
      useRegisterStore.getState().clearSession();
      // Navigation back to /login will happen automatically via ProtectedRoute redirect
    };
    window.addEventListener('pos:auth-expired', handleAuthExpired);

    // Start monitoring network connectivity
    const stopMonitor = useOfflineStore.getState().startConnectivityMonitor();
    return () => {
      stopMonitor();
      window.removeEventListener('pos:auth-expired', handleAuthExpired);
    };
  }, []);

  return (
    <Routes>
      {/* Public routes — no sidebar/layout */}
      <Route path="/setup" element={<TerminalSetup />} />
      <Route path="/login" element={<EmployeeLogin />} />

      {/* Open register — protected but no AppLayout (session not yet open) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/open-register" element={<OpenRegister />} />
      </Route>

      {/* All authenticated routes — wrapped in AppLayout with persistent sidebar */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<MainPOS />} />
          <Route path="/held" element={<HeldTransactions />} />
          <Route path="/returns" element={<Returns />} />
          <Route path="/returns/:orderId" element={<ReturnProcess />} />
          <Route path="/stock" element={<StockLookup />} />
          <Route path="/history" element={<SalesHistory />} />
          <Route path="/close-register" element={<CloseRegister />} />
          <Route path="/cash-management" element={<CashManagement />} />
          <Route path="/bopis" element={<BOPIS />} />
          <Route path="/ship-from-store" element={<ShipFromStore />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
