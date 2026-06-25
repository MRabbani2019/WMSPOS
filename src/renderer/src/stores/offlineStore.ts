import { create } from 'zustand';
import apiClient from '../lib/axios';

interface QueuedTransaction {
  localId: string;
  type: 'sale' | 'refund' | 'hold';
  payload: any;
  createdAt: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error?: string;
}

interface SyncConflict {
  localId: string;
  type: string;
  message: string;
  resolution?: string;
}

interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  queue: QueuedTransaction[];
  conflicts: SyncConflict[];
  lastSyncAt: string | null;
  syncInProgress: boolean;

  setOnline: (online: boolean) => void;
  enqueue: (type: QueuedTransaction['type'], payload: any) => string;
  syncAll: () => Promise<void>;
  clearSynced: () => void;
  resolveConflict: (localId: string, resolution: string) => void;
  startConnectivityMonitor: () => () => void;
}

function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Module-level sync lock — prevents concurrent syncAll invocations across
// React re-renders and interval ticks that share the same store instance.
let _syncLock = false;

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: false,
  pendingCount: 0,
  queue: [],
  conflicts: [],
  lastSyncAt: null,
  syncInProgress: false,

  setOnline: (online) => {
    const wasOffline = !get().isOnline;
    set({ isOnline: online });

    // Auto-sync when coming back online
    if (online && wasOffline && get().queue.length > 0) {
      get().syncAll();
    }
  },

  enqueue: (type, payload) => {
    const localId = generateLocalId();
    const transaction: QueuedTransaction = {
      localId,
      type,
      payload: { ...payload, localId },
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    set((state) => ({
      queue: [...state.queue, transaction],
      pendingCount: state.pendingCount + 1,
    }));

    // Persist to localStorage for crash safety
    try {
      const stored = JSON.parse(localStorage.getItem('pos_offline_queue') || '[]');
      stored.push(transaction);
      localStorage.setItem('pos_offline_queue', JSON.stringify(stored));
    } catch (e) {
      console.error('Failed to persist offline queue:', e);
    }

    return localId;
  },

  syncAll: async () => {
    if (_syncLock) return;
    _syncLock = true;

    try {
      const { queue, isOnline } = get();
      if (!isOnline) { _syncLock = false; return; }

      const pending = queue.filter((t) => t.status === 'pending');
      if (pending.length === 0) return;

      set({ syncInProgress: true });

      for (const transaction of pending) {
        // Mark as syncing
        set((state) => ({
          queue: state.queue.map((t) =>
            t.localId === transaction.localId ? { ...t, status: 'syncing' as const } : t
          ),
        }));

        try {
          let endpoint = '';
          switch (transaction.type) {
            case 'sale':
              endpoint = '/client/pos/sale/create';
              break;
            case 'refund':
              endpoint = '/client/pos/refund/create';
              break;
            case 'hold':
              endpoint = '/client/pos/sale/hold';
              break;
          }

          const response = await apiClient.post(endpoint, transaction.payload);

          if (response.data.status) {
            set((state) => ({
              queue: state.queue.map((t) =>
                t.localId === transaction.localId ? { ...t, status: 'synced' as const } : t
              ),
              pendingCount: Math.max(0, state.pendingCount - 1),
            }));
          } else {
            // Server rejected — create conflict
            set((state) => ({
              queue: state.queue.map((t) =>
                t.localId === transaction.localId
                  ? { ...t, status: 'failed' as const, error: response.data.message }
                  : t
              ),
              conflicts: [...state.conflicts, {
                localId: transaction.localId,
                type: transaction.type,
                message: response.data.message || 'Server rejected transaction',
              }],
            }));
          }
        } catch (error: any) {
          // Network error — keep as pending for retry
          const isNetworkError = !error.response;
          set((state) => ({
            queue: state.queue.map((t) =>
              t.localId === transaction.localId
                ? { ...t, status: isNetworkError ? 'pending' as const : 'failed' as const, error: error.message }
                : t
            ),
          }));

          if (isNetworkError) {
            // Network went down again mid-sync
            set({ isOnline: false });
            break;
          }
        }
      }

      set({
        syncInProgress: false,
        lastSyncAt: new Date().toISOString(),
      });

      // Update localStorage
      try {
        const currentQueue = get().queue.filter((t) => t.status !== 'synced');
        localStorage.setItem('pos_offline_queue', JSON.stringify(currentQueue));
      } catch (e) {
        console.error('Failed to update offline queue storage:', e);
      }
    } finally {
      _syncLock = false;
    }
  },

  clearSynced: () => {
    set((state) => ({
      queue: state.queue.filter((t) => t.status !== 'synced'),
    }));
    try {
      const remaining = get().queue;
      localStorage.setItem('pos_offline_queue', JSON.stringify(remaining));
    } catch {}
  },

  resolveConflict: (localId, resolution) => {
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.localId === localId ? { ...c, resolution } : c
      ),
    }));
  },

  startConnectivityMonitor: () => {
    // Restore queue from localStorage on startup
    try {
      const stored = JSON.parse(localStorage.getItem('pos_offline_queue') || '[]');
      if (stored.length > 0) {
        set({
          queue: stored,
          pendingCount: stored.filter((t: QueuedTransaction) => t.status === 'pending').length,
        });
        // Force sync if there are pending items
        setTimeout(() => get().syncAll(), 2000);
      }
    } catch (e) {
      console.error('Failed to restore offline queue:', e);
    }

    let checkInterval: ReturnType<typeof setInterval>;

    const checkConnectivity = async () => {
      try {
        await apiClient.get('/client/pos/ping', { timeout: 5000 });
        get().setOnline(true);
      } catch {
        get().setOnline(false);
      }
    };

    // Check every 10 seconds
    checkInterval = setInterval(checkConnectivity, 10000);

    // Also listen to browser online/offline events
    const handleOnline = () => checkConnectivity();
    const handleOffline = () => get().setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkConnectivity();

    // Return cleanup function
    return () => {
      clearInterval(checkInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },
}));
