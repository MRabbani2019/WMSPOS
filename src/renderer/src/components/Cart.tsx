import { Trash2, Plus, Minus, User, Tag, Pause, Percent, ShoppingCart } from 'lucide-react';
import { useCartStore, CartItem } from '../stores/cartStore';
import { useRegisterStore } from '../stores/registerStore';
import { useState } from 'react';
import CustomerSearch from './CustomerSearch';
import DiscountModal from './DiscountModal';
import LineItemDiscountModal from './LineItemDiscountModal';
import apiClient from '../lib/axios';

interface CartProps {
  onCheckout: () => void;
}

export default function Cart({ onCheckout }: CartProps) {
  const {
    items,
    customer,
    discount,
    removeItem,
    updateQuantity,
    clearCart,
    getSubtotal,
    getItemDiscountTotal,
    getCartDiscountAmount,
    getDiscountAmount,
    getTaxBreakdown,
    getVAT,
    getTotal,
    getItemDiscountAmount,
    getItemLineTotal,
  } = useCartStore();

  const session = useRegisterStore((state) => state.session);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [lineDiscountItem, setLineDiscountItem] = useState<CartItem | null>(null);
  const [holdError, setHoldError] = useState('');

  const handleHold = async () => {
    if (!session?.id || items.length === 0) return;

    try {
      const cartJSON = {
        items: items.map((item) => ({
          variationId: item.variationId,
          catalogueId: item.catalogueId,
          sku: item.sku,
          name: item.name,
          image: item.image,
          price: item.price,
          quantity: item.quantity,
          maxStock: item.maxStock,
          taxRate: item.taxRate,
          discount: item.discount,
        })),
        customer,
        discount,
      };

      await apiClient.post('/client/pos/sale/hold', {
        sessionId: session.id,
        cartJSON,
        customerId: customer?.id || null,
        note: null,
      });

      clearCart();
      setHoldError('');
    } catch (error) {
      setHoldError('Failed to hold transaction. Please try again.');
    }
  };

  const taxBreakdown = getTaxBreakdown();
  const itemDiscountTotal = getItemDiscountTotal();
  const cartDiscountAmount = getCartDiscountAmount();
  const hasAnyDiscount = itemDiscountTotal > 0 || cartDiscountAmount > 0;

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#E1E3E5]">
          <h2 className="font-semibold text-base text-[#202223] mb-4">Current Sale</h2>

          <div className="flex gap-2">
            <button
              onClick={() => setShowCustomerSearch(true)}
              className={
                customer
                  ? 'flex-1 bg-[#F6F6F7] rounded-[10px] px-3 py-2.5 text-sm text-[#202223] font-medium flex items-center justify-center gap-2'
                  : 'flex-1 border border-dashed border-[#C9CCCF] rounded-[10px] px-3 py-2.5 text-sm text-[#6D7175] hover:border-primary-500 hover:text-primary-500 transition-colors flex items-center justify-center gap-2'
              }
            >
              <User className="w-4 h-4" />
              {customer ? customer.name : 'Add Customer'}
            </button>
            <button
              onClick={() => setShowDiscountModal(true)}
              className="border border-dashed border-[#C9CCCF] rounded-[10px] px-3 py-2.5 text-sm text-[#6D7175] hover:border-primary-500 hover:text-primary-500 transition-colors flex items-center justify-center gap-2"
              title="Cart Discount"
            >
              <Tag className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-auto px-5 py-2">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-[#C9CCCF] mx-auto mb-4" />
              <p className="text-[#8C9196]">Cart is empty</p>
            </div>
          ) : (
            <div>
              {items.map((item) => {
                const lineDiscount = getItemDiscountAmount(item);
                const lineTotal = getItemLineTotal(item);
                return (
                  <div key={item.variationId} className="py-3 border-b border-[#EDEEEF]">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-[#202223]">{item.name}</p>
                        <p className="text-xs text-[#8C9196]">{item.sku}</p>
                        {item.taxRate !== undefined && (
                          <p className="text-[11px] text-[#B5B5B5]">
                            VAT {(item.taxRate * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setLineDiscountItem(item)}
                          className={`p-1 rounded hover:bg-gray-100 ${
                            item.discount ? 'text-success-600' : 'text-gray-400'
                          }`}
                          title="Line discount"
                        >
                          <Percent className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeItem(item.variationId)}
                          className="text-[#8C9196] hover:text-danger-500 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.variationId, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-[#F6F6F7] hover:bg-[#E1E3E5] transition-colors flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.variationId, item.quantity + 1)}
                          className="w-7 h-7 rounded-lg bg-[#F6F6F7] hover:bg-[#E1E3E5] transition-colors flex items-center justify-center"
                          disabled={item.quantity >= item.maxStock}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-right">
                        {lineDiscount > 0 ? (
                          <>
                            <p className="text-xs text-gray-400 line-through">
                              £{(item.price * item.quantity).toFixed(2)}
                            </p>
                            <p className="font-bold text-success-700">£{lineTotal.toFixed(2)}</p>
                            <p className="text-xs text-success-600">
                              -{item.discount?.type === 'percentage'
                                ? `${item.discount.value}%`
                                : `£${item.discount?.value.toFixed(2)}`
                              } ({item.discount?.reason})
                            </p>
                          </>
                        ) : (
                          <p className="font-bold">£{(item.price * item.quantity).toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="border-t border-[#E1E3E5] px-5 py-4 space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#6D7175]">Subtotal</span>
              <span className="text-[#202223] font-medium">£{getSubtotal().toFixed(2)}</span>
            </div>

            {itemDiscountTotal > 0 && (
              <div className="flex justify-between text-sm text-success-600">
                <span>Line Discounts</span>
                <span>-£{itemDiscountTotal.toFixed(2)}</span>
              </div>
            )}

            {discount && cartDiscountAmount > 0 && (
              <div className="flex justify-between text-sm text-danger-600">
                <span>
                  Cart Discount {discount.type === 'percentage' ? `(${discount.value}%)` : ''}
                </span>
                <span>-£{cartDiscountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-[#E1E3E5]">
              <span className="text-[18px] font-bold text-[#202223]">Total</span>
              <span className="text-[18px] font-bold text-[#202223]">£{getTotal().toFixed(2)}</span>
            </div>

            {/* VAT included breakdown */}
            {taxBreakdown.map((tax) => (
              <div key={tax.rate} className="flex justify-between text-[11px] text-[#8C9196]">
                <span>incl. {tax.name}</span>
                <span>£{tax.taxAmount.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleHold}
              disabled={items.length === 0}
              className="flex-1 h-11 rounded-xl bg-[#F6F6F7] text-[#202223] hover:bg-[#E1E3E5] font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Pause className="w-4 h-4" />
              Hold
            </button>
            <button
              onClick={clearCart}
              disabled={items.length === 0}
              className="flex-1 h-11 rounded-xl bg-danger-50 text-danger-500 hover:bg-danger-100 font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          </div>
          {holdError && (
            <p className="text-xs text-danger-500 text-center">{holdError}</p>
          )}

          <button
            onClick={onCheckout}
            disabled={items.length === 0}
            className="h-14 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold text-base w-full mt-3 inline-flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Checkout - £{getTotal().toFixed(2)}
          </button>
        </div>
      </div>

      {showCustomerSearch && (
        <CustomerSearch onClose={() => setShowCustomerSearch(false)} />
      )}

      {showDiscountModal && (
        <DiscountModal onClose={() => setShowDiscountModal(false)} />
      )}

      {lineDiscountItem && (
        <LineItemDiscountModal
          item={lineDiscountItem}
          onClose={() => setLineDiscountItem(null)}
        />
      )}
    </>
  );
}
