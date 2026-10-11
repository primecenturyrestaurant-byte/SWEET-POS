import React, { useState, useEffect } from 'react';
import { ShopSettings, Bill, StaffUser, SyncStatus } from '../types';
import { formatRupee } from '../lib/calculations';
import {
  Clock,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  User,
  Crown,
  Briefcase,
  ShieldCheck,
  Radio,
} from 'lucide-react';

interface HeaderProps {
  settings: ShopSettings;
  bills: Bill[];
  onOpenNewBill: () => void;
  activeTab: string;
  syncStatus?: SyncStatus;
  syncErrorMessage?: string;
  currentUser?: StaffUser | null;
  onOpenUserSwitch?: () => void;
  onRetrySync?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  bills,
  onOpenNewBill,
  activeTab,
  syncStatus = 'synced',
  syncErrorMessage,
  currentUser,
  onOpenUserSwitch,
  onRetrySync,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Today's quick numbers
  const todayStr = new Date().toISOString().split('T')[0];
  const todayBills = bills.filter(
    (b) => b.createdAt.startsWith(todayStr) && b.status !== 'cancelled'
  );
  const todaySales = todayBills.reduce((acc, b) => acc + b.grandTotal, 0);

  const formattedDate = currentTime.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-3.5 h-3.5 text-amber-300" />;
      case 'admin':
        return <ShieldCheck className="w-3.5 h-3.5 text-purple-300" />;
      case 'manager':
        return <Briefcase className="w-3.5 h-3.5 text-blue-300" />;
      default:
        return <User className="w-3.5 h-3.5 text-emerald-300" />;
    }
  };

  return (
    <header className="h-16 bg-[#781324] text-white px-4 lg:px-6 flex items-center justify-between shadow-md z-30 shrink-0 no-print border-b border-[#922137]">
      {/* Brand Title Zone */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#FAF7F2] text-[#781324] flex items-center justify-center shadow-inner border border-[#d4af37]">
          <span className="font-serif font-black text-xl tracking-tighter">P</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif font-bold text-base sm:text-lg tracking-wide uppercase text-white whitespace-nowrap">
              {settings.shopName}
            </h1>
            <span className="hidden sm:inline-block text-[10px] tracking-widest uppercase text-[#e8c878] font-semibold">
              POS Terminal
            </span>
          </div>
          <p className="text-[11px] text-[#f0d6d6] hidden md:block">
            {settings.state} · GSTIN: {settings.gstin}
            {settings.ownerName ? ` · Proprietor: ${settings.ownerName}` : ''}
          </p>
        </div>
      </div>

      {/* Center Zone: Cloud Sync Indicator & Today's live sales ticker */}
      <div className="hidden md:flex items-center gap-4">
        {/* Real-Time Cloud Synchronization Status Pill */}
        <div
          onClick={onRetrySync}
          title={syncErrorMessage || 'Real-time multi-device cloud synchronization'}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none ${
            syncStatus === 'synced'
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
              : syncStatus === 'syncing'
              ? 'bg-amber-950/70 border-amber-500/50 text-amber-300 animate-pulse'
              : syncStatus === 'offline'
              ? 'bg-neutral-800/80 border-neutral-600 text-neutral-300'
              : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
          }`}
        >
          {syncStatus === 'synced' && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-bold tracking-wide">Cloud Synced</span>
            </>
          )}

          {syncStatus === 'syncing' && (
            <>
              <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
              <span className="text-[11px] font-bold tracking-wide">Syncing...</span>
            </>
          )}

          {syncStatus === 'offline' && (
            <>
              <WifiOff className="w-3 h-3 text-neutral-400" />
              <span className="text-[11px] font-bold tracking-wide">Offline Mode</span>
            </>
          )}

          {syncStatus === 'error' && (
            <>
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span className="text-[11px] font-bold tracking-wide">Sync Error</span>
            </>
          )}
        </div>

        {/* Today's Live Sales Ticker */}
        <div className="hidden lg:flex items-center gap-4 text-xs bg-[#5c0e1b] px-3.5 py-1.5 rounded-lg border border-[#8a2236]">
          <div className="flex items-center gap-2">
            <span className="text-[#e2b96f] uppercase font-semibold text-[10px]">Today's Sales:</span>
            <span className="font-mono text-sm font-bold text-white tabular-nums">
              {formatRupee(todaySales)}
            </span>
          </div>
          <div className="h-3 w-px bg-[#8a2236]" />
          <div className="flex items-center gap-2">
            <span className="text-[#e2b96f] uppercase font-semibold text-[10px]">Bills:</span>
            <span className="font-mono font-bold text-white tabular-nums">
              {todayBills.length}
            </span>
          </div>
        </div>
      </div>

      {/* Right Action & User Profile Zone */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Active Cashier / User Badge */}
        <button
          type="button"
          onClick={onOpenUserSwitch}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#5c0e1b] hover:bg-[#4a0b16] border border-[#8a2236] transition-colors cursor-pointer text-left"
          title="Click to Switch Staff User or Enter Security PIN"
        >
          <div className="w-6 h-6 rounded-md bg-[#781324] border border-[#d4af37]/60 flex items-center justify-center">
            {getRoleIcon(currentUser?.role)}
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-bold text-white leading-tight">
              {currentUser?.name || 'Counter Cashier'}
            </div>
            <div className="text-[10px] text-[#e8c878] uppercase font-semibold tracking-wider">
              {currentUser?.role || 'Staff'} · PIN Switch
            </div>
          </div>
        </button>

        {/* Clock & Date */}
        <div className="hidden xl:flex flex-col items-end text-right">
          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-white tabular-nums">
            <Clock className="w-3.5 h-3.5 text-[#e8c878]" />
            <span>{formattedTime}</span>
          </div>
          <span className="text-[11px] text-[#e0b7b7]">{formattedDate}</span>
        </div>

        {/* New Bill Button */}
        {activeTab !== 'new-bill' && (
          <button
            type="button"
            onClick={onOpenNewBill}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#e8c878] hover:bg-[#d8b868] text-[#4a0b16] text-xs font-bold rounded-lg shadow transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Bill (F2)</span>
          </button>
        )}
      </div>
    </header>
  );
};

