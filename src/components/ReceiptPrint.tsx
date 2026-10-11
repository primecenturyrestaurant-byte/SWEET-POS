import React, { useEffect } from 'react';
import { Bill, ShopSettings } from '../types';
import { formatRupee, formatQuantityWithUnit } from '../lib/calculations';
import { Printer, X, Download, FileText, CheckCircle2 } from 'lucide-react';

interface ReceiptPrintProps {
  bill: Bill;
  settings: ShopSettings;
  onClose?: () => void;
  autoPrint?: boolean;
}

export const ReceiptPrint: React.FC<ReceiptPrintProps> = ({
  bill,
  settings,
  onClose,
  autoPrint = false,
}) => {
  const [selectedFormat, setSelectedFormat] = React.useState<'58mm' | '80mm' | 'a4'>(
    settings.printFormat || '80mm'
  );

  useEffect(() => {
    // Set format class on document body for print styling
    document.body.classList.add('is-printing-receipt');
    document.body.classList.remove('print-receipt-58mm', 'print-receipt-80mm', 'print-invoice-a4');
    if (selectedFormat === '58mm') {
      document.body.classList.add('print-receipt-58mm');
    } else if (selectedFormat === '80mm') {
      document.body.classList.add('print-receipt-80mm');
    } else {
      document.body.classList.add('print-invoice-a4');
    }

    return () => {
      document.body.classList.remove(
        'print-receipt-58mm',
        'print-receipt-80mm',
        'print-invoice-a4',
        'is-printing-receipt'
      );
    };
  }, [selectedFormat]);

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(bill.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = new Date(bill.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <>
      {/* ON-SCREEN MODAL PREVIEW */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 no-print">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[92vh] overflow-hidden border border-[#e8d8c8]">
          {/* Top Control Bar */}
          <div className="px-5 py-3.5 bg-[#FAF7F2] border-b border-[#e8d8c8] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#781324] text-white flex items-center justify-center font-serif font-bold text-sm">
                P
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 text-sm leading-tight">
                  Receipt Preview — {bill.billNumber}
                </h3>
                <p className="text-xs text-neutral-500">
                  Thermal & A4 Print Engine
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Format Switcher */}
              <div className="flex items-center bg-white border border-[#e8d8c8] rounded-lg p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setSelectedFormat('58mm')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    selectedFormat === '58mm'
                      ? 'bg-[#781324] text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  58mm
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFormat('80mm')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    selectedFormat === '80mm'
                      ? 'bg-[#781324] text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  80mm
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFormat('a4')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    selectedFormat === 'a4'
                      ? 'bg-[#781324] text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  A4 Tax Invoice
                </button>
              </div>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#781324] hover:bg-[#5c0e1b] text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Bill</span>
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                  title="Close Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Receipt Preview Canvas Area */}
          <div className="p-4 sm:p-6 bg-neutral-100 overflow-y-auto flex justify-center">
            <div
              className={`bg-white shadow-md border border-neutral-200 transition-all ${
                selectedFormat === '58mm'
                  ? 'w-[280px] p-3 text-[11px]'
                  : selectedFormat === '80mm'
                  ? 'w-[360px] p-4 text-[12px]'
                  : 'w-[540px] p-8 text-[13px]'
              }`}
            >
              {/* Receipt Content Rendered for Preview */}
              <ReceiptTemplate
                bill={bill}
                settings={settings}
                format={selectedFormat}
                formattedDate={formattedDate}
                formattedTime={formattedTime}
              />
            </div>
          </div>

          {/* Footer Action Strip */}
          <div className="px-5 py-3 bg-[#FAF7F2] border-t border-[#e8d8c8] flex items-center justify-between text-xs text-neutral-500">
            <span>
              Status: <strong className="uppercase text-emerald-700">{bill.status}</strong> · Cashier: {bill.cashierName}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="font-medium text-[#781324] hover:underline"
              >
                Open System Print Dialog (Ctrl+P)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PRINT-ONLY ELEMENT SENT TO THERMAL PRINTER */}
      <div className="print-only">
        <ReceiptTemplate
          bill={bill}
          settings={settings}
          format={selectedFormat}
          formattedDate={formattedDate}
          formattedTime={formattedTime}
        />
      </div>
    </>
  );
};

