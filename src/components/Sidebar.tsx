import React from 'react';
import { ShopSettings } from '../types';
import {
  LayoutDashboard,
  Receipt,
  Package,
  History,
  BarChart3,
  Boxes,
  Settings,
  Sparkles,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'new-bill'
  | 'products'
  | 'sales-history'
  | 'reports'
  | 'inventory'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  lowStockCount: number;
  settings?: ShopSettings;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  lowStockCount,
  settings,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      shortcut: 'F1',
    },
    {
      id: 'new-bill' as NavTab,
      label: 'New Bill',
      icon: Receipt,
      shortcut: 'F2',
      highlight: true,
    },
    {
      id: 'products' as NavTab,
      label: 'Products',
      icon: Package,
      shortcut: 'F3',
    },
    {
      id: 'sales-history' as NavTab,
      label: 'Sales History',
      icon: History,
      shortcut: 'F4',
    },
    {
      id: 'reports' as NavTab,
      label: 'Reports',
      icon: BarChart3,
      shortcut: 'F5',
    },
    {
      id: 'inventory' as NavTab,
      label: 'Inventory',
      icon: Boxes,
      shortcut: 'F6',
      badge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings',
      icon: Settings,
      shortcut: 'F7',
    },
  ];

  return (
    <aside className="w-60 bg-[#5c0e1b] text-white flex flex-col shrink-0 no-print border-r border-[#781324] select-none">
      {/* Sub-header banner */}
      <div className="p-4 border-b border-[#781324]/80 bg-[#4d0c17]/50">
        <div className="text-[11px] uppercase tracking-wider text-[#e8c878] font-bold">
          PRIME CENTURY SWEET
        </div>
        <div className="text-xs text-[#d6b0b0] font-medium mt-0.5">
          Confectionery Counter POS
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left ${
                isActive
                  ? 'bg-[#e8c878] text-[#4d0c17] shadow-sm font-bold'
                  : item.highlight
                  ? 'bg-[#781324] text-white hover:bg-[#8f192e]'
                  : 'text-[#ebd4d4] hover:bg-[#781324]/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-[#4d0c17]'
                      : item.highlight
                      ? 'text-[#e8c878]'
                      : 'text-[#d4af37]'
                  }`}
                />
                <span className="tracking-wide">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    {item.badge}
                  </span>
                )}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isActive
                      ? 'bg-[#d4b465] text-[#3d0912]'
                      : 'bg-[#400811] text-[#bca3a3]'
                  }`}
                >
                  {item.shortcut}
                </span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Cashier status bottom card */}
      <div className="p-3 m-2 rounded-lg bg-[#400811] border border-[#6b1424] text-xs">
        <div className="text-[11px] text-[#e8c878] font-bold truncate">
          {settings?.shopName || 'PRIME CENTURY SWEET'}
        </div>
        {settings?.ownerName && (
          <div className="text-[10px] text-[#e8c878]/80 font-medium truncate mt-0.5">
            Owner: {settings.ownerName}
          </div>
        )}
        <div className="text-[10px] text-[#c9a6a6] mt-0.5">
          Local Storage: <strong>IndexedDB Ready</strong>
        </div>
        <div className="text-[10px] text-[#c9a6a6] mt-0.5">
          Printer: <strong>Thermal & A4 Enabled</strong>
        </div>
      </div>
    </aside>
  );
};
