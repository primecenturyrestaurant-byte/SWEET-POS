import React, { useState, useMemo } from 'react';
import { Bill, Product, ShopSettings } from '../types';
import { formatRupee, formatQuantityWithUnit } from '../lib/calculations';
import { exportSalesReportToExcel } from '../lib/excelExport';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  Receipt,
  Layers,
  Percent,
  IndianRupee,
  Package,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface ReportsProps {
  bills: Bill[];
  products: Product[];
  settings: ShopSettings;
}

export const Reports: React.FC<ReportsProps> = ({ bills, products, settings }) => {
  const [reportPeriod, setReportPeriod] = useState<
    'today' | 'yesterday' | 'week' | 'month' | 'custom'
  >('today');

  const todayStr = new Date().toISOString().split('T')[0];
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Compute date range
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    if (reportPeriod === 'today') {
      return { startDate: todayStr, endDate: todayStr, periodLabel: "Today's Sales" };
    }
    if (reportPeriod === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      return { startDate: yStr, endDate: yStr, periodLabel: "Yesterday's Sales" };
    }
    if (reportPeriod === 'week') {
      const w = new Date();
      w.setDate(w.getDate() - 6);
      return {
        startDate: w.toISOString().split('T')[0],
        endDate: todayStr,
        periodLabel: 'Last 7 Days',
      };
    }
    if (reportPeriod === 'month') {
      const mStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return { startDate: mStr, endDate: todayStr, periodLabel: 'This Month' };
    }
    return {
      startDate: customStartDate,
      endDate: customEndDate,
      periodLabel: `Custom (${customStartDate} to ${customEndDate})`,
    };
  }, [reportPeriod, customStartDate, customEndDate, todayStr]);

  // Filter bills in date range
  const rangeBills = useMemo(() => {
    return bills.filter((b) => {
      const bDate = b.createdAt.split('T')[0];
      return bDate >= startDate && bDate <= endDate;
    });
  }, [bills, startDate, endDate]);

  // Exclude cancelled & refunded for net sales
  const validBills = useMemo(() => {
    return rangeBills.filter((b) => b.status === 'completed' || b.status === 'edited');
  }, [rangeBills]);

  const cancelledBills = useMemo(() => {
    return rangeBills.filter((b) => b.status === 'cancelled' || b.status === 'refunded');
  }, [rangeBills]);

  // Aggregate Metrics
  const grossSales = rangeBills.reduce((acc, b) => acc + b.grandTotal, 0);
  const netSales = validBills.reduce((acc, b) => acc + b.grandTotal, 0);
  const totalBillsCount = validBills.length;
  const cancelledAmount = cancelledBills.reduce((acc, b) => acc + b.grandTotal, 0);

  const totalTaxable = validBills.reduce((acc, b) => acc + b.taxableAmount, 0);
  const totalGst = validBills.reduce((acc, b) => acc + b.totalTax, 0);
  const totalCgst = validBills.reduce((acc, b) => acc + b.cgstTotal, 0);
  const totalSgst = validBills.reduce((acc, b) => acc + b.sgstTotal, 0);
  const totalIgst = validBills.reduce((acc, b) => acc + b.igstTotal, 0);

  const totalDiscounts = validBills.reduce(
    (acc, b) => acc + b.totalItemDiscount + b.additionalDiscount,
    0
  );

  // Profit calculation (Revenue excluding GST vs Recorded Cost Price)
  let totalCostPrice = 0;
  let totalWeightSoldKg = 0;
  let totalPiecesSold = 0;

  validBills.forEach((b) => {
    b.items.forEach((item) => {
      totalCostPrice += item.costPrice * item.quantity;
      if (item.baseUnit === 'kg') {
        totalWeightSoldKg += item.quantity;
      } else {
        totalPiecesSold += item.displayQuantity;
      }
    });
  });

  const estimatedProfit = Math.max(0, totalTaxable - totalCostPrice);
  const profitMargin = totalTaxable > 0 ? ((estimatedProfit / totalTaxable) * 100).toFixed(1) : '0';

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    let cash = 0;
    let upi = 0;
    let card = 0;

    validBills.forEach((b) => {
      if (b.paymentMethod === 'cash') cash += b.grandTotal;
      else if (b.paymentMethod === 'upi') upi += b.grandTotal;
      else if (b.paymentMethod === 'card') card += b.grandTotal;
      else if (b.paymentMethod === 'split' && b.splitDetails) {
        cash += b.splitDetails.cash || 0;
        upi += b.splitDetails.upi || 0;
        card += b.splitDetails.card || 0;
      }
    });
    return { cash, upi, card };
  }, [validBills]);

  // Product-wise sales breakdown
  const productSalesMap = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        category: string;
        unit: string;
        totalQty: number;
        revenue: number;
        tax: number;
        profit: number;
      }
    >();

    validBills.forEach((b) => {
      b.items.forEach((item) => {
        const existing = map.get(item.productId) || {
          name: item.name,
          category: item.category,
          unit: item.baseUnit,
          totalQty: 0,
          revenue: 0,
          tax: 0,
          profit: 0,
        };

        const itemRev = item.lineTotal;
        const itemCost = item.costPrice * item.quantity;
        const itemProf = item.taxableAmount - itemCost;

        existing.totalQty += item.quantity;
        existing.revenue += itemRev;
        existing.tax += item.totalGstAmount;
        existing.profit += itemProf;

        map.set(item.productId, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [validBills]);

  // Category-wise sales breakdown
  const categorySalesMap = useMemo(() => {
    const map = new Map<string, { revenue: number; itemsCount: number }>();
    validBills.forEach((b) => {
      b.items.forEach((item) => {
        const cat = item.category || 'General';
        const cur = map.get(cat) || { revenue: 0, itemsCount: 0 };
        cur.revenue += item.lineTotal;
        cur.itemsCount += 1;
        map.set(cat, cur);
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [validBills]);

  // Export to CSV
  const handleExportCSV = () => {
    const rows: string[][] = [
      ['PRIME CENTURY SWEET - SALES REPORT'],
      [`Period: ${periodLabel}`, `From: ${startDate}`, `To: ${endDate}`],
      [''],
      ['SUMMARY METRICS'],
      ['Gross Sales (₹)', grossSales.toFixed(2)],
      ['Net Sales (₹)', netSales.toFixed(2)],
      ['Total Valid Bills', totalBillsCount.toString()],
      ['Cancelled / Refunded Bills', cancelledBills.length.toString()],
      ['Cancelled / Refunded Amount (₹)', cancelledAmount.toFixed(2)],
      ['Taxable Revenue (₹)', totalTaxable.toFixed(2)],
      ['Total GST Collected (₹)', totalGst.toFixed(2)],
      ['CGST (₹)', totalCgst.toFixed(2)],
      ['SGST (₹)', totalSgst.toFixed(2)],
      ['IGST (₹)', totalIgst.toFixed(2)],
      ['Total Discounts (₹)', totalDiscounts.toFixed(2)],
      ['Estimated Net Profit (₹)', estimatedProfit.toFixed(2)],
      [''],
      ['PRODUCT-WISE SALES'],
      ['Product Name', 'Category', 'Quantity Sold', 'Unit', 'Revenue (₹)', 'Est. Profit (₹)'],
    ];

    productSalesMap.forEach((p) => {
      rows.push([
        p.name,
        p.category,
        p.totalQty.toFixed(2),
        p.unit,
        p.revenue.toFixed(2),
        p.profit.toFixed(2),
      ]);
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PrimeCenturySweet_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel (.xlsx) with multiple sheets (Invoices, GSTR-1, Item-Wise Sales, Metadata)
  const handleExportExcel = () => {
    exportSalesReportToExcel(
      rangeBills,
      products,
      settings,
      startDate,
      endDate,
      periodLabel
    );
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title & Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 tracking-tight">
              Sales & Financial Reports
            </h2>
            {settings.ownerName && (
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF7F2] text-[#781324] border border-[#d4af37]/50">
                Proprietor: {settings.ownerName}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            {settings.shopName} · Daily, monthly and custom sales analytics, GST reconciliation, and profitability metrics
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Excel Export Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Download multi-sheet Excel workbook with Invoices, GSTR-1 and Item-Wise breakdown"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export to Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrintReport}
            className="px-3.5 py-2 bg-[#781324] hover:bg-[#600f1c] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector Bar */}
      <div className="bg-white p-3 rounded-xl border border-neutral-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setReportPeriod('today')}
            className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
              reportPeriod === 'today' ? 'bg-white shadow-xs text-neutral-900 font-bold' : 'text-neutral-600'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setReportPeriod('yesterday')}
            className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
              reportPeriod === 'yesterday' ? 'bg-white shadow-xs text-neutral-900 font-bold' : 'text-neutral-600'
            }`}
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => setReportPeriod('week')}
            className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
              reportPeriod === 'week' ? 'bg-white shadow-xs text-neutral-900 font-bold' : 'text-neutral-600'
            }`}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => setReportPeriod('month')}
            className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
              reportPeriod === 'month' ? 'bg-white shadow-xs text-neutral-900 font-bold' : 'text-neutral-600'
            }`}
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => setReportPeriod('custom')}
            className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
              reportPeriod === 'custom' ? 'bg-white shadow-xs text-neutral-900 font-bold' : 'text-neutral-600'
            }`}
          >
            Custom Range
          </button>
        </div>

        {reportPeriod === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-500">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2 py-1 border border-neutral-300 rounded bg-[#FAF7F2]"
            />
            <span className="text-neutral-500">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2 py-1 border border-neutral-300 rounded bg-[#FAF7F2]"
            />
          </div>
        )}
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Net Sales */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Net Sales Revenue
          </span>
          <div className="text-2xl font-bold font-mono text-[#781324] mt-1 tabular-nums">
            {formatRupee(netSales)}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Excludes cancelled & refunds ({formatRupee(cancelledAmount)})
          </p>
        </div>

        {/* Total Bills & Units */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Total Orders & Volume
          </span>
          <div className="text-2xl font-bold font-mono text-neutral-900 mt-1 tabular-nums">
            {totalBillsCount} Bills
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Sold: <strong>{totalWeightSoldKg.toFixed(2)} kg</strong> +{' '}
            <strong>{totalPiecesSold} pcs</strong>
          </p>
        </div>

        {/* GST Breakup */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            GST Collected (Net)
          </span>
          <div className="text-2xl font-bold font-mono text-neutral-900 mt-1 tabular-nums">
            {formatRupee(totalGst)}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            CGST: {formatRupee(totalCgst)} · SGST: {formatRupee(totalSgst)}
          </p>
        </div>

        {/* Estimated Gross Profit */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Estimated Profit
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
            {formatRupee(estimatedProfit)}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Profit Margin: <strong>{profitMargin}%</strong> on taxable revenue
          </p>
        </div>
      </div>

      {/* Payment & Category Split Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment Methods */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs space-y-3">
          <h3 className="font-semibold text-neutral-900 text-sm">
            Payment Method Breakdown
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg">
              <span className="font-medium text-neutral-700">Cash Register:</span>
              <span className="font-mono font-bold text-neutral-900 tabular-nums">
                {formatRupee(paymentBreakdown.cash)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg">
              <span className="font-medium text-neutral-700">UPI / QR Code:</span>
              <span className="font-mono font-bold text-neutral-900 tabular-nums">
                {formatRupee(paymentBreakdown.upi)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg">
              <span className="font-medium text-neutral-700">Card POS Machine:</span>
              <span className="font-mono font-bold text-neutral-900 tabular-nums">
                {formatRupee(paymentBreakdown.card)}
              </span>
            </div>
          </div>
        </div>

        {/* Category Share */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs space-y-3">
          <h3 className="font-semibold text-neutral-900 text-sm">
            Category-wise Sales
          </h3>
          <div className="space-y-2 text-xs max-h-48 overflow-y-auto">
            {categorySalesMap.length === 0 ? (
              <p className="text-neutral-400 py-4 text-center">No sales in selected period</p>
            ) : (
              categorySalesMap.map(([cat, val]) => {
                const pct = netSales > 0 ? ((val.revenue / netSales) * 100).toFixed(1) : 0;
                return (
                  <div key={cat} className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg">
                    <div>
                      <span className="font-medium text-neutral-800">{cat}</span>
                      <span className="text-[11px] text-neutral-400 block">{val.itemsCount} items sold</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-neutral-900 tabular-nums">
                        {formatRupee(val.revenue)}
                      </span>
                      <span className="text-[11px] text-neutral-500 block">({pct}%)</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Product-Wise Sales Table */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs p-5">
        <h3 className="font-semibold text-neutral-900 text-sm mb-3">
          Product-Wise Sales & Profit Performance
        </h3>
        {productSalesMap.length === 0 ? (
          <p className="py-8 text-center text-neutral-400 text-xs">
            No product sales recorded in the selected period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500 font-semibold pb-2">
                  <th className="pb-2.5 font-semibold">Sweet Name</th>
                  <th className="pb-2.5 font-semibold">Category</th>
                  <th className="pb-2.5 font-semibold text-right">Quantity Sold</th>
                  <th className="pb-2.5 font-semibold text-right">Revenue (₹)</th>
                  <th className="pb-2.5 font-semibold text-right">GST Collected (₹)</th>
                  <th className="pb-2.5 font-semibold text-right">Est. Profit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {productSalesMap.map((p, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50/80">
                    <td className="py-2.5 font-semibold text-neutral-900">{p.name}</td>
                    <td className="py-2.5 text-neutral-600">{p.category}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {p.unit === 'kg' ? `${p.totalQty.toFixed(2)} kg` : `${p.totalQty} ${p.unit}`}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-neutral-900 tabular-nums">
                      {formatRupee(p.revenue)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-neutral-600 tabular-nums">
                      {formatRupee(p.tax)}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-emerald-700 tabular-nums">
                      {formatRupee(p.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
