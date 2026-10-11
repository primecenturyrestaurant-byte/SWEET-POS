import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Bill, CartItem, PaymentMethod, Product, ShopSettings, SplitPaymentDetails, WeightPreset, StaffUser } from '../types';
import {
  calculateLineItem,
  calculateBillTotals,
  formatRupee,
  formatQuantityWithUnit,
} from '../lib/calculations';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Printer,
  Save,
  User,
  Phone,
  QrCode,
  CreditCard,
  Banknote,
  Split,
  Percent,
  CheckCircle,
  AlertCircle,
  Package,
  Edit2,
  Check,
  X,
  Eye,
  FilePlus,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';

interface NewBillProps {
  products: Product[];
  settings: ShopSettings;
  onSaveBill: (bill: Bill, autoPrint: boolean) => Promise<void>;
  onRefreshProducts: () => Promise<void>;
  onNavigateToProducts?: () => void;
  onOpenAddSweet?: () => void;
  onPrintPreview?: (draftBill: Bill) => void;
  currentUser?: StaffUser | null;
}

export const NewBill: React.FC<NewBillProps> = ({
  products,
  settings,
  onSaveBill,
  onRefreshProducts,
  onNavigateToProducts,
  onOpenAddSweet,
  onPrintPreview,
  currentUser,
}) => {
  // Default to Exclusive of GST as requested (tax added on top of sweet price)
  const priceIncludesTax = settings.priceIncludesTax ?? false;

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Customer information
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isInterState, setIsInterState] = useState<boolean>(false);

  // Bill-level Discount
  const [billDiscount, setBillDiscount] = useState<number>(0);

  // Collapsible tax breakdown to save vertical space in the cart
  const [isGstDetailsOpen, setIsGstDetailsOpen] = useState<boolean>(false);

  // Mobile / Tablet Slide-Over Cart Drawer state
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);

  // Payments
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    settings.defaultPaymentMethod || 'cash'
  );
  const [cashReceived, setCashReceived] = useState<string>('');
  const [splitDetails, setSplitDetails] = useState<SplitPaymentDetails>({
    cash: 0,
    upi: 0,
    card: 0,
  });

  // Dedicated Weight Input Dialog for weight-based products
  const [weightModal, setWeightModal] = useState<{
    isOpen: boolean;
    product: Product | null;
    grams: number;
    customUnitPrice?: number;
    separateRow: boolean;
  }>({
    isOpen: false,
    product: null,
    grams: 250,
    separateRow: false,
  });

  // Inline Price Editing in Cart
  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
  const [customItemPrice, setCustomItemPrice] = useState<string>('');

  // Saving state & notifications
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gramsInputRef = useRef<HTMLInputElement>(null);

  // Auto-generated Bill Number
  const billNumber = useMemo(() => {
    return `${settings.invoicePrefix}${settings.nextInvoiceNumber}`;
  }, [settings.invoicePrefix, settings.nextInvoiceNumber]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  // Filtered active products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isActive) return false;
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.hindiName && p.hindiName.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Recalculate bill totals
  const billTotals = useMemo(() => {
    return calculateBillTotals(cart, billDiscount, isInterState);
  }, [cart, billDiscount, isInterState]);

  // Cash change due calculation
  const cashNum = parseFloat(cashReceived) || 0;
  const changeDue = Math.max(0, cashNum - billTotals.grandTotal);

  // Total items count in cart
  const totalItemCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.baseUnit === 'kg' ? 1 : item.quantity), 0);
  }, [cart]);

  // Focus grams input when weight modal opens
  useEffect(() => {
    if (weightModal.isOpen && gramsInputRef.current) {
      setTimeout(() => {
        gramsInputRef.current?.focus();
        gramsInputRef.current?.select();
      }, 50);
    }
  }, [weightModal.isOpen]);

  // Handle Barcode submission
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matched = products.find(
      (p) => p.isActive && p.barcode && p.barcode.toLowerCase() === barcodeInput.trim().toLowerCase()
    );
    if (matched) {
      if (matched.unit === 'kg') {
        openWeightModal(matched, 250);
      } else {
        handleAddPieceProduct(matched, 1);
      }
      setBarcodeInput('');
    } else {
      setErrorMessage(`No product found with barcode: ${barcodeInput}`);
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  // Open Weight Modal for kg-based sweet
  const openWeightModal = (product: Product, defaultGrams: number = 250) => {
    setWeightModal({
      isOpen: true,
      product,
      grams: defaultGrams,
      separateRow: false,
    });
  };

  // Confirm Adding Weight from Modal
  const handleConfirmWeightModal = () => {
    if (!weightModal.product || weightModal.grams <= 0) return;
    const product = weightModal.product;
    const grams = weightModal.grams;
    const qtyInKg = grams / 1000;

    // Check if sweet is already in cart
    const existingIndex = cart.findIndex((item) => item.productId === product.id);

    if (existingIndex >= 0 && !weightModal.separateRow) {
      // Increase existing quantity instead of creating duplicate cart rows
      const updated = [...cart];
      const existing = updated[existingIndex];
      const newTotalKg = Number((existing.quantity + qtyInKg).toFixed(3));
      const newDisplayGrams = Math.round(newTotalKg * 1000);

      updated[existingIndex] = calculateLineItem(
        product,
        newTotalKg,
        newDisplayGrams,
        'g',
        undefined,
        existing.itemDiscountPercent,
        priceIncludesTax,
        isInterState,
        existing.unitPrice // preserve existing unit price if edited
      );
      setCart(updated);
    } else {
      // Add new cart item
      const newItem = calculateLineItem(
        product,
        qtyInKg,
        grams,
        'g',
        undefined,
        0,
        priceIncludesTax,
        isInterState
      );
      setCart((prev) => [...prev, newItem]);
    }

    setWeightModal({ isOpen: false, product: null, grams: 250, separateRow: false });
  };

  // Quick 1-click Preset Weight Add (e.g. 100g, 250g, 500g, 1kg directly from card)
  const handleQuickAddWeightPreset = (product: Product, presetGrams: number) => {
    const qtyInKg = presetGrams / 1000;
    const existingIndex = cart.findIndex((item) => item.productId === product.id);

    if (existingIndex >= 0) {
      const updated = [...cart];
      const existing = updated[existingIndex];
      const newTotalKg = Number((existing.quantity + qtyInKg).toFixed(3));
      const newDisplayGrams = Math.round(newTotalKg * 1000);

      updated[existingIndex] = calculateLineItem(
        product,
        newTotalKg,
        newDisplayGrams,
        'g',
        undefined,
        existing.itemDiscountPercent,
        priceIncludesTax,
        isInterState,
        existing.unitPrice
      );
      setCart(updated);
    } else {
      const newItem = calculateLineItem(
        product,
        qtyInKg,
        presetGrams,
        'g',
        undefined,
        0,
        priceIncludesTax,
        isInterState
      );
      setCart((prev) => [...prev, newItem]);
    }
  };

  // Add piece/box/packet product
  const handleAddPieceProduct = (product: Product, count: number = 1) => {
    const existingIndex = cart.findIndex((item) => item.productId === product.id);

    if (existingIndex >= 0) {
      const updated = [...cart];
      const existing = updated[existingIndex];
      const newCount = existing.quantity + count;

      updated[existingIndex] = calculateLineItem(
        product,
        newCount,
        newCount,
        product.unit,
        undefined,
        existing.itemDiscountPercent,
        priceIncludesTax,
        isInterState,
        existing.unitPrice
      );
      setCart(updated);
    } else {
      const newItem = calculateLineItem(
        product,
        count,
        count,
        product.unit,
        undefined,
        0,
        priceIncludesTax,
        isInterState
      );
      setCart((prev) => [...prev, newItem]);
    }
  };

  // Generic Product Click or "Add to Cart" button click
  const handleProductCardClick = (product: Product) => {
    if (product.unit === 'kg') {
      openWeightModal(product, 250);
    } else {
      handleAddPieceProduct(product, 1);
    }
  };

  // Direct Quantity Input Change in Cart
  const handleDirectQuantityChange = (cartItemId: string, newInputValue: string) => {
    const num = parseFloat(newInputValue);
    if (isNaN(num) || num <= 0) return;

    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== cartItemId) return item;
        const product = products.find((p) => p.id === item.productId);
        if (!product) return item;

        if (item.baseUnit === 'kg') {
          // Input is in grams
          const qtyInKg = num / 1000;
          return calculateLineItem(
            product,
            qtyInKg,
            num,
            'g',
            undefined,
            item.itemDiscountPercent,
            priceIncludesTax,
            isInterState,
            item.unitPrice
          );
        } else {
          return calculateLineItem(
            product,
            num,
            num,
            item.baseUnit,
            undefined,
            item.itemDiscountPercent,
            priceIncludesTax,
            isInterState,
            item.unitPrice
          );
        }
      })
    );
  };

  // Stepper (+) and (-) Button Handlers in Cart
  const handleStepQuantity = (cartItemId: string, stepDirection: 1 | -1) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== cartItemId) return item;
          const product = products.find((p) => p.id === item.productId);
          if (!product) return item;

          if (item.baseUnit === 'kg') {
            const stepGrams = 100; // standard 100g step
            const currentGrams = Math.round(item.quantity * 1000);
            const nextGrams = currentGrams + stepDirection * stepGrams;
            if (nextGrams <= 0) return null; // Remove item

            const qtyInKg = nextGrams / 1000;
            return calculateLineItem(
              product,
              qtyInKg,
              nextGrams,
              'g',
              undefined,
              item.itemDiscountPercent,
              priceIncludesTax,
              isInterState,
              item.unitPrice
            );
          } else {
            const nextCount = item.quantity + stepDirection;
            if (nextCount <= 0) return null; // Remove item

            return calculateLineItem(
              product,
              nextCount,
              nextCount,
              item.baseUnit,
              undefined,
              item.itemDiscountPercent,
              priceIncludesTax,
              isInterState,
              item.unitPrice
            );
          }
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Save Custom Overridden Unit Price for a Cart Item
  const handleSaveCustomPrice = (cartItemId: string) => {
    const newPrice = parseFloat(customItemPrice);
    if (!isNaN(newPrice) && newPrice >= 0) {
      setCart((prev) =>
        prev.map((item) => {
          if (item.id !== cartItemId) return item;
          const product = products.find((p) => p.id === item.productId);
          if (!product) return item;

          return calculateLineItem(
            product,
            item.quantity,
            item.displayQuantity,
            item.displayUnit,
            item.weightPreset,
            item.itemDiscountPercent,
            priceIncludesTax,
            isInterState,
            newPrice
          );
        })
      );
    }
    setEditingPriceItemId(null);
    setCustomItemPrice('');
  };

  // Update item discount %
  const handleUpdateItemDiscount = (cartItemId: string, discountPercent: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== cartItemId) return item;
        const product = products.find((p) => p.id === item.productId);
        if (!product) return item;

        return calculateLineItem(
          product,
          item.quantity,
          item.displayQuantity,
          item.displayUnit,
          item.weightPreset,
          discountPercent,
          priceIncludesTax,
          isInterState,
          item.unitPrice
        );
      })
    );
  };

  // Remove single item
  const handleRemoveItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  // Clear Cart with confirmation
  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Clear all items from the current cart?')) {
      setCart([]);
      setBillDiscount(0);
      setCashReceived('');
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  // New Bill button (resets for fresh customer)
  const handleNewBillClick = () => {
    if (cart.length > 0) {
      if (!window.confirm('Start a new bill? Any unsaved cart items will be cleared.')) {
        return;
      }
    }
    setCart([]);
    setBillDiscount(0);
    setCashReceived('');
    setCustomerName('');
    setCustomerPhone('');
    setErrorMessage('');
    setSuccessNotice('Ready for next bill');
    setTimeout(() => setSuccessNotice(''), 2000);
  };

  // Print Preview Draft (without saving)
  const handlePrintPreviewClick = () => {
    if (cart.length === 0) {
      setErrorMessage('Cannot preview an empty bill. Please add sweets to the cart first.');
      return;
    }
    if (onPrintPreview) {
      const draftBill: Bill = {
        id: `draft-${Date.now()}`,
        billNumber,
        createdAt: new Date().toISOString(),
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items: cart,
        subtotal: billTotals.subtotal,
        totalItemDiscount: billTotals.totalItemDiscount,
        additionalDiscount: billTotals.additionalDiscount,
        taxableAmount: billTotals.taxableAmount,
        isInterState,
        cgstTotal: billTotals.cgstTotal,
        sgstTotal: billTotals.sgstTotal,
        igstTotal: billTotals.igstTotal,
        totalTax: billTotals.totalTax,
        roundOff: billTotals.roundOff,
        grandTotal: billTotals.grandTotal,
        paymentMethod,
        splitDetails: paymentMethod === 'split' ? splitDetails : undefined,
        amountReceived: paymentMethod === 'cash' ? (cashNum || billTotals.grandTotal) : undefined,
        changeDue: paymentMethod === 'cash' ? changeDue : undefined,
        cashierName: 'Counter Cashier 1',
        status: 'completed',
      };
      onPrintPreview(draftBill);
    }
  };

  // Save Bill / Save and Print
  const handleSubmitBill = async (autoPrint: boolean) => {
    if (cart.length === 0) {
      setErrorMessage('Cart is empty. Please add at least one sweet to the bill.');
      return;
    }

    if (paymentMethod === 'cash') {
      if (cashNum > 0 && cashNum < billTotals.grandTotal) {
        setErrorMessage(
          `Amount received (₹${cashNum}) is less than the Grand Total (₹${billTotals.grandTotal})`
        );
        return;
      }
    }

    if (paymentMethod === 'split') {
      const splitSum = splitDetails.cash + splitDetails.upi + splitDetails.card;
      if (Math.abs(splitSum - billTotals.grandTotal) > 1) {
        setErrorMessage(
          `Split payment sum (₹${splitSum}) must equal the grand total (₹${billTotals.grandTotal})`
        );
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newBill: Bill = {
        id: `bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        billNumber,
        createdAt: new Date().toISOString(),
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items: cart,
        subtotal: billTotals.subtotal,
        totalItemDiscount: billTotals.totalItemDiscount,
        additionalDiscount: billTotals.additionalDiscount,
        taxableAmount: billTotals.taxableAmount,
        isInterState,
        cgstTotal: billTotals.cgstTotal,
        sgstTotal: billTotals.sgstTotal,
        igstTotal: billTotals.igstTotal,
        totalTax: billTotals.totalTax,
        roundOff: billTotals.roundOff,
        grandTotal: billTotals.grandTotal,
        paymentMethod,
        splitDetails: paymentMethod === 'split' ? splitDetails : undefined,
        amountReceived: paymentMethod === 'cash' ? (cashNum || billTotals.grandTotal) : undefined,
        changeDue: paymentMethod === 'cash' ? changeDue : undefined,
        cashierName: currentUser?.name || settings.ownerName || 'Shop Owner',
        createdByUserId: currentUser?.id,
        idempotencyKey,
        status: 'completed',
      };

      await onSaveBill(newBill, autoPrint);

      // Reset form for next customer only after cloud confirmation
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setBillDiscount(0);
      setCashReceived('');
      setSplitDetails({ cash: 0, upi: 0, card: 0 });
      setIsMobileCartOpen(false);
      setSuccessNotice(`Bill #${billNumber} saved and synchronized to cloud!`);
      setTimeout(() => setSuccessNotice(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save bill. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reusable Shopping Cart Content (used in Desktop column & Mobile Drawer)
  const renderCartContent = (isMobileView: boolean = false) => (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* 1. CART HEADER */}
      <div className="p-3 bg-[#FAF7F2] border-b border-[#e4d4c4] shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-[#781324]">
              {billNumber}
            </span>
            <span className="text-[10px] text-neutral-500 uppercase font-semibold">
              {priceIncludesTax ? 'Inclusive Tax' : 'Exclusive GST (+Tax)'}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleNewBillClick}
              className="px-2 py-0.5 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 text-[11px] font-semibold rounded cursor-pointer transition-colors"
              title="Start a fresh bill"
            >
              New Bill
            </button>

            <button
              type="button"
              onClick={handleClearCart}
              disabled={cart.length === 0}
              className="px-2 py-0.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 disabled:opacity-40 text-[11px] font-semibold rounded cursor-pointer transition-colors flex items-center gap-0.5"
              title="Clear all cart items"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>

            {isMobileView && (
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(false)}
                className="p-1 text-neutral-500 hover:text-neutral-900 rounded cursor-pointer"
                title="Close Cart"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Customer fields */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="relative">
            <User className="w-3.5 h-3.5 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Customer Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full pl-6 pr-2 py-1 bg-white border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#781324]"
            />
          </div>
          <div className="relative">
            <Phone className="w-3.5 h-3.5 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full pl-6 pr-2 py-1 bg-white border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#781324]"
            />
          </div>
        </div>
      </div>

      {/* 2. NOTICES */}
      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-800 text-xs px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-rose-500 hover:text-rose-800 cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {successNotice && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs px-3 py-1.5 flex items-center gap-2 shrink-0">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="font-semibold">{successNotice}</span>
        </div>
      )}

      {/* 3. INDEPENDENTLY SCROLLABLE CART ITEMS LIST */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 p-2 sm:p-3 min-h-[120px]">
        {cart.length === 0 ? (
          <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center p-6 text-neutral-400">
            <ShoppingCart className="w-10 h-10 stroke-1 text-neutral-300 mb-2" />
            <p className="font-medium text-neutral-700 text-xs">Shopping cart is empty</p>
            <p className="text-[11px] text-neutral-400 mt-1 max-w-xs">
              Click any sweet card on the left to add items by weight (e.g. 250 g) or piece.
            </p>
          </div>
        ) : (
          cart.map((item) => {
            const isEditingPrice = editingPriceItemId === item.id;
            const rawSubtotalBeforeDiscountAndTax = item.unitPrice * item.quantity;

            return (
              <div
                key={item.id}
                className="py-2.5 px-2 flex flex-col gap-1.5 hover:bg-neutral-50/70 rounded-lg transition-colors text-xs"
              >
                {/* Top Row: Sweet Name, Rate, and Line Total */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-neutral-900 truncate text-xs">
                      {item.name}
                    </div>

                    {/* Unit Price and Edit Price Option */}
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-0.5">
                      {isEditingPrice ? (
                        <div className="flex items-center gap-1">
                          <span className="text-neutral-600">Rate: ₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={customItemPrice}
                            onChange={(e) => setCustomItemPrice(e.target.value)}
                            className="w-16 px-1.5 py-0.5 border border-neutral-300 rounded text-xs font-mono font-bold"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveCustomPrice(item.id)}
                            className="p-1 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Save Rate"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPriceItemId(null)}
                            className="p-1 text-neutral-400 hover:bg-neutral-100 rounded cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-mono font-medium text-neutral-700 tabular-nums">
                            ₹{item.unitPrice}/{item.baseUnit}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPriceItemId(item.id);
                              setCustomItemPrice(item.unitPrice.toString());
                            }}
                            className="p-0.5 text-neutral-400 hover:text-[#781324] transition-colors cursor-pointer"
                            title="Edit price for this sweet"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <span>·</span>
                          <span className="text-[#781324] font-medium">
                            +{item.gstRate}% GST (₹{item.totalGstAmount.toFixed(2)})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Line Total with GST added on top */}
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-neutral-900 text-sm tabular-nums">
                      {formatRupee(item.lineTotal)}
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono tabular-nums">
                      Base: {formatRupee(rawSubtotalBeforeDiscountAndTax)}
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Editable Quantity Input & Steppers, Discount %, Remove Button */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100">
                  {/* Stepper + Editable Quantity Input */}
                  <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-0.5 border border-neutral-200">
                    <button
                      type="button"
                      onClick={() => handleStepQuantity(item.id, -1)}
                      className="w-5 h-5 rounded bg-white hover:bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-xs cursor-pointer shadow-2xs"
                      title="Decrease Quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>

                    {/* Editable Quantity Input */}
                    <div className="flex items-center px-1">
                      <input
                        type="number"
                        step={item.baseUnit === 'kg' ? '50' : '1'}
                        min="1"
                        value={item.displayQuantity}
                        onChange={(e) => handleDirectQuantityChange(item.id, e.target.value)}
                        className="w-14 text-center font-mono font-bold text-neutral-900 text-xs tabular-nums bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#781324] rounded py-0.5"
                        title="Click to edit quantity directly"
                      />
                      <span className="text-[10px] font-semibold text-neutral-600 pl-0.5">
                        {item.displayUnit}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStepQuantity(item.id, 1)}
                      className="w-5 h-5 rounded bg-white hover:bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-xs cursor-pointer shadow-2xs"
                      title="Increase Quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Item Discount Input */}
                  <div className="flex items-center gap-1 text-[11px] text-neutral-600">
                    <span>Disc:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={item.itemDiscountPercent || ''}
                      onChange={(e) =>
                        handleUpdateItemDiscount(
                          item.id,
                          Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                        )
                      }
                      placeholder="0"
                      className="w-9 text-right px-1 py-0.5 border border-neutral-300 rounded font-mono text-xs focus:outline-none focus:border-[#781324]"
                    />
                    <span>%</span>
                  </div>

                  {/* Remove Item */}
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 text-neutral-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                    title="Remove sweet from bill"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. PINNED BOTTOM SUMMARY & CHECKOUT ACTIONS (NEVER DISAPPEARS OFF SCREEN) */}
      <div className="p-3 bg-[#FAF7F2] border-t border-[#e4d4c4] space-y-2 shrink-0 shadow-sm">
        {/* Subtotal, Discount & Taxable Base */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-neutral-600">
            <span>Subtotal:</span>
            <span className="font-mono tabular-nums">{formatRupee(billTotals.subtotal)}</span>
          </div>

          {/* Discount given */}
          <div className="flex items-center justify-between text-neutral-600">
            <span className="flex items-center gap-1">
              <span>Discount:</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-emerald-700 tabular-nums">
                {formatRupee(billTotals.totalItemDiscount + billTotals.additionalDiscount)}
              </span>
              <input
                type="number"
                min="0"
                value={billDiscount || ''}
                onChange={(e) => setBillDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="Bill ₹"
                title="Bill-level discount in ₹"
                className="w-16 text-right px-1.5 py-0.5 bg-white border border-neutral-300 rounded text-[11px] font-mono tabular-nums focus:outline-none focus:border-[#781324]"
              />
            </div>
          </div>

          <div className="flex justify-between text-neutral-800 font-medium">
            <span>Taxable Amount:</span>
            <span className="font-mono tabular-nums">{formatRupee(billTotals.taxableAmount)}</span>
          </div>

          {/* Collapsible GST Breakdown Strip */}
          <div className="pt-0.5">
            <div className="flex items-center justify-between text-[11px] text-neutral-600 bg-white p-1.5 rounded border border-neutral-200">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-neutral-700">Total GST:</span>
                <span className="font-mono font-bold text-[#781324] tabular-nums">
                  +{formatRupee(billTotals.totalTax)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsInterState(!isInterState)}
                  className="text-[10px] text-neutral-500 underline ml-1 cursor-pointer"
                  title="Toggle Intra vs Inter-State IGST"
                >
                  ({isInterState ? 'IGST' : 'CGST+SGST'})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsGstDetailsOpen(!isGstDetailsOpen)}
                className="text-[10px] text-neutral-600 hover:text-neutral-900 font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span>{isGstDetailsOpen ? 'Hide' : 'Breakdown'}</span>
                {isGstDetailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {/* Expanded GST details when toggled */}
            {isGstDetailsOpen && (
              <div className="mt-1 p-2 bg-neutral-50 rounded border border-neutral-200 text-[10px] space-y-0.5 text-neutral-600 font-mono">
                {!isInterState ? (
                  <>
                    <div className="flex justify-between">
                      <span>CGST:</span>
                      <span>{formatRupee(billTotals.cgstTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST:</span>
                      <span>{formatRupee(billTotals.sgstTotal)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>IGST:</span>
                    <span>{formatRupee(billTotals.igstTotal)}</span>
                  </div>
                )}
                {billTotals.roundOff !== 0 && (
                  <div className="flex justify-between pt-0.5 border-t border-neutral-200 text-neutral-500">
                    <span>Round Off:</span>
                    <span>{billTotals.roundOff > 0 ? `+${billTotals.roundOff}` : billTotals.roundOff}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* GRAND TOTAL - PROMINENT & HIGH-CONTRAST */}
          <div className="flex items-center justify-between text-base font-bold text-neutral-900 pt-1 border-t border-neutral-300">
            <span className="font-serif uppercase tracking-tight text-neutral-900 text-sm">
              GRAND TOTAL:
            </span>
            <span className="font-mono text-xl sm:text-2xl text-[#781324] tabular-nums font-black">
              {formatRupee(billTotals.grandTotal)}
            </span>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="pt-1.5 border-t border-[#e4d4c4]">
          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`py-1 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                paymentMethod === 'cash'
                  ? 'bg-[#781324] text-white shadow-xs font-bold'
                  : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <Banknote className="w-3 h-3" />
              <span>Cash</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('upi')}
              className={`py-1 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                paymentMethod === 'upi'
                  ? 'bg-[#781324] text-white shadow-xs font-bold'
                  : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <QrCode className="w-3 h-3" />
              <span>UPI</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`py-1 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                paymentMethod === 'card'
                  ? 'bg-[#781324] text-white shadow-xs font-bold'
                  : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <CreditCard className="w-3 h-3" />
              <span>Card</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('split')}
              className={`py-1 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                paymentMethod === 'split'
                  ? 'bg-[#781324] text-white shadow-xs font-bold'
                  : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <Split className="w-3 h-3" />
              <span>Split</span>
            </button>
          </div>

          {/* Cash Calculator */}
          {paymentMethod === 'cash' && (
            <div className="mt-1.5 p-1.5 bg-white rounded border border-neutral-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-600 font-medium text-[11px]">Received:</span>
                <input
                  type="number"
                  min="0"
                  placeholder={billTotals.grandTotal.toString()}
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="w-20 px-1.5 py-0.5 border border-neutral-300 rounded font-mono font-bold text-xs focus:outline-none focus:border-[#781324]"
                />
              </div>
              <div className="text-right">
                <span className="text-[10px] text-neutral-500">Change: </span>
                <span className="font-mono font-bold text-emerald-700 text-xs tabular-nums">
                  {formatRupee(changeDue)}
                </span>
              </div>
            </div>
          )}

          {/* Split Payment */}
          {paymentMethod === 'split' && (
            <div className="mt-1.5 p-2 bg-white rounded border border-neutral-200 space-y-1 text-xs">
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="text-[10px] text-neutral-500 font-semibold block">Cash (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={splitDetails.cash || ''}
                    onChange={(e) =>
                      setSplitDetails({ ...splitDetails, cash: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-1.5 py-0.5 border border-neutral-300 rounded font-mono text-xs"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 font-semibold block">UPI (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={splitDetails.upi || ''}
                    onChange={(e) =>
                      setSplitDetails({ ...splitDetails, upi: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-1.5 py-0.5 border border-neutral-300 rounded font-mono text-xs"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 font-semibold block">Card (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={splitDetails.card || ''}
                    onChange={(e) =>
                      setSplitDetails({ ...splitDetails, card: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-1.5 py-0.5 border border-neutral-300 rounded font-mono text-xs"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Check-Out Buttons: Preview, Save Bill, Save & Print */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {/* Print Preview Button */}
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={handlePrintPreviewClick}
            className="py-2 px-1 bg-white hover:bg-neutral-100 disabled:opacity-40 border border-neutral-300 text-neutral-800 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
            title="Preview receipt before saving"
          >
            <Eye className="w-3.5 h-3.5 text-neutral-600" />
            <span>Preview</span>
          </button>

          {/* Save Bill Button */}
          <button
            type="button"
            disabled={isSubmitting || cart.length === 0}
            onClick={() => handleSubmitBill(false)}
            className="py-2 px-1 bg-neutral-800 hover:bg-neutral-900 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Bill</span>
          </button>

          {/* Save & Print Button */}
          <button
            type="button"
            disabled={isSubmitting || cart.length === 0}
            onClick={() => handleSubmitBill(true)}
            className="py-2 px-1 bg-[#781324] hover:bg-[#600f1c] disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-[#e8c878]" />
            <span>Save & Print</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row bg-[#FAF7F2] overflow-hidden relative">
      {/* ======================================================== */}
      {/* LEFT COLUMN: SWEET PRODUCTS CATALOG & SEARCH             */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col h-full border-r border-[#e4d4c4] bg-[#FAF7F2] overflow-hidden pb-16 lg:pb-0">
        {/* Top Control Bar: Search, Barcode, Add Sweet & View Toggle */}
        <div className="p-3 sm:p-4 bg-white border-b border-[#e4d4c4] space-y-3 shrink-0 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Prominent Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search sweets by name (e.g. Kaju Katli, Laddu, Peda) or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-7 py-2 bg-[#FAF7F2] border border-neutral-300 rounded-lg text-xs font-medium focus:outline-none focus:border-[#781324] focus:ring-1 focus:ring-[#781324] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Barcode Quick Scan */}
            <form onSubmit={handleBarcodeSubmit} className="relative sm:w-44">
              <input
                type="text"
                placeholder="Barcode Scan..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-[#FAF7F2] border border-neutral-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#781324] transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#781324] cursor-pointer"
                title="Scan"
              >
                ↵
              </button>
            </form>

            {/* "Add Sweet" Button (Direct navigation to product management) */}
            <button
              type="button"
              onClick={onOpenAddSweet || onNavigateToProducts}
              className="px-3.5 py-2 bg-[#781324] hover:bg-[#600f1c] text-white text-xs font-bold rounded-lg shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="Add New Sweet to Catalog"
            >
              <FilePlus className="w-4 h-4" />
              <span>Add Sweet</span>
            </button>

            {/* Grid / Table View Switcher */}
            <div className="flex items-center bg-neutral-100 p-1 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white shadow-2xs text-[#781324]' : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewMode === 'table' ? 'bg-white shadow-2xs text-[#781324]' : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Compact Table View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#781324] text-white shadow-xs font-semibold'
                      : 'bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Items Canvas - Independently scrollable */}
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
          {/* Empty Catalog State */}
          {products.length === 0 ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 bg-white rounded-xl border border-dashed border-neutral-300">
              <Package className="w-12 h-12 text-neutral-300 mb-3" />
              <h3 className="text-base font-serif font-bold text-neutral-900">
                No Sweets in Product Catalog
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mt-1 mb-4">
                Add your delicious Indian sweets with prices, GST rates, and inventory to start billing counter sales.
              </p>
              <button
                type="button"
                onClick={onOpenAddSweet || onNavigateToProducts}
                className="px-4 py-2.5 bg-[#781324] hover:bg-[#600f1c] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Sweet</span>
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full min-h-[250px] flex flex-col items-center justify-center text-center p-8 text-neutral-400 text-xs">
              <Search className="w-8 h-8 mb-2 text-neutral-300" />
              <p className="font-semibold text-neutral-700">No sweets matched "{searchQuery}"</p>
              <p className="mt-1">Try searching another sweet or select "All" categories.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="mt-3 text-xs text-[#781324] font-semibold underline cursor-pointer"
              >
                Clear Search Filter
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* VIEW MODE: PRODUCT CARDS GRID */
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((product) => {
                const isKg = product.unit === 'kg';

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl border border-[#e8d8c8] shadow-2xs hover:shadow-md hover:border-[#781324]/50 transition-all flex flex-col overflow-hidden group"
                  >
                    {/* Sweet Image Slot (Clickable to add) */}
                    <div
                      onClick={() => handleProductCardClick(product)}
                      className="h-28 bg-[#f5ebe1] relative overflow-hidden flex items-center justify-center cursor-pointer select-none"
                    >
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <span className="font-serif text-3xl font-bold text-[#bfa07e]">
                            {product.name.charAt(0)}
                          </span>
                        </div>
                      )}

                      {/* Stock Badge */}
                      <div className="absolute top-1.5 right-1.5 bg-black/65 backdrop-blur-xs text-white text-[10px] px-1.5 py-0.5 rounded font-mono font-medium">
                        {product.stockQty} {product.unit}
                      </div>

                      {product.hindiName && (
                        <div className="absolute bottom-1.5 left-1.5 bg-[#FAF7F2]/95 text-[#5c0e1b] text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                          {product.hindiName}
                        </div>
                      )}
                    </div>

                    {/* Sweet Details */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4
                          onClick={() => handleProductCardClick(product)}
                          className="font-semibold text-neutral-900 text-xs line-clamp-1 leading-snug cursor-pointer hover:text-[#781324]"
                          title={product.name}
                        >
                          {product.name}
                        </h4>

                        <div className="flex items-center justify-between mt-1">
                          <span className="font-mono font-bold text-[#781324] text-xs tabular-nums">
                            {formatRupee(product.sellingPrice)}
                            <span className="text-[10px] text-neutral-500 font-normal">
                              /{product.unit} (base)
                            </span>
                          </span>
                          <span className="text-[10px] text-neutral-600 font-medium">
                            +{product.gstRate}% GST
                          </span>
                        </div>
                      </div>

                      {/* Action & Weight Presets */}
                      <div className="mt-2.5 pt-2 border-t border-neutral-100 space-y-1.5">
                        {/* Primary "Add to Cart" Button */}
                        <button
                          type="button"
                          onClick={() => handleProductCardClick(product)}
                          className="w-full py-1.5 bg-[#781324] hover:bg-[#600f1c] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Add to Cart</span>
                        </button>

                        {/* Quick 1-click Weight Chips for kg-based sweets */}
                        {isKg && (
                          <div className="grid grid-cols-4 gap-1 pt-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickAddWeightPreset(product, 100);
                              }}
                              className="py-1 bg-[#FAF7F2] hover:bg-[#781324] hover:text-white text-neutral-700 text-[10px] font-bold rounded transition-colors cursor-pointer border border-[#e4d4c4]"
                              title="Quick add 100g"
                            >
                              100g
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickAddWeightPreset(product, 250);
                              }}
                              className="py-1 bg-[#FAF7F2] hover:bg-[#781324] hover:text-white text-neutral-700 text-[10px] font-bold rounded transition-colors cursor-pointer border border-[#e4d4c4]"
                              title="Quick add 250g"
                            >
                              250g
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickAddWeightPreset(product, 500);
                              }}
                              className="py-1 bg-[#FAF7F2] hover:bg-[#781324] hover:text-white text-neutral-700 text-[10px] font-bold rounded transition-colors cursor-pointer border border-[#e4d4c4]"
                              title="Quick add 500g"
                            >
                              500g
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickAddWeightPreset(product, 1000);
                              }}
                              className="py-1 bg-[#e8c878] hover:bg-[#d8b868] text-[#4d0c17] text-[10px] font-bold rounded transition-colors cursor-pointer"
                              title="Quick add 1 kg"
                            >
                              1 kg
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* VIEW MODE: COMPACT PRODUCT TABLE */
            <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF7F2] border-b border-neutral-200 text-neutral-600 font-semibold">
                    <th className="py-2.5 px-3">Sweet Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Base Price</th>
                    <th className="py-2.5 px-3 text-center">GST</th>
                    <th className="py-2.5 px-3 text-right">Stock</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-50/80">
                      <td className="py-2.5 px-3 font-semibold text-neutral-900">
                        {p.name}
                        {p.hindiName && (
                          <span className="text-[11px] text-neutral-500 font-normal ml-1.5">
                            ({p.hindiName})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600">{p.category}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#781324] tabular-nums">
                        {formatRupee(p.sellingPrice)}/{p.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-neutral-600">
                        +{p.gstRate}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-neutral-700 tabular-nums">
                        {p.stockQty} {p.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.unit === 'kg' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleQuickAddWeightPreset(p, 250)}
                                className="px-2 py-1 bg-neutral-100 hover:bg-[#781324] hover:text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                250g
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickAddWeightPreset(p, 500)}
                                className="px-2 py-1 bg-neutral-100 hover:bg-[#781324] hover:text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                500g
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleProductCardClick(p)}
                            className="px-3 py-1 bg-[#781324] hover:bg-[#600f1c] text-white rounded text-[11px] font-bold cursor-pointer"
                          >
                            Add to Cart
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT COLUMN: PERMANENTLY VISIBLE DESKTOP SHOPPING CART  */}
      {/* ======================================================== */}
      <div className="hidden lg:flex w-[440px] xl:w-[480px] h-full shadow-lg border-l border-[#e4d4c4] shrink-0 overflow-hidden">
        {renderCartContent(false)}
      </div>

      {/* ======================================================== */}
      {/* TABLET & MOBILE: COMPACT STICKY BOTTOM CHECKOUT BAR      */}
      {/* ======================================================== */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#5c0e1b] text-white px-4 py-2.5 shadow-2xl flex items-center justify-between border-t border-[#8a2236]">
        <div>
          <div className="text-[11px] text-[#e8c878] font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span>{cart.length} Sweets in Cart</span>
            <span>·</span>
            <span className="text-[#f5dcdc]">{billTotals.totalTax > 0 ? `GST +₹${billTotals.totalTax.toFixed(2)}` : 'Zero GST'}</span>
          </div>
          <div className="font-mono text-lg font-black text-white tabular-nums leading-tight">
            {formatRupee(billTotals.grandTotal)}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsMobileCartOpen(true)}
          className="px-4 py-2 bg-[#e8c878] hover:bg-[#dfbd6a] text-[#4d0c17] text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>View Cart & Pay ({cart.length})</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ======================================================== */}
      {/* TABLET & MOBILE: SLIDE-OVER FULL CART DRAWER             */}
      {/* ======================================================== */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {renderCartContent(true)}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: WEIGHT INPUT DIALOG (FOR WEIGHT-BASED SWEETS)     */}
      {/* ======================================================== */}
      {weightModal.isOpen && weightModal.product && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-[#e8d8c8] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-2 border-b border-neutral-100 mb-3">
              <div>
                <h3 className="font-serif font-bold text-base text-neutral-900 leading-tight">
                  Add {weightModal.product.name}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Base Price: <strong className="text-[#781324] font-mono">{formatRupee(weightModal.product.sellingPrice)}</strong> per kg
                  <span className="text-neutral-400 ml-1">(+{weightModal.product.gstRate}% GST extra)</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWeightModal({ isOpen: false, product: null, grams: 250, separateRow: false })}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const baseGrams = weightModal.grams;
              const baseAmt = (weightModal.product.sellingPrice * baseGrams) / 1000;
              const gstAmt = (baseAmt * weightModal.product.gstRate) / 100;
              const finalAmt = baseAmt + gstAmt;

              return (
                <div className="space-y-3.5">
                  {/* Common Weight Presets */}
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1.5">
                      Common Weight Presets
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[100, 250, 500, 1000].map((presetG) => (
                        <button
                          key={presetG}
                          type="button"
                          onClick={() => setWeightModal({ ...weightModal, grams: presetG })}
                          className={`py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                            weightModal.grams === presetG
                              ? 'bg-[#781324] text-white shadow-xs'
                              : 'bg-[#FAF7F2] hover:bg-neutral-200 text-neutral-700 border border-[#e4d4c4]'
                          }`}
                        >
                          {presetG >= 1000 ? `${presetG / 1000} kg` : `${presetG}g`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Direct Grams Input Field */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Enter Exact Weight in Grams (g)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        ref={gramsInputRef}
                        type="number"
                        min="1"
                        max="50000"
                        step="1"
                        value={weightModal.grams || ''}
                        onChange={(e) =>
                          setWeightModal({
                            ...weightModal,
                            grams: Math.max(1, parseInt(e.target.value) || 0),
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleConfirmWeightModal();
                          }
                        }}
                        placeholder="250"
                        className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm font-mono font-bold focus:outline-none focus:border-[#781324] focus:ring-1 focus:ring-[#781324]"
                        autoFocus
                      />
                      <span className="font-semibold text-neutral-600 text-xs">grams</span>
                    </div>
                  </div>

                  {/* Live Calculation Preview with GST added on top */}
                  <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#e8d8c8] text-xs space-y-1">
                    <div className="flex justify-between text-neutral-600">
                      <span>Weight in Kg:</span>
                      <span className="font-mono font-bold">
                        {(weightModal.grams / 1000).toFixed(3)} kg
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-700">
                      <span>Base Amount (before GST):</span>
                      <span className="font-mono font-bold">
                        {formatRupee(baseAmt)}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-700">
                      <span>GST ({weightModal.product.gstRate}%):</span>
                      <span className="font-mono font-bold text-[#781324]">
                        +{formatRupee(gstAmt)}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-900 font-bold pt-1 border-t border-neutral-200">
                      <span>Line Total (with GST):</span>
                      <span className="font-mono text-[#781324] text-sm font-black">
                        {formatRupee(finalAmt)}
                      </span>
                    </div>
                  </div>

                  {/* Option to add as separate row if already in cart */}
                  {cart.some((item) => item.productId === weightModal.product?.id) && (
                    <label className="flex items-center gap-2 text-[11px] text-neutral-600 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={weightModal.separateRow}
                        onChange={(e) =>
                          setWeightModal({ ...weightModal, separateRow: e.target.checked })
                        }
                        className="rounded text-[#781324]"
                      />
                      <span>Add as separate cart row instead of merging</span>
                    </label>
                  )}
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={() =>
                  setWeightModal({ isOpen: false, product: null, grams: 250, separateRow: false })
                }
                className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWeightModal}
                className="flex-1 py-2 bg-[#781324] hover:bg-[#600f1c] text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm"
              >
                Add to Cart (Enter)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
