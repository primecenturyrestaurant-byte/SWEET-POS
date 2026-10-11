import React, { useState, useEffect } from 'react';
import { StaffUser, UserRole } from '../types';
import { cloudSync } from '../lib/cloudSync';
import { ShieldCheck, Lock, Crown, Briefcase, User, X, AlertCircle, KeyRound, Check } from 'lucide-react';

interface UserAuthModalProps {
  currentUser: StaffUser | null;
  staffUsers: StaffUser[];
  onUserChange: (user: StaffUser | null) => void;
  onClose: () => void;
  isOpen: boolean;
  overrideRoleRequired?: UserRole;
  title?: string;
  onSuccess?: () => void;
}

export const UserAuthModal: React.FC<UserAuthModalProps> = ({
  currentUser,
  staffUsers,
  onUserChange,
  onClose,
  isOpen,
  overrideRoleRequired,
  title = 'Switch Staff / Cashier',
  onSuccess,
}) => {
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(currentUser);
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Active users only
  const activeUsers = staffUsers.filter((u) => u.isActive);

  useEffect(() => {
    if (isOpen) {
      setSelectedUser(currentUser || (activeUsers.length > 0 ? activeUsers[0] : null));
      setPin('');
      setError('');
    }
  }, [isOpen, currentUser, staffUsers]);

  // Keyboard listener for typing PIN directly
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 4) {
          setPin((prev) => prev + e.key);
          setError('');
        }
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1));
        setError('');
      } else if (e.key === 'Enter') {
        if (pin.length === 4) {
          handleSubmit();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, selectedUser]);

  if (!isOpen) return null;

  const handleNumClick = (num: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + num);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      setError('Please enter your 4-digit PIN');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const user = await cloudSync.loginWithPin(pin, selectedUser?.id);

      // Check role override if required (e.g. owner only)
      if (overrideRoleRequired) {
        const roleRank: { [key in UserRole]: number } = {
          owner: 4,
          admin: 3,
          manager: 2,
          cashier: 1,
        };
        const requiredRank = roleRank[overrideRoleRequired] || 1;
        const userRank = roleRank[user.role] || 1;

        if (userRank < requiredRank) {
          setError(`Requires ${overrideRoleRequired.toUpperCase()} authorization. "${user.name}" is a ${user.role}.`);
          setIsLoading(false);
          return;
        }
      }

      onUserChange(user);
      setPin('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid PIN. Authentication failed.');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-3.5 h-3.5 text-amber-500" />;
      case 'admin':
        return <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />;
      case 'manager':
        return <Briefcase className="w-3.5 h-3.5 text-blue-500" />;
      default:
        return <User className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 no-print">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="bg-[#781324] text-white p-4 flex items-center justify-between border-b border-[#922137]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] text-[#781324] flex items-center justify-center font-serif font-black shadow-inner">
              P
            </div>
            <div>
              <h3 className="font-serif font-bold text-base leading-tight text-white">{title}</h3>
              <p className="text-[11px] text-[#e8c878]">PRIME CENTURY SWEET · Secure Counter Access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current User Session Bar */}
          {currentUser && (
            <div className="flex items-center justify-between p-2.5 bg-[#FAF7F2] rounded-xl border border-neutral-200 text-xs">
              <div className="flex items-center gap-2">
                {getRoleIcon(currentUser.role)}
                <div>
                  <span className="font-bold text-neutral-800">{currentUser.name}</span>
                  <span className="text-[10px] uppercase font-bold text-[#781324] ml-2 px-1.5 py-0.5 bg-[#781324]/10 rounded">
                    {currentUser.role}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onUserChange(null);
                  cloudSync.setCurrentUser(null);
                }}
                className="text-[11px] font-semibold text-rose-700 hover:underline cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          )}

          {overrideRoleRequired && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Owner authorization required ({overrideRoleRequired.toUpperCase()} PIN).
              </span>
            </div>
          )}

          {/* Dynamic Active Staff Selector (Populated from persistent database, never hardcoded) */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block">
              Select Staff Account to Authenticate
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-0.5">
              {activeUsers.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(u);
                      setPin('');
                      setError('');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#781324] bg-[#781324]/5 ring-2 ring-[#781324]/20'
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs text-neutral-900 truncate">
                        {u.name}
                      </span>
                      {getRoleIcon(u.role)}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-neutral-500">
                      <span className="uppercase font-semibold tracking-wider">{u.role}</span>
                      {isSelected && (
                        <span className="flex items-center gap-0.5 text-[#781324] font-bold">
                          <Check className="w-3 h-3" /> Selected
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Masked Password-Style PIN Indicator (Dots instead of digits) */}
          <div className="space-y-1.5 text-center">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block">
              Enter 4-Digit PIN for {selectedUser ? selectedUser.name : 'Selected User'}
            </label>
            <div className="flex items-center justify-center gap-3 p-3 bg-neutral-100 rounded-xl border border-neutral-200">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    idx < pin.length
                      ? 'bg-[#781324] border-[#781324] scale-110'
                      : 'border-neutral-300 bg-white'
                  }`}
                />
              ))}
            </div>
            <p className="text-[10px] text-neutral-400">
              PIN is encrypted and never displayed in plain text.
            </p>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Numeric Touch Keypad for Fast Cashier Entry */}
          <div className="grid grid-cols-3 gap-1.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumClick(num)}
                className="h-11 rounded-xl bg-neutral-100 hover:bg-[#FAF7F2] active:bg-[#e8c878]/30 text-lg font-bold text-neutral-800 transition-colors border border-neutral-200 cursor-pointer active:scale-95"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-11 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-bold text-neutral-600 transition-colors border border-neutral-200 cursor-pointer active:scale-95"
            >
              CLEAR
            </button>
            <button
              type="button"
              onClick={() => handleNumClick('0')}
              className="h-11 rounded-xl bg-neutral-100 hover:bg-[#FAF7F2] text-lg font-bold text-neutral-800 transition-colors border border-neutral-200 cursor-pointer active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-11 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-bold text-neutral-600 transition-colors border border-neutral-200 cursor-pointer active:scale-95"
            >
              ⌫ DEL
            </button>
          </div>

          {/* Submit Action */}
          <button
            type="button"
            disabled={pin.length < 4 || isLoading}
            onClick={handleSubmit}
            className="w-full py-2.5 rounded-xl bg-[#781324] hover:bg-[#5c0e1b] disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            <span>Verify & Log In</span>
          </button>
        </div>
      </div>
    </div>
  );
};
