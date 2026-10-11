export type ProductUnit = 'kg' | '500g' | '250g' | '100g' | 'gram' | 'piece' | 'packet' | 'box';

export type WeightPreset = '100g' | '250g' | '500g' | '1kg' | 'custom_g' | '1pc' | '1box';

export interface Product {
  id: string;
  name: string;
  hindiName?: string;
  category: string;
  sellingPrice: number; // Base price for unit (e.g. ₹800/kg or ₹30/piece)
  costPrice: number;    // Purchase / preparation cost price
  unit: ProductUnit;
  gstRate: number;      // 0, 5, 12, 18
  stockQty: number;     // In standard unit (e.g., kg for weight sweets, pieces for piece sweets)
  minStockLevel: number;
  barcode?: string;
  image?: string;
  isActive: boolean;
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string; // unique cart item id
  productId: string;
  name: string;
  hindiName?: string;
  category: string;
  baseUnit: ProductUnit;
  unitPrice: number;         // Price per base unit
  quantity: number;          // In base unit (e.g. 0.25 for 250g of kg sweet, or 4 for 4 pieces)
  displayQuantity: number;   // E.g. 250
  displayUnit: string;       // E.g. 'g', 'kg', 'pcs'
  weightPreset?: WeightPreset;
  itemDiscountPercent: number; // 0-100
  itemDiscountAmount: number;
  gstRate: number;           // 5, 12, etc.
  costPrice: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGstAmount: number;
  lineTotal: number;
}

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'split';

export interface SplitPaymentDetails {
  cash: number;
  upi: number;
  card: number;
}

export interface BillAuditRecord {
  editedAt: string;
  editedBy: string;
  reason: string;
  previousGrandTotal: number;
  previousItemsSummary: string;
}

export interface Bill {
  id: string;
  billNumber: string;         // e.g. PCS-2026-0001
  createdAt: string;          // ISO
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: CartItem[];
  subtotal: number;
  totalItemDiscount: number;
  additionalDiscount: number; // Flat bill-level discount
  taxableAmount: number;
  isInterState: boolean;      // True if IGST applies instead of CGST+SGST
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  splitDetails?: SplitPaymentDetails;
  amountReceived?: number;
  changeDue?: number;
  cashierName: string;
  createdByUserId?: string;
  deviceTerminalName?: string;
  idempotencyKey?: string;
  status: 'completed' | 'edited' | 'cancelled' | 'refunded';
  notes?: string;
  editHistory?: BillAuditRecord[];
  cancellationDetails?: {
    cancelledAt: string;
    cancelledBy: string;
    reason: string;
  };
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'sale' | 'restock' | 'damage' | 'expired' | 'adjustment' | 'cancellation_return' | 'edit_adjustment';
  quantityDelta: number; // Negative for sale, positive for restock
  previousStock: number;
  newStock: number;
  unit: string;
  reason?: string;
  billNumber?: string;
  timestamp: string;
}

export interface ShopSettings {
  shopName: string;
  ownerName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  fssai: string;
  state: string;
  stateCode: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  printFormat: '58mm' | '80mm' | 'a4';
  defaultPaymentMethod: PaymentMethod;
  priceIncludesTax: boolean;
  allowNegativeStock: boolean;
  cashierPinEnabled: boolean;
  adminPin: string;
  footerMessage: string;
  currencySymbol: string;
  cloudSyncUrl?: string;
  cloudSyncEnabled?: boolean;
}

export type UserRole = 'owner' | 'admin' | 'manager' | 'cashier';

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  pin?: string; // Optional legacy / input field, never returned from server
  pinHash?: string;
  pinSalt?: string;
  password?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action:
    | 'BILL_CREATE'
    | 'BILL_EDIT'
    | 'BILL_CANCEL'
    | 'BILL_DELETE'
    | 'PRICE_CHANGE'
    | 'STOCK_ADJUST'
    | 'LOGIN'
    | 'LOGOUT'
    | 'SETTINGS_CHANGE'
    | 'USER_CREATE'
    | 'USER_UPDATE'
    | 'USER_DEACTIVATE'
    | 'USER_REACTIVATE'
    | 'PIN_RESET';
  details: string;
  targetId?: string;
  ipAddress?: string;
}

export interface ShiftSession {
  id: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime?: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  totalBills: number;
  totalSales: number;
  notes?: string;
  status: 'open' | 'closed';
}
