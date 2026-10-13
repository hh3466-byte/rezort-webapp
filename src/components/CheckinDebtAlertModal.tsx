import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Phone, 
  Calendar, 
  User, 
  MessageSquare, 
  CreditCard, 
  LogIn, 
  ArrowRight,
  Banknote,
  ShieldAlert,
  Wallet
} from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import { formatDateIL } from '../utils/dateUtils';
import { getServiceTypeHebrew, generatePaymentReminderMessage, openWhatsAppMessage } from '../utils/whatsappUtils';

interface CheckinDebtAlertModalProps {
  isOpen: boolean;
  booking: Booking | null;
  settings: ResortSettings;
  onClose: () => void;
  onMarkPaidAndCheckin: (booking: Booking, method: 'cash' | 'grow', amountPaid: number) => void;
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
  const totalPrice = Number(booking?.totalPrice) || 0;
  const depositAmount = Number(booking?.depositAmount) || 0;
  const remainingDebt = Math.max(0, totalPrice - depositAmount);
  
  // Default cash amount is the remaining balance due (or totalPrice if 0 was paid)
  const defaultCashAmount = remainingDebt > 0 ? remainingDebt : totalPrice;
  const [cashAmountInput, setCashAmountInput] = useState<string>(String(defaultCashAmount));

  useEffect(() => {
    if (booking) {
      const debt = Math.max(0, (Number(booking.totalPrice) || 0) - (Number(booking.depositAmount) || 0));
      setCashAmountInput(String(debt > 0 ? debt : (Number(booking.totalPrice) || 0)));
    }
  }, [booking]);

  if (!isOpen || !booking) return null;

  const numericCashAmount = Math.max(0, Number(cashAmountInput) || 0);

  const handleSendWhatsApp = () => {
    const msg = generatePaymentReminderMessage(booking, settings);
    openWhatsAppMessage(booking.ownerPhone, msg);
  };

  const handleConfirmCash = () => {
    const amt = numericCashAmount > 0 ? numericCashAmount : defaultCashAmount;
    onMarkPaidAndCheckin(booking, 'cash', amt);
  };

