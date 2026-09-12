import React, { useState } from 'react';
import { 
  X, 
  Gift, 
  Sparkles, 
  Copy, 
  Check, 
  MessageCircle, 
  Calendar, 
  Ticket, 
  Share2, 
  Heart,
  Dog,
  User,
  Phone,
  ArrowLeft
} from 'lucide-react';
import { ResortSettings } from '../types';
import { getFirstName, cleanPhoneNumber } from '../utils/whatsappUtils';
import { formatDateIL } from '../utils/dateUtils';

export type VoucherType = 'loyalty' | 'refer_friend';

export interface VoucherModalProps {
  isOpen: boolean;
  initialCustomerName?: string;
  initialDogName?: string;
  initialPhone?: string;
  settings: ResortSettings;
  onClose: () => void;
}

const BENEFIT_PRESETS = [
  { id: 'discount_100_long_weekend', label: '₪100 הנחה בשהות של 3 ימים (סופ"ש ארוך)', valueText: '₪100 הנחה בשהות של 3 ימים ומעלה' },
  { id: 'discount_50', label: '₪50 הנחה להזמנה', valueText: '₪50 הנחה' },
  { id: 'late_checkout', label: 'צ\'ק-אאוט מאוחר חינם (איסוף גמיש בערב במקום בבוקר - שווי ₪100)', valueText: 'צ\'ק-אאוט מאוחר חינם (איסוף גמיש בערב)' },
  { id: 'training_consultation', label: 'שיחת ייעוץ אילוף והתנהגות אישית עם שמוליק (שווי ₪250) מתנה', valueText: 'שיחת ייעוץ אילוף והתנהגות אישית עם שמוליק (שווי ₪250) מתנה' },
  { id: 'daycare_free', label: 'יום שהות יומי (Daycare) / יום כיף מתנה', valueText: 'יום שהות יומי / יום כיף (Daycare) מתנה' },
  { id: 'vip_photo', label: 'צילום מקצועי ומזכרת VIP של הכלב מהחופשה לשיתוף ברשתות', valueText: 'מזכרת צילום VIP מהחופשה לשיתוף' },
  { id: 'premium_treat', label: 'מארז פינוק: עצם לעיסה טבעית מובחרת + חטיפי בריאות פרימיום', valueText: 'מארז חטיפי בריאות פרימיום ועצם טבעית' },
  { id: 'brain_games', label: 'סשן משחקי חשיבה והעשרה מנטלית אישי (Brain Games)', valueText: 'סשן משחקי חשיבה והעשרה מנטלית' },
  { id: 'discount_10', label: '10% הנחה לשהות', valueText: '10% הנחה' },
  { id: 'custom', label: 'הטבה מותאמת אישית (טקסט חופשי)...', valueText: '' }
];

