import React, { useState } from 'react';
import { 
  X, 
  CreditCard, 
  Send, 
  MessageSquare, 
  Copy, 
  Check, 
  Sparkles,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import { formatDateIL, calculateDaysCount } from '../utils/dateUtils';
import { cleanPhoneNumber, getFirstName, getServiceTypeHebrew } from '../utils/whatsappUtils';
import { sendGreenApiDirectMessage } from '../services/notificationService';

interface SendPaymentLinkModalProps {
  isOpen: boolean;
  booking: Booking | null;
  settings: ResortSettings;
  onClose: () => void;
  onSentSuccess?: (msg: string) => void;
}

export const SendPaymentLinkModal: React.FC<SendPaymentLinkModalProps> = ({
  isOpen,
  booking,
  settings,
  onClose,
  onSentSuccess,
}) => {
  if (!isOpen || !booking) return null;

  const currentDebt = Math.max(0, (Number(booking.totalPrice) || 0) - (Number(booking.depositAmount) || 0));
  const initialAmount = currentDebt > 0 ? currentDebt : Number(booking.totalPrice) || 0;

  const [amount, setAmount] = useState<number>(initialAmount);
  const [customLink, setCustomLink] = useState<string>(() => {
    return (
      settings.growPaymentLink || 
      settings.payboxPaymentLink || 
      settings.payboxLink || 
      'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg'
    );
  });
  const [isSending, setIsSending] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  const cleanPhone = cleanPhoneNumber(booking.ownerPhone);
  const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
  const firstName = getFirstName(booking.ownerName);
  const serviceHebrew = getServiceTypeHebrew(booking.serviceType);
  const stayDates = `${formatDateIL(booking.startDate)} עד ${formatDateIL(booking.endDate)}`;

  let linkToUse = (customLink || '').trim();
  if (linkToUse.startsWith('//')) {
    linkToUse = 'https:' + linkToUse;
  } else if (!linkToUse.startsWith('http://') && !linkToUse.startsWith('https://')) {
    linkToUse = 'https://' + linkToUse;
  }

  // Construct official payment message
  const generateMessage = () => {
    const amountSection = amount > 0 ? `\n💰 *הסכום לתשלום:* ₪${amount}\n` : '';
    const amountHint = amount > 0 ? ` (יש להזין ₪${amount} בעמוד התשלום)` : '';

    return `היי ${firstName}! 🐾
שמחים לעדכן שהמקום עבור *${booking.dogName}* (${serviceHebrew}) שוריין בריזורט לכלב לתאריכים:
📅 ${stayDates}.${amountSection}
להשלמת השריון / הסדרת התשלום, מצורף הקישור המאובטח לתשלום${amountHint}:
👉 ${linkToUse}

(בתוך הקישור ניתן לשלם בנוחות ב-Bit, Apple Pay, Google Pay או כרטיס אשראי)

⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:00 - 19:00*
• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:00
• מעבר לשעות הפעילות (לפני 09:00 ואחרי 19:00), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾

נשמח לראותכם בריזורט! 🐕🤍
צוות הריזורט לכלב`;
  };

  const messageText = generateMessage();

  // Send via automated Green-API direct to WhatsApp
  const handleSendGreenApi = async () => {
    setIsSending(true);
    setSendStatus(null);

    try {
      const res = await sendGreenApiDirectMessage(
        cleanPhone,
        messageText,
        settings.greenApiIdInstance,
        settings.greenApiToken
      );

      if (res && res.success) {
        setSendStatus('הודעה עם הקישור נשלחה בהצלחה ישירות לוואטסאפ של הלקוח! 🟢');
        if (onSentSuccess) {
          onSentSuccess(`קישור לתשלום נשלח בהצלחה ל-${booking.ownerName} בוואטסאפ`);
        }
        setTimeout(() => {
          onClose();
        }, 1600);
      } else {
        // Fallback to direct WhatsApp web/app
        handleOpenWhatsApp();
      }
    } catch (err) {
      console.warn('Green-API send error, falling back to manual whatsapp:', err);
      handleOpenWhatsApp();
    } finally {
      setIsSending(false);
    }
  };

  // Open direct WhatsApp chat with prefilled message
  const handleOpenWhatsApp = () => {
    const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(messageText)}`;
    const win = window.open(waUrl, '_blank');
    if (!win) {
      window.location.href = waUrl;
    }
    if (onSentSuccess) {
      onSentSuccess(`חלון הוואטסאפ נפתח עם קישור התשלום עבור ${booking.ownerName}`);
    }
    onClose();
  };

  // Copy message to clipboard
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(messageText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-lg w-full p-4 sm:p-6 text-slate-900 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center font-black text-lg shadow-2xs">
              💳
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900">
                שליחת קישור לתשלום (Grow / Bit)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                עבור {booking.dogName} ({booking.ownerName} • {booking.ownerPhone})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3.5">
          
          {/* Booking Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-600">
              <span>שירות ותאריכים:</span>
              <span className="font-bold text-slate-900">{serviceHebrew} ({stayDates})</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>עלות כוללת בהזמנה:</span>
              <span className="font-black text-slate-900">₪{booking.totalPrice}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>שולם עד כה:</span>
              <span className="font-bold text-emerald-600">₪{booking.depositAmount}</span>
            </div>
            <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-700">יתרת חוב נוכחית:</span>
              <span className={`font-black text-sm ${currentDebt > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                ₪{currentDebt}
              </span>
            </div>
          </div>

          {/* Amount to request */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-extrabold text-slate-800">
                סכום לתשלום בקישור (₪) *
              </label>
              {currentDebt > 0 && currentDebt !== amount && (
                <button
                  type="button"
                  onClick={() => setAmount(currentDebt)}
                  className="text-[11px] text-emerald-700 hover:underline font-bold cursor-pointer"
                >
                  הגדר למלוא יתרת החוב (₪{currentDebt})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-black text-slate-400">₪</span>
              <input
                type="number"
                min="1"
                value={amount === 0 ? '' : amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full bg-white text-slate-900 font-black text-base pr-8 pl-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Payment Link URL */}
          <div>
            <label className="text-xs font-extrabold text-slate-800 block mb-1">
              קישור לתשלום (Grow / Bit / אשראי):
            </label>
            <input
              type="text"
              value={customLink}
              onChange={(e) => setCustomLink(e.target.value)}
              placeholder="https://pay.grow.link/..."
              className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Preview of Message */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-extrabold text-slate-700">
                תצוגה מקדימה של ההודעה שתישלח ללקוח:
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'הועתק!' : 'העתק'}</span>
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-700 whitespace-pre-line max-h-36 overflow-y-auto font-sans leading-relaxed">
              {messageText}
            </div>
          </div>

          {sendStatus && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl p-2.5 text-xs font-bold flex items-center gap-2">
              <span>{sendStatus}</span>
            </div>
          )}

        </div>

        {/* Action Buttons Footer */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer order-2 sm:order-1 text-center"
          >
            סגור
          </button>

          <div className="flex items-center gap-2 order-1 sm:order-2">
            {/* WhatsApp App / Web button */}
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="flex-1 sm:flex-initial bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold px-3 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="פתח שיחת וואטסאפ עם ההודעה מוכנה לשליחה"
            >
              <MessageSquare className="w-4 h-4 text-emerald-700" />
              <span>פתח בוואטסאפ</span>
            </button>

            {/* Direct Green-API button */}
            <button
              type="button"
              onClick={handleSendGreenApi}
              disabled={isSending}
              className="flex-1 sm:flex-initial bg-[#065f46] hover:bg-[#044e45] active:scale-95 text-white text-xs font-black px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="שלח ישירות דרך Green-API ללא פתיחת וואטסאפ"
            >
              <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-spin' : ''}`} />
              <span>{isSending ? 'שולח...' : 'שלח עכשיו 🟢'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
