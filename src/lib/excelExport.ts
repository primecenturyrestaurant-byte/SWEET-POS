import * as XLSX from 'xlsx';
import { Bill, Product, ShopSettings, StockMovement, AuditLogEntry } from '../types';

/**
 * Generates and downloads a rich, multi-tab Excel Workbook (.xlsx)
 * for PRIME CENTURY SWEET Sales & GST Reports.
 */
export function exportSalesReportToExcel(
  bills: Bill[],
  products: Product[],
  settings: ShopSettings,
  startDate: string,
  endDate: string,
  periodLabel: string
): void {
  const wb = XLSX.utils.book_new();

  // Valid non-cancelled bills
  const validBills = bills.filter(
    (b) => b.status === 'completed' || b.status === 'edited'
  );
  const cancelledBills = bills.filter(
    (b) => b.status === 'cancelled' || b.status === 'refunded'
  );

  // -------------------------------------------------------------
  // SHEET 1: INVOICES & SALES DETAILED
  // -------------------------------------------------------------
  const invoiceRows = bills.map((b) => {
    const createdDate = new Date(b.createdAt);
    const dateStr = createdDate.toLocaleDateString('en-IN');
    const timeStr = createdDate.toLocaleTimeString('en-IN');
    const itemsSummary = b.items
      .map((it) => `${it.name} (${it.displayQuantity}${it.displayUnit})`)
      .join('; ');

    return {
      'Invoice No': b.billNumber,
      'Date': dateStr,
      'Time': timeStr,
      'Status': b.status.toUpperCase(),
      'Customer Name': b.customerName || 'Walk-in Customer',
      'Customer Phone': b.customerPhone || '-',
      'Cashier': b.cashierName || 'Counter 1',
      'Items Count': b.items.length,
      'Items Description': itemsSummary,
      'Subtotal (₹)': Number(b.subtotal.toFixed(2)),
      'Discount (₹)': Number((b.totalItemDiscount + b.additionalDiscount).toFixed(2)),
      'Taxable Value (₹)': Number(b.taxableAmount.toFixed(2)),
      'CGST (₹)': Number(b.cgstTotal.toFixed(2)),
      'SGST (₹)': Number(b.sgstTotal.toFixed(2)),
      'IGST (₹)': Number(b.igstTotal.toFixed(2)),
      'Total GST (₹)': Number(b.totalTax.toFixed(2)),
      'Round Off (₹)': Number(b.roundOff.toFixed(2)),
      'Grand Total (₹)': Number(b.grandTotal.toFixed(2)),
      'Payment Mode': b.paymentMethod.toUpperCase(),
      'Cash (₹)': b.paymentMethod === 'cash' ? b.grandTotal : (b.splitDetails?.cash || 0),
      'UPI (₹)': b.paymentMethod === 'upi' ? b.grandTotal : (b.splitDetails?.upi || 0),
      'Card (₹)': b.paymentMethod === 'card' ? b.grandTotal : (b.splitDetails?.card || 0),
      'Notes': b.notes || '',
    };
  });

  // Add Summary Total Row
  if (invoiceRows.length > 0) {
    const totalTaxable = validBills.reduce((acc, b) => acc + b.taxableAmount, 0);
    const totalCgst = validBills.reduce((acc, b) => acc + b.cgstTotal, 0);
    const totalSgst = validBills.reduce((acc, b) => acc + b.sgstTotal, 0);
    const totalIgst = validBills.reduce((acc, b) => acc + b.igstTotal, 0);
    const totalGst = validBills.reduce((acc, b) => acc + b.totalTax, 0);
    const totalGrand = validBills.reduce((acc, b) => acc + b.grandTotal, 0);
    const totalDiscount = validBills.reduce(
      (acc, b) => acc + b.totalItemDiscount + b.additionalDiscount,
      0
    );

    invoiceRows.push({
      'Invoice No': 'TOTALS (Valid Bills)',
      'Date': `${startDate} to ${endDate}`,
      'Time': '',
      'Status': `${validBills.length} Bills (${cancelledBills.length} cancelled)`,
      'Customer Name': '',
      'Customer Phone': '',
      'Cashier': '',
      'Items Count': 0,
      'Items Description': '',
      'Subtotal (₹)': 0,
      'Discount (₹)': Number(totalDiscount.toFixed(2)),
      'Taxable Value (₹)': Number(totalTaxable.toFixed(2)),
      'CGST (₹)': Number(totalCgst.toFixed(2)),
      'SGST (₹)': Number(totalSgst.toFixed(2)),
      'IGST (₹)': Number(totalIgst.toFixed(2)),
      'Total GST (₹)': Number(totalGst.toFixed(2)),
      'Round Off (₹)': 0,
      'Grand Total (₹)': Number(totalGrand.toFixed(2)),
      'Payment Mode': '',
      'Cash (₹)': 0,
      'UPI (₹)': 0,
      'Card (₹)': 0,
      'Notes': '',
    });
  }

  const wsInvoices = XLSX.utils.json_to_sheet(invoiceRows);
  // Auto-column widths
  wsInvoices['!cols'] = [
    { wch: 15 }, // Invoice No
    { wch: 12 }, // Date
    { wch: 10 }, // Time
    { wch: 12 }, // Status
    { wch: 20 }, // Customer
    { wch: 15 }, // Phone
    { wch: 15 }, // Cashier
    { wch: 10 }, // Items Count
    { wch: 40 }, // Items
    { wch: 12 }, // Subtotal
    { wch: 12 }, // Discount
    { wch: 15 }, // Taxable
    { wch: 10 }, // CGST
    { wch: 10 }, // SGST
    { wch: 10 }, // IGST
    { wch: 12 }, // Total GST
    { wch: 10 }, // Round off
    { wch: 14 }, // Grand Total
    { wch: 12 }, // Payment Mode
    { wch: 10 }, // Cash
    { wch: 10 }, // UPI
    { wch: 10 }, // Card
    { wch: 20 }, // Notes
  ];
  XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices Detailed');

  // -------------------------------------------------------------
  // SHEET 2: GSTR-1 TAX SUMMARY (Indian GST Return format)
  // -------------------------------------------------------------
  const taxSlabs: { [rate: number]: { taxable: number; cgst: number; sgst: number; igst: number; totalTax: number } } = {
    0: { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
    5: { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
    12: { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
    18: { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
  };

  validBills.forEach((b) => {
    b.items.forEach((it) => {
      const rate = it.gstRate || 0;
      if (!taxSlabs[rate]) {
        taxSlabs[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
      }
      taxSlabs[rate].taxable += it.taxableAmount;
      taxSlabs[rate].cgst += it.cgstAmount;
      taxSlabs[rate].sgst += it.sgstAmount;
      taxSlabs[rate].igst += it.igstAmount;
      taxSlabs[rate].totalTax += it.totalGstAmount;
    });
  });

  const gstRows = Object.keys(taxSlabs)
    .sort((a, b) => Number(a) - Number(b))
    .map((rateStr) => {
      const rate = Number(rateStr);
      const data = taxSlabs[rate];
      return {
        'GST Slab Rate': `${rate}%`,
        'Taxable Value (₹)': Number(data.taxable.toFixed(2)),
        'CGST Rate': rate > 0 ? `${rate / 2}%` : '0%',
        'CGST Amount (₹)': Number(data.cgst.toFixed(2)),
        'SGST Rate': rate > 0 ? `${rate / 2}%` : '0%',
        'SGST Amount (₹)': Number(data.sgst.toFixed(2)),
        'IGST Rate': `${rate}%`,
        'IGST Amount (₹)': Number(data.igst.toFixed(2)),
        'Total GST Collected (₹)': Number(data.totalTax.toFixed(2)),
        'Gross Invoice Value (₹)': Number((data.taxable + data.totalTax).toFixed(2)),
      };
    });

  const wsGst = XLSX.utils.json_to_sheet(gstRows);
  wsGst['!cols'] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 22 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsGst, 'GSTR-1 Tax Summary');

  // -------------------------------------------------------------
  // SHEET 3: ITEM-WISE SALES & PROFIT SUMMARY
  // -------------------------------------------------------------
  const itemMap: {
    [prodId: string]: {
      name: string;
      category: string;
      baseUnit: string;
      unitPrice: number;
      costPrice: number;
      qty: number;
      revenue: number;
      taxable: number;
      gst: number;
      discount: number;
    };
  } = {};

  validBills.forEach((b) => {
    b.items.forEach((it) => {
      if (!itemMap[it.productId]) {
        itemMap[it.productId] = {
          name: it.name,
          category: it.category,
          baseUnit: it.baseUnit,
          unitPrice: it.unitPrice,
          costPrice: it.costPrice || 0,
          qty: 0,
          revenue: 0,
          taxable: 0,
          gst: 0,
          discount: 0,
        };
      }
      itemMap[it.productId].qty += it.quantity;
      itemMap[it.productId].revenue += it.lineTotal;
      itemMap[it.productId].taxable += it.taxableAmount;
      itemMap[it.productId].gst += it.totalGstAmount;
      itemMap[it.productId].discount += it.itemDiscountAmount;
    });
  });

  const itemRows = Object.values(itemMap)
    .sort((a, b) => b.revenue - a.revenue)
    .map((item) => {
      const estimatedCost = item.qty * item.costPrice;
      const estimatedGrossMargin = item.taxable - estimatedCost;
      const marginPercent =
        item.taxable > 0 ? ((estimatedGrossMargin / item.taxable) * 100).toFixed(1) + '%' : '0%';

      let qtyLabel = `${item.qty.toFixed(2)} ${item.baseUnit}`;
      if (item.baseUnit === 'kg') {
        qtyLabel = `${item.qty.toFixed(3)} kg (${Math.round(item.qty * 1000)} g)`;
      }

      return {
        'Sweet / Product Name': item.name,
        'Category': item.category,
        'Base Unit': item.baseUnit,
        'Selling Price (₹)': Number(item.unitPrice.toFixed(2)),
        'Total Quantity Sold': Number(item.qty.toFixed(3)),
        'Sold Quantity Unit': qtyLabel,
        'Discount Given (₹)': Number(item.discount.toFixed(2)),
        'Taxable Sales (₹)': Number(item.taxable.toFixed(2)),
        'GST Collected (₹)': Number(item.gst.toFixed(2)),
        'Total Revenue (₹)': Number(item.revenue.toFixed(2)),
        'Est. Cost of Goods (₹)': Number(estimatedCost.toFixed(2)),
        'Est. Gross Profit (₹)': Number(estimatedGrossMargin.toFixed(2)),
        'Gross Margin %': marginPercent,
      };
    });

  const wsItems = XLSX.utils.json_to_sheet(itemRows);
  wsItems['!cols'] = [
    { wch: 30 },
    { wch: 18 },
    { wch: 10 },
    { wch: 15 },
    { wch: 18 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsItems, 'Item-Wise Sales');

  // -------------------------------------------------------------
  // SHEET 4: SHOP & REPORT METADATA
  // -------------------------------------------------------------
  const metaRows = [
    { 'Parameter': 'Shop Name', 'Value': settings.shopName },
    { 'Parameter': 'Proprietor / Owner', 'Value': settings.ownerName || 'Shop Owner' },
    { 'Parameter': 'Address', 'Value': settings.address },
    { 'Parameter': 'GSTIN', 'Value': settings.gstin },
    { 'Parameter': 'FSSAI License', 'Value': settings.fssai },
    { 'Parameter': 'State', 'Value': `${settings.state} (${settings.stateCode})` },
    { 'Parameter': 'Report Period', 'Value': periodLabel },
    { 'Parameter': 'Start Date', 'Value': startDate },
    { 'Parameter': 'End Date', 'Value': endDate },
    { 'Parameter': 'Total Bills Generated', 'Value': bills.length },
    { 'Parameter': 'Valid Completed Bills', 'Value': validBills.length },
    { 'Parameter': 'Cancelled / Refunded Bills', 'Value': cancelledBills.length },
    { 'Parameter': 'Generated On', 'Value': new Date().toLocaleString('en-IN') },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaRows);
  wsMeta['!cols'] = [{ wch: 25 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Report Info');

  // Generate file name & trigger download
  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `PRIME_CENTURY_SWEET_SalesReport_${cleanPeriod}_${startDate}_to_${endDate}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Generates and downloads Stock & Inventory Ledger Excel (.xlsx)
 */
export function exportStockReportToExcel(
  products: Product[],
  stockMovements: StockMovement[],
  settings: ShopSettings
): void {
  const wb = XLSX.utils.book_new();

  // Current Stock Status
  const stockRows = products.map((p) => {
    const isLowStock = p.stockQty <= p.minStockLevel;
    const inventoryValuationCost = p.stockQty * (p.costPrice || 0);
    const inventoryValuationRetail = p.stockQty * p.sellingPrice;

    return {
      'Product Code / ID': p.barcode || p.id,
      'Sweet Name': p.name,
      'Hindi Name': p.hindiName || '',
      'Category': p.category,
      'Current Stock': Number(p.stockQty.toFixed(2)),
      'Unit': p.unit,
      'Min Reorder Level': p.minStockLevel,
      'Stock Alert': isLowStock ? 'LOW STOCK - REORDER' : 'ADEQUATE',
      'Cost Price (₹)': p.costPrice || 0,
      'Selling Price (₹)': p.sellingPrice,
      'GST Rate': `${p.gstRate}%`,
      'Valuation at Cost (₹)': Number(inventoryValuationCost.toFixed(2)),
      'Valuation at Retail (₹)': Number(inventoryValuationRetail.toFixed(2)),
      'Active Status': p.isActive ? 'Active' : 'Archived',
    };
  });

  const wsStock = XLSX.utils.json_to_sheet(stockRows);
  wsStock['!cols'] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 8 },
    { wch: 16 },
    { wch: 22 },
    { wch: 14 },
    { wch: 15 },
    { wch: 10 },
    { wch: 20 },
    { wch: 20 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsStock, 'Current Inventory');

  // Stock Movements Ledger
  const movementRows = stockMovements.map((m) => {
    const dateObj = new Date(m.timestamp);
    return {
      'Timestamp': dateObj.toLocaleString('en-IN'),
      'Product Name': m.productName,
      'Movement Type': m.type.toUpperCase(),
      'Quantity Change': m.quantityDelta > 0 ? `+${m.quantityDelta}` : `${m.quantityDelta}`,
      'Previous Stock': m.previousStock,
      'New Stock': m.newStock,
      'Unit': m.unit,
      'Bill Reference': m.billNumber || '-',
      'Reason / Remarks': m.reason || '-',
    };
  });

  const wsMovements = XLSX.utils.json_to_sheet(movementRows);
  wsMovements['!cols'] = [
    { wch: 20 },
    { wch: 28 },
    { wch: 18 },
    { wch: 15 },
    { wch: 14 },
    { wch: 14 },
    { wch: 8 },
    { wch: 16 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMovements, 'Movement History');

  const filename = `PRIME_CENTURY_SWEET_InventoryLedger_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Generates and downloads Audit Log Trail Excel (.xlsx)
 */
export function exportAuditLogToExcel(auditLogs: AuditLogEntry[]): void {
  const wb = XLSX.utils.book_new();

  const rows = auditLogs.map((log) => ({
    'Timestamp': new Date(log.timestamp).toLocaleString('en-IN'),
    'Action': log.action,
    'User Name': log.userName,
    'User Role': log.userRole.toUpperCase(),
    'Details & Reason': log.details,
    'Target ID': log.targetId || '-',
    'Log ID': log.id,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 45 },
    { wch: 20 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Security & Audit Log');

  const filename = `PRIME_CENTURY_SWEET_AuditLog_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}
