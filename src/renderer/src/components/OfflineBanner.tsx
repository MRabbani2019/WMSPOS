import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOfflineStore } from '../stores/offlineStore';

export default function OfflineBanner() {
  const isOnline = useOfflineStore((state) => state.isOnline);
  const pendingCount = useOfflineStore((state) => state.pendingCount);
  const syncInProgress = useOfflineStore((state) => state.syncInProgress);
  const conflicts = useOfflineStore((state) => state.conflicts);
  const syncAll = useOfflineStore((state) => state.syncAll);

  const unresolvedConflicts = conflicts.filter((c) => !c.resolution);

  if (isOnline && pendingCount === 0 && unresolvedConflicts.length === 0) {
    return null;
  }

  return (
    <div className="relative z-40">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-warning-600 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-5 h-5" />
            <span className="font-medium">OFFLINE MODE</span>
            <span className="text-sm opacity-90">— Cash payments only. Card payments disabled.</span>
          </div>
          {pendingCount > 0 && (
            <span className="text-sm bg-white/20 px-2 py-0.5 rounded">
              {pendingCount} transaction{pendingCount !== 1 ? 's' : ''} queued
            </span>
          )}
        </div>
      )}

      {/* Syncing Banner */}
      {isOnline && syncInProgress && (
        <div className="bg-primary-500 text-white px-4 py-2 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Syncing offline transactions...</span>
        </div>
      )}

      {/* Pending Queue Banner (online but pending) */}
      {isOnline && !syncInProgress && pendingCount > 0 && (
        <div className="bg-warning-50 text-warning-700 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">
              {pendingCount} offline transaction{pendingCount !== 1 ? 's' : ''} pending sync
            </span>
          </div>
          <button
            onClick={() => syncAll()}
            className="text-sm font-medium hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Sync Now
          </button>
        </div>
      )}

      {/* Conflicts Banner */}
      {unresolvedConflicts.length > 0 && (
        <div className="bg-danger-50 text-danger-500 px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">
            {unresolvedConflicts.length} sync conflict{unresolvedConflicts.length !== 1 ? 's' : ''} need manager review
          </span>
        </div>
      )}
    </div>
  );
}
