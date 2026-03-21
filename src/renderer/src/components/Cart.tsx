import { ShoppingCart, Trash2, Plus, Minus, User, Tag, Pause } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useRegisterStore } from '../stores/registerStore';
import { useState } from 'react';
import CustomerSearch from './CustomerSearch';
import DiscountModal from './DiscountModal';
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
    getDiscountAmount,
    getVAT,
    getTotal,
  } = useCartStore();

  const session = useRegisterStore((state) => state.session);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

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
    } catch (error) {
      console.error('Failed to hold transaction:', error);
    }
  };

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-5 h-5 text-gray-600" />
            <h2 className="font-semibold text-lg">Current Sale</h2>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowCustomerSearch(true)}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4" />
              {customer ? customer.name : 'Add Customer'}
            </button>
            <button
              onClick={() => setShowDiscountModal(true)}
              className="btn-secondary flex items-center gap-2"
              title="Add Discount"
            >
              <Tag className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.variationId} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.sku}</p>
                    </div>
                    <button
                      onClick={() => removeItem(item.variationId)}
                      className="text-danger-600 hover:text-danger-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.variationId, item.quantity - 1)}
                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.variationId, item.quantity + 1)}
                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        disabled={item.quantity >= item.maxStock}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="font-bold">£{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">£{getSubtotal().toFixed(2)}</span>
            </div>

            {discount && (
              <div className="flex justify-between text-sm text-danger-600">
                <span>
                  Discount {discount.type === 'percentage' ? `(${discount.value}%)` : ''}
                </span>
                <span>-£{getDiscountAmount().toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">VAT (20%)</span>
              <span className="font-medium">£{getVAT().toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>£{getTotal().toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleHold}
              disabled={items.length === 0}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <Pause className="w-4 h-4" />
              Hold
            </button>
            <button
              onClick={clearCart}
              disabled={items.length === 0}
              className="flex-1 btn-danger"
            >
              Clear
            </button>
          </div>

          <button
            onClick={onCheckout}
            disabled={items.length === 0}
            className="btn-success w-full text-lg py-3"
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
    </>
  );
}
