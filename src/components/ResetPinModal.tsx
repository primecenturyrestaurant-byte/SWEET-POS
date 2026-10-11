import React, { useState } from 'react';
import { StaffUser } from '../types';
import { cloudSync } from '../lib/cloudSync';
import { ShieldCheck, Lock, KeyRound, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ResetPinModalProps {
  isOpen: boolean;
  targetUser: StaffUser | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const ResetPinModal: React.FC<ResetPinModalProps> = ({
  isOpen,
  targetUser,
  onClose,
  onSuccess,
}) => {
  const [ownerPin, setOwnerPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [activeField, setActiveField] = useState<'owner' | 'new' | 'confirm'>('owner');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  React.useEffect(() => {
    if (!isOpen || !targetUser) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        if (ownerPin.length === 4 && newPin.length === 4 && confirmPin.length === 4) {
          handleSubmit();
        } else if (activeField === 'owner' && ownerPin.length === 4) {
          setActiveField('new');
        } else if (activeField === 'new' && newPin.length === 4) {
          setActiveField('confirm');
        }
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, targetUser, activeField, ownerPin, newPin, confirmPin]);

  if (!isOpen || !targetUser) return null;

  const handleClose = () => {
    setOwnerPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setIsLoading(false);
    onClose();
  };

  const handleKeypadPress = (digit: string) => {
    setError('');
    if (activeField === 'owner') {
      if (ownerPin.length < 4) setOwnerPin((prev) => prev + digit);
    } else if (activeField === 'new') {
      if (newPin.length < 4) setNewPin((prev) => prev + digit);
    } else {
      if (confirmPin.length < 4) setConfirmPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setError('');
    if (activeField === 'owner') {
      setOwnerPin((prev) => prev.slice(0, -1));
    } else if (activeField === 'new') {
      setNewPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setError('');
    if (activeField === 'owner') setOwnerPin('');
    else if (activeField === 'new') setNewPin('');
    else setConfirmPin('');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    if (ownerPin.length !== 4) {
      setError('Please enter your 4-digit Owner PIN to authorize this reset.');
      setActiveField('owner');
      return;
    }

    if (newPin.length !== 4) {
      setError('New PIN must be exactly 4 digits.');
      setActiveField('new');
      return;
    }

    if (newPin !== confirmPin) {
      setError('New PIN and Confirm PIN do not match. Please verify.');
      setActiveField('confirm');
      return;
    }

    setIsLoading(true);
    try {
      await cloudSync.resetUserPin(targetUser.id, ownerPin, newPin);
      onSuccess(`Successfully updated PIN for ${targetUser.name}`);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reset PIN. Please verify your Owner PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="bg-[#781324] text-white p-4 flex items-center justify-between border-b border-[#922137]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] text-[#781324] flex items-center justify-center font-serif font-black shadow-inner">
              <KeyRound className="w-4 h-4 text-[#781324]" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base leading-tight text-white">
                Secure PIN Reset
              </h3>
              <p className="text-[11px] text-[#e8c878]">Owner-Authorized Access Only</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Target User Info */}
          <div className="p-3 bg-[#FAF7F2] rounded-xl border border-neutral-200 text-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                Resetting PIN For
              </span>
              <span className="font-bold text-neutral-900 text-sm">{targetUser.name}</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#781324]/10 text-[#781324]">
              {targetUser.role}
            </span>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-3 text-xs">
            {/* Step 1: Owner Authentication */}
            <div>
              <label className="block font-bold text-neutral-700 mb-1">
                1. Owner Authentication (Your Current PIN) *
              </label>
              <div
                onClick={() => setActiveField('owner')}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  activeField === 'owner'
                    ? 'border-[#781324] ring-2 ring-[#781324]/20 bg-white'
                    : 'border-neutral-300 bg-neutral-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-neutral-400" />
                  <span className="font-mono text-base tracking-widest text-neutral-900 font-bold">
                    {ownerPin ? '•'.repeat(ownerPin.length) : (
                      <span className="text-neutral-400 font-normal text-xs">Enter Owner PIN</span>
                    )}
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400">{ownerPin.length}/4</span>
              </div>
            </div>

            {/* Step 2: New PIN */}
            <div>
              <label className="block font-bold text-neutral-700 mb-1">
                2. New 4-Digit PIN *
              </label>
              <div
                onClick={() => setActiveField('new')}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  activeField === 'new'
                    ? 'border-[#781324] ring-2 ring-[#781324]/20 bg-white'
                    : 'border-neutral-300 bg-neutral-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-neutral-400" />
                  <span className="font-mono text-base tracking-widest text-neutral-900 font-bold">
                    {newPin ? '•'.repeat(newPin.length) : (
                      <span className="text-neutral-400 font-normal text-xs">Enter New PIN</span>
                    )}
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400">{newPin.length}/4</span>
              </div>
            </div>

            {/* Step 3: Confirm PIN */}
            <div>
              <label className="block font-bold text-neutral-700 mb-1">
                3. Confirm New 4-Digit PIN *
              </label>
              <div
                onClick={() => setActiveField('confirm')}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  activeField === 'confirm'
                    ? 'border-[#781324] ring-2 ring-[#781324]/20 bg-white'
                    : 'border-neutral-300 bg-neutral-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-neutral-400" />
                  <span className="font-mono text-base tracking-widest text-neutral-900 font-bold">
                    {confirmPin ? '•'.repeat(confirmPin.length) : (
                      <span className="text-neutral-400 font-normal text-xs">Re-enter New PIN</span>
                    )}
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400">{confirmPin.length}/4</span>
              </div>
            </div>
          </div>

          {/* On-Screen Numeric Keypad for Fast Touch Input */}
          <div className="pt-1">
            <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Touch Keypad: Entering {activeField === 'owner' ? 'Owner PIN' : activeField === 'new' ? 'New PIN' : 'Confirm PIN'}</span>
              <div className="flex gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setActiveField('owner')}
                  className={`px-1.5 py-0.5 rounded ${activeField === 'owner' ? 'bg-[#781324] text-white' : 'bg-neutral-200'}`}
                >
                  Step 1
                </button>
                <button
                  type="button"
                  onClick={() => setActiveField('new')}
                  className={`px-1.5 py-0.5 rounded ${activeField === 'new' ? 'bg-[#781324] text-white' : 'bg-neutral-200'}`}
                >
                  Step 2
                </button>
                <button
                  type="button"
                  onClick={() => setActiveField('confirm')}
                  className={`px-1.5 py-0.5 rounded ${activeField === 'confirm' ? 'bg-[#781324] text-white' : 'bg-neutral-200'}`}
                >
                  Step 3
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="h-10 rounded-lg bg-neutral-100 hover:bg-[#FAF7F2] active:bg-[#e8c878]/30 text-base font-bold text-neutral-800 transition-colors border border-neutral-200 cursor-pointer"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="h-10 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs font-bold text-neutral-600 transition-colors border border-neutral-200 cursor-pointer"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="h-10 rounded-lg bg-neutral-100 hover:bg-[#FAF7F2] text-base font-bold text-neutral-800 transition-colors border border-neutral-200 cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="h-10 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs font-bold text-neutral-600 transition-colors border border-neutral-200 cursor-pointer"
              >
                ⌫ DEL
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-neutral-200">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-bold text-xs cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || ownerPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4}
              className="flex-1 py-2.5 rounded-xl bg-[#781324] hover:bg-[#5c0e1b] disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>Authorize & Save PIN</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
