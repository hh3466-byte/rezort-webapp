import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Phone, Calendar, User, MessageSquare, CreditCard, ShieldAlert, Home, Star } from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import { formatDateIL } from '../utils/dateUtils';
import { getServiceTypeHebrew, generatePaymentReminderMessage, openWhatsAppMessage } from '../utils/whatsappUtils';

interface CheckoutDebtAlertModalProps {
  isOpen: boolean;
  booking: Booking | null;
  settings: ResortSettings;
  onClose: () => void;
  onMarkPaidAndRelease: (booking: Booking, skipReview?: boolean) => void;
  onConfirmReleaseWithDebt: (booking: Booking, skipReview?: boolean) => void;
  onConfirmReleaseDirect?: (booking: Booking, skipReview?: boolean) => void;
  onOpenPaymentModal?: (booking: Booking) => void;
}

export const CheckoutDebtAlertModal: React.FC<CheckoutDebtAlertModalProps> = ({
  isOpen,
  booking,
  settings,
  onClose,
  onMarkPaidAndRelease,
  onConfirmReleaseWithDebt,
  onConfirmReleaseDirect,
  onOpenPaymentModal,
}) => {
  const [skipReview, setSkipReview] = useState<boolean>(false);

  useEffect(() => {
    if (booking) {
      setSkipReview(Boolean(booking.skipReviewRequest || (booking.notes && booking.notes.indexOf('ללא_סקר') !== -1)));
    }
  }, [booking]);

  if (!isOpen || !booking) return null;

  const totalPrice = Number(booking.totalPrice) || 0;
  const depositAmount = Number(booking.depositAmount) || 0;
  const remainingDebt = Math.max(0, totalPrice - depositAmount);
  const hasDebt = remainingDebt > 0 && booking.paymentStatus !== 'fully_paid';

  const handleSendWhatsApp = () => {
    const msg = generatePaymentReminderMessage(booking, settings);
    openWhatsAppMessage(booking.ownerPhone, msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div className={`bg-white border ${hasDebt ? 'border-red-200' : 'border-emerald-200'} rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200`}>
        
        {/* Top Header Banner */}
        <div className={`${hasDebt ? 'bg-red-600' : 'bg-emerald-600'} text-white p-4 sm:p-5 flex items-start justify-between gap-3 relative overflow-hidden`}>
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 text-white shadow-inner">
              {hasDebt ? (
                <ShieldAlert className="w-7 h-7 stroke-[2.5]" />
              ) : (
                <Home className="w-7 h-7 stroke-[2.5]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white/25 text-white text-[11px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide">
                  {hasDebt ? 'שים לב – חוב פתוח' : 'שחרור הביתה'}
                </span>
                <h3 className="font-black text-lg sm:text-xl">
                  {hasDebt ? 'יתרת חוב פתוחה בשחרור!' : `שחרור ${booking.dogName} הביתה 🏡`}
                </h3>
              </div>
              <p className="text-xs text-white/90 mt-0.5">
                {hasDebt 
                  ? 'הכלב עומד להשתחרר כעת, אך טרם הוסדר מלוא התשלום עבור השהייה.'
                  : 'הכלב מוכן לשחרור! התשלום מוסדר במלואו.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors cursor-pointer relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4">
          
          {/* Dog & Customer Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-slate-900">{booking.dogName}</span>
                {booking.dogBreed && (
                  <span className="text-xs text-slate-500 font-medium">({booking.dogBreed})</span>
                )}
              </div>
              <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full">
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

          {/* Payment Info Box */}
          {hasDebt ? (
            <div className="bg-red-50/80 border-2 border-red-200 rounded-2xl p-4 text-center space-y-2">
              <div className="text-xs font-bold text-red-800">יתרת חוב פתוחה לתשלום:</div>
              <div className="text-3xl sm:text-4xl font-black text-red-600 tracking-tight">
                ₪{remainingDebt.toLocaleString('he-IL')}
              </div>
              
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-red-200/80 text-xs">
                <div className="text-slate-600">
                  סה״כ מחיר: <span className="font-bold text-slate-900">₪{totalPrice.toLocaleString('he-IL')}</span>
                </div>
                <div className="text-slate-600">
                  שולם עד כה: <span className="font-bold text-green-700">₪{depositAmount.toLocaleString('he-IL')}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-emerald-950 block">התשלום מוסדר במלואו</span>
                  <span className="text-emerald-700">סה״כ שולם: ₪{depositAmount.toLocaleString('he-IL')} | אין חוב פתוח</span>
                </div>
              </div>
              <span className="bg-emerald-200 text-emerald-900 font-black px-2.5 py-1 rounded-lg">
                0 ₪ חוב
              </span>
            </div>
          )}

          {/* Review Request Cancellation Option (User requested feature!) */}
          <div className={`p-3.5 rounded-2xl border transition-all ${
            skipReview 
              ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/30' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={skipReview}
                onChange={(e) => setSkipReview(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-red-600 focus:ring-red-500 border-slate-300 cursor-pointer"
              />
              <div className="flex-1">
                <div className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <span>🚫 בטל שליחת בקשת חוות דעת ופינוק VIP</span>
                  {skipReview && (
                    <span className="text-[10px] bg-red-100 text-red-700 font-black px-2 py-0.5 rounded-md">
                      מבוטל ללקוח זה!
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  סמן אפשרות זו אם בעל הכלב לא הסתדר איתנו או שלא היה מרוצה, כדי שהמערכת לא תשלח לו מחר הודעת דירוג וסקר בוואטסאפ.
                </p>
              </div>
            </label>
          </div>

          {/* Main Action Buttons */}
          <div className="space-y-2 pt-1">
            {hasDebt ? (
              <>
                <p className="text-xs font-bold text-slate-700 text-center mb-1">
                  האם הלקוח שילם כעת (מזומן / ביט / אשראי), או שברצונך לשחרר בכל זאת?
                </p>
                {/* Primary Action: Mark Paid & Release */}
                <button
                  type="button"
                  onClick={() => onMarkPaidAndRelease(booking, skipReview)}
                  className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white py-3 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <CheckCircle className="w-5 h-5 stroke-[2.5]" />
                  <span>סמן כשולם במלואו וסגור שחרור הביתה</span>
                </button>

                {/* Release without payment (keeping debt open) */}
                <button
                  type="button"
                  onClick={() => onConfirmReleaseWithDebt(booking, skipReview)}
                  className="w-full bg-slate-100 hover:bg-amber-50 hover:border-amber-300 text-slate-700 hover:text-amber-900 border border-slate-200 py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>שחרר הביתה ללא תשלום (החוב יישאר פתוח ביומן)</span>
                </button>

                {/* Helper tools: Send WhatsApp & Partial Payment */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>וואטסאפ ללקוח</span>
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
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (onConfirmReleaseDirect) {
                      onConfirmReleaseDirect(booking, skipReview);
                    } else {
                      onConfirmReleaseWithDebt(booking, skipReview);
                    }
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <Home className="w-5 h-5 stroke-[2.5]" />
                  <span>אשר שחרור הביתה 🏡</span>
                </button>
              </>
            )}

            {/* Cancel release */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
              >
                ביטול – אל תשחרר את הכלב עדיין
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
