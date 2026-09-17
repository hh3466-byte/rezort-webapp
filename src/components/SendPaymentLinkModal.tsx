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
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const cleanPhone = cleanPhoneNumber(booking.ownerPhone);
  const intlPhone = cleanPhone.startsWith('0') 
    ? '972' + cleanPhone.substring(1) 
    : (cleanPhone.startsWith('5') && cleanPhone.length === 9 ? '972' + cleanPhone : cleanPhone);
  const firstName = getFirstName(booking.ownerName);
  const serviceHebrew = getServiceTypeHebrew(booking.serviceType);
  const stayDates = `${formatDateIL(booking.startDate)} עד ${formatDateIL(booking.endDate)}`;

  // Helper to format link
  const formatLink = (rawLink: string) => {
    let clean = (rawLink || '').trim();
    if (clean.startsWith('//')) {
      clean = 'https:' + clean;
    } else if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    return clean;
  };

  // Construct official payment message
  const buildDefaultMessage = (amt: number, rawLink: string) => {
    const formattedLink = formatLink(rawLink);
    const amountSection = amt > 0 ? `\n💰 *הסכום לתשלום:* ₪${amt}\n` : '';
    const amountHint = amt > 0 ? ` (יש להזין ₪${amt} בעמוד התשלום)` : '';

    return `היי ${firstName}! 🐾
שמחים לעדכן שהמקום עבור *${booking.dogName}* (${serviceHebrew}) שוריין בריזורט לכלב לתאריכים:
📅 ${stayDates}.${amountSection}
להשלמת השריון / הסדרת התשלום, מצורף הקישור המאובטח לתשלום${amountHint}:
👉 ${formattedLink}

(בתוך הקישור ניתן לשלם בנוחות ב-Bit, Apple Pay, Google Pay או כרטיס אשראי)

⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:00 - 19:00*
• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:00
• מעבר לשעות הפעילות (לפני 09:00 ואחרי 19:00), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾

נשמח לראותכם בריזורט! 🐕🤍
צוות הריזורט לכלב`;
  };

  const [messageText, setMessageText] = useState<string>(() => buildDefaultMessage(initialAmount, customLink));
  const [isManuallyEdited, setIsManuallyEdited] = useState<boolean>(false);

  const handleAmountChange = (newAmt: number) => {
    setAmount(newAmt);
    if (!isManuallyEdited) {
      setMessageText(buildDefaultMessage(newAmt, customLink));
    }
  };

  const handleLinkChange = (newLink: string) => {
    setCustomLink(newLink);
    if (!isManuallyEdited) {
      setMessageText(buildDefaultMessage(amount, newLink));
    }
  };

  const handleResetToDefault = () => {
    setMessageText(buildDefaultMessage(amount, customLink));
    setIsManuallyEdited(false);
  };

  const whatsappUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(messageText)}`;

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
        setSendStatus({
          type: 'success',
          text: `ההודעה עם הקישור נשלחה בהצלחה ישירות לוואטסאפ של ${booking.ownerName}! 🟢`
        });
        if (onSentSuccess) {
          onSentSuccess(`קישור לתשלום נשלח בהצלחה ל-${booking.ownerName} בוואטסאפ`);
        }
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setSendStatus({
          type: 'error',
          text: res?.error || 'השליחה האוטומטית נכשלה. באפשרותך ללחוץ על "פתח בוואטסאפ" או להעתיק את ההודעה.'
        });
      }
    } catch (err: any) {
      setSendStatus({
        type: 'error',
        text: `שגיאת תקשורת: ${err?.message || String(err)}`
      });
    } finally {
      setIsSending(false);
    }
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
                  onClick={() => handleAmountChange(currentDebt)}
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
                onChange={(e) => handleAmountChange(Number(e.target.value) || 0)}
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
              onChange={(e) => handleLinkChange(e.target.value)}
              placeholder="https://pay.grow.link/..."
              className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Editable Message Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>הודעה לבקשת תשלום (ניתנת לעריכה חופשית):</span>
              </label>
              <div className="flex items-center gap-2">
                {isManuallyEdited && (
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="text-[11px] text-amber-700 hover:text-amber-900 underline font-bold cursor-pointer transition-colors"
                    title="שחזר לנוסח ברירת המחדל המקורי"
                  >
                    שחזר נוסח מקורי
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-colors"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'הועתק!' : 'העתק'}</span>
                </button>
              </div>
            </div>
            <textarea
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                setIsManuallyEdited(true);
              }}
              rows={8}
              placeholder="כתוב כאן את הודעת בקשת התשלום..."
              className="w-full bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl p-3 text-xs font-sans leading-relaxed transition-all resize-y"
              dir="rtl"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-1">
              <span>💡 ניתן לערוך, להוסיף ברכה או לשנות את נוסח ההודעה לפני השליחה</span>
              <span>{messageText.length} תווים</span>
            </div>
          </div>

          {/* Status Feedback Banner */}
          {sendStatus && (
            <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
              sendStatus.type === 'success' 
                ? 'bg-emerald-50 border border-emerald-300 text-emerald-900' 
                : 'bg-rose-50 border border-rose-300 text-rose-900'
            }`}>
              <span>{sendStatus.text}</span>
            </div>
          )}

        </div>

        {/* Action Buttons Footer */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer order-3 sm:order-1 text-center"
          >
            סגור
          </button>

          <div className="flex items-center gap-2 order-1 sm:order-2">
            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopyMessage}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="העתק את ההודעה המלאה יחד עם הקישור ללוח"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'הועתק!' : 'העתק'}</span>
            </button>

            {/* Direct WhatsApp Native Link (Unblockable by popup blockers!) */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (onSentSuccess) {
                  onSentSuccess(`חלון הוואטסאפ נפתח עם קישור התשלום עבור ${booking.ownerName}`);
                }
              }}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold px-3 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 text-center cursor-pointer"
              title="פתח שיחת וואטסאפ ישירה (עובד מכל טלפון ומחשב ללא חסימות)"
            >
              <MessageSquare className="w-4 h-4 text-emerald-700" />
              <span>פתח בוואטסאפ 📱</span>
            </a>

            {/* Direct Autonomous Green-API button */}
            <button
              type="button"
              onClick={handleSendGreenApi}
              disabled={isSending}
              className="bg-[#065f46] hover:bg-[#044e45] active:scale-95 text-white text-xs font-black px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="שליחה ישירה מוואטסאפ הריזורט ללקוח ברקע (עובד אוטומטית גם מהנייד וגם מהמחשב)"
            >
              <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-spin' : ''}`} />
              <span>{isSending ? 'שולח עכשיו...' : '⚡ שלח ישירות בוואטסאפ'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
