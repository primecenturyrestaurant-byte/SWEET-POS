import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bill, Product, ShopSettings, StockMovement, StaffUser, AuditLogEntry, SyncStatus } from './types';
import { dbStorage, DEFAULT_SETTINGS } from './lib/storage';
import { cloudSync } from './lib/cloudSync';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { NewBill } from './components/NewBill';
import { Products } from './components/Products';
import { SalesHistory } from './components/SalesHistory';
import { Reports } from './components/Reports';
import { Inventory } from './components/Inventory';
import { Settings } from './components/Settings';
import { ReceiptPrint } from './components/ReceiptPrint';
import { UserAuthModal } from './components/UserAuthModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [shouldOpenAddProductModal, setShouldOpenAddProductModal] = useState<boolean>(false);

  // Cloud Synchronization state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [syncError, setSyncError] = useState<string>('');

  // Active Staff Member & User Switch Modal (Restored from authenticated session or loaded from cloud database)
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(() => {
    return cloudSync.getCurrentUser();
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Active Bill for Print Preview Modal
  const [activePrintBill, setActivePrintBill] = useState<{
    bill: Bill | null;
    autoPrint: boolean;
  }>({
    bill: null,
    autoPrint: false,
  });

  // Load all initial data from cloud database (with local IndexedDB fallback)
  const loadAllData = useCallback(async () => {
    try {
      const snapshot = await cloudSync.fetchFullSnapshot();
      if (snapshot.products) setProducts(snapshot.products);
      if (snapshot.bills) setBills(snapshot.bills);
      if (snapshot.stockMovements) setStockMovements(snapshot.stockMovements);
      if (snapshot.settings) setSettings(snapshot.settings);
      if (snapshot.users?.length) {
        setStaffUsers(snapshot.users);
        setCurrentUser((prev) => {
          if (!prev) {
            const owner = snapshot.users.find((u) => u.role === 'owner' && u.isActive) || snapshot.users[0];
            if (owner) cloudSync.setCurrentUser(owner);
            return owner || null;
          }
          const matched = snapshot.users.find((u) => u.id === prev.id);
          if (matched) {
            cloudSync.setCurrentUser(matched);
            return matched;
          }
          return prev;
        });
      }
      if (snapshot.auditLogs) setAuditLogs(snapshot.auditLogs);
    } catch (err: any) {
      console.error('Failed to load snapshot:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize Cloud Sync & Real-Time Listeners on boot
  useEffect(() => {
    loadAllData();
    cloudSync.connect();

    const unsubStatus = cloudSync.onStatusChange((status, errorMsg) => {
      setSyncStatus(status);
      if (errorMsg) setSyncError(errorMsg);
      else setSyncError('');
    });

    const unsubEvents = cloudSync.onSyncEvent((event) => {
      const { type, data } = event;

      if (type === 'BILL_CREATED') {
        // Automatically add newly created bill to terminal state
        if (data.bill) {
          setBills((prev) => {
            if (prev.some((b) => b.id === data.bill.id)) return prev;
            return [data.bill, ...prev];
          });
        }
        if (data.products) setProducts(data.products);
        if (data.stockMovements) {
          setStockMovements((prev) => [...data.stockMovements, ...prev]);
        }
        if (data.nextInvoiceNumber) {
          setSettings((prev) => ({ ...prev, nextInvoiceNumber: data.nextInvoiceNumber }));
        }
      } else if (type === 'BILL_UPDATED') {
        if (data.bill) {
          setBills((prev) => prev.map((b) => (b.id === data.bill.id ? data.bill : b)));
        }
        if (data.products) setProducts(data.products);
      } else if (type === 'BILL_CANCELLED') {
        if (data.bill) {
          setBills((prev) => prev.map((b) => (b.id === data.bill.id ? data.bill : b)));
        }
        if (data.products) setProducts(data.products);
        if (data.stockMovements) {
          setStockMovements((prev) => [...data.stockMovements, ...prev]);
        }
      } else if (type === 'PRODUCT_UPDATED') {
        if (data.products) setProducts(data.products);
        else if (data.product) {
          setProducts((prev) => {
            const idx = prev.findIndex((p) => p.id === data.product.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = data.product;
              return copy;
            }
            return [...prev, data.product];
          });
        }
      } else if (type === 'STOCK_ADJUSTED') {
        if (data.products) setProducts(data.products);
        if (data.movement) {
          setStockMovements((prev) => [data.movement, ...prev]);
        }
      } else if (type === 'SETTINGS_UPDATED') {
        if (data.settings) setSettings(data.settings);
      } else if (type === 'USER_UPDATED') {
        if (data.users) {
          setStaffUsers(data.users);
          setCurrentUser((prev) => {
            if (!prev) return null;
            const matched = data.users.find((u: StaffUser) => u.id === prev.id);
            if (matched) {
              cloudSync.setCurrentUser(matched);
              return matched;
            }
            return prev;
          });
        }
      } else if (type === 'FULL_RELOAD') {
        loadAllData();
      }
    });

    return () => {
      unsubStatus();
      unsubEvents();
      cloudSync.disconnect();
    };
  }, [loadAllData]);

  // Global Keyboard Shortcuts for POS Cashiers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('dashboard');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('new-bill');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('products');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveTab('sales-history');
      } else if (e.key === 'F5') {
        e.preventDefault();
        setActiveTab('reports');
      } else if (e.key === 'F6') {
        e.preventDefault();
        setActiveTab('inventory');
      } else if (e.key === 'F7') {
        e.preventDefault();
        setActiveTab('settings');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save new bill to cloud server (with atomic stock check and cloud confirmation)
  const handleSaveBill = async (bill: Bill, autoPrint: boolean) => {
    const res = await cloudSync.saveBill(bill);
    const savedBill = res.bill;

    // Update local state immediately
    setBills((prev) => [savedBill, ...prev.filter((b) => b.id !== savedBill.id)]);
    if (res.products) {
      setProducts(res.products);
    }

    if (autoPrint) {
      setActivePrintBill({ bill: savedBill, autoPrint: true });
    } else {
      setActivePrintBill({ bill: savedBill, autoPrint: false });
    }
  };

  // Product CRUD
  const handleSaveProduct = async (product: Product) => {
    const saved = await cloudSync.saveProduct(product);
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [...prev, saved];
    });
  };

  const handleDeleteProduct = async (productId: string) => {
    await cloudSync.deleteProduct(productId);
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, isActive: false } : p)));
  };

  // Bill Editing with Audit Trail
  const handleUpdateBill = async (
    billId: string,
    updatedBill: Bill,
    reason: string
  ) => {
    const res = await cloudSync.updateBill(billId, updatedBill, reason);
    setBills((prev) => prev.map((b) => (b.id === billId ? res.bill : b)));
    if (res.products) setProducts(res.products);
  };

  // Bill Cancel / Refund
  const handleCancelOrRefundBill = async (
    billId: string,
    action: 'cancelled' | 'refunded',
    reason: string
  ) => {
    const res = await cloudSync.cancelOrRefundBill(billId, action, reason);
    setBills((prev) => prev.map((b) => (b.id === billId ? res.bill : b)));
    if (res.products) setProducts(res.products);
  };

  // Stock adjustments
  const handleAddStockMovement = async (movement: StockMovement) => {
    await cloudSync.adjustStock(
      movement.productId,
      movement.quantityDelta,
      movement.type,
      movement.reason || ''
    );
  };

  // Settings
  const handleSaveSettings = async (newSettings: ShopSettings) => {
    const saved = await cloudSync.saveSettings(newSettings);
    setSettings(saved);
    await dbStorage.saveSettings(saved);
    if (saved.ownerName && currentUser?.role === 'owner') {
      const updatedUser: StaffUser = { ...currentUser, name: saved.ownerName };
      setCurrentUser(updatedUser);
      cloudSync.setCurrentUser(updatedUser);
    }
  };

  // Backup & Restore
  const handleExportData = async () => {
    window.location.href = '/api/backup/export';
  };

  const handleImportData = async (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error('Cloud import failed');
      await loadAllData();
      return { success: true, message: 'Database imported successfully.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Import failed.' };
    }
  };

  const handleResetDatabase = async () => {
    await fetch('/api/backup/reset', { method: 'POST' });
    await loadAllData();
  };

  const lowStockCount = products.filter(
    (p) => p.isActive && p.stockQty <= p.minStockLevel
  ).length;

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#FAF7F2] text-neutral-800">
        <div className="w-12 h-12 rounded-xl bg-[#781324] text-white flex items-center justify-center font-serif font-black text-2xl shadow-lg mb-4 animate-pulse border border-[#d4af37]">
          P
        </div>
        <h2 className="font-serif font-bold text-lg text-[#781324]">
          PRIME CENTURY SWEET
        </h2>
        <p className="text-xs text-neutral-500 mt-1">Connecting to Real-Time Cloud Engine...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col selection:bg-[#781324] selection:text-white app-root-layout">
      {/* Top Application Header with Live Cloud Sync & User Profile */}
      <Header
        settings={settings}
        bills={bills}
        onOpenNewBill={() => setActiveTab('new-bill')}
        activeTab={activeTab}
        syncStatus={syncStatus}
        syncErrorMessage={syncError}
        currentUser={currentUser}
        onOpenUserSwitch={() => setIsAuthModalOpen(true)}
        onRetrySync={() => cloudSync.connect()}
      />

      {/* Main Workspace with Sidebar */}
      <div className="flex-1 flex overflow-hidden app-workspace">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          lowStockCount={lowStockCount}
          settings={settings}
        />

        {/* Dynamic Center Viewport */}
        <main className="flex-1 overflow-y-auto relative">
          {activeTab === 'dashboard' && (
            <Dashboard
              bills={bills}
              products={products}
              settings={settings}
              onOpenNewBill={() => setActiveTab('new-bill')}
              onViewBill={(bill) => setActivePrintBill({ bill, autoPrint: false })}
              onPrintBill={(bill) => setActivePrintBill({ bill, autoPrint: true })}
              onNavigateToTab={setActiveTab}
            />
          )}

          {activeTab === 'new-bill' && (
            <NewBill
              products={products}
              settings={settings}
              onSaveBill={handleSaveBill}
              onRefreshProducts={loadAllData}
              currentUser={currentUser}
              onNavigateToProducts={() => setActiveTab('products')}
              onOpenAddSweet={() => {
                setShouldOpenAddProductModal(true);
                setActiveTab('products');
              }}
              onPrintPreview={(draftBill) => setActivePrintBill({ bill: draftBill, autoPrint: false })}
            />
          )}

          {activeTab === 'products' && (
            <Products
              products={products}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              autoOpenAddModal={shouldOpenAddProductModal}
              onModalOpened={() => setShouldOpenAddProductModal(false)}
            />
          )}

          {activeTab === 'sales-history' && (
            <SalesHistory
              bills={bills}
              products={products}
              settings={settings}
              currentUser={currentUser}
              onViewBill={(bill) => setActivePrintBill({ bill, autoPrint: false })}
              onPrintBill={(bill) => setActivePrintBill({ bill, autoPrint: true })}
              onUpdateBill={handleUpdateBill}
              onCancelOrRefundBill={handleCancelOrRefundBill}
            />
          )}

          {activeTab === 'reports' && (
            <Reports
              bills={bills}
              products={products}
              settings={settings}
            />
          )}

          {activeTab === 'inventory' && (
            <Inventory
              products={products}
              stockMovements={stockMovements}
              settings={settings}
              onSaveProduct={handleSaveProduct}
              onAddStockMovement={handleAddStockMovement}
              onRefreshData={loadAllData}
            />
          )}

          {activeTab === 'settings' && (
            <Settings
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onExportData={handleExportData}
              onImportData={handleImportData}
              onResetDatabase={handleResetDatabase}
              staffUsers={staffUsers}
              onRefreshStaff={async () => {
                const users = await cloudSync.fetchStaffUsers();
                setStaffUsers(users);
              }}
              auditLogs={auditLogs}
              currentUser={currentUser}
              onOpenOwnerAuth={() => setIsAuthModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Staff User Switch & PIN Authentication Modal */}
      <UserAuthModal
        isOpen={isAuthModalOpen}
        currentUser={currentUser}
        staffUsers={staffUsers}
        onUserChange={(user) => {
          setCurrentUser(user);
          cloudSync.setCurrentUser(user);
        }}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Thermal & A4 Receipt Print Modal / Print Engine */}
      {activePrintBill.bill && (
        <ReceiptPrint
          bill={activePrintBill.bill}
          settings={settings}
          onClose={() => setActivePrintBill({ bill: null, autoPrint: false })}
          autoPrint={activePrintBill.autoPrint}
        />
      )}
    </div>
  );
}
