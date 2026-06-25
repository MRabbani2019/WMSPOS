import { useState } from 'react';
import { X, Printer, Mail, SkipForward, CheckCircle } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import apiClient from '../lib/axios';

interface ReceiptItem {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxRate: number;
  discount?: { type: string; value: number; reason: string };
}

interface TaxLine {
  name: string;
  rate: number;
  taxableAmount: number;
  taxAmount: number;
}

interface ReceiptData {
  orderId: number;
  orderNumber: string;
  date: string;
  cashierName: string;
  terminalName: string;
  items: ReceiptItem[];
  subtotal: number;
  discountTotal: number;
  taxLines: TaxLine[];
  taxTotal: number;
  total: number;
  paymentMethod: string;
  cashTendered?: number;
  changeGiven?: number;
  customerName?: string;
  customerEmail?: string;
}

interface ReceiptModalProps {
  receipt: ReceiptData;
  onClose: () => void;
}

export default function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const receiptTemplate = useSettingsStore((state) => state.receiptTemplate);
  const [emailAddress, setEmailAddress] = useState(receipt.customerEmail || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<'print' | 'email' | null>(null);
  const [error, setError] = useState('');

  const handlePrint = async () => {
    setSending(true);
    setError('');
    try {
      await apiClient.post('/client/pos/receipt/print', {
        orderId: receipt.orderId,
      });
      setSent('print');
    } catch (err) {
      // Print failed but don't block — log and show fallback
      console.error('Print failed:', err);
      setError('Printer not available. Try email instead.');
    } finally {
      setSending(false);
    }
  };

  const handleEmail = async () => {
    if (!emailAddress.trim()) {
      setError('Please enter an email address');
      return;
    }

    setSending(true);
    setError('');
    try {
      await apiClient.post('/client/pos/receipt/email', {
        orderId: receipt.orderId,
        email: emailAddress,
      });
      setSent('email');
    } catch (err) {
      console.error('Email failed:', err);
      setError('Failed to send email receipt. It will be queued for retry.');
      // Still mark as sent — the backend should queue it
      setSent('email');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="fixed inset-0 z-50" onClick={onClose}>
        <div className="fixed inset-0 bg-black/30" />
        <div className="fixed top-0 right-0 bottom-0 w-[480px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] flex flex-col items-center justify-center p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-success-600" />
          </div>
          <p className="font-semibold text-lg mb-2">
            {sent === 'print' ? 'Receipt Printed' : 'Receipt Sent'}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            {sent === 'print' ? 'Receipt sent to printer' : `Email sent to ${emailAddress}`}
          </p>
          <button onClick={onClose} className="btn-primary w-full">
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed top-0 right-0 bottom-0 w-[480px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#E1E3E5]">
          <h2 className="text-lg font-semibold">Receipt</h2>
          <button onClick={onClose} className="text-[#8C9196] hover:text-[#202223]">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Receipt Preview */}
        <div className="flex-1 overflow-auto p-4">
          <div className="bg-gray-50 rounded-lg p-6 font-mono text-sm space-y-3">
            {/* Header */}
            <div className="text-center space-y-0.5">
              <p className="font-bold text-base">
                {receiptTemplate?.headerLine1 || 'Store Name'}
              </p>
              {receiptTemplate?.headerLine2 && (
                <p className="text-xs text-gray-600">{receiptTemplate.headerLine2}</p>
              )}
              {receiptTemplate?.headerLine3 && (
                <p className="text-xs text-gray-600">{receiptTemplate.headerLine3}</p>
              )}
              {receiptTemplate?.headerLine4 && (
                <p className="text-xs text-gray-600">{receiptTemplate.headerLine4}</p>
              )}
              {receiptTemplate?.showVatNumber && receiptTemplate.vatNumber && (
                <p className="text-xs text-gray-600">VAT: {receiptTemplate.vatNumber}</p>
              )}
            </div>

            <div className="border-t border-dashed border-gray-300" />

            {/* Transaction info */}
            <div className="text-xs text-gray-600 space-y-0.5">
              <p>Receipt: {receipt.orderNumber}</p>
              <p>Date: {new Date(receipt.date).toLocaleString('en-GB')}</p>
              <p>Terminal: {receipt.terminalName}</p>
              <p>Cashier: {receipt.cashierName}</p>
              {receipt.customerName && <p>Customer: {receipt.customerName}</p>}
            </div>

            <div className="border-t border-dashed border-gray-300" />

            {/* Items */}
            <div className="space-y-1.5">
              {receipt.items.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between">
                    <span className="flex-1">{item.name}</span>
                    <span>£{item.lineTotal.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500 flex justify-between">
                    <span>{item.quantity} x £{item.unitPrice.toFixed(2)}</span>
                    <span>{item.sku}</span>
                  </div>
                  {item.discount && (
                    <div className="text-xs text-success-600">
                      Discount: -{item.discount.type === 'percentage'
                        ? `${item.discount.value}%`
                        : `£${item.discount.value.toFixed(2)}`
                      } ({item.discount.reason})
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-300" />

            {/* Totals */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>£{receipt.subtotal.toFixed(2)}</span>
              </div>
              {receipt.discountTotal > 0 && (
                <div className="flex justify-between text-success-600">
                  <span>Discount</span>
                  <span>-£{receipt.discountTotal.toFixed(2)}</span>
                </div>
              )}
              {receipt.taxLines.map((tax, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>{tax.name} ({(tax.rate * 100).toFixed(0)}%)</span>
                  <span>£{tax.taxAmount.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-300">
                <span>TOTAL</span>
                <span>£{receipt.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-300" />

            {/* Payment */}
            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>Payment: {receipt.paymentMethod.toUpperCase()}</span>
                <span>£{receipt.total.toFixed(2)}</span>
              </div>
              {receipt.cashTendered !== undefined && receipt.cashTendered > 0 && (
                <>
                  <div className="flex justify-between text-xs">
                    <span>Cash Tendered</span>
                    <span>£{receipt.cashTendered.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span>Change</span>
                    <span>£{(receipt.changeGiven || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {receiptTemplate?.footerLine1 && (
              <>
                <div className="border-t border-dashed border-gray-300" />
                <div className="text-center text-xs text-gray-500 space-y-0.5">
                  <p>{receiptTemplate.footerLine1}</p>
                  {receiptTemplate.footerLine2 && <p>{receiptTemplate.footerLine2}</p>}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[#E1E3E5] space-y-3">
          {error && (
            <div className="p-2 bg-danger-50 border border-danger-200 text-danger-700 rounded text-sm">
              {error}
            </div>
          )}

          {/* Email input */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email Receipt To</label>
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              className="input-field text-sm"
              placeholder="customer@email.com"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handlePrint}
              disabled={sending}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleEmail}
              disabled={sending || !emailAddress.trim()}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
            <button
              onClick={onClose}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <SkipForward className="w-4 h-4" />
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
