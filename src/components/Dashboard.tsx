import React from 'react';
import { Bill, Product, ShopSettings } from '../types';
import { formatRupee } from '../lib/calculations';
import {
  IndianRupee,
  Receipt,
  Package,
  Percent,
  CreditCard,
  QrCode,
  Banknote,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Calendar,
  Eye,
  Printer,
} from 'lucide-react';

interface DashboardProps {
  bills: Bill[];
  products: Product[];
  settings: ShopSettings;
  onOpenNewBill: () => void;
  onViewBill: (bill: Bill) => void;
  onPrintBill: (bill: Bill) => void;
  onNavigateToTab: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  bills,
  products,
  settings,
  onOpenNewBill,
  onViewBill,
  onPrintBill,
  onNavigateToTab,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM

  // Filter completed or edited bills (exclude cancelled/refunded from revenue)
  const activeBills = bills.filter(
    (b) => b.status === 'completed' || b.status === 'edited'
  );

  const todayBills = activeBills.filter((b) => b.createdAt.startsWith(todayStr));
  const monthBills = activeBills.filter((b) => b.createdAt.startsWith(currentMonthStr));

  // Today metrics strictly from saved transactions
  const todaySales = todayBills.reduce((acc, b) => acc + b.grandTotal, 0);
  const todayBillCount = todayBills.length;
  const todayItemsSold = todayBills.reduce(
    (acc, b) => acc + b.items.reduce((sum, item) => sum + (item.baseUnit === 'kg' ? item.quantity : item.displayQuantity), 0),
    0
  );
  const todayGst = todayBills.reduce((acc, b) => acc + b.totalTax, 0);

  // Today payment breakup
  let todayCash = 0;
  let todayUpi = 0;
  let todayCard = 0;

  for (const b of todayBills) {
    if (b.paymentMethod === 'cash') todayCash += b.grandTotal;
    else if (b.paymentMethod === 'upi') todayUpi += b.grandTotal;
    else if (b.paymentMethod === 'card') todayCard += b.grandTotal;
    else if (b.paymentMethod === 'split' && b.splitDetails) {
      todayCash += b.splitDetails.cash || 0;
      todayUpi += b.splitDetails.upi || 0;
      todayCard += b.splitDetails.card || 0;
    }
  }

  const todayDiscounts = todayBills.reduce(
    (acc, b) => acc + b.totalItemDiscount + b.additionalDiscount,
    0
  );

  const monthlySales = monthBills.reduce((acc, b) => acc + b.grandTotal, 0);

  // Low stock products
  const lowStockProducts = products.filter(
    (p) => p.isActive && p.stockQty <= p.minStockLevel
  );

  // Last 7 days sales calculation for trend chart
  const last7Days: { dateStr: string; label: string; amount: number; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
    const dayBills = activeBills.filter((b) => b.createdAt.startsWith(dateStr));
    const amount = dayBills.reduce((acc, b) => acc + b.grandTotal, 0);
    last7Days.push({ dateStr, label, amount, count: dayBills.length });
  }

