import { create } from 'zustand';

export interface ItemDiscount {
  type: 'percentage' | 'fixed';
  value: number;
  reason: string;
  approvedBy?: string; // manager ID if override was needed
}

export interface CartItem {
  variationId: number;
  catalogueId: number;
  sku: string;
  name: string;
  image: string | null;
  price: number;
  quantity: number;
  maxStock: number;
  taxRate: number; // e.g. 0.2 for 20%
  discount?: ItemDiscount;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export interface CartDiscount {
  type: 'percentage' | 'fixed';
  value: number;
  reason?: string;
}

interface TaxBreakdownLine {
  rate: number;
  name: string;
  taxableAmount: number;
  taxAmount: number;
}

interface CartState {
  items: CartItem[];
  customer: Customer | null;
  discount: CartDiscount | null;

  addItem: (item: CartItem) => void;
  removeItem: (variationId: number) => void;
  updateQuantity: (variationId: number, quantity: number) => void;
  setCustomer: (customer: Customer | null) => void;
  setDiscount: (discount: CartDiscount | null) => void;
  setItemDiscount: (variationId: number, discount: ItemDiscount | undefined) => void;
  clearCart: () => void;

  getSubtotal: () => number;
  getCartDiscountAmount: () => number;
  getItemDiscountTotal: () => number;
  getDiscountAmount: () => number;
  getTaxBreakdown: () => TaxBreakdownLine[];
  getVAT: () => number;
  getTotal: () => number;
  getItemLineTotal: (item: CartItem) => number;
  getItemDiscountAmount: (item: CartItem) => number;
}

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
      newItems[existingIndex] = { ...newItems[existingIndex], quantity: newQuantity };
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

  setItemDiscount: (variationId, discount) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.variationId === variationId
          ? { ...item, discount }
          : item
      ),
    }));
  },

  clearCart: () => {
    set({ items: [], customer: null, discount: null });
  },

  // Gross line total before any discounts
  getSubtotal: () => {
    const items = get().items;
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  // Amount deducted by individual line-item discounts
  getItemDiscountTotal: () => {
    const items = get().items;
    return items.reduce((sum, item) => {
      return sum + get().getItemDiscountAmount(item);
    }, 0);
  },

  // Amount deducted by the cart-level discount (applied after line discounts)
  getCartDiscountAmount: () => {
    const subtotal = get().getSubtotal();
    const itemDiscountTotal = get().getItemDiscountTotal();
    const afterItemDiscounts = subtotal - itemDiscountTotal;
    const discount = get().discount;

    if (!discount) return 0;

    if (discount.type === 'percentage') {
      return afterItemDiscounts * (discount.value / 100);
    } else {
      return Math.min(discount.value, afterItemDiscounts);
    }
  },

  // Total discount amount (line + cart)
  getDiscountAmount: () => {
    return get().getItemDiscountTotal() + get().getCartDiscountAmount();
  },

  // Discount amount for a single line item
  getItemDiscountAmount: (item: CartItem) => {
    if (!item.discount) return 0;
    const lineGross = item.price * item.quantity;
    if (item.discount.type === 'percentage') {
      return lineGross * (item.discount.value / 100);
    }
    return Math.min(item.discount.value, lineGross);
  },

  // Net line total after line discount but before cart discount and tax
  getItemLineTotal: (item: CartItem) => {
    return item.price * item.quantity - get().getItemDiscountAmount(item);
  },

  // Tax breakdown grouped by rate
  // Prices are TAX-INCLUSIVE: VAT is extracted from the price, not added on top
  // Formula: netAmount = grossAmount / (1 + taxRate), vatAmount = grossAmount - netAmount
  getTaxBreakdown: () => {
    const items = get().items;
    const cartDiscountFraction = (() => {
      const subtotal = get().getSubtotal();
      const itemDiscountTotal = get().getItemDiscountTotal();
      const afterItemDiscounts = subtotal - itemDiscountTotal;
      if (afterItemDiscounts <= 0) return 0;
      return get().getCartDiscountAmount() / afterItemDiscounts;
    })();

    const rateMap = new Map<number, { netAmount: number; taxAmount: number }>();

    for (const item of items) {
      const lineAfterItemDiscount = get().getItemLineTotal(item);
      // Pro-rata the cart discount across items
      const grossAfterAllDiscounts = lineAfterItemDiscount * (1 - cartDiscountFraction);
      // Extract VAT from the gross (tax-inclusive) price
      const netAmount = grossAfterAllDiscounts / (1 + item.taxRate);
      const taxAmount = grossAfterAllDiscounts - netAmount;

      const existing = rateMap.get(item.taxRate);
      if (existing) {
        existing.netAmount += netAmount;
        existing.taxAmount += taxAmount;
      } else {
        rateMap.set(item.taxRate, {
          netAmount,
          taxAmount,
        });
      }
    }

    return Array.from(rateMap.entries())
      .map(([rate, data]) => ({
        rate,
        name: rate === 0 ? 'Zero Rate' : `VAT ${(rate * 100).toFixed(0)}%`,
        taxableAmount: data.netAmount,
        taxAmount: data.taxAmount,
      }))
      .sort((a, b) => b.rate - a.rate);
  },

  // Total VAT (already included in prices — shown for receipt/reporting only)
  getVAT: () => {
    const breakdown = get().getTaxBreakdown();
    return breakdown.reduce((sum, line) => sum + line.taxAmount, 0);
  },

  // Grand total — prices already include VAT, so total = subtotal - discounts
  getTotal: () => {
    const subtotal = get().getSubtotal();
    const discountAmount = get().getDiscountAmount();
    return subtotal - discountAmount;
  },
}));
