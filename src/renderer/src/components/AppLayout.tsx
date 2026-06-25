import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TrainingBanner from './TrainingBanner';
import OfflineBanner from './OfflineBanner';

export default function AppLayout() {
  return (
    <div className="h-screen flex">
      <Sidebar />
      <div className="flex-1 ml-[72px] flex flex-col overflow-hidden">
        <TrainingBanner />
        <OfflineBanner />
        <Outlet />
      </div>
    </div>
  );
}
