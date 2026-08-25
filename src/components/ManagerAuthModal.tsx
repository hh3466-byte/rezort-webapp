import React, { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, X, Check, ShieldAlert } from 'lucide-react';

interface ManagerAuthModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const ADMIN_PASSCODE = '3466';

export const ManagerAuthModal: React.FC<ManagerAuthModalProps> = ({
  isOpen,
  title = 'אישור מנהל נדרש 🔒',
  description = 'לפתיחת הגדרות המערכת ופעולות רגישות, אנא הזן קוד מנהל (4 ספרות):',
  onSuccess,
  onClose,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setError(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerify = (passToTest: string) => {
    if (passToTest === ADMIN_PASSCODE) {
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setCode('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleVerify(code);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCode(val);
    if (error) setError(false);
    if (val.length === 4) {
      handleVerify(val);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-5 text-right animate-in zoom-in-95 duration-150"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-inner">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                {title}
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">אבטחת הגדרות ריזורט</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
          {description}
        </p>

        {/* Passcode Input */}
        <div className="space-y-2">
          <div className="relative">
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={code}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="••••"
              className={`w-full bg-white text-center text-3xl tracking-[1em] font-mono font-black py-3 rounded-2xl border-2 transition-all focus:outline-none ${
                error
                  ? 'border-rose-500 bg-rose-50 text-rose-700 animate-shake'
                  : 'border-slate-300 focus:border-emerald-600 text-slate-900 shadow-inner'
              }`}
            />
          </div>

          {error && (
            <div className="text-center text-xs font-bold text-rose-600 flex items-center justify-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>קוד שגוי. אנא נסה שוב.</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleVerify(code)}
            disabled={code.length === 0}
            className="py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>אישור כניסה</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all active:scale-98 flex items-center justify-center cursor-pointer border border-slate-200"
          >
            <span>ביטול</span>
          </button>
        </div>
      </div>
    </div>
  );
};
