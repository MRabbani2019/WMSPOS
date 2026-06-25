import { create } from 'zustand';
import apiClient from '../lib/axios';
import { CartItem } from './cartStore';

export type PromotionType = 'qty_discount' | 'bogof' | 'mix_match' | 'spend_save';

export interface Promotion {
  id: number;
  name: string;
  type: PromotionType;
  description: string;
  // Conditions
  minQty?: number; // e.g. "buy 3"
  triggerCategoryIds?: number[];
  triggerVariationIds?: number[];
  minSpend?: number; // for spend_save
  // Rewards
  fixedPrice?: number; // "3 for £10"
  freeQty?: number; // "buy 2 get 1 free" → freeQty=1
  discountPercent?: number; // "spend £50 get 20% off"
  // Scheduling
  startsAt: string;
  expiresAt: string;
  activeDays?: number[]; // 0=Sun, 6=Sat; empty = all days
  activeHoursStart?: string; // "09:00"
  activeHoursEnd?: string; // "17:00"
  // Stacking
  stackable: boolean;
  priority: number; // higher = applied first
  isActive: boolean;
}

export interface AppliedPromotion {
  promotionId: number;
  name: string;
  description: string;
  type: PromotionType;
  saving: number; // total £ saved
  affectedItems: number[]; // variationIds
}

interface PromotionsState {
  promotions: Promotion[];
  appliedPromotions: AppliedPromotion[];
  loaded: boolean;

  fetchPromotions: () => Promise<void>;
  evaluateCart: (items: CartItem[]) => AppliedPromotion[];
  getTotalPromotionSaving: () => number;
}

function isPromotionActiveNow(promo: Promotion): boolean {
  const now = new Date();

  // Date range check
  if (promo.startsAt && new Date(promo.startsAt) > now) return false;
  if (promo.expiresAt && new Date(promo.expiresAt) < now) return false;

  // Day of week check
  if (promo.activeDays && promo.activeDays.length > 0) {
    if (!promo.activeDays.includes(now.getDay())) return false;
  }

  // Time of day check
  if (promo.activeHoursStart && promo.activeHoursEnd) {
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (currentTime < promo.activeHoursStart || currentTime > promo.activeHoursEnd) return false;
  }

  return true;
}

function itemMatchesPromo(item: CartItem, promo: Promotion): boolean {
  if (promo.triggerVariationIds?.length) {
    return promo.triggerVariationIds.includes(item.variationId);
  }
  if (promo.triggerCategoryIds?.length) {
    return promo.triggerCategoryIds.includes(item.catalogueId);
  }
  return false;
}

export const usePromotionsStore = create<PromotionsState>((set, get) => ({
  promotions: [],
  appliedPromotions: [],
  loaded: false,

  fetchPromotions: async () => {
    try {
      const response = await apiClient.get('/client/pos/promotions');
      const data = response.data?.data || [];
      set({
        promotions: data.filter((p: Promotion) => p.isActive),
        loaded: true,
      });
    } catch (error) {
      console.error('Failed to fetch promotions:', error);
      set({ loaded: true });
    }
  },

  evaluateCart: (items: CartItem[]) => {
    const { promotions } = get();
    const applied: AppliedPromotion[] = [];
    const usedItems = new Set<number>(); // Track items already used by a non-stackable promo

    // Sort by priority (highest first)
    const sortedPromos = [...promotions]
      .filter((p) => p.isActive && isPromotionActiveNow(p))
      .sort((a, b) => b.priority - a.priority);

    for (const promo of sortedPromos) {
      const matchingItems = items.filter(
        (item) => itemMatchesPromo(item, promo) && (!usedItems.has(item.variationId) || promo.stackable)
      );

      if (matchingItems.length === 0) continue;

      let saving = 0;
      const affectedIds: number[] = [];

      switch (promo.type) {
        case 'qty_discount': {
          // "Buy 3 for £10" — promo.minQty=3, promo.fixedPrice=10
          const totalQty = matchingItems.reduce((sum, i) => sum + i.quantity, 0);
          if (totalQty >= (promo.minQty || 1) && promo.fixedPrice !== undefined) {
            const sets = Math.floor(totalQty / (promo.minQty || 1));
            const normalPrice = matchingItems
              .sort((a, b) => a.price - b.price) // cheapest first
              .slice(0, sets * (promo.minQty || 1))
              .reduce((sum, i) => sum + i.price * Math.min(i.quantity, promo.minQty || 1), 0);
            saving = normalPrice - (sets * promo.fixedPrice);
            matchingItems.forEach((i) => affectedIds.push(i.variationId));
          }
          break;
        }

        case 'bogof': {
          // "Buy 2 get 1 free" — promo.minQty=2, promo.freeQty=1
          const totalQty = matchingItems.reduce((sum, i) => sum + i.quantity, 0);
          const triggerQty = (promo.minQty || 2) + (promo.freeQty || 1);
          if (totalQty >= triggerQty) {
            const sets = Math.floor(totalQty / triggerQty);
            // Free items are the cheapest ones
            const allPrices = matchingItems
              .flatMap((i) => Array(i.quantity).fill(i.price))
              .sort((a, b) => a - b);
            const freeCount = sets * (promo.freeQty || 1);
            saving = allPrices.slice(0, freeCount).reduce((sum, p) => sum + p, 0);
            matchingItems.forEach((i) => affectedIds.push(i.variationId));
          }
          break;
        }

        case 'mix_match': {
          // "Any 3 from category X for £Y" — same as qty_discount but across categories
          const totalQty = matchingItems.reduce((sum, i) => sum + i.quantity, 0);
          if (totalQty >= (promo.minQty || 1) && promo.fixedPrice !== undefined) {
            const normalPrice = matchingItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
            saving = Math.max(0, normalPrice - promo.fixedPrice);
            matchingItems.forEach((i) => affectedIds.push(i.variationId));
          }
          break;
        }

        case 'spend_save': {
          // "Spend £50 get 20% off" — promo.minSpend=50, promo.discountPercent=20
          const totalSpend = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
          if (totalSpend >= (promo.minSpend || 0) && promo.discountPercent) {
            saving = totalSpend * (promo.discountPercent / 100);
            items.forEach((i) => affectedIds.push(i.variationId));
          }
          break;
        }
      }

      // Best-price rule: only apply if it saves the customer money
      if (saving > 0) {
        applied.push({
          promotionId: promo.id,
          name: promo.name,
          description: promo.description,
          type: promo.type,
          saving,
          affectedItems: affectedIds,
        });

        if (!promo.stackable) {
          affectedIds.forEach((id) => usedItems.add(id));
        }
      }
    }

    set({ appliedPromotions: applied });
    return applied;
  },

  getTotalPromotionSaving: () => {
    return get().appliedPromotions.reduce((sum, p) => sum + p.saving, 0);
  },
}));
