import React from 'react';
import { X, AlertTriangle, CheckCircle, Phone, Calendar, User, MessageSquare, CreditCard, LogIn, ArrowRight } from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import { formatDateIL } from '../utils/dateUtils';
import { getServiceTypeHebrew, generatePaymentReminderMessage, openWhatsAppMessage } from '../utils/whatsappUtils';

interface CheckinDebtAlertModalProps {
  isOpen: boolean;
  booking: Booking | null;
  settings: ResortSettings;
  onClose: () => void;
  onMarkPaidAndCheckin: (booking: Booking) => void;
  onConfirmCheckinWithDebt: (booking: Booking) => void;
  onOpenPaymentModal?: (booking: Booking) => void;
}

export const CheckinDebtAlertModal: React.FC<CheckinDebtAlertModalProps> = ({
  isOpen,
  booking,
  settings,
  onClose,
  onMarkPaidAndCheckin,
  onConfirmCheckinWithDebt,
  onOpenPaymentModal,
}) => {
  if (!isOpen || !booking) return null;

  const totalPrice = Number(booking.totalPrice) || 0;
  const depositAmount = Number(booking.depositAmount) || 0;
  const remainingDebt = Math.max(0, totalPrice - depositAmount);

  const handleSendWhatsApp = () => {
    const msg = generatePaymentReminderMessage(booking, settings);
    openWhatsAppMessage(booking.ownerPhone, msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white border border-amber-300 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-600 text-white p-4 sm:p-5 flex items-start justify-between gap-3 relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 text-white shadow-inner">
              <LogIn className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white/25 text-white text-[11px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide">
                  קליטה לריזורט (צ׳ק-אין)
                </span>
                <h3 className="font-black text-lg sm:text-xl">
                  יתרת חוב לתשלום בקליטה! 🐾
                </h3>
              </div>
              <p className="text-xs text-amber-100 mt-0.5">
                שימו לב: עבור שהיית <strong>{booking.dogName}</strong> טרם הוסדר מלוא התשלום.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors cursor-pointer relative z-10"
            title="סגור חלון"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4">
          
          {/* Dog & Customer Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-slate-900">{booking.dogName}</span>
                {booking.dogBreed && (
                  <span className="text-xs text-slate-500 font-medium">({booking.dogBreed})</span>
                )}
              </div>
              <span className="text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {getServiceTypeHebrew(booking.serviceType)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1 border-t border-slate-200/60">
              <span className="flex items-center gap-1 font-semibold text-slate-800">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                {booking.ownerName}
              </span>
              <span className="flex items-center gap-1 font-mono text-slate-800 font-bold" dir="ltr">
                <Phone className="w-3.5 h-3.5 text-green-600" />
                {booking.ownerPhone}
              </span>
              <span className="flex items-center gap-1 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                {formatDateIL(booking.startDate)} עד {formatDateIL(booking.endDate)}
              </span>
            </div>
          </div>

          {/* Outstanding Debt Amount Box */}
          <div className="bg-gradient-to-b from-red-50 to-orange-50/60 border-2 border-red-200 rounded-2xl p-4 text-center space-y-2 shadow-xs">
            <div className="text-xs font-bold text-red-800">יתרה שטרם שולמה עבור השהייה:</div>
            <div className="text-3xl sm:text-4xl font-black text-red-600 tracking-tight font-mono">
              ₪{remainingDebt.toLocaleString('he-IL')}
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-red-200/80 text-xs">
              <div className="text-slate-600">
                סה״כ מחיר: <span className="font-bold text-slate-900 font-mono">₪{totalPrice.toLocaleString('he-IL')}</span>
              </div>
              <div className="text-slate-600">
                שולמה מקדמה: <span className="font-bold text-emerald-700 font-mono">₪{depositAmount.toLocaleString('he-IL')}</span>
              </div>
            </div>
          </div>

          <p className="text-xs font-bold text-slate-700 text-center">
            האם הלקוח משלם את היתרה כעת במעמד הקליטה, או לקלוט עם חוב פתוח?
          </p>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            {/* 1. Mark Paid & Check In */}
            <button
              type="button"
              onClick={() => onMarkPaidAndCheckin(booking)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white py-3 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <CheckCircle className="w-5 h-5 stroke-[2.5]" />
              <span>הלקוח שילם הכל כעת (מזומן/ביט/אשראי) – קלוט כשולם</span>
            </button>

            {/* 2. Check in keeping debt open */}
            <button
              type="button"
              onClick={() => onConfirmCheckinWithDebt(booking)}
              className="w-full bg-slate-100 hover:bg-amber-50 hover:border-amber-300 text-slate-800 hover:text-amber-950 border border-slate-200 py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>קלוט לריזורט בכל זאת (החוב יופיע כחוב פתוח לגבייה)</span>
            </button>

            {/* 3. Helper Tools */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>שלח לינק לתשלום</span>
              </button>

              {onOpenPaymentModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPaymentModal(booking);
                  }}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                  <span>רישום סכום חלקי</span>
                </button>
              )}
            </div>

            {/* Cancel Checkin */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>ביטול – אל תקלוט את הכלב עדיין</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