export const VoucherModal: React.FC<VoucherModalProps> = ({
  isOpen,
  initialCustomerName = '',
  initialDogName = '',
  initialPhone = '',
  settings,
  onClose
}) => {
  const [voucherType, setVoucherType] = useState<VoucherType>('loyalty');
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [dogName, setDogName] = useState(initialDogName);
  const [phone, setPhone] = useState(initialPhone);

  const [selectedPresetId, setSelectedPresetId] = useState('discount_100_long_weekend');
  const [customBenefitText, setCustomBenefitText] = useState('');

  // Auto-generate code based on dog/owner name
  const generateInitialCode = (type: VoucherType, dog: string) => {
    const cleanD = (dog || 'VIP').replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '').slice(0, 8);
    const prefix = type === 'refer_friend' ? 'FRIEND' : 'VIP';
    const rand = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${cleanD ? cleanD : 'REWARD'}-${rand}`;
  };

  const [voucherCode, setVoucherCode] = useState(() => generateInitialCode('loyalty', initialDogName));
  
  // Expiry date (default: 6 months from now)
  const defaultExpiry = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  };
  const [expiryDate, setExpiryDate] = useState(defaultExpiry);

  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const currentBenefit = selectedPresetId === 'custom' 
    ? (customBenefitText.trim() || 'הטבה מיוחדת')
    : (BENEFIT_PRESETS.find(p => p.id === selectedPresetId)?.valueText || '₪100 הנחה בשהות של 3 ימים ומעלה');

  const firstName = getFirstName(customerName) || 'חבר/ה יקר/ה';
  const displayDog = dogName.trim() || 'הכלב/ה';
  const cleanP = cleanPhoneNumber(phone);
  const intlPhone = cleanP.startsWith('0') ? '972' + cleanP.substring(1) : cleanP;

  // Build Intake Link with voucher query param
  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'https://rezort-webapp.vercel.app';
  const intakeUrl = `${currentHost}/?intake=true&voucher=${encodeURIComponent(voucherCode)}`;

  // Formulate WhatsApp message text
  const messageText = voucherType === 'loyalty'
    ? `היי ${firstName}! 🐾🤍
היה לנו תענוג אמיתי לארח את ${displayDog} אצלנו בריזורט לכלב!

כדי לפנק אתכם לקראת הפעם הבאה, הכנו עבורכם שובר הטבה אישי:
🎁 *הטבה בלעדית:* ${currentBenefit}
🏷️ *קוד שובר אישי:* ${voucherCode}
📅 *תוקף:* עד ${formatDateIL(expiryDate)}
📌 *תנאי השובר:* תקף בהזמנת שהות של 3 ימים ומעלה (סופ"ש ארוך) | אין כפל הטבות ומבצעים.

לשריון מקום ישיר ביומן:
👉 ${intakeUrl}

מחכים לראותכם שוב! 🐕
${settings.managerName || 'שמוליק'} וצוות ${settings.resortName || 'הריזורט לכלב'} 🐾`
    : `היי ${firstName}! 🐾🐶
שמחנו מאוד לארח את ${displayDog} בריזורט לכלב!
אהבתם את האירוח? נשמח לפנק גם את החברים שלכם שיש להם כלב!

הנה שובר מתנה שתוכלו להעביר לחברים עם כלב:
👇👇👇
"היי! הכלב שלי ${displayDog} התארח בריזורט לכלב של שמוליק וממש נהנה שם.
הם נתנו לי שובר מתנה מיוחד להעביר לחברים:
🎁 *${currentBenefit}!*
🏷️ קוד שובר להזמנה: *${voucherCode}*
📌 תנאי השובר: תקף בהזמנת שהות ראשונה של 3 ימים ומעלה (סופ"ש ארוך) | אין כפל הטבות ומבצעים.
קישור ישיר להתרשמות ולהזמנה:
👉 ${intakeUrl}
מומלץ בחום! 🐕🤍"

*פינוק הדדי: על כל חבר שיזמין שהות של 3 ימים עם השובר שלך, גם אתם מקבלים 100 ₪ הנחה לשהות הבאה של ${displayDog} (בשהות של 3 ימים ומעלה, אין כפל הטבות)! 🎉
${settings.managerName || 'שמוליק'} - ${settings.resortName || 'הריזורט לכלב'} 🐾`;

  const handleSendWhatsApp = () => {
    if (!phone) {
      alert('נא להזין מספר טלפון לשליחה בוואטסאפ');
      return;
    }
    const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(messageText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(intakeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleTypeChange = (type: VoucherType) => {
    setVoucherType(type);
    setVoucherCode(generateInitialCode(type, dogName));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[94vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-700 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-2xl shadow-xs ring-1 ring-white/30">
              🎁
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black tracking-tight">
                הפקת שובר הטבה דיגיטלי
              </h3>
              <p className="text-xs text-amber-100 font-medium mt-0.5">
                שובר פינוק לפעם הבאה או כרטיס מתנה של ״חבר מביא חבר״ לשליחה בוואטסאפ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voucher Type Tabs */}
        <div className="bg-slate-100 p-2 flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => handleTypeChange('loyalty')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              voucherType === 'loyalty'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <span>💎</span>
            <span>שובר לפעם הבאה (נאמנות ללקוח חוזר)</span>
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange('refer_friend')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              voucherType === 'refer_friend'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <span>🤝</span>
            <span>חבר מביא חבר (שלח לחבר עם כלב)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Customer & Dog Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>שם הבעלים</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="למשל: דני כהן"
                className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Dog className="w-3.5 h-3.5 text-slate-500" />
                <span>שם הכלב</span>
              </label>
              <input
                type="text"
                value={dogName}
                onChange={(e) => {
                  setDogName(e.target.value);
                  setVoucherCode(generateInitialCode(voucherType, e.target.value));
                }}
                placeholder="למשל: רוקי"
                className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>טלפון בוואטסאפ</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05..."
                className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
                dir="ltr"
              />
            </div>
          </div>

          {/* Benefit Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-amber-600" />
              <span>בחר את סוג ההטבה של השובר:</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BENEFIT_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/80 border-amber-400 ring-1 ring-amber-400/40 text-amber-950 font-black shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 font-bold'
                    }`}
                  >
                    <span className="text-xs leading-snug">{preset.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0 mr-1" />}
                  </button>
                );
              })}
            </div>

            {selectedPresetId === 'custom' && (
              <div className="pt-1.5">
                <input
                  type="text"
                  value={customBenefitText}
                  onChange={(e) => setCustomBenefitText(e.target.value)}
                  placeholder="הקלד תיאור הטבה אישית (לדוגמה: ₪150 הנחה / צילום מקצועי במתנה)..."
                  className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>
            )}
          </div>

          {/* Voucher Code and Expiry Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5 text-slate-500" />
                <span>קוד שובר אישי (ניתן לעריכה)</span>
              </label>
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 focus:outline-none focus:border-emerald-500 uppercase tracking-wider font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>תוקף השובר</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Luxury Visual Digital Voucher Card Preview */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-950 text-white p-4 sm:p-5 shadow-lg border border-emerald-500/30">
            {/* Cutout punch hole effects */}
            <div className="absolute top-1/2 -left-3 w-6 h-6 rounded-full bg-white -translate-y-1/2" />
            <div className="absolute top-1/2 -right-3 w-6 h-6 rounded-full bg-white -translate-y-1/2" />
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-white/15 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🐕</span>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-emerald-300 block">
                    {settings.resortName || 'הריזורט לכלב'} · שובר VIP
                  </span>
                  <h4 className="text-base sm:text-lg font-black text-white">
                    {voucherType === 'loyalty' ? 'שובר פינוק לפעם הבאה' : 'כרטיס מתנה: חבר מביא חבר'}
                  </h4>
                </div>
              </div>

              <div className="bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-black px-3 py-1 rounded-full shadow-2xs">
                {currentBenefit}
              </div>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <div className="text-emerald-100/90 space-y-0.5 text-center sm:text-right">
                <div>מוענק לחבר הריזורט: <strong className="text-white">{firstName}</strong> ועבור <strong className="text-white">{displayDog}</strong></div>
                <div className="text-[10px] text-emerald-300/80">תקף להזמנות עד: {formatDateIL(expiryDate)} · מינימום 3 ימים (סופ"ש ארוך)</div>
                <div className="text-[10px] text-amber-200/90 font-medium">ללא כפל הטבות ומבצעים</div>
              </div>

              <div className="bg-white/10 backdrop-blur-xs border border-white/20 px-3 py-1.5 rounded-xl font-mono text-xs font-black text-amber-300 tracking-wider">
                קוד: {voucherCode}
              </div>
            </div>
          </div>

          {/* WhatsApp Text Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>תצוגה מקדימה של נוסח הוואטסאפ:</span>
              </span>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
              >
                {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'הנוסח הועתק!' : 'העתק נוסח'}</span>
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed max-h-36 overflow-y-auto">
              {messageText}
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 sm:flex-initial bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
              title="העתק קישור ישיר לטופס הקליטה עם קוד השובר מוטמע"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'הקישור הועתק!' : 'העתק קישור לשובר'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
            >
              סגור
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex-1 sm:flex-initial bg-[#25D366] hover:bg-[#1EBE5D] text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <MessageCircle className="w-4 h-4 fill-white/20 shrink-0" />
              <span>שלח שובר בוואטסאפ</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
