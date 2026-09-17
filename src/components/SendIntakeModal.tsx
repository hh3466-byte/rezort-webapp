import React, { useState } from 'react';
import { 
  X, 
  MessageCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  Phone, 
  User, 
  Heart,
  Sparkles,
  Send
} from 'lucide-react';
import { Booking, IntakeRequest, ResortSettings } from '../types';
import { cleanPhoneNumber } from '../utils/whatsappUtils';
import { formatDateIL } from '../utils/dateUtils';

interface SendIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ResortSettings;
  bookings?: Booking[];
  intakeRequests?: IntakeRequest[];
  onOpenFormPreview?: () => void;
}

export const SendIntakeModal: React.FC<SendIntakeModalProps> = ({
  isOpen,
  onClose,
  settings,
  bookings = [],
  intakeRequests = [],
  onOpenFormPreview,
}) => {
  const [clientPhone, setClientPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [dogName, setDogName] = useState('');
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const cleanPhone = cleanPhoneNumber(clientPhone);
  const phoneSuffix = cleanPhone.length >= 7 ? cleanPhone.slice(-7) : '';

  const matchedBooking = (phoneSuffix && bookings)
    ? bookings.find(b => cleanPhoneNumber(b.ownerPhone).slice(-7) === phoneSuffix)
    : null;

  const matchedIntake = (phoneSuffix && intakeRequests)
    ? intakeRequests.find(r => cleanPhoneNumber(r.ownerPhone).slice(-7) === phoneSuffix)
    : null;

  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/?intake=true`
    : 'https://rezort-webapp.vercel.app/?intake=true';

  const params = new URLSearchParams();
  if (cleanPhone) params.append('phone', cleanPhone);
  if (clientName.trim()) params.append('name', clientName.trim());
  if (dogName.trim()) params.append('dog', dogName.trim());
  const paramStr = params.toString();
  const intakeUrl = paramStr ? `${baseUrl}&${paramStr}` : baseUrl;

  const generateWhatsAppMessage = () => {
    const greeting = clientName.trim() ? `שלום ${clientName.trim()}! 🐾🐶` : `שלום! 🐾🐶`;
    const forDog = dogName.trim() ? `עבור *${dogName.trim()}*` : `עבור הכלב/ה שלכם`;
    const resortTitle = settings.resortName || 'הריזורט לכלב';

    return `${greeting}
שמחנו לשוחח איתך ב${resortTitle}! 🐾

כדי שנוכל לבדוק התאמה, תפוסה פנויה ולשריין מקום ${forDog}, אנא מלא/י את שאלון בקשת הקליטה הקצר בקישור הבא:
👉 \u200E${intakeUrl}

⏰ *שימו לב:* אנחנו נמצאים כרגע במתחם ומטפלים במסירות בכלבים, ולא נשכח אתכם! 🐾
מיד שנתפנה נעבור על פרטי השאלון ונחזור אליכם לשיחה בנוגע לתשובות לתיאום סופי.

בברכה חמה,
צוות ${resortTitle} 🐕🤍`;
  };

  const messageText = generateWhatsAppMessage();

  const handleSendWhatsApp = () => {
    const clean = cleanPhoneNumber(clientPhone);
    const intlPhone = clean ? (clean.startsWith('0') ? '972' + clean.substring(1) : clean) : '';
    const encoded = encodeURIComponent(messageText);
    
    const url = intlPhone 
      ? `https://wa.me/${intlPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(url, '_blank');
    onClose();
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(messageText);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const handleCopyLinkOnly = () => {
    navigator.clipboard.writeText(intakeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200 max-h-[92vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#065f46] via-teal-700 to-[#065f46] text-white p-4 sm:p-5 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner border border-white/20">
                📲
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  שליחת שאלון בקשה לקליטה ללקוח
                </h3>
                <p className="text-xs text-emerald-100 font-medium">
                  עבור לקוח שהתקשר — שליחת קישור ישיר לוואטסאפ עם הודעה מוכנה
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Deduplication Guidance Note */}
          <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-emerald-950 shadow-2xs">
            <span className="text-base shrink-0">💡</span>
            <div className="leading-relaxed">
              <strong>שים לב – מניעת כפילות:</strong> כל לקוח שפונה בוואטסאפ מקבל קישור לשאלון קליטה במענה האוטומטי באופן מיידי.
              מסך זה מיועד <strong>רק ללקוחות ששוחחת איתם בטלפון</strong>, או שלקוח שכבר שוחח איתך <strong>ביקש את השאלון שוב</strong> על מנת למלא אותו.
            </div>
          </div>

          {/* Caller Quick Info Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Phone */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>מספר טלפון / וואטסאפ של הלקוח:</span>
              </label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="לדוגמה: 050-1234567 (או השאר ריק לבחירת איש קשר בוואטסאפ)"
                className="w-full bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-300 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                autoFocus
              />

              {/* Duplicate Safeguard Alerts */}
              {matchedBooking && (
                <div className="mt-2 bg-red-50 border border-red-200 text-red-900 rounded-xl p-2.5 text-xs flex items-center gap-2">
                  <span className="text-base shrink-0">🛑</span>
                  <div>
                    <strong>עצור – לקוח קיים ביומן!</strong>
                    <div>
                      ללקוח זה יש כבר הזמנה רשומה ביומן עבור <strong>{matchedBooking.dogName}</strong> ({matchedBooking.ownerName}). אין צורך בשאלון קליטה!
                    </div>
                  </div>
                </div>
              )}

              {!matchedBooking && matchedIntake && (
                <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl p-2.5 text-xs flex items-center gap-2">
                  <span className="text-base shrink-0">⚠️</span>
                  <div>
                    <strong>שאלון קליטה כבר מולא ונקלט במערכת!</strong>
                    <div>
                      לקוח זה כבר הגיש שאלון עבור <strong>{matchedIntake.dogName}</strong> ({formatDateIL(matchedIntake.createdAt)}).
                      יש לשלוח שוב אך ורק אם הלקוח ביקש קישור נוסף בהתנהלות מולו.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Client Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>שם הלקוח (אופציונלי):</span>
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="למשל: דני"
                className="w-full bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-300 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs focus:outline-none"
              />
            </div>

            {/* Dog Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>שם הכלב (אופציונלי):</span>
              </label>
              <input
                type="text"
                value={dogName}
                onChange={(e) => setDogName(e.target.value)}
                placeholder="למשל: מקס"
                className="w-full bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-300 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs focus:outline-none"
              />
            </div>
          </div>

          {/* Message Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                <span>תצוגה מקדימה של ההודעה שתישלח:</span>
              </span>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMessage ? 'הועתק!' : 'העתק הודעה'}</span>
              </button>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-2xl p-3 sm:p-3.5 text-xs text-slate-800 font-sans whitespace-pre-wrap leading-relaxed">
              {messageText}
            </div>
          </div>

          {/* Direct Link Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs text-slate-600">
            <span className="truncate max-w-[280px] sm:max-w-xs font-mono text-[11px] text-slate-500" dir="ltr">
              {intakeUrl}
            </span>
            <button
              type="button"
              onClick={handleCopyLinkOnly}
              className="bg-white hover:bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200 text-xs flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
            >
              {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copiedLink ? 'הקישור הועתק!' : 'העתק קישור'}</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {onOpenFormPreview ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFormPreview();
              }}
              className="bg-white hover:bg-slate-100 text-slate-700 font-bold px-3.5 py-2 rounded-xl border border-slate-300 text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>צפה בשאלון</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="bg-white hover:bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl border border-slate-300 text-xs cursor-pointer"
            >
              סגור
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMessage}
              className="bg-white hover:bg-slate-100 text-slate-700 font-bold px-3 py-2 rounded-xl border border-slate-300 text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedMessage ? 'ההודעה הועתקה!' : 'העתק'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex-1 sm:flex-initial bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 text-white font-black px-5 py-2.5 rounded-xl shadow-md text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>📲 שלח עכשיו בוואטסאפ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
