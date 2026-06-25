import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  Pause,
  RotateCcw,
  Package,
  ShoppingBag,
  Truck,
  FileText,
  DollarSign,
  BarChart3,
  FileBarChart,
  GraduationCap,
  Lock,
  LogOut,
} from 'lucide-react';
import { useTrainingStore } from '../stores/trainingStore';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import { useRegisterStore } from '../stores/registerStore';
import XReportModal from './XReportModal';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  isAmber?: boolean;
}

function NavItem({ icon, label, onClick, isActive = false, isAmber = false }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={[
        'relative w-full h-12 flex items-center justify-center transition-colors',
        isActive
          ? 'text-white bg-[#2D2D2D] before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-[#008060] before:rounded-r'
          : isAmber
            ? 'text-[#FFC453] hover:text-white hover:bg-[#252525]'
            : 'text-[#8A8A8A] hover:text-white hover:bg-[#252525]',
      ].join(' ')}
    >
      <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
    </button>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isTraining = useTrainingStore((state) => state.isTrainingMode);
  const toggleTraining = useTrainingStore((state) => state.toggleTrainingMode);
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const [showXReport, setShowXReport] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out?')) {
      clearAuth();
      useCartStore.getState().clearCart();
      useRegisterStore.getState().clearSession();
      navigate('/login');
    }
  };

  return (
    <>
      <div
        className="fixed left-0 top-0 h-screen w-[72px] flex flex-col z-40"
        style={{ backgroundColor: '#1A1A1A', borderRight: '1px solid #2D2D2D' }}
      >
        {/* Brand mark */}
        <div
          className="h-16 flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#222222' }}
        >
          <div className="w-9 h-9 rounded-full bg-[#008060] flex items-center justify-center">
            <span className="text-white font-bold text-lg leading-none select-none">C</span>
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex flex-col flex-1 overflow-hidden">
          <NavItem
            icon={<LayoutGrid className="w-5 h-5" />}
            label="Sale"
            onClick={() => navigate('/')}
            isActive={isActive('/')}
          />
          <NavItem
            icon={<Pause className="w-5 h-5" />}
            label="Held"
            onClick={() => navigate('/held')}
            isActive={isActive('/held')}
          />
          <NavItem
            icon={<RotateCcw className="w-5 h-5" />}
            label="Returns"
            onClick={() => navigate('/returns')}
            isActive={isActive('/returns') || location.pathname.startsWith('/returns/')}
          />
          <NavItem
            icon={<Package className="w-5 h-5" />}
            label="Stock"
            onClick={() => navigate('/stock')}
            isActive={isActive('/stock')}
          />
          <NavItem
            icon={<ShoppingBag className="w-5 h-5" />}
            label="Collect"
            onClick={() => navigate('/bopis')}
            isActive={isActive('/bopis')}
          />
          <NavItem
            icon={<Truck className="w-5 h-5" />}
            label="Ship"
            onClick={() => navigate('/ship-from-store')}
            isActive={isActive('/ship-from-store')}
          />

          {/* Separator */}
          <div className="mx-4 my-2 border-t border-[#2D2D2D]" />

          <NavItem
            icon={<FileText className="w-5 h-5" />}
            label="History"
            onClick={() => navigate('/history')}
            isActive={isActive('/history')}
          />
          <NavItem
            icon={<DollarSign className="w-5 h-5" />}
            label="Cash"
            onClick={() => navigate('/cash-management')}
            isActive={isActive('/cash-management')}
          />
          <NavItem
            icon={<BarChart3 className="w-5 h-5" />}
            label="Dashboard"
            onClick={() => navigate('/dashboard')}
            isActive={isActive('/dashboard')}
          />
          <NavItem
            icon={<FileBarChart className="w-5 h-5" />}
            label="X Report"
            onClick={() => setShowXReport(true)}
            isActive={false}
          />

          {/* Bottom-pinned actions */}
          <div
            className="mt-auto flex flex-col border-t"
            style={{ borderColor: '#2D2D2D' }}
          >
            <NavItem
              icon={<GraduationCap className="w-5 h-5" />}
              label={isTraining ? 'Training: ON' : 'Training: OFF'}
              onClick={toggleTraining}
              isAmber={isTraining}
            />
            <NavItem
              icon={<Lock className="w-5 h-5" />}
              label="Close Register"
              onClick={() => navigate('/close-register')}
              isActive={isActive('/close-register')}
            />
            <NavItem
              icon={<LogOut className="w-5 h-5" />}
              label={user ? `Log out (${user.firstName})` : 'Log out'}
              onClick={handleLogout}
            />
          </div>
        </nav>
      </div>

      {showXReport && <XReportModal onClose={() => setShowXReport(false)} />}
    </>
  );
}