  const max7DayAmount = Math.max(...last7Days.map((d) => d.amount), 1);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Hero Welcome & Quick Action Banner */}
      <div className="bg-gradient-to-r from-[#781324] via-[#630f1e] to-[#4d0c17] rounded-xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-[#922137]">
        <div className="space-y-1.5 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#e8c878] text-xs font-bold uppercase tracking-wider">
              {settings.shopName}
            </span>
            <span className="bg-[#FAF7F2]/15 text-[11px] px-2 py-0.5 rounded text-white font-medium">
              Live Terminal
            </span>
            {settings.ownerName && (
              <span className="bg-[#FAF7F2]/20 border border-[#e8c878]/30 text-[11px] px-2.5 py-0.5 rounded-full text-[#e8c878] font-bold">
                Proprietor: {settings.ownerName}
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold tracking-tight">
            Sweet Shop Daily Operations
          </h2>
          <p className="text-xs text-[#eed5d5] max-w-xl">
            Real-time counter sales, inventory tracking, GST compliance, and thermal receipt billing.{settings.ownerName ? ` Managed by ${settings.ownerName}.` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
          <button
            type="button"
            onClick={onOpenNewBill}
            className="w-full md:w-auto px-5 py-2.5 bg-[#e8c878] hover:bg-[#dfbd6a] text-[#4d0c17] text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>Create New Bill (F2)</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (8 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wide">Today's Sales</span>
            <IndianRupee className="w-4 h-4 text-[#781324]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 tabular-nums">
            {formatRupee(todaySales)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {todayBillCount} {todayBillCount === 1 ? 'bill generated' : 'bills generated'}
          </div>
        </div>

        {/* Monthly Sales */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wide">Monthly Sales</span>
            <Calendar className="w-4 h-4 text-[#781324]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 tabular-nums">
            {formatRupee(monthlySales)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {monthBills.length} total bills this month
          </div>
        </div>

        {/* Today GST Collected */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wide">Today's GST</span>
            <Percent className="w-4 h-4 text-[#781324]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 tabular-nums">
            {formatRupee(todayGst)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Intra/Inter state tax collected
          </div>
        </div>

        {/* Total Discounts */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wide">Discounts Given</span>
            <TrendingUp className="w-4 h-4 text-[#781324]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 tabular-nums">
            {formatRupee(todayDiscounts)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Item & bill promotional cuts
          </div>
        </div>

        {/* Cash Sales */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wide">Cash Sales</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-neutral-900 tabular-nums">
            {formatRupee(todayCash)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Cash register collected
          </div>
        </div>

        {/* UPI Sales */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wide">UPI / QR Sales</span>
            <QrCode className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-neutral-900 tabular-nums">
            {formatRupee(todayUpi)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            GPay / PhonePe / Paytm
          </div>
        </div>

        {/* Card Sales */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wide">Card Sales</span>
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-neutral-900 tabular-nums">
            {formatRupee(todayCard)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Debit & Credit cards
          </div>
        </div>

        {/* Low Stock Warning */}
        <div
          onClick={() => onNavigateToTab('inventory')}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
            lowStockProducts.length > 0
              ? 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/60'
              : 'bg-white border-neutral-200/80'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wide text-amber-800">
              Low Stock Alerts
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-900 tabular-nums">
            {lowStockProducts.length} items
          </div>
          <div className="text-[11px] text-amber-700 mt-1 flex items-center justify-between">
            <span>Needs restocking</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* 2-Column Split: Sales Trend Chart & Low-Stock Quick View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Sales Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-neutral-900 text-sm">
                Last 7 Days Sales Trend
              </h3>
              <p className="text-xs text-neutral-500">
                Daily recorded revenue from saved customer bills
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab('reports')}
              className="text-xs text-[#781324] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View Full Reports</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="pt-4">
            <div className="h-44 flex items-end gap-2 sm:gap-4 px-2 border-b border-neutral-200">
              {last7Days.map((day, idx) => {
                const heightPercent = Math.max(
                  6,
                  Math.round((day.amount / max7DayAmount) * 100)
                );
                const isToday = day.dateStr === todayStr;

                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center gap-2 group relative h-full justify-end"
                  >
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-neutral-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-20 pointer-events-none">
                      {formatRupee(day.amount)} ({day.count} bills)
                    </div>

                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t transition-all ${
                        isToday
                          ? 'bg-[#781324] hover:bg-[#630f1e]'
                          : 'bg-[#d8c5b8] hover:bg-[#bfa594]'
                      }`}
                    />
                    <span className="text-[10px] font-medium text-neutral-500 text-center truncate w-full">
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Low Stock Fast Glance */}
        <div className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                <span>Inventory Alerts</span>
                {lowStockProducts.length > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                    {lowStockProducts.length} Alert
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => onNavigateToTab('inventory')}
                className="text-xs text-[#781324] font-semibold hover:underline cursor-pointer"
              >
                Manage
              </button>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-xs">
                <Package className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                All sweets are stocked above minimum safety thresholds!
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 max-h-56 overflow-y-auto">
                {lowStockProducts.slice(0, 5).map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-neutral-800">{p.name}</div>
                      <div className="text-[11px] text-neutral-500">
                        Threshold: {p.minStockLevel} {p.unit}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-amber-700 tabular-nums">
                        {p.stockQty} {p.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigateToTab('inventory')}
            className="w-full mt-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center"
          >
            Go to Restock & Stock Movements
          </button>
        </div>
      </div>

      {/* Recent Bills Table */}
      <div className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm">
              Recent Billing Transactions
            </h3>
            <p className="text-xs text-neutral-500">
              Live audit stream of counter orders
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('sales-history')}
            className="text-xs text-[#781324] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All Sales ({bills.length})</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {bills.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 text-xs">
            <Receipt className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
            <p className="text-neutral-700 font-medium text-sm">No bills generated yet.</p>
            <p className="mt-1">Click "Create New Bill" above to start cashiering.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500 font-medium">
                  <th className="pb-2.5 font-semibold">Bill No.</th>
                  <th className="pb-2.5 font-semibold">Date & Time</th>
                  <th className="pb-2.5 font-semibold">Customer</th>
                  <th className="pb-2.5 font-semibold">Items</th>
                  <th className="pb-2.5 font-semibold">Mode</th>
                  <th className="pb-2.5 font-semibold text-right">Taxable</th>
                  <th className="pb-2.5 font-semibold text-right">GST</th>
                  <th className="pb-2.5 font-semibold text-right">Grand Total</th>
                  <th className="pb-2.5 font-semibold text-center">Status</th>
                  <th className="pb-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {bills.slice(0, 8).map((bill) => {
                  const billDate = new Date(bill.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                  });
                  const billTime = new Date(bill.createdAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });

                  return (
                    <tr key={bill.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-2.5 font-mono font-bold text-[#781324]">
                        {bill.billNumber}
                      </td>
                      <td className="py-2.5 text-neutral-600">
                        {billDate} <span className="text-neutral-400">·</span> {billTime}
                      </td>
                      <td className="py-2.5 text-neutral-800">
                        {bill.customerName ? (
                          <div>
                            <span className="font-medium">{bill.customerName}</span>
                            {bill.customerPhone && (
                              <span className="block text-[11px] text-neutral-400">
                                {bill.customerPhone}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400 italic">Walk-in</span>
                        )}
                      </td>
                      <td className="py-2.5 text-neutral-600">
                        {bill.items.length} {bill.items.length === 1 ? 'item' : 'items'}
                      </td>
                      <td className="py-2.5 uppercase text-neutral-700 font-semibold text-[11px]">
                        {bill.paymentMethod}
                      </td>
                      <td className="py-2.5 text-right font-mono text-neutral-600 tabular-nums">
                        {formatRupee(bill.taxableAmount)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-neutral-600 tabular-nums">
                        {formatRupee(bill.totalTax)}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-neutral-900 tabular-nums">
                        {formatRupee(bill.grandTotal)}
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            bill.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : bill.status === 'edited'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewBill(bill)}
                            className="p-1.5 text-neutral-600 hover:text-[#781324] hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintBill(bill)}
                            className="p-1.5 text-[#781324] hover:text-[#5c0e1b] hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                            title="Print Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
