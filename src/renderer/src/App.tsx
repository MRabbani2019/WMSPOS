import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useRegisterStore } from './stores/registerStore';

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
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

  return <>{children}</>;
}

function App() {
  const setTerminalConfig = useAuthStore((state) => state.setTerminalConfig);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await window.electronAPI.getTerminalConfig();
        if (config) {
          setTerminalConfig(config);

          // Load stored token if exists
          const token = await window.electronAPI.getStoredToken();
          if (token && config.user) {
            setAuth(token, config.user);
          }
        }
      } catch (error) {
        console.error('Failed to load terminal config:', error);
      }
    };

    loadConfig();
  }, [setTerminalConfig, setAuth]);

  return (
    <Routes>
      <Route path="/setup" element={<TerminalSetup />} />
      <Route path="/login" element={<EmployeeLogin />} />
      <Route path="/open-register" element={<OpenRegister />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainPOS />
          </ProtectedRoute>
        }
      />
      <Route
        path="/held"
        element={
          <ProtectedRoute>
            <HeldTransactions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/returns"
        element={
          <ProtectedRoute>
            <Returns />
          </ProtectedRoute>
        }
      />
      <Route
        path="/returns/:orderId"
        element={
          <ProtectedRoute>
            <ReturnProcess />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock"
        element={
          <ProtectedRoute>
            <StockLookup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <SalesHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/close-register"
        element={
          <ProtectedRoute>
            <CloseRegister />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
