import React, { useState, useEffect } from 'react';
import { ShopSettings, PaymentMethod, StaffUser, AuditLogEntry, UserRole } from '../types';
import { exportAuditLogToExcel } from '../lib/excelExport';
import { cloudSync } from '../lib/cloudSync';
import { ResetPinModal } from './ResetPinModal';
import {
  Settings as SettingsIcon,
  Store,
  Printer,
  Receipt,
  Percent,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  FileCode,
  HardDrive,
  Cloud,
  Users,
  ShieldAlert,
  Crown,
  KeyRound,
  Plus,
  Edit2,
  Lock,
  FileSpreadsheet,
  Radio,
  Wifi,
} from 'lucide-react';

interface SettingsProps {
  settings: ShopSettings;
  onSaveSettings: (settings: ShopSettings) => Promise<void>;
  onExportData: () => Promise<void>;
  onImportData: (jsonStr: string) => Promise<{ success: boolean; message: string }>;
  onResetDatabase: () => Promise<void>;
  staffUsers?: StaffUser[];
  onRefreshStaff?: () => Promise<void>;
  auditLogs?: AuditLogEntry[];
  currentUser?: StaffUser | null;
  onOpenOwnerAuth?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onSaveSettings,
  onExportData,
  onImportData,
  onResetDatabase,
  staffUsers = [],
  onRefreshStaff,
  auditLogs = [],
  currentUser,
  onOpenOwnerAuth,
}) => {
  const [formData, setFormData] = useState<ShopSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState<
    'store' | 'print' | 'tax' | 'staff' | 'audit' | 'backup' | 'guide'
  >('store');

  // Synchronize form when external settings update
  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  // New staff user modal state
  const [showAddStaffModal, setShowAddStaffModal] = useState<boolean>(false);
  const [staffForm, setStaffForm] = useState<{
    name: string;
    username: string;
    role: UserRole;
    pin: string;
    phone: string;
  }>({
    name: '',
    username: '',
    role: 'cashier',
    pin: '',
    phone: '',
  });
  const [staffError, setStaffError] = useState<string>('');
  const [staffSuccess, setStaffSuccess] = useState<string>('');

  // Edit user profile state (Owner can edit their own display name or staff display names)
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('cashier');

  // Reset PIN modal state (Strictly requires Owner PIN verification)
  const [resetPinTargetUser, setResetPinTargetUser] = useState<StaffUser | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ownerName || !formData.ownerName.trim()) {
      setSaveError('Owner Name is required and cannot be empty.');
      setSaveSuccess(false);
      return;
    }

    setSaveError('');
    setIsSaving(true);
    try {
      await onSaveSettings(formData);
      setSaveSuccess(true);
      if (onRefreshStaff) await onRefreshStaff();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save shop settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const res = await onImportData(content);
      setImportStatus(res.message);
      setTimeout(() => setImportStatus(''), 4000);
    };
    reader.readAsText(file);
  };

  const handleReset = async () => {
    if (
      window.confirm(
        'WARNING: This will reset all products, bills, stock records, and restore initial sample data.\n\nAre you sure you wish to proceed?'
      )
    ) {
      await onResetDatabase();
      alert('Database restored to clean sample sweet shop data.');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 tracking-tight">
            System & Store Settings
          </h2>
          <p className="text-xs text-neutral-500">
            Configure shop profile, tax calculation mode, thermal printer widths, and data backup
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-neutral-200/80 text-xs shadow-2xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('store')}
          className={`px-3.5 py-2 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'store'
              ? 'bg-[#781324] text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Store Profile & Invoice
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('print')}
          className={`px-3.5 py-2 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'print'
              ? 'bg-[#781324] text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Thermal Printer & Receipts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tax')}
          className={`px-3.5 py-2 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'tax'
              ? 'bg-[#781324] text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          GST & Tax Configuration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`px-3.5 py-2 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'staff'
              ? 'bg-[#781324] text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Staff & Roles (RBAC)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`px-3.5 py-2 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-[#781324] text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Cloud Sync & Audit Trail
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`px-3.5 py-2 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'backup'
              ? 'bg-[#781324] text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Data Backup & Recovery
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('guide')}
          className={`px-3.5 py-2 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'guide'
              ? 'bg-[#781324] text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Hardware & Cloud Setup Guide
        </button>
      </div>

      {/* Main Settings Form Container */}
      <form onSubmit={handleSave} className="space-y-5">
        {/* Save Status & Feedback Notifications */}
        {saveSuccess && (
          <div className="p-3.5 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2.5 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Shop settings and owner name updated permanently! Changes applied across all screens.</span>
          </div>
        )}
        {saveError && (
          <div className="p-3.5 bg-rose-50 text-rose-900 border border-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2.5 shadow-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* TAB 1: STORE PROFILE */}
        {activeTab === 'store' && (
          <div className="bg-white rounded-xl border border-neutral-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                <Store className="w-4 h-4 text-[#781324]" />
                <span>Shop Identity & Legal Registration</span>
              </h3>
              <span className="text-[11px] text-neutral-400 font-medium">Business Profile</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Shop Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.shopName}
                  onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-serif font-bold text-neutral-900 focus:outline-none focus:border-[#781324]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Owner / Proprietor Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.ownerName || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, ownerName: e.target.value });
                    if (saveError) setSaveError('');
                  }}
                  placeholder="e.g. Shop Owner"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 focus:outline-none focus:border-[#781324]"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  Legal owner name displayed on invoices, receipts, dashboard, and reports.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Tagline / Brand Motto
                </label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:border-[#781324]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Complete Shop Address (Appears on receipts) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:border-[#781324]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Contact Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:border-[#781324]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:border-[#781324]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  GSTIN (Goods and Services Tax Identification Number)
                </label>
                <input
                  type="text"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  placeholder="27AABCU9603R1ZM"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-[#781324]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  FSSAI License Number (Mandatory for Indian Sweet Shops)
                </label>
                <input
                  type="text"
                  value={formData.fssai}
                  onChange={(e) => setFormData({ ...formData, fssai: e.target.value })}
                  placeholder="11522036000492"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#781324]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Shop State & GST State Code *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-xs"
                    placeholder="Maharashtra"
                  />
                  <input
                    type="text"
                    value={formData.stateCode}
                    onChange={(e) => setFormData({ ...formData, stateCode: e.target.value })}
                    className="w-16 px-2 py-2 border border-neutral-300 rounded-lg text-xs font-mono text-center"
                    placeholder="27"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Invoice Prefix & Next Sequential Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.invoicePrefix}
                    onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                    className="w-28 px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono"
                    placeholder="PCS-2026-"
                  />
                  <input
                    type="number"
                    min="1"
                    value={formData.nextInvoiceNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nextInvoiceNumber: parseInt(e.target.value) || 1001,
                      })
                    }
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Store Profile Save Changes Action Bar */}
            <div className="pt-4 border-t border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[11px] text-neutral-500">
                Clicking <strong>Save Changes</strong> permanently saves the owner name, shop profile, and legal details to the database.
              </p>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#781324] hover:bg-[#600f1c] disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Saving Changes...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: THERMAL PRINTER SETTINGS */}
        {activeTab === 'print' && (
          <div className="bg-white rounded-xl border border-neutral-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
              <Printer className="w-4 h-4 text-[#781324]" />
              <span>Thermal Receipt & Printing Engine</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Default Receipt Format *
                </label>
                <select
                  value={formData.printFormat}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      printFormat: e.target.value as '58mm' | '80mm' | 'a4',
                    })
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white font-medium"
                >
                  <option value="80mm">80mm Thermal Receipt (Standard POS)</option>
                  <option value="58mm">58mm Thermal Receipt (Compact Mini POS)</option>
                  <option value="a4">Standard A4 Tax Invoice (Desktop Printer)</option>
                </select>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Receipt preview also allows switching formats on the fly before printing.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Default Payment Mode
                </label>
                <select
                  value={formData.defaultPaymentMethod}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultPaymentMethod: e.target.value as PaymentMethod,
                    })
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white font-medium uppercase"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / QR Code</option>
                  <option value="card">Card POS</option>
                  <option value="split">Split Payment</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Receipt Footer Thank-You Message
                </label>
                <input
                  type="text"
                  value={formData.footerMessage}
                  onChange={(e) => setFormData({ ...formData, footerMessage: e.target.value })}
                  placeholder="Thank you for visiting Prime Century Sweet! Taste the royal tradition."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GST & TAX CONFIGURATION */}
        {activeTab === 'tax' && (
          <div className="bg-white rounded-xl border border-neutral-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
              <Percent className="w-4 h-4 text-[#781324]" />
              <span>Goods & Services Tax (GST) Calculations</span>
            </h3>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
              <strong>Indian GST Regulatory Note:</strong>
              <p>
                In Indian sweet shops, traditional mithai and halwa generally fall under 5% GST (2.5% CGST + 2.5% SGST). Packaged snacks & namkeen often attract 12% GST, while chocolates & confectionery attract 18%. Rates can be customized per product in the Products tab. Always consult your qualified chartered accountant or tax professional.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Product Selling Price Tax Mode *
                </label>
                <select
                  value={formData.priceIncludesTax ? 'inclusive' : 'exclusive'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priceIncludesTax: e.target.value === 'inclusive',
                    })
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white font-medium"
                >
                  <option value="exclusive">
                    Tax-Exclusive (Default) — Sweet price is base price; GST is added separately on top
                  </option>
                  <option value="inclusive">
                    Tax-Inclusive — Sweet price already includes GST
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Inventory Stock Controls
                </label>
                <div className="pt-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowNegativeStock}
                      onChange={(e) =>
                        setFormData({ ...formData, allowNegativeStock: e.target.checked })
                      }
                      className="rounded text-[#781324]"
                    />
                    <span>Allow sales even when stock is zero/negative (Override safety lock)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: STAFF & ROLE-BASED ACCESS CONTROL */}
        {activeTab === 'staff' && (
          <div className="bg-white rounded-xl border border-neutral-200/80 p-5 sm:p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#781324]" />
                  <span>Owner & Staff Management (RBAC)</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Manage staff accounts, edit display names, deactivate/reactivate staff, and securely reset PINs
                </p>
              </div>

              {currentUser?.role === 'owner' && (
                <button
                  type="button"
                  onClick={() => {
                    setStaffForm({
                      name: '',
                      username: '',
                      role: 'cashier',
                      pin: '',
                      phone: '',
                    });
                    setStaffError('');
                    setShowAddStaffModal(true);
                  }}
                  className="px-3.5 py-2 bg-[#781324] hover:bg-[#600f1c] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Staff Account</span>
                </button>
              )}
            </div>

            {/* Non-Owner Access Restriction Banner */}
            {currentUser?.role !== 'owner' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
                <Lock className="w-8 h-8 text-amber-600 mx-auto" />
                <h4 className="font-bold text-amber-900 text-sm">Owner Authorization Required</h4>
                <p className="text-xs text-amber-800 max-w-md mx-auto">
                  Owner and Staff Management is restricted exclusively to the Shop Owner. Please authenticate with the Owner account to manage staff members or reset security PINs.
                </p>
                {onOpenOwnerAuth && (
                  <button
                    type="button"
                    onClick={onOpenOwnerAuth}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#781324] hover:bg-[#5c0e1b] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Enter Owner PIN to Unlock</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {staffSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{staffSuccess}</span>
                  </div>
                )}

                {/* Staff List Table (Never reveals plaintext PINs) */}
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#FAF7F2] border-b border-neutral-200 text-neutral-600 font-semibold">
                        <th className="py-3 px-4">Display Name</th>
                        <th className="py-3 px-3">Role</th>
                        <th className="py-3 px-3">Username</th>
                        <th className="py-3 px-3">Security PIN</th>
                        <th className="py-3 px-3">Contact</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-4 text-right">Management Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {staffUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-neutral-50/80">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-neutral-900">{user.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser(user);
                                  setEditName(user.name);
                                  setEditPhone(user.phone || '');
                                  setEditRole(user.role);
                                }}
                                className="p-1 text-neutral-400 hover:text-[#781324] transition-colors cursor-pointer"
                                title="Edit display name"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-[10px] text-neutral-400">ID: {user.id}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                user.role === 'owner'
                                  ? 'bg-amber-100 text-amber-900'
                                  : user.role === 'manager'
                                  ? 'bg-blue-100 text-blue-900'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {user.role === 'owner' && <Crown className="w-3 h-3" />}
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-neutral-700">{user.username}</td>
                          <td className="py-3 px-3 font-mono font-bold text-neutral-500 tracking-widest select-none">
                            ••••
                          </td>
                          <td className="py-3 px-3 text-neutral-600">{user.phone || '-'}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                user.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-neutral-100 text-neutral-500'
                              }`}
                            >
                              {user.isActive ? 'Active' : 'Deactivated'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Name / Profile */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser(user);
                                  setEditName(user.name);
                                  setEditPhone(user.phone || '');
                                  setEditRole(user.role);
                                }}
                                className="px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded border border-neutral-200 transition-colors cursor-pointer"
                              >
                                Edit Name
                              </button>

                              {/* Secure Reset PIN (Opens Owner-authenticated modal) */}
                              <button
                                type="button"
                                onClick={() => setResetPinTargetUser(user)}
                                className="px-2 py-1 text-xs font-semibold text-[#781324] hover:bg-[#781324]/10 rounded border border-[#781324]/30 transition-colors cursor-pointer"
                                title="Change or Reset PIN"
                              >
                                Change PIN
                              </button>

                              {/* Deactivate / Reactivate (Owner cannot be deactivated) */}
                              {user.role !== 'owner' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const actionText = user.isActive ? 'deactivate' : 'reactivate';
                                    if (window.confirm(`Are you sure you want to ${actionText} ${user.name}'s account?`)) {
                                      try {
                                        await cloudSync.updateStaffUser(user.id, { isActive: !user.isActive });
                                        setStaffSuccess(`Account ${user.name} ${user.isActive ? 'deactivated' : 'reactivated'}.`);
                                        if (onRefreshStaff) await onRefreshStaff();
                                        setTimeout(() => setStaffSuccess(''), 3000);
                                      } catch (err: any) {
                                        alert(err.message || 'Action failed');
                                      }
                                    }
                                  }}
                                  className={`px-2 py-1 text-xs font-semibold rounded border transition-colors cursor-pointer ${
                                    user.isActive
                                      ? 'text-rose-700 border-rose-200 hover:bg-rose-50'
                                      : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                                  }`}
                                >
                                  {user.isActive ? 'Deactivate' : 'Reactivate'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Permissions Breakdown Guide */}
                <div className="bg-[#FAF7F2] p-4 rounded-xl border border-neutral-200 text-xs space-y-2">
                  <h4 className="font-bold text-neutral-800 text-xs flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-600" />
                    <span>Role Permissions Breakdown</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="p-3 bg-white rounded-lg border border-neutral-200/80">
                      <div className="font-bold text-amber-900 mb-1">👑 Shop Owner / Super Admin</div>
                      <ul className="list-disc pl-4 space-y-0.5 text-neutral-600 text-[11px]">
                        <li>Full system access & settings configuration</li>
                        <li>Exclusively edit or delete existing bills</li>
                        <li>View revenue, profit margins & audit trails</li>
                        <li>Manage staff accounts and reset security PINs</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-neutral-200/80">
                      <div className="font-bold text-blue-900 mb-1">👔 Store Manager</div>
                      <ul className="list-disc pl-4 space-y-0.5 text-neutral-600 text-[11px]">
                        <li>Billing & cart checkout</li>
                        <li>Stock inventory adjustments and restocking</li>
                        <li>View sales reports permitted for store floor</li>
                        <li>Cannot edit or delete historical bills without Owner</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-neutral-200/80">
                      <div className="font-bold text-emerald-900 mb-1">💼 Counter Cashier</div>
                      <ul className="list-disc pl-4 space-y-0.5 text-neutral-600 text-[11px]">
                        <li>Fast sweet billing & weight calculations</li>
                        <li>Cash, UPI, Card & Split payments</li>
                        <li>Print and reprint customer receipts</li>
                        <li>Strictly forbidden from editing or deleting bills</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Modal: Edit Display Name & Details */}
            {editingUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-neutral-200">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h4 className="font-serif font-bold text-base text-neutral-900">
                      Edit Account Details
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="text-neutral-400 hover:text-neutral-600 text-sm font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Display Name *
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                      />
                      <p className="text-[10px] text-neutral-400 mt-1">
                        This name will appear on printed bills, cash register logs, and reports.
                      </p>
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Contact Phone
                      </label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="e.g. +91 98220 12345"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                      />
                    </div>

                    {editingUser.role !== 'owner' && (
                      <div>
                        <label className="block font-semibold text-neutral-700 mb-1">
                          Role *
                        </label>
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white"
                        >
                          <option value="cashier">Counter Cashier</option>
                          <option value="manager">Store Manager</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!editName.trim()) {
                          alert('Display name cannot be empty.');
                          return;
                        }
                        try {
                          await cloudSync.updateStaffUser(editingUser.id, {
                            name: editName.trim(),
                            phone: editPhone.trim(),
                            role: editRole,
                          });
                          setEditingUser(null);
                          setStaffSuccess(`Updated profile for ${editName}`);
                          if (onRefreshStaff) await onRefreshStaff();
                          setTimeout(() => setStaffSuccess(''), 3000);
                        } catch (err: any) {
                          alert(err.message || 'Failed to update profile');
                        }
                      }}
                      className="px-4 py-2 bg-[#781324] hover:bg-[#600f1c] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Add New Staff Member (Masked PINs, never plaintext) */}
            {showAddStaffModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-neutral-200">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h4 className="font-serif font-bold text-base text-neutral-900">
                      Add New Staff Account
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddStaffModal(false)}
                      className="text-neutral-400 hover:text-neutral-600 text-sm font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {staffError && (
                    <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-semibold">
                      {staffError}
                    </div>
                  )}

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Full Display Name *
                      </label>
                      <input
                        type="text"
                        value={staffForm.name}
                        onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                        placeholder="e.g. Ramesh Kulkarni"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-neutral-700 mb-1">
                          Role *
                        </label>
                        <select
                          value={staffForm.role}
                          onChange={(e) =>
                            setStaffForm({ ...staffForm, role: e.target.value as UserRole })
                          }
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white"
                        >
                          <option value="cashier">Counter Cashier</option>
                          <option value="manager">Store Manager</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-neutral-700 mb-1">
                          4-Digit Security PIN *
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          value={staffForm.pin}
                          onChange={(e) =>
                            setStaffForm({ ...staffForm, pin: e.target.value.replace(/\D/g, '') })
                          }
                          placeholder="••••"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono tracking-widest text-center font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Contact Mobile (optional)
                      </label>
                      <input
                        type="text"
                        value={staffForm.phone}
                        onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                        placeholder="e.g. +91 98220 12345"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setShowAddStaffModal(false)}
                      className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!staffForm.name.trim() || staffForm.pin.length !== 4) {
                          setStaffError('Please enter Name and a valid 4-digit PIN.');
                          return;
                        }
                        try {
                          await cloudSync.createStaffUser(staffForm);
                          setShowAddStaffModal(false);
                          setStaffSuccess(`Added staff member ${staffForm.name}`);
                          if (onRefreshStaff) await onRefreshStaff();
                          setTimeout(() => setStaffSuccess(''), 3000);
                        } catch (err: any) {
                          setStaffError(err.message || 'Failed to create staff member');
                        }
                      }}
                      className="px-4 py-2 bg-[#781324] hover:bg-[#600f1c] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Save Staff Member
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Secure Reset PIN (Owner authorization required) */}
            <ResetPinModal
              isOpen={Boolean(resetPinTargetUser)}
              targetUser={resetPinTargetUser}
              onClose={() => setResetPinTargetUser(null)}
              onSuccess={(msg) => {
                setStaffSuccess(msg);
                if (onRefreshStaff) onRefreshStaff();
                setTimeout(() => setStaffSuccess(''), 3000);
              }}
            />
          </div>
        )}

        {/* TAB: CLOUD SYNC & AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl border border-neutral-200/80 p-5 sm:p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-[#781324]" />
                  <span>Cloud Synchronization & Cybersecurity Audit Trail</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Real-time multi-terminal replication, double-click protection, and tamper-evident event log
                </p>
              </div>

              <button
                type="button"
                onClick={() => exportAuditLogToExcel(auditLogs)}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Audit Log (.xlsx)</span>
              </button>
            </div>

            {/* Cloud Status Architecture Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200/80">
                <div className="flex items-center gap-2 text-emerald-800 font-bold mb-1">
                  <Wifi className="w-4 h-4 text-emerald-600" />
                  <span>Real-Time Sync Engine</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  Server-Sent Events (SSE) active. When a bill is created on PC 1, it appears on PC 2 and mobile counters within milliseconds.
                </p>
              </div>

              <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200/80">
                <div className="flex items-center gap-2 text-blue-800 font-bold mb-1">
                  <Lock className="w-4 h-4 text-blue-600" />
                  <span>Atomic Stock Lock</span>
                </div>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  Prevents race conditions if two cashiers sell the last sweet simultaneously. Server validates stock atomically before confirming the sale.
                </p>
              </div>

              <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200/80">
                <div className="flex items-center gap-2 text-purple-800 font-bold mb-1">
                  <ShieldAlert className="w-4 h-4 text-purple-600" />
                  <span>Double-Click Protection</span>
                </div>
                <p className="text-[11px] text-purple-700 leading-relaxed">
                  Client generates unique idempotency keys per submission. Double-clicking or network retries never produce duplicate bills.
                </p>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-neutral-800">
                  Recent Security & Transaction Events ({auditLogs.length})
                </span>
                <span className="text-[11px] text-neutral-500">
                  Showing last {Math.min(auditLogs.length, 100)} recorded events
                </span>
              </div>

              <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#FAF7F2] border-b border-neutral-200 text-neutral-600 font-semibold z-10">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Staff User</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-4">Event Details & Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-neutral-400">
                          No audit events recorded yet. New actions will automatically appear here.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.slice(0, 100).map((log) => (
                        <tr key={log.id} className="hover:bg-neutral-50/80">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}{' '}
                            <span className="text-neutral-400">
                              · {new Date(log.timestamp).toLocaleDateString('en-IN')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.action === 'BILL_CREATE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : log.action === 'BILL_EDIT'
                                  ? 'bg-amber-100 text-amber-800'
                                  : log.action === 'BILL_CANCEL'
                                  ? 'bg-rose-100 text-rose-800'
                                  : log.action === 'PRICE_CHANGE'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-neutral-100 text-neutral-800'
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-neutral-800">
                            {log.userName}
                          </td>
                          <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-neutral-500">
                            {log.userRole}
                          </td>
                          <td className="py-2.5 px-4 text-neutral-700">{log.details}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BACKUP & DATA RECOVERY */}
        {activeTab === 'backup' && (
          <div className="bg-white rounded-xl border border-neutral-200/80 p-5 sm:p-6 shadow-xs space-y-5">
            <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#781324]" />
              <span>Data Persistence & Backup Management</span>
            </h3>

            <div className="p-3 bg-neutral-50 rounded-lg text-xs text-neutral-600">
              All transactions, inventory movements, product lists, and store settings are securely stored locally in your browser's persistent <strong>IndexedDB</strong> database. This ensures complete data retention even after restarting the computer, browser updates, or closing the tab.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Export Button */}
              <div className="p-4 rounded-xl border border-neutral-200 flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="font-semibold text-neutral-900 text-xs flex items-center gap-2">
                    <Download className="w-4 h-4 text-[#781324]" />
                    <span>Download JSON Backup</span>
                  </h4>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Export complete database snapshot containing all bills, products, and movements to an offline file.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onExportData}
                  className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Export System Backup File
                </button>
              </div>

              {/* Import Button */}
              <div className="p-4 rounded-xl border border-neutral-200 flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="font-semibold text-neutral-900 text-xs flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#781324]" />
                    <span>Restore from Backup</span>
                  </h4>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Upload a previously exported .json file to restore data on this or another machine.
                  </p>
                </div>

                <label className="w-full py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-bold rounded-lg transition-colors cursor-pointer text-center block">
                  Select Backup File (.json)
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {importStatus && (
              <div className="p-3 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-medium">
                {importStatus}
              </div>
            )}

            {/* Reset sample database */}
            <div className="pt-4 border-t border-neutral-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-xs text-rose-800">Danger Zone</span>
                <p className="text-[11px] text-neutral-500">
                  Reset product catalog and clear current bills back to initial sample state
                </p>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 cursor-pointer"
              >
                Reset Database
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: HARDWARE & CLOUD GUIDE */}
        {activeTab === 'guide' && (
          <div className="bg-white rounded-xl border border-neutral-200/80 p-5 sm:p-6 shadow-xs space-y-5 text-xs">
            <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#781324]" />
              <span>Thermal Receipt Printer & Cloud Integration Guide</span>
            </h3>

            {/* Printer guide */}
            <div className="space-y-2 border-b border-neutral-200 pb-4">
              <h4 className="font-bold text-neutral-800 text-xs flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-[#781324]" />
                <span>How to connect a 58mm or 80mm Thermal Receipt Printer:</span>
              </h4>
              <ol className="list-decimal pl-4 space-y-1.5 text-neutral-600">
                <li>
                  Plug your thermal printer (e.g. TVS, Epson, Citizen, Everycom, NGX) into your Windows PC or Laptop via USB, Bluetooth, or LAN.
                </li>
                <li>
                  Install the official Windows printer driver from the manufacturer's CD or website.
                </li>
                <li>
                  Go to <strong>Windows Settings → Bluetooth & Devices → Printers & Scanners</strong> and set paper size to <strong>80mm x 297mm</strong> or <strong>58mm x 210mm</strong>.
                </li>
                <li>
                  In this POS system, when you click <strong>Save & Print</strong> or <strong>Print Bill</strong>, the browser print dialog will appear. Select your thermal printer from the destination list.
                </li>
                <li>
                  Enable <strong>"Headers and Footers: Off"</strong> and <strong>"Margins: None"</strong> in browser print settings for a clean receipt edge.
                </li>
              </ol>
            </div>

            {/* Multi-Device Cloud Sync Notice */}
            <div className="space-y-2">
              <h4 className="font-bold text-neutral-800 text-xs flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-[#781324]" />
                <span>Multi-Device Cloud Synchronization (Firebase Integration)</span>
              </h4>
              <p className="text-neutral-600">
                This POS application currently utilizes local <strong>IndexedDB</strong> persistence so it works 100% reliably offline inside PRIME CENTURY SWEET without requiring an internet connection.
              </p>
              <p className="text-neutral-600">
                To link multiple billing counters across different computers or tablets via Google Cloud / Firebase Firestore, you can activate the Firebase sync module using the built-in backup and export structures.
              </p>
            </div>
          </div>
        )}

        {/* Global Save Button for configuration */}
        {activeTab !== 'backup' && activeTab !== 'guide' && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-[#781324] hover:bg-[#600f1c] disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
