import { create } from 'zustand';
import apiClient from '../lib/axios';

export interface TaxRate {
  id: number;
  name: string;
  rate: number; // 0.2 = 20%
  isDefault: boolean;
  appliesTo: 'all' | 'category' | 'product';
  categoryIds: number[];
  variationIds: number[];
  warehouseIds: number[];
  isActive: boolean;
}

export interface DiscountConfig {
  cashierMaxPercent: number;
  managerMaxPercent: number;
  reasonCodes: string[];
}

export interface ReceiptTemplate {
  id: number;
  headerLine1: string;
  headerLine2: string;
  headerLine3: string;
  headerLine4: string;
  footerLine1: string;
  footerLine2: string;
  showBarcode: boolean;
  showVatNumber: boolean;
  vatNumber: string | null;
  logoUrl: string | null;
}

export type CashRoundingRule = 'none' | 'nearest_5' | 'nearest_10';

interface SettingsState {
  taxRates: TaxRate[];
  defaultTaxRate: number; // fallback rate
  discountConfig: DiscountConfig;
  receiptTemplate: ReceiptTemplate | null;
  taxMode: 'inclusive' | 'exclusive'; // tax-inclusive or exclusive pricing
  cashRounding: CashRoundingRule;
  currency: { code: string; symbol: string };
  loaded: boolean;

  fetchSettings: () => Promise<void>;
  getTaxRateForProduct: (variationId: number, catalogueId: number, categoryIds?: number[]) => number;
  getTaxRateNameForRate: (rate: number) => string;
  getUniqueTaxRates: (items: Array<{ taxRate: number; quantity: number; price: number }>) => Array<{ rate: number; name: string; taxAmount: number }>;
  applyCashRounding: (amount: number) => { rounded: number; adjustment: number };
}

const DEFAULT_DISCOUNT_CONFIG: DiscountConfig = {
  cashierMaxPercent: 10,
  managerMaxPercent: 25,
  reasonCodes: [
    'Price Match',
    'Clearance',
    'Damaged Packaging',
    'Customer Loyalty',
    'Staff Purchase',
    'Manager Discretion',
  ],
};

const DEFAULT_TAX_RATE = 0.2; // 20% fallback

export const useSettingsStore = create<SettingsState>((set, get) => ({
  taxRates: [],
  defaultTaxRate: DEFAULT_TAX_RATE,
  discountConfig: DEFAULT_DISCOUNT_CONFIG,
  receiptTemplate: null,
  taxMode: 'inclusive',
  cashRounding: 'none',
  currency: { code: 'GBP', symbol: '£' },
  loaded: false,

  fetchSettings: async () => {
    try {
      const response = await apiClient.get('/client/pos/settings');
      const data = response.data?.data || response.data;

      const taxRates: TaxRate[] = (data.taxRates || []).map((tr: any) => ({
        id: tr.id,
        name: tr.name || 'Standard',
        rate: parseFloat(tr.rate) || DEFAULT_TAX_RATE,
        isDefault: !!tr.isDefault,
        appliesTo: tr.appliesTo || 'all',
        categoryIds: tr.categoryIds || [],
        variationIds: tr.variationIds || [],
        warehouseIds: tr.warehouseIds || [],
        isActive: tr.isActive !== false,
      }));

      const defaultRate = taxRates.find((r) => r.isDefault);

      set({
        taxRates,
        defaultTaxRate: defaultRate?.rate ?? DEFAULT_TAX_RATE,
        discountConfig: data.discountConfig || DEFAULT_DISCOUNT_CONFIG,
        receiptTemplate: data.receiptTemplate || null,
        taxMode: data.taxMode || 'inclusive',
        cashRounding: data.cashRounding || 'none',
        currency: data.currency || { code: 'GBP', symbol: '£' },
        loaded: true,
      });
    } catch (error) {
      console.error('Failed to fetch POS settings, using defaults:', error);
      // Use defaults on failure — never block the cashier
      set({
        taxRates: [{
          id: 0,
          name: 'Standard Rate',
          rate: DEFAULT_TAX_RATE,
          isDefault: true,
          appliesTo: 'all',
          categoryIds: [],
          variationIds: [],
          warehouseIds: [],
          isActive: true,
        }],
        defaultTaxRate: DEFAULT_TAX_RATE,
        loaded: true,
      });
    }
  },

  getTaxRateForProduct: (variationId: number, _catalogueId: number, categoryIds?: number[]) => {
    const { taxRates, defaultTaxRate } = get();
    const activeTaxRates = taxRates.filter((r) => r.isActive);

    // 1. Check product-level override
    const productRate = activeTaxRates.find(
      (r) => r.appliesTo === 'product' && r.variationIds.includes(variationId)
    );
    if (productRate) return productRate.rate;

    // 2. Check category-level match
    if (categoryIds && categoryIds.length > 0) {
      const categoryRate = activeTaxRates.find(
        (r) => r.appliesTo === 'category' && r.categoryIds.some((cid) => categoryIds.includes(cid))
      );
      if (categoryRate) return categoryRate.rate;
    }

    // 3. Fall back to default
    return defaultTaxRate;
  },

  getTaxRateNameForRate: (rate: number) => {
    const { taxRates } = get();
    const match = taxRates.find((r) => Math.abs(r.rate - rate) < 0.0001);
    if (match) return match.name;
    if (rate === 0) return 'Zero Rate';
    return `${(rate * 100).toFixed(0)}%`;
  },

  getUniqueTaxRates: (items) => {
    const { getTaxRateNameForRate } = get();
    const rateMap = new Map<number, { name: string; taxAmount: number }>();

    for (const item of items) {
      const lineTotal = item.price * item.quantity;
      const taxAmount = lineTotal - (lineTotal / (1 + item.taxRate));
      const existing = rateMap.get(item.taxRate);
      if (existing) {
        existing.taxAmount += taxAmount;
      } else {
        rateMap.set(item.taxRate, {
          name: getTaxRateNameForRate(item.taxRate),
          taxAmount,
        });
      }
    }

    return Array.from(rateMap.entries()).map(([rate, data]) => ({
      rate,
      name: data.name,
      taxAmount: data.taxAmount,
    }));
  },

  applyCashRounding: (amount: number) => {
    const { cashRounding } = get();

    if (cashRounding === 'none') {
      return { rounded: amount, adjustment: 0 };
    }

    let increment: number;
    if (cashRounding === 'nearest_5') {
      increment = 0.05;
    } else {
      increment = 0.10;
    }

    const rounded = Math.round(amount / increment) * increment;
    // Fix floating point precision
    const roundedFixed = parseFloat(rounded.toFixed(2));
    const adjustment = parseFloat((roundedFixed - amount).toFixed(2));

    return { rounded: roundedFixed, adjustment };
  },
}));
