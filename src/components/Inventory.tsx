import React, { useState } from 'react';
import { Product, ShopSettings, StockMovement } from '../types';
import { formatRupee, formatQuantityWithUnit } from '../lib/calculations';
import { exportStockReportToExcel } from '../lib/excelExport';
import {
  Boxes,
  Plus,
  Minus,
  AlertTriangle,
  History,
  TrendingDown,
  TrendingUp,
  PackageCheck,
  Search,
  Filter,
  X,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';

interface InventoryProps {
  products: Product[];
  stockMovements: StockMovement[];
  settings: ShopSettings;
  onSaveProduct: (product: Product) => Promise<void>;
  onAddStockMovement: (movement: StockMovement) => Promise<void>;
  onRefreshData: () => Promise<void>;
}

export const Inventory: React.FC<InventoryProps> = ({
  products,
  stockMovements,
  settings,
  onSaveProduct,
  onAddStockMovement,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'low-stock'>('all');
  const [activeTab, setActiveTab] = useState<'current-stock' | 'movement-history'>('current-stock');

  // Restock / Purchase modal state
  const [restockModal, setRestockModal] = useState<{
    isOpen: boolean;
    product: Product | null;
    quantity: string;
    unitCost: string;
    supplierInvoice?: string;
  }>({
    isOpen: false,
    product: null,
    quantity: '',
    unitCost: '',
    supplierInvoice: '',
  });

  // Adjustment (Damage / Waste / Count Audit) modal state
  const [adjustModal, setAdjustModal] = useState<{
    isOpen: boolean;
    product: Product | null;
    action: 'damage' | 'expired' | 'adjustment';
    quantity: string;
    reason: string;
  }>({
    isOpen: false,
    product: null,
    action: 'damage',
    quantity: '',
    reason: '',
  });

  const filteredProducts = products.filter((p) => {
    if (filterMode === 'low-stock' && p.stockQty > p.minStockLevel) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  const lowStockCount = products.filter((p) => p.isActive && p.stockQty <= p.minStockLevel).length;

  // Handle Restock Submit
  const handleConfirmRestock = async () => {
    if (!restockModal.product) return;
    const qty = parseFloat(restockModal.quantity);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid quantity to restock.');
      return;
    }

    const prod = restockModal.product;
    const prevStock = prod.stockQty;
    const newStock = Number((prevStock + qty).toFixed(3));

    // Optionally update cost price if new cost entered
    const newCost = parseFloat(restockModal.unitCost);
    const updatedProd: Product = {
      ...prod,
      stockQty: newStock,
      costPrice: !isNaN(newCost) && newCost > 0 ? newCost : prod.costPrice,
      updatedAt: new Date().toISOString(),
    };

    await onSaveProduct(updatedProd);

    // Add stock movement
    await onAddStockMovement({
      id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: prod.id,
      productName: prod.name,
      type: 'restock',
      quantityDelta: qty,
      previousStock: prevStock,
      newStock,
      unit: prod.unit,
      reason: restockModal.supplierInvoice
        ? `Purchase Invoice: ${restockModal.supplierInvoice}`
        : 'Stock replenishment / fresh preparation',
      timestamp: new Date().toISOString(),
    });

    setRestockModal({ isOpen: false, product: null, quantity: '', unitCost: '', supplierInvoice: '' });
    await onRefreshData();
  };

  // Handle Adjustment Submit
  const handleConfirmAdjustment = async () => {
    if (!adjustModal.product) return;
    const qty = parseFloat(adjustModal.quantity);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    const prod = adjustModal.product;
    const prevStock = prod.stockQty;
    const newStock = Number((prevStock - qty).toFixed(3));

    if (!settings.allowNegativeStock && newStock < 0) {
      alert(`Adjustment would make stock negative (${newStock} ${prod.unit}), which is disallowed by shop settings.`);
      return;
    }

    const updatedProd: Product = {
      ...prod,
      stockQty: Math.max(0, newStock),
      updatedAt: new Date().toISOString(),
    };

    await onSaveProduct(updatedProd);

    // Add stock movement
    await onAddStockMovement({
      id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: prod.id,
      productName: prod.name,
      type: adjustModal.action,
      quantityDelta: -qty,
      previousStock: prevStock,
      newStock: Math.max(0, newStock),
      unit: prod.unit,
      reason: adjustModal.reason || `${adjustModal.action} write-off`,
      timestamp: new Date().toISOString(),
    });

    setAdjustModal({ isOpen: false, product: null, action: 'damage', quantity: '', reason: '' });
    await onRefreshData();
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 tracking-tight">
            Inventory & Stock Management
          </h2>
          <p className="text-xs text-neutral-500">
            Real-time weight and piece inventory, restocking entries, damage write-offs, and movement ledger
          </p>
        </div>

        {/* Tab switch between Current Stock and Movement History */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => exportStockReportToExcel(products, stockMovements, settings)}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Download full Inventory and Movement Ledger as Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Stock Excel</span>
          </button>

          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-neutral-200 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('current-stock')}
              className={`px-3.5 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                activeTab === 'current-stock'
                  ? 'bg-[#781324] text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Live Stock Level
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('movement-history')}
              className={`px-3.5 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                activeTab === 'movement-history'
                  ? 'bg-[#781324] text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Stock Movement History ({stockMovements.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'current-stock' ? (
        <>
          {/* Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products by name or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#FAF7F2] border border-neutral-200 rounded-lg text-xs focus:outline-none focus:border-[#781324]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  filterMode === 'all'
                    ? 'bg-neutral-800 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                All Sweets ({products.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('low-stock')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                  filterMode === 'low-stock'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Low Stock Only ({lowStockCount})</span>
              </button>
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF7F2] border-b border-neutral-200 text-neutral-600 font-semibold">
                    <th className="py-3 px-4">Sweet Product</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Available Stock</th>
                    <th className="py-3 px-3 text-right">Min Threshold</th>
                    <th className="py-3 px-3 text-right">Inventory Value</th>
                    <th className="py-3 px-3 text-center">Stock Health</th>
                    <th className="py-3 px-4 text-right">Stock Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredProducts.map((p) => {
                    const isLow = p.stockQty <= p.minStockLevel;
                    const stockValue = p.costPrice * p.stockQty;

                    return (
                      <tr key={p.id} className="hover:bg-neutral-50/80">
                        <td className="py-3 px-4 font-semibold text-neutral-900">
                          {p.name}
                        </td>
                        <td className="py-3 px-3 text-neutral-600">{p.category}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold tabular-nums">
                          <span className={isLow ? 'text-amber-700' : 'text-neutral-900'}>
                            {p.stockQty} {p.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-neutral-500 tabular-nums">
                          {p.minStockLevel} {p.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-neutral-700 tabular-nums">
                          {formatRupee(stockValue)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isLow ? (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              Low Stock
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              In Stock
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Restock Button */}
                            <button
                              type="button"
                              onClick={() =>
                                setRestockModal({
                                  isOpen: true,
                                  product: p,
                                  quantity: '',
                                  unitCost: p.costPrice.toString(),
                                  supplierInvoice: '',
                                })
                              }
                              className="px-2.5 py-1 bg-[#FAF7F2] hover:bg-[#781324] hover:text-white border border-[#e4d4c4] text-[#781324] rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Restock</span>
                            </button>

                            {/* Adjustment Button */}
                            <button
                              type="button"
                              onClick={() =>
                                setAdjustModal({
                                  isOpen: true,
                                  product: p,
                                  action: 'damage',
                                  quantity: '',
                                  reason: '',
                                })
                              }
                              className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded text-[11px] font-medium transition-colors cursor-pointer"
                            >
                              Damage / Recount
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Movement History Tab */
        <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs p-5">
          <h3 className="font-semibold text-neutral-900 text-sm mb-3">
            Stock Movement Audit Trail
          </h3>
          {stockMovements.length === 0 ? (
            <p className="py-12 text-center text-neutral-400 text-xs">
              No stock movements recorded yet. Movements automatically appear upon sales, restocks, and adjustments.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500 font-semibold pb-2">
                    <th className="pb-2.5 font-semibold">Timestamp</th>
                    <th className="pb-2.5 font-semibold">Sweet Product</th>
                    <th className="pb-2.5 font-semibold">Type</th>
                    <th className="pb-2.5 font-semibold text-right">Change</th>
                    <th className="pb-2.5 font-semibold text-right">Prev → New</th>
                    <th className="pb-2.5 font-semibold">Reason / Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {stockMovements.map((sm) => {
                    const isPositive = sm.quantityDelta > 0;
                    const dateFormatted = new Date(sm.timestamp).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr key={sm.id} className="hover:bg-neutral-50/80">
                        <td className="py-2.5 text-neutral-500 font-mono text-[11px]">
                          {dateFormatted}
                        </td>
                        <td className="py-2.5 font-semibold text-neutral-900">
                          {sm.productName}
                        </td>
                        <td className="py-2.5 uppercase font-bold text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              sm.type === 'sale'
                                ? 'bg-neutral-100 text-neutral-700'
                                : sm.type === 'restock'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sm.type === 'cancellation_return'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {sm.type}
                          </span>
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono font-bold tabular-nums ${
                            isPositive ? 'text-emerald-700' : 'text-neutral-700'
                          }`}
                        >
                          {isPositive ? `+${sm.quantityDelta}` : sm.quantityDelta} {sm.unit}
                        </td>
                        <td className="py-2.5 text-right font-mono text-neutral-500 tabular-nums">
                          {sm.previousStock} → {sm.newStock} {sm.unit}
                        </td>
                        <td className="py-2.5 text-neutral-600 truncate max-w-xs">
                          {sm.reason || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RESTOCK MODAL */}
      {restockModal.isOpen && restockModal.product && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-[#e8d8c8]">
            <h3 className="font-serif font-bold text-base text-neutral-900 mb-1">
              Restock Sweet — {restockModal.product.name}
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Current Stock: <strong>{restockModal.product.stockQty} {restockModal.product.unit}</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Quantity to Add ({restockModal.product.unit}) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  placeholder="e.g. 10"
                  value={restockModal.quantity}
                  onChange={(e) => setRestockModal({ ...restockModal, quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm font-mono font-bold focus:outline-none focus:border-[#781324]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Cost Price per Unit (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Optional cost update"
                  value={restockModal.unitCost}
                  onChange={(e) => setRestockModal({ ...restockModal, unitCost: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Invoice / Batch Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kitchen Batch #42 or Supplier PO-88"
                  value={restockModal.supplierInvoice}
                  onChange={(e) =>
                    setRestockModal({ ...restockModal, supplierInvoice: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setRestockModal({ isOpen: false, product: null, quantity: '', unitCost: '', supplierInvoice: '' })}
                className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestock}
                className="flex-1 py-2 bg-[#781324] hover:bg-[#600f1c] text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Confirm Restock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADJUSTMENT MODAL */}
      {adjustModal.isOpen && adjustModal.product && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-amber-200">
            <h3 className="font-serif font-bold text-base text-neutral-900 mb-1">
              Stock Adjustment / Write-Off
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Item: <strong>{adjustModal.product.name}</strong> · Current:{' '}
              {adjustModal.product.stockQty} {adjustModal.product.unit}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Adjustment Reason
                </label>
                <select
                  value={adjustModal.action}
                  onChange={(e) => setAdjustModal({ ...adjustModal, action: e.target.value as any })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white"
                >
                  <option value="damage">Damaged / Spoiled in Store</option>
                  <option value="expired">Expired Shelf Life</option>
                  <option value="adjustment">Physical Recount Correction</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Quantity to Deduct ({adjustModal.product.unit}) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  placeholder="e.g. 1.5"
                  value={adjustModal.quantity}
                  onChange={(e) => setAdjustModal({ ...adjustModal, quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm font-mono font-bold focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Detailed Explanation
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Dropped tray or taste sampling"
                  value={adjustModal.reason}
                  onChange={(e) => setAdjustModal({ ...adjustModal, reason: e.target.value })}
                  className="w-full p-2 border border-neutral-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setAdjustModal({ isOpen: false, product: null, action: 'damage', quantity: '', reason: '' })}
                className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAdjustment}
                className="flex-1 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Confirm Deduction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
