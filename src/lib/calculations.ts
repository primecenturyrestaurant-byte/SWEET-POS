import { CartItem, Product, ShopSettings, WeightPreset } from '../types';

/**
 * Format any number as Indian Rupee string: e.g. ₹1,250.00
 */
export function formatRupee(amount: number): string {
  const rounded = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/**
 * Format quantity with unit e.g. "250 g", "1.5 kg", "4 pcs"
 */
export function formatQuantityWithUnit(quantity: number, unit: string): string {
  if (unit === 'kg') {
    if (quantity < 1 && quantity > 0) {
      return `${Math.round(quantity * 1000)} g`;
    }
    return `${quantity.toFixed(quantity % 1 === 0 ? 0 : 3)} kg`;
  }
  return `${quantity} ${unit}`;
}

/**
 * Calculate quantity in base unit given a weight preset or custom grams
 */
export function calculateQuantityFromPreset(
  preset: WeightPreset,
  customGrams?: number
): { quantity: number; displayQuantity: number; displayUnit: string } {
  switch (preset) {
    case '100g':
      return { quantity: 0.1, displayQuantity: 100, displayUnit: 'g' };
    case '250g':
      return { quantity: 0.25, displayQuantity: 250, displayUnit: 'g' };
    case '500g':
      return { quantity: 0.5, displayQuantity: 500, displayUnit: 'g' };
    case '1kg':
      return { quantity: 1, displayQuantity: 1, displayUnit: 'kg' };
    case 'custom_g': {
      const g = Math.max(1, customGrams || 100);
      return { quantity: g / 1000, displayQuantity: g, displayUnit: 'g' };
    }
    case '1pc':
      return { quantity: 1, displayQuantity: 1, displayUnit: 'pcs' };
    case '1box':
      return { quantity: 1, displayQuantity: 1, displayUnit: 'box' };
    default:
      return { quantity: 1, displayQuantity: 1, displayUnit: 'kg' };
  }
}

/**
 * Calculate line item values including GST and discounts
 */
export function calculateLineItem(
  product: Product,
  quantity: number, // in base product unit
  displayQuantity: number,
  displayUnit: string,
  weightPreset?: WeightPreset,
  itemDiscountPercent: number = 0,
  priceIncludesTax: boolean = false,
  isInterState: boolean = false,
  overrideUnitPrice?: number
): CartItem {
  const unitPrice = typeof overrideUnitPrice === 'number' && overrideUnitPrice >= 0 ? overrideUnitPrice : product.sellingPrice;
  const rawSubtotal = unitPrice * quantity;
  const discountPct = Math.min(100, Math.max(0, itemDiscountPercent));
  const discountAmount = Number(((rawSubtotal * discountPct) / 100).toFixed(2));
  const effectivePrice = Math.max(0, rawSubtotal - discountAmount);

  let taxableAmount = 0;
  let totalGstAmount = 0;

  if (priceIncludesTax && product.gstRate > 0) {
    // Inclusive: Taxable = effectivePrice / (1 + rate / 100)
    taxableAmount = Number((effectivePrice / (1 + product.gstRate / 100)).toFixed(2));
    totalGstAmount = Number((effectivePrice - taxableAmount).toFixed(2));
  } else if (!priceIncludesTax && product.gstRate > 0) {
    // Exclusive: Tax is added on top of taxable amount
    taxableAmount = Number(effectivePrice.toFixed(2));
    totalGstAmount = Number(((taxableAmount * product.gstRate) / 100).toFixed(2));
  } else {
    // 0% GST
    taxableAmount = Number(effectivePrice.toFixed(2));
    totalGstAmount = 0;
  }

  const lineTotal = priceIncludesTax
    ? effectivePrice
    : Number((taxableAmount + totalGstAmount).toFixed(2));

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstAmount = totalGstAmount;
  } else {
    cgstAmount = Number((totalGstAmount / 2).toFixed(2));
    sgstAmount = Number((totalGstAmount - cgstAmount).toFixed(2)); // avoid rounding discrepancy
  }

  return {
    id: `${product.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    productId: product.id,
    name: product.name,
    hindiName: product.hindiName,
    category: product.category,
    baseUnit: product.unit,
    unitPrice,
    quantity,
    displayQuantity,
    displayUnit,
    weightPreset,
    itemDiscountPercent: discountPct,
    itemDiscountAmount: discountAmount,
    gstRate: product.gstRate,
    costPrice: product.costPrice,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalGstAmount,
    lineTotal: Number(lineTotal.toFixed(2)),
  };
}

/**
 * Calculate grand bill totals from items and overall discount
 */
export function calculateBillTotals(
  items: CartItem[],
  additionalDiscount: number = 0,
  isInterState: boolean = false
) {
  const subtotal = items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  const totalItemDiscount = items.reduce((acc, item) => acc + item.itemDiscountAmount, 0);

  const grossTaxable = items.reduce((acc, item) => acc + item.taxableAmount, 0);

  // Bill-level additional flat discount applies against taxable value
  const safeAdditionalDiscount = Math.min(
    grossTaxable,
    Math.max(0, additionalDiscount)
  );

  const taxableAmount = Math.max(0, grossTaxable - safeAdditionalDiscount);
  
  // Tax calculation
  let totalTax = 0;
  if (safeAdditionalDiscount === 0) {
    totalTax = items.reduce((acc, item) => acc + item.totalGstAmount, 0);
  } else {
    const discountRatio = grossTaxable > 0 ? taxableAmount / grossTaxable : 1;
    totalTax = items.reduce(
      (acc, item) => acc + Number((item.totalGstAmount * discountRatio).toFixed(2)),
      0
    );
  }

  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  if (isInterState) {
    igstTotal = Number(totalTax.toFixed(2));
  } else {
    cgstTotal = Number((totalTax / 2).toFixed(2));
    sgstTotal = Number((totalTax - cgstTotal).toFixed(2));
  }

  const rawGrandTotal = taxableAmount + totalTax;
  const grandTotal = Math.round(Math.max(0, rawGrandTotal));
  const roundOff = Number((grandTotal - rawGrandTotal).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    totalItemDiscount: Number(totalItemDiscount.toFixed(2)),
    additionalDiscount: Number(safeAdditionalDiscount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    cgstTotal,
    sgstTotal,
    igstTotal,
    totalTax: Number(totalTax.toFixed(2)),
    roundOff,
    grandTotal,
  };
}
