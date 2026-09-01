import React from 'react';
import { Sparkles, CheckCircle, X, ArrowLeft, CreditCard, Phone, Mail, User, ShieldCheck } from 'lucide-react';
import { GrowIncomingPayment } from '../types';

interface GrowPaymentsModalProps {
  pendingPayments: GrowIncomingPayment[];
  onAccept: (payment: GrowIncomingPayment) => void;
  onDismiss: (payment: GrowIncomingPayment) => void;
}

export const GrowPaymentsModal: React.FC<GrowPaymentsModalProps> = ({
  pendingPayments,
  onAccept,
  onDismiss,
}) => {
  if (!pendingPayments || pendingPayments.length === 0) return null;

  const current = pendingPayments[0]; // Process one at a time or show top one
  const totalPending = pendingPayments.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border-2 border-emerald-500 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200"
        dir="rtl"
      >
        {/* Glowing Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-5 sm:p-6 relative overflow-hidden">
          {/* Subtle animated background sparkle glow */}
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-amber-300/20 rounded-full blur-2xl" />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/30 text-2xl">
                💳
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/50 text-[11px] font-extrabold text-emerald-100 border border-emerald-300/30 mb-1">
                  <Sparkles className="w-3 h-3 text-amber-300 animate-spin" />
                  <span>סונכרן אוטומטית מ-GROW (Gmail)</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  התקבל תשלום חדש!
                </h3>
              </div>
            </div>

            {totalPending > 1 && (
              <span className="bg-amber-400 text-slate-900 font-extrabold text-xs px-2.5 py-1 rounded-full shadow-xs">
                {totalPending} תשלומים ממתינים
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
            
            {/* Amount & Method Banner */}
            <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-bold text-slate-600">סכום ששולם:</span>
              </div>
              <div className="text-xl font-black text-emerald-700">
                ₪{current.amount.toLocaleString()}
                <span className="text-xs font-medium text-slate-500 mr-1.5">
                  ({current.payment_method || 'Bit'})
                </span>
              </div>
            </div>

            {/* Customer Details extracted from email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
              <div className="flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-slate-100">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="overflow-hidden">
                  <span className="text-slate-400 block text-[10px]">שם הלקוח:</span>
                  <span className="font-bold text-slate-800 truncate block">{current.customer_name}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-slate-100">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="overflow-hidden">
                  <span className="text-slate-400 block text-[10px]">טלפון:</span>
                  <span className="font-bold text-slate-800 font-mono block">{current.customer_phone}</span>
                </div>
              </div>

              {current.customer_email && (
                <div className="sm:col-span-2 flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-slate-100">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="overflow-hidden">
                    <span className="text-slate-400 block text-[10px]">אימייל:</span>
                    <span className="font-bold text-slate-800 truncate block">{current.customer_email}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Reference & Anti-Duplicate Tag */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 px-1">
              <span className="flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                אסמכתא: {current.reference_id}
              </span>
              <span className="text-[10px] text-slate-400">
                {new Date(current.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 text-center leading-relaxed">
            💡 <strong>נשאר רק:</strong> להזין שם כלב, לבחור תאריכים וסוג שירות (פנסיון / אילוף).
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => onDismiss(current)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
          >
            התעלם / טופל ידנית
          </button>

          <button
            type="button"
            onClick={() => onAccept(current)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer transform active:scale-98"
          >
            <span>הקם והשלם הזמנה עכשיו</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
