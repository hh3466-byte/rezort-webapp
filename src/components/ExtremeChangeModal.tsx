import React from 'react';
import { AlertTriangle, ShieldAlert, Check, X, ArrowLeft, ArrowRight } from 'lucide-react';

export interface ExtremeChangeImpact {
  label: string;
  oldValue?: string | number;
  newValue: string | number;
  warningNote?: string;
}

interface ExtremeChangeModalProps {
  isOpen: boolean;
  title?: string;
  description: string;
  impacts?: ExtremeChangeImpact[];
  confirmText?: string;
  cancelText?: string;
  severity?: 'warning' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ExtremeChangeModal: React.FC<ExtremeChangeModalProps> = ({
  isOpen,
  title = 'שינוי מהותי במערכת — נדרש אישור',
  description,
  impacts = [],
  confirmText = 'כן, אני בטוח — בצע את השינוי',
  cancelText = 'ביטול וחזרה (אל תשנה)',
  severity = 'warning',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const isDanger = severity === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200 text-right"
        dir="rtl"
      >
        {/* Header with Warning Icon */}
        <div className="flex items-start gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-inner ${
            isDanger 
              ? 'bg-rose-100 text-rose-600 border border-rose-200' 
              : 'bg-amber-100 text-amber-600 border border-amber-200'
          }`}>
            {isDanger ? <ShieldAlert className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 leading-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              המערכת זיהתה שינוי קיצוני או רגיש בהגדרות / נתונים. אנא ודא שזהו רצונך.
            </p>
          </div>
        </div>

        {/* Explanation Box */}
        <div className={`p-4 rounded-2xl border text-sm font-medium leading-relaxed ${
          isDanger
            ? 'bg-rose-50/80 border-rose-200 text-rose-900'
            : 'bg-amber-50/80 border-amber-200 text-amber-900'
        }`}>
          {description}
        </div>

        {/* Impact Differences Breakdown */}
        {impacts.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700">פירוט השינויים שזוהו:</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
              {impacts.map((item, idx) => (
                <div 
                  key={idx} 
                  className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-slate-800">{item.label}</span>
                  <div className="flex items-center gap-2 font-mono">
                    {item.oldValue !== undefined && (
                      <>
                        <span className="line-through text-slate-400 font-medium">{item.oldValue}</span>
                        <span className="text-slate-400">←</span>
                      </>
                    )}
                    <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                      {item.newValue}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmation Question */}
        <div className="bg-slate-100/70 p-3 rounded-xl text-center text-xs font-bold text-slate-700">
          ❓ האם אתה בטוח שברצונך להחיל את השינוי הזה עכשיו?
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={onConfirm}
            className={`w-full py-3 px-4 rounded-xl text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer ${
              isDanger 
                ? 'bg-rose-600 hover:bg-rose-700' 
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{confirmText}</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer border border-slate-300"
          >
            <X className="w-4 h-4" />
            <span>{cancelText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
