import { CheckCircle } from 'lucide-react';

interface SaleCompleteProps {
  sale: any;
  onNewSale: () => void;
}

export default function SaleComplete({ sale, onNewSale }: SaleCompleteProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-8 text-center">
          <div className="w-20 h-20 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-success-600" />
          </div>

          <h2 className="text-2xl font-bold mb-2">Sale Complete!</h2>
          <p className="text-gray-500 mb-6">{sale.orderNumber}</p>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <p className="text-sm text-gray-600 mb-1">Amount Paid</p>
            <p className="text-4xl font-bold mb-4">£{sale.total.toFixed(2)}</p>

            {sale.paymentMethod === 'cash' && sale.change > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Change Given</p>
                <p className="text-2xl font-bold text-success-600">
                  £{sale.change.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={onNewSale}
            className="btn-success w-full text-lg py-3"
          >
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
}
