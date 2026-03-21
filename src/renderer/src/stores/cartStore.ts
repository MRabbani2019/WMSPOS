import { create } from 'zustand';

interface CartItem {
  variationId: number;
  catalogueId: number;
  sku: string;
  name: string;
  image: string | null;
  price: number;
  quantity: number;
  maxStock: number;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface Discount {
  type: 'percentage' | 'fixed';
  value: number;
}

interface CartState {
  items: CartItem[];
  customer: Customer | null;
  discount: Discount | null;

  addItem: (item: CartItem) => void;
  removeItem: (variationId: number) => void;
  updateQuantity: (variationId: number, quantity: number) => void;
  setCustomer: (customer: Customer | null) => void;
  setDiscount: (discount: Discount | null) => void;
  clearCart: () => void;

  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getVAT: () => number;
  getTotal: () => number;
}

const VAT_RATE = 0.2; // 20% VAT

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customer: null,
  discount: null,

  addItem: (item) => {
    const items = get().items;
    const existingIndex = items.findIndex((i) => i.variationId === item.variationId);

    if (existingIndex >= 0) {
      const newItems = [...items];
      const newQuantity = Math.min(
        newItems[existingIndex].quantity + item.quantity,
        item.maxStock
      );
      newItems[existingIndex].quantity = newQuantity;
      set({ items: newItems });
    } else {
      set({ items: [...items, item] });
    }
  },

  removeItem: (variationId) => {
    set((state) => ({
      items: state.items.filter((item) => item.variationId !== variationId),
    }));
  },

  updateQuantity: (variationId, quantity) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.variationId === variationId
          ? { ...item, quantity: Math.min(Math.max(1, quantity), item.maxStock) }
          : item
      ),
    }));
  },

  setCustomer: (customer) => {
    set({ customer });
  },

  setDiscount: (discount) => {
    set({ discount });
  },

  clearCart: () => {
    set({ items: [], customer: null, discount: null });
  },

  getSubtotal: () => {
    const items = get().items;
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  getDiscountAmount: () => {
    const subtotal = get().getSubtotal();
    const discount = get().discount;

    if (!discount) return 0;

    if (discount.type === 'percentage') {
      return subtotal * (discount.value / 100);
    } else {
      return Math.min(discount.value, subtotal);
    }
  },

  getVAT: () => {
    const subtotal = get().getSubtotal();
    const discountAmount = get().getDiscountAmount();
    return (subtotal - discountAmount) * VAT_RATE;
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const discountAmount = get().getDiscountAmount();
    const vat = get().getVAT();
    return subtotal - discountAmount + vat;
  },
}));