  const handleConfirmDigital = () => {
    onMarkPaidAndCheckin(booking, 'grow', remainingDebt > 0 ? remainingDebt : totalPrice);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200" 
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border-2 border-amber-400/90 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-600 text-white p-4 sm:p-5 flex items-start justify-between gap-3 relative overflow-hidden shrink-0">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 text-white shadow-inner">
              <ShieldAlert className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white/25 text-white text-[11px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide">
                  קליטה לריזורט (צ׳ק-אין)
                </span>
                <span className="bg-red-500/90 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md animate-pulse">
                  חובת אימות תשלום
                </span>
              </div>
              <h3 className="font-black text-lg sm:text-xl mt-0.5">
                אימות תשלום עבור {booking.dogName} 🐾
              </h3>
              <p className="text-xs text-amber-100 mt-0.5">
                טרם אומת תשלום דיגיטלי מלא ב-Grow עבור שהייה זו. לא ניתן לדלג.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors cursor-pointer relative z-10"
            title="ביטול וסגירה"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          
          {/* Dog & Customer Details Card */}
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

          {/* Financial Balance Due Box */}
          <div className="bg-gradient-to-b from-red-50 to-orange-50/70 border-2 border-red-200 rounded-2xl p-4 text-center space-y-2 shadow-xs">
            <div className="text-xs font-bold text-red-800">
              {remainingDebt > 0 ? 'יתרת חוב לתשלום בקליטה:' : 'מחיר השהייה הכולל:'}
            </div>
            <div className="text-3xl sm:text-4xl font-black text-red-600 tracking-tight font-mono">
              ₪{(remainingDebt > 0 ? remainingDebt : totalPrice).toLocaleString('he-IL')}
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-red-200/80 text-xs">
              <div className="text-slate-600">
                סה״כ מחיר: <span className="font-bold text-slate-900 font-mono">₪{totalPrice.toLocaleString('he-IL')}</span>
              </div>
              <div className="text-slate-600">
                שולם עד כה: <span className="font-bold text-emerald-700 font-mono">₪{depositAmount.toLocaleString('he-IL')}</span>
              </div>
            </div>
          </div>

          <div className="text-xs font-black text-slate-800 text-center">
            כיצד מוסדר התשלום במעמד הקליטה? בחר אפשרות:
          </div>

          {/* 3 Explicit, Mandatory Paths */}
          <div className="space-y-3">
            
            {/* OPTION 1: CASH PAYMENT (מזומן בקופה) */}
            <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl p-3.5 space-y-2.5 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-emerald-950 text-sm">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <span>1. שולם במזומן בקופה לשמוליק</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  נרשם כ-מזומן
                </span>
              </div>

              {/* Editable cash amount input */}
              <div className="flex items-center gap-2 bg-white border border-emerald-300 rounded-xl p-2 shadow-inner">
                <span className="text-xs font-bold text-slate-600 shrink-0">סכום במזומן:</span>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₪</span>
                  <input
                    type="number"
                    min="0"
                    max={totalPrice * 2}
                    value={cashAmountInput}
                    onChange={(e) => setCashAmountInput(e.target.value)}
                    className="w-full text-left font-black text-emerald-900 font-mono text-base pl-7 pr-2 py-1 bg-transparent border-0 outline-hidden"
                    placeholder="0"
                  />
                </div>
                {numericCashAmount !== defaultCashAmount && (
                  <button
                    type="button"
                    onClick={() => setCashAmountInput(String(defaultCashAmount))}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-md shrink-0 cursor-pointer"
                  >
                    איפוס ליתרה (₪{defaultCashAmount})
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleConfirmCash}
                disabled={numericCashAmount <= 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                <span>אשר קליטה – שולם ₪{numericCashAmount.toLocaleString('he-IL')} במזומן בקופה</span>
              </button>
            </div>

            {/* OPTION 2: DIGITAL PAYMENT (Grow / Bit / העברה) */}
            <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-sky-950 text-xs sm:text-sm">
                  <div className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center">
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <span>2. הוסדר דיגיטלית (Grow / Bit / העברה)</span>
                </div>
                <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">
                  דיגיטלי
                </span>
              </div>
              <p className="text-[11px] text-sky-800">
                הלקוח שילם דרך לינק סליקה של Grow, ב-Bit או בהעברה בנקאית שאושרה.
              </p>
              <button
                type="button"
                onClick={handleConfirmDigital}
                className="w-full bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>אשר קליטה – הוסדר דיגיטלית (₪{defaultCashAmount.toLocaleString('he-IL')})</span>
              </button>
            </div>

            {/* OPTION 3: CHECK IN WITH OPEN DEBT (טרם שולם) */}
            <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-amber-950 text-xs sm:text-sm">
                  <div className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <span>3. הלקוח טרם שילם (קלוט עם חוב פתוח)</span>
                </div>
                <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">
                  חוב פתוח
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-snug">
                הכלב ייקלט לריזורט, אך יתרת החוב (₪{defaultCashAmount.toLocaleString('he-IL')}) תישאר פתוחה לגבייה ותוצג באורות האדומים ובשחרור.
              </p>
              <button
                type="button"
                onClick={() => onConfirmCheckinWithDebt(booking)}
                className="w-full bg-white hover:bg-amber-100/70 border border-amber-300 text-amber-950 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>קלוט בכל זאת עם חוב פתוח של ₪{defaultCashAmount.toLocaleString('he-IL')}</span>
              </button>
            </div>

            {/* Helper Quick Tool: Send WhatsApp Link */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>📱 שלח לינק לתשלום מאובטח בוואטסאפ ללקוח כעת</span>
              </button>
            </div>

            {/* Cancel Checkin (Abort) */}
            <div className="text-center pt-2 pb-1">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>ביטול – אל תקלוט את הכלב כעת (הכלב יישאר בממתינים לכניסה)</span>
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
