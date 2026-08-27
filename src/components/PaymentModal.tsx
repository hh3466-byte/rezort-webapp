import React, { useState } from 'react';
import { 
  X, 
  CreditCard, 
  DollarSign, 
  CheckCircle2, 
  Dog, 
  User, 
  MessageSquare,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Booking, PaymentMethod, ResortSettings } from '../types';
import { generatePaymentReminderMessage, openWhatsAppMessage } from '../utils/whatsappUtils';

interface PaymentModalProps {
  booking: Booking | null;
  settings: ResortSettings;
  onClose: () => void;
  onSavePayment: (bookingId: string, addedAmount: number, method: PaymentMethod, notes?: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  booking,
  settings,
  onClose,
  onSavePayment,
}) => {
  if (!booking) return null;

  const currentDebt = Math.max(0, booking.totalPrice - booking.depositAmount);
  const [payAmount, setPayAmount] = useState<number>(currentDebt);
  const [method, setMethod] = useState<PaymentMethod>(booking.paymentMethod || 'bit');
  const [receiptNotes, setReceiptNotes] = useState('');

  const handlePayFull = () => {
    setPayAmount(currentDebt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) {
      alert('נא להזין סכום תשלום חיובי');
      return;
    }

    // Trigger celebration confetti if paying off the full debt
    if (payAmount >= currentDebt) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    onSavePayment(booking.id, payAmount, method, receiptNotes);
    onClose();
  };

  const handleWhatsApp = () => {
    const msg = generatePaymentReminderMessage(booking, settings);
    openWhatsAppMessage(booking.ownerPhone, msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 text-slate-900">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 border border-green-200 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">רישום תשלום ומקדמה</h3>
              <p className="text-xs text-slate-500">עבור {booking.dogName} ({booking.ownerName})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Balance Summary Card */}
        <div className="my-4 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span>עלות כוללת:</span>
            <span className="font-bold text-slate-900 text-sm">₪{booking.totalPrice}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>שולם עד כה:</span>
            <span className="font-bold text-green-600">₪{booking.depositAmount}</span>
          </div>
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold">
            <span className="text-slate-700">יתרת חוב פתוחה:</span>
            <span className="text-red-500 text-sm">₪{currentDebt}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-700 font-bold">
                סכום התשלום עכשיו (₪) *
              </label>
              {currentDebt > 0 && (
                <button
                  type="button"
                  onClick={handlePayFull}
                  className="text-[11px] text-green-700 hover:underline cursor-pointer font-bold"
                >
                  מלא את יתרת כל החוב (₪{currentDebt})
                </button>
              )}
            </div>
            <input
              type="number"
              min="1"
              max={currentDebt > 0 ? currentDebt : booking.totalPrice}
              value={payAmount === 0 ? '' : payAmount}
              onChange={(e) => setPayAmount(e.target.value === '' ? 0 : Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full bg-white text-slate-900 font-extrabold text-base px-3 py-2.5 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-slate-700 font-bold block mb-1">
              אמצעי תשלום
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full bg-white text-slate-900 text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none cursor-pointer"
            >
              <option value="bit">ביט (Bit)</option>
              <option value="paybox">פייבוקס (PayBox)</option>
              <option value="cash">מזומן</option>
              <option value="credit">כרטיס אשראי</option>
              <option value="bank_transfer">העברה בנקאית</option>
              <option value="other">אחר</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">
              אסמכתא / הערה (אופציונלי)
            </label>
            <input
              type="text"
              value={receiptNotes}
              onChange={(e) => setReceiptNotes(e.target.value)}
              placeholder="מספר אישור, קבלה וכו'..."
              className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleWhatsApp}
              className="text-xs text-green-700 hover:text-green-900 flex items-center gap-1 py-2 px-2.5 rounded-xl bg-green-50 hover:bg-green-100 transition-colors border border-green-200 cursor-pointer font-bold"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>שלח בוואטסאפ</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                בטל
              </button>

              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 active:scale-98 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>שמור תשלום</span>
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
