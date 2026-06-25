import { create } from 'zustand';
import apiClient from '../lib/axios';

interface StockLevel {
  variationId: number;
  warehouseId: number;
  available: number; // on-hand minus reserved
  reserved: number; // BOPIS + open orders
  lastUpdated: string;
}

interface LowStockAlert {
  variationId: number;
  name: string;
  sku: string;
  available: number;
  threshold: number;
}

interface InventoryState {
  stockLevels: Map<string, StockLevel>; // key: `${variationId}_${warehouseId}`
  lowStockAlerts: LowStockAlert[];
  lowStockThreshold: number;
  ws: WebSocket | null;
  connected: boolean;
  lastSyncAt: string | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;

  getStock: (variationId: number, warehouseId: number) => StockLevel | null;
  reserveStock: (variationId: number, warehouseId: number, qty: number) => void;
  releaseStock: (variationId: number, warehouseId: number, qty: number) => void;
  fetchStockForWarehouse: (warehouseId: number) => Promise<void>;
  connectWebSocket: (warehouseId: number) => void;
  disconnect: () => void;
}

function stockKey(variationId: number, warehouseId: number): string {
  return `${variationId}_${warehouseId}`;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  stockLevels: new Map(),
  lowStockAlerts: [],
  lowStockThreshold: 5,
  ws: null,
  connected: false,
  lastSyncAt: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,

  getStock: (variationId, warehouseId) => {
    return get().stockLevels.get(stockKey(variationId, warehouseId)) || null;
  },

  reserveStock: (variationId, warehouseId, qty) => {
    const key = stockKey(variationId, warehouseId);
    const levels = new Map(get().stockLevels);
    const current = levels.get(key);
    if (current) {
      levels.set(key, {
        ...current,
        available: Math.max(0, current.available - qty),
        reserved: current.reserved + qty,
      });
      set({ stockLevels: levels });
    }
  },

  releaseStock: (variationId, warehouseId, qty) => {
    const key = stockKey(variationId, warehouseId);
    const levels = new Map(get().stockLevels);
    const current = levels.get(key);
    if (current) {
      levels.set(key, {
        ...current,
        available: current.available + qty,
        reserved: Math.max(0, current.reserved - qty),
      });
      set({ stockLevels: levels });
    }
  },

  fetchStockForWarehouse: async (warehouseId) => {
    try {
      const response = await apiClient.get('/client/pos/inventory/stock', {
        params: { warehouseId },
      });
      const data: any[] = response.data?.data || [];
      const levels = new Map(get().stockLevels);
      const alerts: LowStockAlert[] = [];

      for (const item of data) {
        const key = stockKey(item.variationId, warehouseId);
        const available = (item.quantity || 0) - (item.reserved || 0);
        levels.set(key, {
          variationId: item.variationId,
          warehouseId,
          available,
          reserved: item.reserved || 0,
          lastUpdated: new Date().toISOString(),
        });

        if (available <= get().lowStockThreshold && available > 0) {
          alerts.push({
            variationId: item.variationId,
            name: item.name || '',
            sku: item.sku || '',
            available,
            threshold: get().lowStockThreshold,
          });
        }
      }

      set({
        stockLevels: levels,
        lowStockAlerts: alerts,
        lastSyncAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to fetch stock levels:', err);
    }
  },

  connectWebSocket: (warehouseId) => {
    const { ws } = get();
    if (ws) ws.close();

    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:9000')
      .replace('http', 'ws');
    const wsUrl = `${baseUrl}/ws/inventory?warehouseId=${warehouseId}`;

    try {
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        set({ ws: socket, connected: true, reconnectAttempts: 0 });
        console.log('Inventory WebSocket connected');
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'stock_update') {
            const levels = new Map(get().stockLevels);
            const key = stockKey(message.variationId, message.warehouseId);
            levels.set(key, {
              variationId: message.variationId,
              warehouseId: message.warehouseId,
              available: message.available,
              reserved: message.reserved || 0,
              lastUpdated: new Date().toISOString(),
            });
            set({ stockLevels: levels });
          }
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };

      socket.onclose = () => {
        set({ connected: false });
        const attempts = get().reconnectAttempts;
        if (attempts < 10) {
          const backoff = Math.min(60000, 5000 * Math.pow(2, attempts));
          set({ reconnectAttempts: attempts + 1 });
          setTimeout(() => {
            if (!get().connected) {
              get().connectWebSocket(warehouseId);
            }
          }, backoff);
        } else {
          console.warn('WebSocket max reconnection attempts reached, falling back to polling');
        }
      };

      socket.onerror = () => {
        // WebSocket not available — fall back to polling
        console.warn('WebSocket not available, falling back to polling');
        socket.close();
      };

      set({ ws: socket });
    } catch {
      // WebSocket not supported or URL invalid — use polling fallback
      console.warn('WebSocket connection failed, using HTTP polling');
    }
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, connected: false });
    }
  },
}));
