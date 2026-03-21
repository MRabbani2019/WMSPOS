import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import ProductGrid from '../components/ProductGrid';
import Cart from '../components/Cart';
import PaymentModal from '../components/PaymentModal';
import SaleComplete from '../components/SaleComplete';

export default function MainPOS() {
  const navigate = useNavigate();
  const [showPayment, setShowPayment] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);

  const handleCheckout = () => {
    setShowPayment(true);
  };

  const handlePaymentComplete = (sale: any) => {
    setShowPayment(false);
    setCompletedSale(sale);
    setShowComplete(true);
  };

  const handleNewSale = () => {
    setShowComplete(false);
    setCompletedSale(null);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TopBar />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          <ProductGrid />
        </div>

        <div className="w-96 border-l border-gray-200 bg-white">
          <Cart onCheckout={handleCheckout} />
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          onClose={() => setShowPayment(false)}
          onComplete={handlePaymentComplete}
        />
      )}

      {showComplete && completedSale && (
        <SaleComplete
          sale={completedSale}
          onNewSale={handleNewSale}
        />
      )}
    </div>
  );
}
