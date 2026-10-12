import type { Bill, BillAuditRecord, CartItem, Product, ShopSettings, StockMovement } from '../types/index.ts';
import { DEFAULT_SETTINGS, INITIAL_PRODUCTS } from './constants.ts';

export { DEFAULT_SETTINGS, INITIAL_PRODUCTS };

const DB_NAME = 'PrimeCenturySweet_POS_DB';
const DB_VERSION = 1;

class StorageEngine {
  private db: IDBDatabase | null = null;
  private isSupported = typeof indexedDB !== 'undefined';

  async init(): Promise<void> {
    if (!this.isSupported) return;
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('bills')) {
          const billStore = db.createObjectStore('bills', { keyPath: 'id' });
          billStore.createIndex('billNumber', 'billNumber', { unique: true });
          billStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('stockMovements')) {
          db.createObjectStore('stockMovements', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => {
        console.warn('IndexedDB failed to open, using LocalStorage fallback');
        resolve();
      };
    });
  }

  // --- PRODUCTS ---

  async getProducts(): Promise<Product[]> {
    await this.init();
    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db!.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const req = store.getAll();
        req.onsuccess = () => {
          const list: Product[] = req.result || [];
          if (list.length === 0) {
            // Seed initial
            this.seedInitialProducts().then(resolve);
          } else {
            resolve(list);
          }
        };
        req.onerror = () => resolve(this.getLocalFallback<Product[]>('pcs_products', INITIAL_PRODUCTS));
      });
    }

    const local = this.getLocalFallback<Product[]>('pcs_products', null as any);
    if (!local || local.length === 0) {
      this.setLocalFallback('pcs_products', INITIAL_PRODUCTS);
      return INITIAL_PRODUCTS;
    }
    return local;
  }

  private async seedInitialProducts(): Promise<Product[]> {
    if (this.db) {
      const tx = this.db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      for (const p of INITIAL_PRODUCTS) {
        store.put(p);
      }
    }
    this.setLocalFallback('pcs_products', INITIAL_PRODUCTS);
    return INITIAL_PRODUCTS;
  }

  async saveProduct(product: Product): Promise<void> {
    await this.init();
    const updated = { ...product, updatedAt: new Date().toISOString() };
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction('products', 'readwrite');
        const store = tx.objectStore('products');
        const req = store.put(updated);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    // Also update localStorage
    const current = await this.getProducts();
    const idx = current.findIndex((p) => p.id === product.id);
    if (idx >= 0) current[idx] = updated;
    else current.unshift(updated);
    this.setLocalFallback('pcs_products', current);
  }

  async deleteProduct(productId: string): Promise<void> {
    await this.init();
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction('products', 'readwrite');
        const store = tx.objectStore('products');
        const req = store.delete(productId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    const current = (await this.getProducts()).filter((p) => p.id !== productId);
    this.setLocalFallback('pcs_products', current);
  }

  // --- BILLS & TRANSACTIONS ---

  async getBills(): Promise<Bill[]> {
    await this.init();
    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db!.transaction('bills', 'readonly');
        const store = tx.objectStore('bills');
        const req = store.getAll();
        req.onsuccess = () => {
          const list: Bill[] = req.result || [];
          resolve(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        };
        req.onerror = () => resolve(this.getLocalFallback<Bill[]>('pcs_bills', []));
      });
    }
    const local = this.getLocalFallback<Bill[]>('pcs_bills', []);
    return local.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async saveBill(bill: Bill): Promise<Bill> {
    await this.init();

    // 1. Save Bill in DB
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction('bills', 'readwrite');
        const store = tx.objectStore('bills');
        const req = store.put(bill);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    const currentBills = await this.getBills();
    const existingIndex = currentBills.findIndex((b) => b.id === bill.id);
    if (existingIndex >= 0) currentBills[existingIndex] = bill;
    else currentBills.unshift(bill);
    this.setLocalFallback('pcs_bills', currentBills);

    // 2. Reduce stock for each product in items
    const products = await this.getProducts();
    const settings = await this.getSettings();

    for (const item of bill.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        const prevStock = prod.stockQty;
        const newStock = Number((prevStock - item.quantity).toFixed(3));

        // If negative stock not allowed and new stock < 0, handle based on setting
        const finalStock = (!settings.allowNegativeStock && newStock < 0) ? 0 : newStock;
        prod.stockQty = finalStock;
        prod.updatedAt = new Date().toISOString();
        await this.saveProduct(prod);

        // Record stock movement
        await this.addStockMovement({
          id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          productId: prod.id,
          productName: prod.name,
          type: 'sale',
          quantityDelta: -item.quantity,
          previousStock: prevStock,
          newStock: finalStock,
          unit: prod.unit,
          billNumber: bill.billNumber,
          reason: `Sale on Bill #${bill.billNumber}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 3. Increment invoice counter
    const currentNum = parseInt(bill.billNumber.replace(/[^0-9]/g, '')) || settings.nextInvoiceNumber;
    if (currentNum >= settings.nextInvoiceNumber) {
      settings.nextInvoiceNumber = currentNum + 1;
      await this.saveSettings(settings);
    }

    return bill;
  }

  async updateBill(
    billId: string,
    updatedBill: Bill,
    editReason: string,
    cashierName: string
  ): Promise<Bill> {
    const bills = await this.getBills();
    const original = bills.find((b) => b.id === billId);
    if (!original) throw new Error('Original bill not found');

    const auditEntry: BillAuditRecord = {
      editedAt: new Date().toISOString(),
      editedBy: cashierName,
      reason: editReason,
      previousGrandTotal: original.grandTotal,
      previousItemsSummary: original.items.map((i) => `${i.name} (${i.displayQuantity}${i.displayUnit})`).join(', '),
    };

    const finalBill: Bill = {
      ...updatedBill,
      status: 'edited',
      editHistory: [...(original.editHistory || []), auditEntry],
    };

    // Reconcile stock: reverse old bill's items then deduct new bill's items
    const products = await this.getProducts();
    for (const oldItem of original.items) {
      const prod = products.find((p) => p.id === oldItem.productId);
      if (prod) {
        const prevStock = prod.stockQty;
        prod.stockQty = Number((prevStock + oldItem.quantity).toFixed(3));
        await this.saveProduct(prod);
      }
    }
    for (const newItem of finalBill.items) {
      const prod = products.find((p) => p.id === newItem.productId);
      if (prod) {
        const prevStock = prod.stockQty;
        prod.stockQty = Number((prevStock - newItem.quantity).toFixed(3));
        await this.saveProduct(prod);
      }
    }

    // Save final bill
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction('bills', 'readwrite');
        const store = tx.objectStore('bills');
        const req = store.put(finalBill);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    const idx = bills.findIndex((b) => b.id === billId);
    if (idx >= 0) bills[idx] = finalBill;
    this.setLocalFallback('pcs_bills', bills);

    return finalBill;
  }

  async cancelOrRefundBill(
    billId: string,
    action: 'cancelled' | 'refunded',
    reason: string,
    cashierName: string
  ): Promise<Bill> {
    const bills = await this.getBills();
    const bill = bills.find((b) => b.id === billId);
    if (!bill) throw new Error('Bill not found');

    bill.status = action;
    bill.cancellationDetails = {
      cancelledAt: new Date().toISOString(),
      cancelledBy: cashierName,
      reason,
    };

    // Return stock back to inventory
    const products = await this.getProducts();
    for (const item of bill.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        const prevStock = prod.stockQty;
        const newStock = Number((prevStock + item.quantity).toFixed(3));
        prod.stockQty = newStock;
        prod.updatedAt = new Date().toISOString();
        await this.saveProduct(prod);

        await this.addStockMovement({
          id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          productId: prod.id,
          productName: prod.name,
          type: 'cancellation_return',
          quantityDelta: item.quantity,
          previousStock: prevStock,
          newStock,
          unit: prod.unit,
          billNumber: bill.billNumber,
          reason: `Stock returned from ${action} Bill #${bill.billNumber}: ${reason}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Save updated bill state
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction('bills', 'readwrite');
        const store = tx.objectStore('bills');
        const req = store.put(bill);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    const idx = bills.findIndex((b) => b.id === billId);
    if (idx >= 0) bills[idx] = bill;
    this.setLocalFallback('pcs_bills', bills);

    return bill;
  }

  // --- STOCK MOVEMENTS ---

  async getStockMovements(): Promise<StockMovement[]> {
    await this.init();
    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db!.transaction('stockMovements', 'readonly');
        const store = tx.objectStore('stockMovements');
        const req = store.getAll();
        req.onsuccess = () => {
          const list: StockMovement[] = req.result || [];
          resolve(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        };
        req.onerror = () => resolve(this.getLocalFallback<StockMovement[]>('pcs_stock_movements', []));
      });
    }
    const local = this.getLocalFallback<StockMovement[]>('pcs_stock_movements', []);
    return local.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async addStockMovement(movement: StockMovement): Promise<void> {
    await this.init();
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction('stockMovements', 'readwrite');
        const store = tx.objectStore('stockMovements');
        const req = store.put(movement);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    const current = await this.getStockMovements();
    current.unshift(movement);
    this.setLocalFallback('pcs_stock_movements', current.slice(0, 500)); // retain last 500
  }

  // --- SETTINGS ---

  async getSettings(): Promise<ShopSettings> {
    await this.init();
    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db!.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.get('main_settings');
        req.onsuccess = () => {
          resolve(req.result ? { ...DEFAULT_SETTINGS, ...req.result } : this.getLocalFallback<ShopSettings>('pcs_settings', DEFAULT_SETTINGS));
        };
        req.onerror = () => resolve(this.getLocalFallback<ShopSettings>('pcs_settings', DEFAULT_SETTINGS));
      });
    }
    return this.getLocalFallback<ShopSettings>('pcs_settings', DEFAULT_SETTINGS);
  }

  async saveSettings(settings: ShopSettings): Promise<void> {
    await this.init();
    const payload = { ...settings, id: 'main_settings' };
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        const req = store.put(payload);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    this.setLocalFallback('pcs_settings', settings);
  }

  // --- BACKUP & RESTORE ---

  async exportAllData(): Promise<string> {
    const products = await this.getProducts();
    const bills = await this.getBills();
    const stockMovements = await this.getStockMovements();
    const settings = await this.getSettings();

    const data = {
      exportVersion: 1,
      appName: 'PRIME CENTURY SWEET POS',
      timestamp: new Date().toISOString(),
      settings,
      products,
      bills,
      stockMovements,
    };
    return JSON.stringify(data, null, 2);
  }

  async importAllData(jsonString: string): Promise<{ success: boolean; message: string }> {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.products || !parsed.settings) {
        return { success: false, message: 'Invalid backup file structure' };
      }

      await this.init();

      if (this.db) {
        const clearStores = ['products', 'bills', 'stockMovements', 'settings'];
        for (const storeName of clearStores) {
          await new Promise<void>((resolve) => {
            const tx = this.db!.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });
        }
      }

      // Re-populate
      if (Array.isArray(parsed.products)) {
        for (const p of parsed.products) {
          await this.saveProduct(p);
        }
      }
      if (Array.isArray(parsed.bills)) {
        for (const b of parsed.bills) {
          await this.saveBillRecordOnly(b);
        }
      }
      if (Array.isArray(parsed.stockMovements)) {
        for (const sm of parsed.stockMovements) {
          await this.addStockMovement(sm);
        }
      }
      if (parsed.settings) {
        await this.saveSettings(parsed.settings);
      }

      return { success: true, message: 'Data imported successfully!' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to import backup' };
    }
  }

  private async saveBillRecordOnly(bill: Bill): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve) => {
        const tx = this.db!.transaction('bills', 'readwrite');
        tx.objectStore('bills').put(bill);
        tx.oncomplete = () => resolve();
      });
    }
    const current = this.getLocalFallback<Bill[]>('pcs_bills', []);
    current.push(bill);
    this.setLocalFallback('pcs_bills', current);
  }

  async resetToSample(): Promise<void> {
    await this.init();
    if (this.db) {
      const clearStores = ['products', 'bills', 'stockMovements', 'settings'];
      for (const s of clearStores) {
        await new Promise<void>((resolve) => {
          const tx = this.db!.transaction(s, 'readwrite');
          tx.objectStore(s).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    }
    localStorage.removeItem('pcs_products');
    localStorage.removeItem('pcs_bills');
    localStorage.removeItem('pcs_stock_movements');
    localStorage.removeItem('pcs_settings');
    await this.seedInitialProducts();
    await this.saveSettings(DEFAULT_SETTINGS);
  }

  // --- LOCALSTORAGE UTILITIES ---

  private getLocalFallback<T>(key: string, defaultValue: T): T {
    try {
      const val = localStorage.getItem(key);
      if (!val) return defaultValue;
      return JSON.parse(val);
    } catch {
      return defaultValue;
    }
  }

  private setLocalFallback(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  }
}

export const dbStorage = new StorageEngine();
