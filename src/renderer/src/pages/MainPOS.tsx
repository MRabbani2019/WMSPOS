import { useState } from 'react';
import ProductGrid from '../components/ProductGrid';
import Cart from '../components/Cart';
import PaymentModal from '../components/PaymentModal';
import ReceiptModal from '../components/ReceiptModal';
import SaleComplete from '../components/SaleComplete';

export default function MainPOS() {
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);

  const handleCheckout = () => {
    setShowPayment(true);
  };

  const handlePaymentComplete = (sale: any) => {
    setShowPayment(false);
    setCompletedSale(sale);
    // Show receipt modal first, then sale complete
    setShowReceipt(true);
  };

  const handleReceiptDone = () => {
    setShowReceipt(false);
    setShowComplete(true);
  };

  const handleNewSale = () => {
    setShowComplete(false);
    setCompletedSale(null);
  };

  return (
    <>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          <ProductGrid />
        </div>

        <div className="w-96 border-l border-[#E1E3E5] bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.04)]">
          <Cart onCheckout={handleCheckout} />
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          onClose={() => setShowPayment(false)}
          onComplete={handlePaymentComplete}
        />
      )}

      {showReceipt && completedSale?.receipt && (
        <ReceiptModal
          receipt={completedSale.receipt}
          onClose={handleReceiptDone}
        />
      )}

      {showComplete && completedSale && (
        <SaleComplete
          sale={completedSale}
          onNewSale={handleNewSale}
        />
      )}
    </>
  );
}
