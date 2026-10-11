import { Bill, Product, ShopSettings, StockMovement, StaffUser, AuditLogEntry, SyncStatus } from '../types';
import { dbStorage } from './storage';

type SyncListener = (event: {
  type: string;
  data: any;
}) => void;

type StatusListener = (status: SyncStatus, errorMsg?: string) => void;

class CloudSyncService {
  private eventSource: EventSource | null = null;
  private syncStatus: SyncStatus = 'syncing';
  private statusListeners = new Set<StatusListener>();
  private syncListeners = new Set<SyncListener>();
  private reconnectTimeout: any = null;
  private currentStaff: StaffUser | null = null;
  private authToken = '';
  private lastErrorMessage = '';

  constructor() {
    // Restore current user and session token from localStorage
    try {
      const stored = localStorage.getItem('prime_century_current_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.name && parsed.name.includes('Rajesh Agarwal')) {
          parsed.name = 'Shop Owner';
          localStorage.setItem('prime_century_current_user', JSON.stringify(parsed));
        }
        this.currentStaff = parsed;
      }
      const token = localStorage.getItem('prime_century_auth_token');
      if (token) {
        this.authToken = token;
      }
    } catch {
      // ignore
    }
  }

  public getCurrentUser(): StaffUser | null {
    return this.currentStaff;
  }

  public setCurrentUser(user: StaffUser | null): void {
    this.currentStaff = user;
    if (user) {
      localStorage.setItem('prime_century_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('prime_century_current_user');
      this.authToken = '';
      localStorage.removeItem('prime_century_auth_token');
    }
  }

  public getAuthToken(): string {
    return this.authToken;
  }

  public setAuthToken(token: string): void {
    this.authToken = token;
    if (token) {
      localStorage.setItem('prime_century_auth_token', token);
    } else {
      localStorage.removeItem('prime_century_auth_token');
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    if (this.currentStaff?.id) {
      headers['X-User-Id'] = this.currentStaff.id;
    }
    return headers;
  }

  public getStatus(): SyncStatus {
    return this.syncStatus;
  }

  public getErrorMessage(): string {
    return this.lastErrorMessage;
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.syncStatus, this.lastErrorMessage);
    return () => this.statusListeners.delete(listener);
  }

  public onSyncEvent(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  private setStatus(status: SyncStatus, errorMsg = ''): void {
    this.syncStatus = status;
    this.lastErrorMessage = errorMsg;
    for (const listener of this.statusListeners) {
      listener(status, errorMsg);
    }
  }

  private notifySyncListeners(type: string, data: any): void {
    for (const listener of this.syncListeners) {
      listener({ type, data });
    }
  }

  /**
   * Initializes real-time SSE listener
   */
  public connect(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      this.setStatus('syncing');
      this.eventSource = new EventSource('/api/sync/events');

      this.eventSource.onopen = () => {
        this.setStatus('synced');
      };

      this.eventSource.addEventListener('CONNECTED', () => {
        this.setStatus('synced');
      });

      this.eventSource.addEventListener('PING', () => {
        if (this.syncStatus !== 'synced') {
          this.setStatus('synced');
        }
      });

      this.eventSource.addEventListener('BILL_CREATED', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifySyncListeners('BILL_CREATED', data);
        } catch (err) {
          console.error('Error handling BILL_CREATED event:', err);
        }
      });

      this.eventSource.addEventListener('BILL_UPDATED', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifySyncListeners('BILL_UPDATED', data);
        } catch (err) {
          console.error('Error handling BILL_UPDATED event:', err);
        }
      });

      this.eventSource.addEventListener('BILL_DELETED', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifySyncListeners('BILL_DELETED', data);
        } catch (err) {
          console.error('Error handling BILL_DELETED event:', err);
        }
      });

      this.eventSource.addEventListener('BILL_CANCELLED', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifySyncListeners('BILL_CANCELLED', data);
        } catch (err) {
          console.error('Error handling BILL_CANCELLED event:', err);
        }
      });

      this.eventSource.addEventListener('PRODUCT_UPDATED', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifySyncListeners('PRODUCT_UPDATED', data);
        } catch (err) {
          console.error('Error handling PRODUCT_UPDATED event:', err);
        }
      });

      this.eventSource.addEventListener('STOCK_ADJUSTED', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifySyncListeners('STOCK_ADJUSTED', data);
        } catch (err) {
          console.error('Error handling STOCK_ADJUSTED event:', err);
        }
      });

      this.eventSource.addEventListener('SETTINGS_UPDATED', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifySyncListeners('SETTINGS_UPDATED', data);
        } catch (err) {
          console.error('Error handling SETTINGS_UPDATED event:', err);
        }
      });

      this.eventSource.addEventListener('USER_UPDATED', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifySyncListeners('USER_UPDATED', data);
        } catch (err) {
          console.error('Error handling USER_UPDATED event:', err);
        }
      });

      this.eventSource.addEventListener('FULL_RELOAD', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifySyncListeners('FULL_RELOAD', data);
        } catch (err) {
          console.error('Error handling FULL_RELOAD event:', err);
        }
      });

      this.eventSource.onerror = () => {
        this.setStatus('offline', 'Lost connection to cloud database. Reconnecting...');
        this.eventSource?.close();
        this.eventSource = null;

        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, 3000);
      };
    } catch (err: any) {
      this.setStatus('error', err?.message || 'Could not connect to cloud sync');
    }
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    clearTimeout(this.reconnectTimeout);
  }

  // -------------------------------------------------------------
  // API CALLS
  // -------------------------------------------------------------

  /**
   * Fetch full snapshot from server
   */
  public async fetchFullSnapshot(): Promise<{
    products: Product[];
    bills: Bill[];
    stockMovements: StockMovement[];
    settings: ShopSettings;
    users: StaffUser[];
    auditLogs: AuditLogEntry[];
  }> {
    try {
      this.setStatus('syncing');
      const res = await fetch('/api/sync/full', {
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch cloud database: HTTP ${res.status}`);
      }
      const data = await res.json();
      this.setStatus('synced');

      // Update local IndexedDB cache asynchronously
      try {
        await dbStorage.init();
        if (data.products?.length) {
          for (const p of data.products) {
            await dbStorage.saveProduct(p);
          }
        }
        if (data.settings) {
          await dbStorage.saveSettings(data.settings);
        }
      } catch (cacheErr) {
        console.warn('Could not cache cloud data into IndexedDB:', cacheErr);
      }

      return data;
    } catch (err: any) {
      console.warn('Cloud fetch failed, attempting local IndexedDB fallback:', err);
      this.setStatus('offline', err.message);

      await dbStorage.init();
      const [prods, bList, movements, sett] = await Promise.all([
        dbStorage.getProducts(),
        dbStorage.getBills(),
        dbStorage.getStockMovements(),
        dbStorage.getSettings(),
      ]);
      return {
        products: prods,
        bills: bList,
        stockMovements: movements,
        settings: sett,
        users: [],
        auditLogs: [],
      };
    }
  }

  /**
   * Save a bill to the cloud server atomically with idempotency protection.
   */
  public async saveBill(bill: Bill): Promise<{ bill: Bill; products?: Product[] }> {
    this.setStatus('syncing');

    const idempotencyKey =
      bill.idempotencyKey || `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const user = this.getCurrentUser();
    const payload: Bill = {
      ...bill,
      idempotencyKey,
      createdByUserId: user?.id,
      cashierName: bill.cashierName || user?.name || 'Counter Cashier',
    };

    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errMsg = `Server returned error (${res.status})`;
      try {
        const errJson = await res.json();
        errMsg = errJson.error || errMsg;
      } catch {
        // ignore
      }
      this.setStatus('error', errMsg);
      throw new Error(errMsg);
    }

    const data = await res.json();
    this.setStatus('synced');
    return { bill: data.bill, products: data.products };
  }

  /**
   * Edit an existing bill on the server (Owner only)
   */
  public async updateBill(
    billId: string,
    updatedBill: Bill,
    reason: string
  ): Promise<{ bill: Bill; products?: Product[] }> {
    this.setStatus('syncing');

    const res = await fetch(`/api/bills/${encodeURIComponent(billId)}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({
        updatedBill,
        reason,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update bill' }));
      this.setStatus('error', err.error || 'Failed to update bill');
      throw new Error(err.error || 'Failed to update bill');
    }

    const data = await res.json();
    this.setStatus('synced');
    return { bill: data.bill, products: data.products };
  }

  /**
   * Delete an existing bill (Owner only)
   */
  public async deleteBill(
    billId: string,
    reason: string,
    restock = true
  ): Promise<{ success: boolean; products?: Product[] }> {
    this.setStatus('syncing');

    const res = await fetch(`/api/bills/${encodeURIComponent(billId)}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({
        reason,
        restock,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete bill' }));
      this.setStatus('error', err.error || 'Failed to delete bill');
      throw new Error(err.error || 'Failed to delete bill');
    }

    const data = await res.json();
    this.setStatus('synced');
    return { success: true, products: data.products };
  }

  /**
   * Cancel or refund a bill on the server (Owner only)
   */
  public async cancelOrRefundBill(
    billId: string,
    action: 'cancelled' | 'refunded',
    reason: string
  ): Promise<{ bill: Bill; products?: Product[] }> {
    this.setStatus('syncing');

    const res = await fetch(`/api/bills/${encodeURIComponent(billId)}/cancel`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        action,
        reason,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to cancel bill' }));
      this.setStatus('error', err.error || 'Failed to cancel bill');
      throw new Error(err.error || 'Failed to cancel bill');
    }

    const data = await res.json();
    this.setStatus('synced');
    return { bill: data.bill, products: data.products };
  }

  /**
   * Save / Add Product
   */
  public async saveProduct(product: Product): Promise<Product> {
    this.setStatus('syncing');
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(product),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save product' }));
      throw new Error(err.error || 'Failed to save product');
    }

    const data = await res.json();
    this.setStatus('synced');
    return data.product;
  }

  /**
   * Delete / Archive Product
   */
  public async deleteProduct(productId: string): Promise<void> {
    this.setStatus('syncing');
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete product' }));
      throw new Error(err.error || 'Failed to delete product');
    }
    this.setStatus('synced');
  }

  /**
   * Manual Stock Adjustment
   */
  public async adjustStock(
    productId: string,
    quantityDelta: number,
    type: string,
    reason: string
  ): Promise<void> {
    this.setStatus('syncing');

    const res = await fetch('/api/inventory/adjust', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        productId,
        quantityDelta,
        type,
        reason,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to adjust stock' }));
      throw new Error(err.error || 'Failed to adjust stock');
    }
    this.setStatus('synced');
  }

  /**
   * Save Shop Settings (Owner only)
   */
  public async saveSettings(settings: ShopSettings): Promise<ShopSettings> {
    this.setStatus('syncing');

    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(settings),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save settings' }));
      throw new Error(err.error || 'Failed to save settings');
    }

    const data = await res.json();
    this.setStatus('synced');
    return data.settings;
  }

  /**
   * Authentication: Login with PIN
   */
  public async loginWithPin(pin: string, userId?: string): Promise<StaffUser> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, userId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Invalid PIN' }));
      throw new Error(err.error || 'Invalid PIN');
    }

    const data = await res.json();
    this.setCurrentUser(data.user);
    if (data.token) {
      this.setAuthToken(data.token);
    }
    return data.user;
  }

  /**
   * Re-verify Owner PIN
   */
  public async verifyOwnerPin(ownerPin: string): Promise<boolean> {
    const res = await fetch('/api/auth/verify-owner-pin', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ownerPin }),
    });
    return res.ok;
  }

  /**
   * Reset any user's PIN (Owner only, requires Owner PIN verification)
   */
  public async resetUserPin(
    targetUserId: string,
    ownerPin: string,
    newPin: string
  ): Promise<void> {
    const res = await fetch('/api/auth/reset-pin', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ targetUserId, ownerPin, newPin }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to reset PIN' }));
      throw new Error(err.error || 'Failed to reset PIN');
    }
  }

  public async fetchStaffUsers(): Promise<StaffUser[]> {
    const res = await fetch('/api/auth/users', {
      headers: this.getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  }

  public async createStaffUser(user: Partial<StaffUser> & { pin: string }): Promise<StaffUser> {
    const res = await fetch('/api/auth/users', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(user),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create user' }));
      throw new Error(err.error || 'Failed to create user');
    }

    const data = await res.json();
    return data.user;
  }

  public async updateStaffUser(id: string, updates: Partial<StaffUser>): Promise<StaffUser> {
    const res = await fetch(`/api/auth/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update user' }));
      throw new Error(err.error || 'Failed to update user');
    }

    const data = await res.json();
    // If the updated user is the currently logged in user, update local state
    if (this.currentStaff && this.currentStaff.id === id) {
      this.setCurrentUser({ ...this.currentStaff, ...data.user });
    }
    return data.user;
  }

  public async fetchAuditLogs(): Promise<AuditLogEntry[]> {
    const res = await fetch('/api/audit-logs', {
      headers: this.getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  }
}

export const cloudSync = new CloudSyncService();
