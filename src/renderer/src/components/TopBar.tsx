import { useNavigate } from 'react-router-dom';
import {
  RotateCcw, Package, FileText, LogOut, Lock, Pause,
  FileBarChart, DollarSign, GraduationCap, ShoppingBag,
  Truck, LayoutDashboard
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useRegisterStore } from '../stores/registerStore';
import { useTrainingStore } from '../stores/trainingStore';
import XReportModal from './XReportModal';
import { useState } from 'react';

export default function TopBar() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const terminalConfig = useAuthStore((state) => state.terminalConfig);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const isTrainingMode = useTrainingStore((state) => state.isTrainingMode);
  const toggleTrainingMode = useTrainingStore((state) => state.toggleTrainingMode);
  const [showXReport, setShowXReport] = useState(false);

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      clearAuth();
      navigate('/login');
    }
  };

  const handleTrainingToggle = () => {
    if (isTrainingMode) {
      toggleTrainingMode();
    } else {
      if (confirm('Enable Training Mode? All transactions will be simulated and will NOT affect live data.')) {
        toggleTrainingMode();
      }
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
              onClick={() => navigate('/bopis')}
              className="btn-secondary flex items-center gap-2"
              title="Click & Collect"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden md:inline">Collect</span>
            </button>

            <button
              onClick={() => navigate('/ship-from-store')}
              className="btn-secondary flex items-center gap-2"
              title="Ship from Store"
            >
              <Truck className="w-4 h-4" />
              <span className="hidden md:inline">Ship</span>
            </button>

            <button
              onClick={() => navigate('/cash-management')}
              className="btn-secondary flex items-center gap-2"
              title="Cash Management"
            >
              <DollarSign className="w-4 h-4" />
              <span className="hidden md:inline">Cash</span>
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="btn-secondary flex items-center gap-2"
              title="Dashboard"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden md:inline">Dashboard</span>
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
              onClick={handleTrainingToggle}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                isTrainingMode
                  ? 'bg-amber-100 border-amber-300 text-amber-800'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
              title={isTrainingMode ? 'Exit Training Mode' : 'Enter Training Mode'}
            >
              <GraduationCap className="w-4 h-4" />
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