interface ReceiptTemplateProps {
  bill: Bill;
  settings: ShopSettings;
  format: '58mm' | '80mm' | 'a4';
  formattedDate: string;
  formattedTime: string;
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({
  bill,
  settings,
  format,
  formattedDate,
  formattedTime,
}) => {
  const isA4 = format === 'a4';
  const is58mm = format === '58mm';

  return (
    <div
      className={`receipt-thermal-wrapper font-mono leading-tight text-neutral-900 ${
        isA4 ? 'receipt-format-a4 font-sans' : is58mm ? 'receipt-format-58mm' : 'receipt-format-80mm'
      }`}
    >
      {/* HEADER */}
      <div className="receipt-header text-center pb-1.5 border-b border-dashed border-neutral-400">
        <div className="font-serif font-black text-base sm:text-lg tracking-wide uppercase text-neutral-900 leading-tight">
          {settings.shopName}
        </div>
        {settings.tagline && (
          <div className="text-[9px] text-neutral-600 italic leading-tight mt-0.5">
            "{settings.tagline}"
          </div>
        )}
        <div className="text-[9px] mt-0.5 text-neutral-700 max-w-[95%] mx-auto leading-tight">
          {settings.address}
        </div>
        <div className="text-[9px] text-neutral-700 leading-tight mt-0.5">
          Tel: {settings.phone}
        </div>
        {settings.gstin && (
          <div className="text-[9px] font-semibold text-neutral-800 leading-tight">
            GSTIN: {settings.gstin}
          </div>
        )}
        {settings.fssai && (
          <div className="text-[9px] text-neutral-600 leading-tight">
            FSSAI Lic: {settings.fssai}
          </div>
        )}
        {settings.ownerName && (
          <div className="text-[9px] text-neutral-800 font-semibold leading-tight">
            Proprietor: {settings.ownerName}
          </div>
        )}
        <div className="text-[10px] font-bold mt-1 uppercase tracking-wider text-neutral-900 border-t border-b border-neutral-800 py-0.5">
          {isA4 ? 'TAX INVOICE' : 'RETAIL CASH MEMO'}
        </div>
      </div>

      {/* INVOICE & CUSTOMER INFO */}
      <div className="receipt-meta py-1.5 text-[9px] border-b border-dashed border-neutral-400 space-y-0.5">
        <div className="flex justify-between">
          <span>Bill No: <strong>{bill.billNumber}</strong></span>
          <span>{formattedDate}</span>
        </div>
        <div className="flex justify-between">
          <span>Cashier: {bill.cashierName}</span>
          <span>{formattedTime}</span>
        </div>
        {bill.customerName && (
          <div className="flex justify-between">
            <span>Customer: <strong>{bill.customerName}</strong></span>
            {bill.customerPhone && <span>{bill.customerPhone}</span>}
          </div>
        )}
        <div className="flex justify-between text-neutral-600">
          <span>State: {settings.state} ({settings.stateCode})</span>
          <span>Pay: <strong className="uppercase">{bill.paymentMethod}</strong></span>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <div className="receipt-items-container py-1 border-b border-dashed border-neutral-400">
        <div className="flex text-[9px] font-bold border-b border-neutral-300 pb-0.5 mb-1 text-neutral-800">
          <span className="flex-1">Item</span>
          <span className="w-16 text-right">Qty/Rate</span>
          <span className="w-14 text-right">Amt (₹)</span>
        </div>

        <div className="space-y-1">
          {bill.items.map((item, idx) => {
            const qtyStr = `${item.displayQuantity}${item.displayUnit}`;
            const rateStr = `₹${item.unitPrice}/${item.baseUnit}`;
            return (
              <div key={idx} className="receipt-item-row text-[9px] border-b border-dotted border-neutral-200 last:border-0 pb-0.5">
                <div className="flex justify-between items-start gap-1">
                  <div className="flex-1 min-w-0 pr-1">
                    <span className="font-semibold text-neutral-900 break-words leading-tight block">
                      {item.name}
                    </span>
                    <span className="text-[8.5px] text-neutral-600 leading-tight block">
                      {qtyStr} @ {rateStr} {item.gstRate > 0 ? `(${item.gstRate}% GST)` : ''}
                    </span>
                    {item.itemDiscountAmount > 0 && (
                      <span className="text-[8px] text-neutral-500 block">
                        Discount: -₹{item.itemDiscountAmount.toFixed(2)} ({item.itemDiscountPercent}%)
                      </span>
                    )}
                  </div>
                  <div className="w-14 text-right font-bold font-mono text-neutral-900 shrink-0 whitespace-nowrap pt-0.5">
                    ₹{item.lineTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TOTALS & BREAKDOWN */}
      <div className="receipt-totals py-1 border-b border-dashed border-neutral-400 space-y-0.5 text-[9px]">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span className="font-mono">₹{bill.subtotal.toFixed(2)}</span>
        </div>

        {(bill.totalItemDiscount > 0 || bill.additionalDiscount > 0) && (
          <div className="flex justify-between text-neutral-600">
            <span>Total Discount:</span>
            <span className="font-mono">-₹{(bill.totalItemDiscount + bill.additionalDiscount).toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between text-neutral-700 font-medium">
          <span>Taxable Amount:</span>
          <span className="font-mono">₹{bill.taxableAmount.toFixed(2)}</span>
        </div>

        {/* GST Breakdowns */}
        {!bill.isInterState ? (
          <>
            <div className="flex justify-between text-neutral-600">
              <span>CGST:</span>
              <span className="font-mono">₹{bill.cgstTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>SGST:</span>
              <span className="font-mono">₹{bill.sgstTotal.toFixed(2)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between text-neutral-600">
            <span>IGST:</span>
            <span className="font-mono">₹{bill.igstTotal.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between text-neutral-700 font-semibold border-t border-dotted border-neutral-300 pt-0.5">
          <span>Total GST:</span>
          <span className="font-mono">₹{bill.totalTax.toFixed(2)}</span>
        </div>

        {bill.roundOff !== 0 && (
          <div className="flex justify-between text-neutral-600">
            <span>Round Off:</span>
            <span className="font-mono">{bill.roundOff > 0 ? `+₹${bill.roundOff.toFixed(2)}` : `-₹${Math.abs(bill.roundOff).toFixed(2)}`}</span>
          </div>
        )}

        {/* GRAND TOTAL */}
        <div className="flex justify-between text-xs font-bold pt-1 border-t-2 border-neutral-900 text-neutral-900 mt-1">
          <span className="uppercase">GRAND TOTAL:</span>
          <span className="text-sm font-mono font-black">₹{bill.grandTotal.toFixed(2)}</span>
        </div>

        {/* PAYMENT DETAILS */}
        <div className="receipt-payment pt-1 text-[9px] border-t border-dotted border-neutral-200 mt-0.5">
          <div className="flex justify-between">
            <span>Payment Mode:</span>
            <span className="font-semibold uppercase">{bill.paymentMethod}</span>
          </div>

          {bill.paymentMethod === 'cash' && bill.amountReceived !== undefined && (
            <>
              <div className="flex justify-between text-neutral-600">
                <span>Cash Received:</span>
                <span className="font-mono">₹{(bill.amountReceived || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-neutral-800">
                <span>Change Returned:</span>
                <span className="font-mono">₹{(bill.changeDue || 0).toFixed(2)}</span>
              </div>
            </>
          )}

          {bill.paymentMethod === 'split' && bill.splitDetails && (
            <div className="text-[8.5px] text-neutral-600 pl-2">
              <div>Cash: ₹{bill.splitDetails.cash.toFixed(2)}</div>
              <div>UPI: ₹{bill.splitDetails.upi.toFixed(2)}</div>
              <div>Card: ₹{bill.splitDetails.card.toFixed(2)}</div>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER & SIGNATORY */}
      <div className="receipt-signatory pt-1.5 border-t border-dashed border-neutral-400 mt-1 flex justify-between items-end text-[8.5px] text-neutral-700">
        <div>
          <span>Cashier: <strong>{bill.cashierName}</strong></span>
        </div>
        <div className="text-right">
          <div className="text-[7.5px] text-neutral-500">For {settings.shopName}</div>
          <div className="font-bold text-neutral-900">{settings.ownerName || 'Authorized Signatory'}</div>
        </div>
      </div>

      <div className="receipt-footer text-center pt-1.5 text-[9px] space-y-0.5 pb-1">
        <p className="font-medium text-neutral-800">
          {settings.footerMessage || 'Thank you for visiting Prime Century Sweet!'}
        </p>
        <p className="text-[8px] text-neutral-500">
          * GST Included as per Government Norms *
        </p>
        <p className="text-[7.5px] text-neutral-400">
          Printed on {new Date().toLocaleString('en-IN')}
        </p>
      </div>
    </div>
  );
};
