import { CheckCircle, Clock, Truck, ShoppingBag } from 'lucide-react';

interface SaleCompleteProps {
  sale: any;
  onNewSale: () => void;
}

export default function SaleComplete({ sale, onNewSale }: SaleCompleteProps) {
  const fulfillment = sale.fulfillmentType || 'take_now';

  const fulfillmentConfig = {
    take_now: {
      icon: ShoppingBag,
      title: 'Sale Complete!',
      subtitle: 'Customer has their items',
      color: 'text-success-600',
      bg: 'bg-success-100',
    },
    collect_wait: {
      icon: Clock,
      title: 'Order Created',
      subtitle: 'Warehouse will pick the items — customer waiting',
      color: 'text-warning-600',
      bg: 'bg-warning-100',
    },
    ship_to_address: {
      icon: Truck,
      title: 'Order Created',
      subtitle: 'Warehouse will pick, pack, and ship to customer',
      color: 'text-primary-600',
      bg: 'bg-primary-100',
    },
  };

  const config = fulfillmentConfig[fulfillment as keyof typeof fulfillmentConfig] || fulfillmentConfig.take_now;
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 bg-white flex items-center justify-center ml-[72px]">
      <div className="max-w-md w-full text-center p-8">
        {/* Checkmark circle */}
        <div className={`w-24 h-24 ${config.bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Icon className={`w-14 h-14 ${config.color}`} />
        </div>

        <h2 className="text-[28px] font-bold text-[#202223] mb-1">{config.title}</h2>
        <p className="text-sm text-[#6D7175] mb-1">{config.subtitle}</p>
        <p className="text-[#8C9196] mb-8">{sale.orderNumber}</p>

        {/* Amount box */}
        <div className="bg-[#F6F6F7] rounded-2xl p-8 mb-8">
          <p className="text-sm text-[#6D7175] mb-1">Amount Paid</p>
          <p className="text-[36px] font-bold text-[#202223] mb-4">£{sale.total.toFixed(2)}</p>

          {sale.paymentMethod === 'cash' && sale.change > 0 && (
            <div>
              <p className="text-sm text-[#6D7175] mb-1">Change Given</p>
              <p className="text-2xl font-bold text-primary-500">
                £{sale.change.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {fulfillment === 'collect_wait' && (
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-4 text-left">
            <p className="text-sm font-medium text-warning-800">Waiting for pickup</p>
            <p className="text-xs text-warning-700 mt-1">
              This order is now in the warehouse queue. The team will pick the items and bring them to the counter.
            </p>
          </div>
        )}

        {fulfillment === 'ship_to_address' && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4 text-left">
            <p className="text-sm font-medium text-primary-800">Shipping order</p>
            <p className="text-xs text-primary-700 mt-1">
              This order is now in the warehouse queue for picking, packing, and dispatch. The customer will receive tracking details.
            </p>
          </div>
        )}

        <button
          onClick={onNewSale}
          className="h-14 w-full max-w-xs mx-auto rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold text-lg inline-flex items-center justify-center transition-colors active:scale-[0.98]"
        >
          New Sale
        </button>
      </div>
    </div>
  );
}
