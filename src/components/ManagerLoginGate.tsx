import React, { useState, useRef, useEffect } from 'react';
import { Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { ADMIN_PASSCODE } from './ManagerAuthModal';

interface ManagerLoginGateProps {
  onSuccess: (rememberDevice: boolean) => void;
  onGoToPublicIntake: () => void;
}

export const ManagerLoginGate: React.FC<ManagerLoginGateProps> = ({
  onSuccess,
  onGoToPublicIntake
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleVerify = (val: string) => {
    if (val === ADMIN_PASSCODE) {
      setError(false);
      onSuccess(rememberDevice);
    } else {
      setError(true);
      setCode('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleVerify(code);
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (code.length < 4) {
      const next = code + digit;
      setCode(next);
      if (error) setError(false);
      if (next.length === 4) {
        handleVerify(next);
      }
    }
  };

  const handleKeypadBackspace = () => {
    setCode(prev => prev.slice(0, -1));
    if (error) setError(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-white" dir="rtl">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="max-w-sm w-full bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 relative z-10 space-y-6 text-center animate-in zoom-in-95 duration-200">
        
        {/* Brand Logo & Lock Icon */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <img 
              src="/resort-logo.svg" 
              alt="הריזורט לכלב" 
              className="w-16 h-16 object-contain drop-shadow-md" 
            />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-700 text-white rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            יומן הריזורט לכלב 🐕
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            כניסת צוות ומנהלים בלבד • נתונים מאובטחים
          </p>
        </div>

        {/* Form Container */}
        <div className="space-y-4">
          <label className="block text-xs font-bold text-slate-700">
            הזן קוד גישה מנהל (4 ספרות):
          </label>

          {/* Hidden/Real input */}
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={code}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="opacity-0 absolute -z-10"
            autoFocus
          />

          {/* 4 Digit Visual Display Boxes */}
          <div 
            onClick={() => inputRef.current?.focus()}
            className="flex justify-center gap-3 cursor-pointer py-1"
          >
            {[0, 1, 2, 3].map(idx => {
              const char = code[idx];
              const isCurrent = code.length === idx;
              return (
                <div
                  key={idx}
                  className={`w-12 h-14 rounded-2xl flex items-center justify-center text-2xl font-black font-mono transition-all duration-150 ${
                    char
                      ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-900 shadow-xs'
                      : isCurrent
                      ? 'bg-white border-2 border-emerald-400 ring-2 ring-emerald-200'
                      : 'bg-slate-50 border border-slate-200 text-slate-300'
                  } ${error ? 'border-red-500 bg-red-50 text-red-600 animate-shake' : ''}`}
                >
                  {char ? '•' : ''}
                </div>
              );
            })}
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-xs font-bold text-red-600 flex items-center justify-center gap-1.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span>קוד מנהל שגוי. אנא נסה שוב.</span>
            </div>
          )}

          {/* Remember Device Option */}
          <div className="flex items-center justify-center gap-2 pt-1 text-xs text-slate-600">
            <input
              type="checkbox"
              id="remember-device"
              checked={rememberDevice}
              onChange={e => setRememberDevice(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
            />
            <label htmlFor="remember-device" className="cursor-pointer select-none font-medium">
              זכור מכשיר זה (שמור מחובר)
            </label>
          </div>

          {/* Numeric Keypad for Touch / Mobile Devices */}
          <div className="grid grid-cols-3 gap-2 pt-2 max-w-[240px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(num)}
                className="h-12 bg-slate-50 hover:bg-slate-100 active:bg-emerald-100 text-slate-800 font-bold text-lg rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer select-none"
              >
                {num}
              </button>
            ))}
            <div />
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="h-12 bg-slate-50 hover:bg-slate-100 active:bg-emerald-100 text-slate-800 font-bold text-lg rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer select-none"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleKeypadBackspace}
              className="h-12 bg-slate-100 hover:bg-slate-200 active:bg-red-50 text-slate-600 font-bold text-sm rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer select-none flex items-center justify-center"
              title="מחק ספרה אחרונה"
            >
              ⌫
            </button>
          </div>
        </div>

        {/* Public Client Alternative Gateway */}
        <div className="pt-4 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 font-medium mb-2">
            הגעת לכאן בטעות ואתה לקוח הריזורט?
          </p>
          <button
            type="button"
            onClick={onGoToPublicIntake}
            className="w-full bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>מעבר לשאלון בקשת קליטה ושריון מקום 🐾</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
