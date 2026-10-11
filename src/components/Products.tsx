import React, { useState, useMemo, useEffect } from 'react';
import { Product, ProductUnit } from '../types';
import { formatRupee } from '../lib/calculations';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Package,
  Layers,
  IndianRupee,
  Percent,
  AlertTriangle,
  Upload,
  X,
  Filter,
} from 'lucide-react';

interface ProductsProps {
  products: Product[];
  onSaveProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  autoOpenAddModal?: boolean;
  onModalOpened?: () => void;
}

export const Products: React.FC<ProductsProps> = ({
  products,
  onSaveProduct,
  onDeleteProduct,
  autoOpenAddModal = false,
  onModalOpened,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (autoOpenAddModal) {
      handleOpenAddModal();
      if (onModalOpened) onModalOpened();
    }
  }, [autoOpenAddModal]);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formHindiName, setFormHindiName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Kaju Sweets');
  const [formSellingPrice, setFormSellingPrice] = useState<string>('');
  const [formCostPrice, setFormCostPrice] = useState<string>('');
  const [formUnit, setFormUnit] = useState<ProductUnit>('kg');
  const [formGstRate, setFormGstRate] = useState<number>(5);
  const [formStockQty, setFormStockQty] = useState<string>('10');
  const [formMinStockLevel, setFormMinStockLevel] = useState<string>('3');
  const [formBarcode, setFormBarcode] = useState<string>('');
  const [formImage, setFormImage] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formError, setFormError] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const categories = useMemo(() => {
    const defaultCats = [
      'Kaju Sweets',
      'Mawa Sweets',
      'Bengali Sweets',
      'Laddu & Ghee Sweets',
      'Dry Fruit & Halwa',
      'Snacks & Namkeen',
    ];
    const set = new Set<string>(defaultCats);
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (statusFilter === 'active' && !p.isActive) return false;
      if (statusFilter === 'inactive' && p.isActive) return false;
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.hindiName && p.hindiName.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.includes(q))
      );
    });
  }, [products, searchQuery, selectedCategory, statusFilter]);

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormHindiName('');
    setFormCategory('Kaju Sweets');
    setFormSellingPrice('');
    setFormCostPrice('');
    setFormUnit('kg');
    setFormGstRate(5);
    setFormStockQty('20');
    setFormMinStockLevel('5');
    setFormBarcode(`890${Math.floor(1000 + Math.random() * 9000)}`);
    setFormImage('/src/assets/images/kaju_katli_sweet_1791696592900.jpg');
    setFormIsActive(true);
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormHindiName(product.hindiName || '');
    setFormCategory(product.category);
    setFormSellingPrice(product.sellingPrice.toString());
    setFormCostPrice(product.costPrice.toString());
    setFormUnit(product.unit);
    setFormGstRate(product.gstRate);
    setFormStockQty(product.stockQty.toString());
    setFormMinStockLevel(product.minStockLevel.toString());
    setFormBarcode(product.barcode || '');
    setFormImage(product.image || '');
    setFormIsActive(product.isActive);
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Please enter a sweet name');
      return;
    }
    const sellingPrice = parseFloat(formSellingPrice);
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      setFormError('Please enter a valid selling price greater than 0');
      return;
    }
    const costPrice = parseFloat(formCostPrice) || 0;
    const stockQty = parseFloat(formStockQty) || 0;
    const minStock = parseFloat(formMinStockLevel) || 0;

    setIsSaving(true);
    setFormError('');

    try {
      const productPayload: Product = {
        id: editingProduct ? editingProduct.id : `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: formName.trim(),
        hindiName: formHindiName.trim() || undefined,
        category: formCategory,
        sellingPrice,
        costPrice,
        unit: formUnit,
        gstRate: formGstRate,
        stockQty,
        minStockLevel: minStock,
        barcode: formBarcode.trim() || undefined,
        image: formImage.trim() || undefined,
        isActive: formIsActive,
        isSample: editingProduct ? editingProduct.isSample : false,
        createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSaveProduct(productPayload);
      setIsEditModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (productId: string, name: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${name}"?\nNote: Past historical bills containing this item will be safely preserved.`
      )
    ) {
      await onDeleteProduct(productId);
    }
  };

  const handleToggleActive = async (product: Product) => {
    await onSaveProduct({
      ...product,
      isActive: !product.isActive,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 tracking-tight">
            Sweet & Product Management
          </h2>
          <p className="text-xs text-neutral-500">
            Configure sweet prices, preparation cost, GST rates, unit types, and stock inventory
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="px-4 py-2 bg-[#781324] hover:bg-[#600f1c] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add New Sweet</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by sweet name or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#FAF7F2] border border-neutral-200 rounded-lg text-xs focus:outline-none focus:border-[#781324]"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-neutral-500 whitespace-nowrap">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#FAF7F2] border border-neutral-200 rounded-lg px-2.5 py-2 text-xs font-medium text-neutral-700 focus:outline-none focus:border-[#781324]"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg text-xs w-full md:w-auto justify-center">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-white shadow-xs text-neutral-900 font-bold' : 'text-neutral-600'
            }`}
          >
            All ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
              statusFilter === 'active' ? 'bg-white shadow-xs text-neutral-900 font-bold' : 'text-neutral-600'
            }`}
          >
            Active ({products.filter((p) => p.isActive).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
              statusFilter === 'inactive' ? 'bg-white shadow-xs text-neutral-900 font-bold' : 'text-neutral-600'
            }`}
          >
            Inactive ({products.filter((p) => !p.isActive).length})
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#FAF7F2] border-b border-neutral-200 text-neutral-600 font-semibold">
                <th className="py-3 px-4">Sweet Item</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Unit</th>
                <th className="py-3 px-3 text-right">Selling Price</th>
                <th className="py-3 px-3 text-right">Cost Price</th>
                <th className="py-3 px-3 text-center">GST Rate</th>
                <th className="py-3 px-3 text-right">Current Stock</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400">
                    No products matched your criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.stockQty <= p.minStockLevel;

                  return (
                    <tr key={p.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-neutral-100 overflow-hidden shrink-0 border border-neutral-200 flex items-center justify-center">
                            {p.image ? (
                              <img
                                src={p.image}
                                alt={p.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="font-serif font-bold text-neutral-400">
                                {p.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {p.isSample && (
                                <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-normal">
                                  Editable Sample
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                              {p.hindiName && <span>{p.hindiName}</span>}
                              {p.barcode && <span>Code: {p.barcode}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-neutral-600 font-medium">
                        {p.category}
                      </td>

                      <td className="py-3 px-3 uppercase text-neutral-700 font-mono font-semibold">
                        {p.unit}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-[#781324] tabular-nums">
                        {formatRupee(p.sellingPrice)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-neutral-600 tabular-nums">
                        {formatRupee(p.costPrice)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="font-mono font-semibold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded text-[11px]">
                          {p.gstRate}%
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <div className="flex items-center justify-end gap-1">
                          {isLow && (
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          )}
                          <span className={`font-bold ${isLow ? 'text-amber-700' : 'text-neutral-800'}`}>
                            {p.stockQty} {p.unit}
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-400 block">
                          Min: {p.minStockLevel} {p.unit}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(p)}
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            p.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                          }`}
                        >
                          {p.isActive ? 'Active' : 'Disabled'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 text-neutral-600 hover:text-[#781324] hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 text-neutral-400 hover:text-rose-700 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Sweet Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-5 sm:p-6 border border-[#e8d8c8] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
              <div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-neutral-900">
                  {editingProduct ? 'Edit Sweet Product' : 'Add New Sweet Product'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {editingProduct ? `Updating SKU for ${editingProduct.name}` : 'Enter sweet details and pricing'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Sweet Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kaju Katli (Royal Silver)"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:border-[#781324]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Hindi / Regional Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. काजू कतली"
                    value={formHindiName}
                    onChange={(e) => setFormHindiName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:border-[#781324]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white focus:outline-none focus:border-[#781324]"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Unit of Sale *
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value as ProductUnit)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white focus:outline-none focus:border-[#781324]"
                  >
                    <option value="kg">kg (Kilogram - Weight based)</option>
                    <option value="piece">piece (Per item/cup)</option>
                    <option value="box">box (Per packaged box)</option>
                    <option value="packet">packet (Per snack pouch)</option>
                    <option value="500g">500g</option>
                    <option value="250g">250g</option>
                    <option value="100g">100g</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Selling Price (₹ per unit) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 800"
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-[#781324]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Cost / Preparation Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 520"
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#781324]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    GST Rate (%) *
                  </label>
                  <select
                    value={formGstRate}
                    onChange={(e) => setFormGstRate(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white font-mono focus:outline-none focus:border-[#781324]"
                  >
                    <option value={0}>0% (Tax Exempt)</option>
                    <option value={5}>5% (Standard Sweets / Mithai)</option>
                    <option value={12}>12% (Dry Fruits / Snacks)</option>
                    <option value={18}>18% (Confectionery / Chocolates)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Current Stock Quantity ({formUnit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formStockQty}
                    onChange={(e) => setFormStockQty(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#781324]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Minimum Safety Stock Alert ({formUnit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formMinStockLevel}
                    onChange={(e) => setFormMinStockLevel(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#781324]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Barcode / SKU Code
                  </label>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="e.g. 8901001"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#781324]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Product Image Path / URL
                  </label>
                  <input
                    type="text"
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                    placeholder="/src/assets/images/... or web URL"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:border-[#781324]"
                  />
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="formIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded text-[#781324] focus:ring-[#781324]"
                />
                <label htmlFor="formIsActive" className="text-xs font-semibold text-neutral-700">
                  Sweet is Active and available for cashier billing
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#781324] hover:bg-[#600f1c] text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm"
                >
                  {isSaving ? 'Saving...' : editingProduct ? 'Update Sweet' : 'Add Sweet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
