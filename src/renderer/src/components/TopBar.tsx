import { useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  Package,
  FileText,
  LogOut,
  Lock,
  Pause,
  FileBarChart
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useRegisterStore } from '../stores/registerStore';
import XReportModal from './XReportModal';
import { useState } from 'react';

export default function TopBar() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const terminalConfig = useAuthStore((state) => state.terminalConfig);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [showXReport, setShowXReport] = useState(false);

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      clearAuth();
      navigate('/login');
    }
  };

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="font-semibold text-gray-800">
                {user?.firstName} {user?.lastName}
              </h2>
              <p className="text-sm text-gray-500">{terminalConfig?.terminalName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/held')}
              className="btn-secondary flex items-center gap-2"
              title="Held Transactions"
            >
              <Pause className="w-4 h-4" />
              <span className="hidden md:inline">Held</span>
            </button>

            <button
              onClick={() => navigate('/returns')}
              className="btn-secondary flex items-center gap-2"
              title="Returns"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden md:inline">Returns</span>
            </button>

            <button
              onClick={() => navigate('/stock')}
              className="btn-secondary flex items-center gap-2"
              title="Stock Lookup"
            >
              <Package className="w-4 h-4" />
              <span className="hidden md:inline">Stock</span>
            </button>

            <button
              onClick={() => navigate('/history')}
              className="btn-secondary flex items-center gap-2"
              title="Sales History"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden md:inline">History</span>
            </button>

            <button
              onClick={() => setShowXReport(true)}
              className="btn-secondary flex items-center gap-2"
              title="X Report"
            >
              <FileBarChart className="w-4 h-4" />
              <span className="hidden md:inline">X Report</span>
            </button>

            <button
              onClick={() => navigate('/close-register')}
              className="btn-danger flex items-center gap-2"
              title="Close Register"
            >
              <Lock className="w-4 h-4" />
              <span className="hidden md:inline">Close</span>
            </button>

            <button
              onClick={handleLogout}
              className="btn-secondary flex items-center gap-2"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showXReport && <XReportModal onClose={() => setShowXReport(false)} />}
    </>
  );
}
