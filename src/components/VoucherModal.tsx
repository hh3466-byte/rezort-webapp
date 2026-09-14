import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Gift, 
  Sparkles, 
  Copy, 
  Check, 
  MessageCircle, 
  Calendar, 
  Ticket, 
  Dog, 
  User, 
  Phone, 
  Search, 
  List, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2,
  Crown,
  Download,
  Image as ImageIcon
} from 'lucide-react';
import { ResortSettings, Booking, DigitalVoucher, VoucherStatus, RESORT_BENEFIT_OPTIONS } from '../types';
import { getFirstName, cleanPhoneNumber } from '../utils/whatsappUtils';
import { formatDateIL } from '../utils/dateUtils';
import { saveVoucherToDb, updateVoucherStatusInDb, subscribeToVouchers, loadStoredVouchers } from '../services/dbService';

export type VoucherType = 'loyalty' | 'refer_friend';

export interface VoucherModalProps {
  isOpen: boolean;
  initialCustomerName?: string;
  initialDogName?: string;
  initialPhone?: string;
  staysCount?: number;
  settings: ResortSettings;
  bookings?: Booking[];
  onClose: () => void;
}

const BENEFIT_PRESETS = [
  { 
    id: 'frequent_daycare_gift', 
    label: '👑 יום כיף VIP בריזורט במתנה 09:00-19:00 (הטבת VIP לקוח 4+)', 
    valueText: 'יום כיף ושהות יומית VIP במתחם הדשא (09:00-19:00) במתנה' 
  },
  { 
    id: 'customer_choice', 
    label: '🌟 לבחירת הלקוח מתוך תפריט הפינוקים (מומלץ ביותר!)', 
    valueText: 'שובר VIP לבחירה אישית מתוך תפריט הפינוקים בריזורט' 
  },
  { 
    id: 'discount_100_long_weekend', 
    label: '💰 100 ₪ הנחה ישירה על החופשה (בשהות 3+ ימים)', 
    valueText: '100 ₪ הנחה ישירה בהזמנת שהות של 3 ימים ומעלה (סופ״ש ארוך)' 
  },
  { 
    id: 'late_checkout', 
    label: '🌙 צ\'ק-אאוט VIP רגוע במוצאי שבת או חג (19:00-21:00)', 
    valueText: 'צ\'ק-אאוט VIP במוצאי שבת או חג (19:00-21:00) ללא עלות נוספת' 
  },
  { 
    id: 'training_consultation', 
    label: '🐾 שיחת ייעוץ והדרכת התנהגות 1-על-1 עם שמוליק (שווי ₪250)', 
    valueText: 'שיחת ייעוץ והדרכת התנהגות אישית 1-על-1 עם שמוליק במתנה' 
  },
  { 
    id: 'daycare_free', 
    label: '☀️ יום כיף ושהות יומית VIP במתחם הדשא (09:00-19:00) מתנה', 
    valueText: 'יום כיף ושהות יומית VIP במתחם הדשא (09:00-19:00) מתנה' 
  },
  { 
    id: 'premium_treat', 
    label: '🦴 מארז שף גורמה: עצם לעיסה טבעית מעושנת + מעדני בריאות', 
    valueText: 'מארז שף גורמה: עצם לעיסה טבעית מעושנת + מעדני בריאות מובחרים' 
  },
  { 
    id: 'vip_photo', 
    label: '📸 בוק צילומי VIP מקצועי מהרגעים היפים בריזורט לסטורי', 
    valueText: 'בוק צילומי VIP מקצועי מהחופשה לשיתוף ברשתות' 
  },
  { 
    id: 'brain_games', 
    label: '🧠 סשן משחקי חשיבה, רחרוח והעשרה מנטלית (Brain Games)', 
    valueText: 'סשן משחקי חשיבה, רחרוח והעשרה מנטלית (Brain Games) מוענק ע״י צוות הריזורט' 
  },
  { 
    id: 'custom', 
    label: '✨ פינוק מותאם אישית (טקסט חופשי)...', 
    valueText: '' 
  }
];

export const VoucherModal: React.FC<VoucherModalProps> = ({
  isOpen,
  initialCustomerName = '',
  initialDogName = '',
  initialPhone = '',
  staysCount = 0,
  settings,
  bookings,
  onClose
}) => {
  // Frequent customer rule: 4th stay onwards (staysCount >= 3)
  const isFrequentClient = staysCount >= 3;

  // Active view tab: 'create' | 'history'
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Form State
  const [voucherType, setVoucherType] = useState<VoucherType>('loyalty');
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [dogName, setDogName] = useState(initialDogName);
  const [phone, setPhone] = useState(initialPhone);

  const [selectedPresetId, setSelectedPresetId] = useState(() => isFrequentClient ? 'frequent_daycare_gift' : 'customer_choice');
  const [customBenefitText, setCustomBenefitText] = useState('');

  // Auto-generate code based on dog/owner name (Hebrew format)
  const generateInitialCode = (type: VoucherType, dog: string) => {
    const cleanD = (dog || '').replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '').slice(0, 10);
    const rand = Math.floor(100 + Math.random() * 900);
    if (type === 'refer_friend') {
      return `חבר-${cleanD ? cleanD : 'ריזורט'}-${rand}`;
    }
    if (isFrequentClient) {
      return `VIP-יום-${cleanD ? cleanD : 'ריזורט'}-${rand}`;
    }
    return `פינוק-${cleanD ? cleanD : 'ריזורט'}-${rand}`;
  };

  const [voucherCode, setVoucherCode] = useState(() => generateInitialCode('loyalty', initialDogName));
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  // Expiry date (default: 6 months from now)
  const defaultExpiry = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  };
  const [expiryDate, setExpiryDate] = useState(defaultExpiry);

  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Vouchers History State
  const [vouchersList, setVouchersList] = useState<DigitalVoucher[]>(() => loadStoredVouchers());
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'active' | 'redeemed'>('all');

  useEffect(() => {
    const unsubscribe = subscribeToVouchers((data) => {
      setVouchersList(data);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const currentBenefit = selectedPresetId === 'custom' 
    ? (customBenefitText.trim() || 'הטבה מיוחדת')
    : (BENEFIT_PRESETS.find(p => p.id === selectedPresetId)?.valueText || 'שובר לבחירה מתוך תפריט ההטבות');

  const firstName = getFirstName(customerName) || 'חבר/ה יקר/ה';
  const displayDog = dogName.trim() || 'הכלב/ה';
  const cleanP = cleanPhoneNumber(phone);
  const intlPhone = cleanP.startsWith('0') ? '972' + cleanP.substring(1) : cleanP;

  // Build Intake Link with voucher query param
  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'https://rezort-webapp.vercel.app';
  const intakeUrl = `${currentHost}/?intake=true&voucher=${encodeURIComponent(voucherCode)}`;

  const greetingIntro = isFrequentClient
    ? `תודה על הנאמנות והאירוחים הרבים של ${displayDog} אצלנו בריזורט! 👑`
    : `שמחנו מאוד לארח את ${displayDog} בריזורט לכלב!`;

  // Formulate WhatsApp message text
  const getWhatsAppMessageText = (): string => {
    if (voucherType === 'loyalty') {
      if (isFrequentClient && selectedPresetId === 'frequent_daycare_gift') {
        return `היי ${firstName}! 🐾👑
תודה ענקית מכל הלב על הנאמנות והאירוחים הרבים של ${displayDog} אצלנו בריזורט (${staysCount} פעמים שאתם חלק בלתי נפרד מהמשפחה שלנו)! ❤️

כאות הערכה עמוקה ללקוחותינו הנאמנים (4 אירוחים ומעלה), הכנו עבור ${displayDog} מתנת VIP מכל הלב ישירות מאיתנו:
☀️ *יום כיף שלם ומשחקים בריזורט – במתנה מאיתנו (09:00-19:00)!* 🐕✨

מה מחכה ל-${displayDog} ביום הכיף?
🌿 מרחבי דשא ירוקים ומגודרים למשחקים חופשיים
🎾 פעילות חברתית מבוקרת ומשחקי כדור
💦 שכשוך במתקני מים ומשחקים מרעננים
🛋️ מנוחה בסוויטות מרווחות ומפנקות עם שפע אהבה ופינוקים מצוות הריזורט!
*(שווי ההטבה: ₪90–120 – עבורכם ב-₪0 מלאים!)*

🏷️ *קוד שובר אישי:* ${voucherCode}
📅 *תוקף:* עד ${formatDateIL(expiryDate)}

לשריון יום הכיף המושלם של ${displayDog} ביומן:
👉 ${intakeUrl}

🎁 *הטבה כפולה:* בנוסף, עומדת לרשותכם תוכנית "חבר מביא חבר" – ספרו לחברים עם כלב, הם ייהנו מהטבת הצטרפות, ואתם תצברו 100 ₪ זיכוי לחופשה הבאה!

מחכים לפנק ולחבק את ${displayDog}! 🐾🤍
${settings.managerName || 'שמוליק'} וצוות ${settings.resortName || 'הריזורט לכלב'} 🐾`;
      }

      if (selectedPresetId === 'customer_choice') {
        return `היי ${firstName}! 🐾🤍
היה לנו תענוג אמיתי וכיף ענק לארח את ${displayDog} אצלנו בריזורט לכלב!

כדי לפנק אתכם לקראת החופשה הבאה, הכנו עבורכם שובר VIP שבו *אתם בוחרים* את הפינוק שהכי יעשה לכם ול-${displayDog} טוב על הלב:

🎁 *תפריט פינוקי VIP לבחירתכם (אחת מתוך הרשימה):*
 • 💰 *100 ₪ הנחה ישירה* בהזמנת שהות של 3 ימים ומעלה (סופ״ש ארוך)
 • 🌙 *צ'ק-אאוט VIP רגוע במוצאי שבת או חג (19:00-21:00)* – איסוף גמיש ללא עלות
 • 🐾 *שיחת ייעוץ והדרכת התנהגות 1-על-1 עם שמוליק* (שווי ₪250)
 • ☀️ *יום כיף ושהות יומית VIP (09:00-19:00)* – 10 שעות של דשא, מים וחברים במתנה
 • 🦴 *מארז שף גורמה:* עצם לעיסה טבעית מעושנת + מעדני בריאות מובחרים
 • 📸 *בוק צילומי VIP מקצועי מהחופשה* – תמונות אקשן מרהיבות מוכנות לסטורי
 • 🧠 *סשן משחקי חשיבה, רחרוח והעשרה (Brain Games)* – מוענק ע״י צוות הריזורט

🏷️ *קוד שובר אישי:* ${voucherCode}
📅 *תוקף:* עד ${formatDateIL(expiryDate)}
📌 *תנאי השובר:* לבחירת הטבה אחת | בשהות של 3 ימים ומעלה (סופ"ש ארוך) | אין כפל הטבות ומבצעים.

לבחירת הפינוק שלכם ושריון מקום ביומן:
👉 ${intakeUrl}

מחכים לראותכם שוב! 🐕✨
${settings.managerName || 'שמוליק'} וצוות ${settings.resortName || 'הריזורט לכלב'} 🐾`;
      }

      return `היי ${firstName}! 🐾🤍
היה לנו תענוג אמיתי לארח את ${displayDog} אצלנו בריזורט לכלב!

כדי לפנק אתכם לקראת הפעם הבאה, הכנו עבורכם שובר הטבה אישי:
🎁 *פינוק בלעדי:* ${currentBenefit}
🏷️ *קוד שובר אישי:* ${voucherCode}
📅 *תוקף:* עד ${formatDateIL(expiryDate)}
📌 *תנאי השובר:* תקף בהזמנת שהות של 3 ימים ומעלה (סופ"ש ארוך) | אין כפל הטבות ומבצעים.

לשריון מקום ישיר ביומן:
👉 ${intakeUrl}

מחכים לראותכם שוב! 🐕
${settings.managerName || 'שמוליק'} וצוות ${settings.resortName || 'הריזורט לכלב'} 🐾`;
    }

    // voucherType === 'refer_friend'
    return `היי ${firstName}! 🐾🐶
${greetingIntro}
אהבתם את האירוח? נשמח לפנק גם את החברים שלכם שיש להם כלב!

הנה שובר מתנה מפנק שתוכלו להעביר לחברים:
👇👇👇
"היי! הכלב שלי ${displayDog} מתארח בריזורט לכלב של שמוליק וממש נהנה שם 🐕❤️
הם נתנו לי שובר VIP בלעדי להעביר לחברים טובים, שמאפשר לכם לבחור מתנת קבלת פנים מדהימה בהזמנה ראשונה:

🎁 *תפריט פינוקי VIP לבחירתכם בהזמנה ראשונה:*
 • 💰 100 ₪ הנחה ישירה בשהות של 3 ימים ומעלה (סופ״ש ארוך)
 • 🌙 צ'ק-אאוט VIP רגוע במוצאי שבת או חג (19:00-21:00) ללא תוספת
 • 🐾 שיחת ייעוץ והדרכת התנהגות אישית 1-על-1 עם שמוליק (שווי ₪250)
 • ☀️ יום כיף ושהות יומית VIP (09:00-19:00) מתנה לכלב
 • 🦴 מארז שף גורמה: עצם לעיסה טבעית מעושנת + מעדני בריאות מובחרים
 • 📸 בוק צילומי VIP מקצועי מהחופשה לשיתוף בסטורי
 • 🧠 סשן משחקי חשיבה, רחרוח והעשרה מנטלית (Brain Games) – ע״י צוות הריזורט

🏷️ קוד שובר אישי להזמנה: *${voucherCode}*
📌 תנאי השובר: לבחירת הטבה אחת | תקף בהזמנת שהות ראשונה של 3 ימים ומעלה (סופ"ש ארוך) | אין כפל הטבות ומבצעים.

להתרשמות, בחירת המתנה שלכם ושריון מקום בקליק:
👉 ${intakeUrl}
מומלץ מכל הלב! 🐕🤍"

*פינוק הדדי: ברגע שהחבר יבצע שהות משלמת ראשונה של 3 ימים עם השובר שלך, גם אתם מקבלים 100 ₪ זיכוי לשהות הבאה של ${displayDog}! 🎉
${settings.managerName || 'שמוליק'} - ${settings.resortName || 'הריזורט לכלב'} 🐾`;
  };

  const messageText = getWhatsAppMessageText();

  // Save current voucher to DB
  const handleSaveVoucher = async () => {
    const newVoucher: DigitalVoucher = {
      id: `vouch-${Date.now()}`,
      code: voucherCode.trim(),
      type: voucherType,
      customerName: customerName.trim(),
      dogName: dogName.trim(),
      phone: phone.trim(),
      benefitText: currentBenefit,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiryDate: expiryDate,
      notes: isFrequentClient 
        ? (voucherType === 'loyalty' ? 'הטבת VIP יום כיף 09:00-19:00 מתנה ללקוח 4+' : 'שובר חבר מביא חבר (לקוח ותיק 4+)')
        : 'הופק ידנית במערכת'
    };
    await saveVoucherToDb(newVoucher);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleSendWhatsApp = async () => {
    if (!phone) {
      alert('נא להזין מספר טלפון לשליחה בוואטסאפ');
      return;
    }
    await handleSaveVoucher();
    const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');
  };

  const handleCopyMessage = async () => {
    await handleSaveVoucher();
    navigator.clipboard.writeText(messageText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleCopyLink = async () => {
    await handleSaveVoucher();
    navigator.clipboard.writeText(intakeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const downloadVoucherImage = async () => {
    setIsGeneratingImage(true);
    try {
      await handleSaveVoucher();
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 650;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Luxury Dark Emerald Gradient Background
      const bgGrad = ctx.createLinearGradient(0, 0, 1200, 650);
      bgGrad.addColorStop(0, '#062c22');
      bgGrad.addColorStop(0.5, '#0a3d30');
      bgGrad.addColorStop(1, '#02150f');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 650);

      // Radial Gold/Emerald Warm Glow
      const radialGlow = ctx.createRadialGradient(950, 150, 20, 950, 150, 450);
      radialGlow.addColorStop(0, 'rgba(234, 179, 8, 0.18)');
      radialGlow.addColorStop(0.5, 'rgba(16, 185, 129, 0.10)');
      radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, 1200, 650);

      // 2. Double Golden Border with corner details
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.45)';
      ctx.lineWidth = 4;
      ctx.strokeRect(28, 28, 1144, 594);

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 2;
      ctx.strokeRect(38, 38, 1124, 574);

      // Decorative corner squares
      ctx.fillStyle = '#f59e0b';
      const corners = [
        [38, 38], [1162, 38], [38, 612], [1162, 612]
      ];
      corners.forEach(([cx, cy]) => {
        ctx.fillRect(cx - 5, cy - 5, 10, 10);
      });

      // 3. Header Text & Branding
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Brand subtitle
      ctx.font = 'bold 22px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(`👑  ${settings.resortName || 'הריזורט לכלב'}  ·  מועדון VIP`, 600, 85);

      // Main Card Title
      ctx.font = '900 46px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#ffffff';
      const title = voucherType === 'refer_friend' 
        ? 'כרטיס מתנה: חבר מביא חבר 🤝' 
        : 'שובר פינוק VIP לשהות הבאה 🐾';
      ctx.fillText(title, 600, 145);

      // 4. Benefit Highlight Box
      const benefitBoxY = 195;
      const benefitBoxH = 75;
      const bGrad = ctx.createLinearGradient(150, benefitBoxY, 1050, benefitBoxY);
      bGrad.addColorStop(0, 'rgba(245, 158, 11, 0.12)');
      bGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.28)');
      bGrad.addColorStop(1, 'rgba(245, 158, 11, 0.12)');
      ctx.fillStyle = bGrad;
      ctx.fillRect(150, benefitBoxY, 900, benefitBoxH);

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(150, benefitBoxY, 900, benefitBoxH);

      ctx.font = 'bold 26px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.fillText(`🎁  ${currentBenefit}`, 600, benefitBoxY + benefitBoxH / 2);

      // 5. Large Golden Voucher Code Box
      const codeBoxY = 295;
      const codeBoxH = 110;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(260, codeBoxY, 680, codeBoxH);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(260, codeBoxY, 680, codeBoxH);

      ctx.font = 'bold 20px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText('קוד שובר אישי להזמנה:', 600, codeBoxY + 30);

      ctx.font = '900 48px monospace, system-ui, Arial, sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(voucherCode, 600, codeBoxY + 75);

      // 6. Recipient & Expiry Information
      ctx.font = 'bold 24px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`מוענק באהבה עבור: ${firstName} ועבור ${displayDog} 🐕`, 600, 445);

      ctx.font = 'bold 21px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(`📅  בתוקף ל-6 חודשים עד: ${formatDateIL(expiryDate)}`, 600, 485);

      // Terms & Conditions
      ctx.font = '500 18px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('📌  תקף בהזמנת שהות של 3 ימים ומעלה (סופ״ש ארוך)  ·  אין כפל מבצעים והטבות  ·  בתיאום מראש', 600, 530);

      // Footer Booking CTA
      ctx.font = 'bold 18px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#fcd34d';
      ctx.fillText(`למימוש ושריון מקום ביומן: הזינו את קוד השובר בטופס הקליטה | ${settings.managerPhone ? `וואטסאפ: ${settings.managerPhone}` : ''}`, 600, 575);

      // Trigger PNG download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `שובר-הריזורט-${voucherCode}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      console.error('Error generating voucher image:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleTypeChange = (type: VoucherType) => {
    setVoucherType(type);
    setVoucherCode(generateInitialCode(type, dogName));
    if (type === 'loyalty' && isFrequentClient) {
      setSelectedPresetId('frequent_daycare_gift');
    } else if (type === 'refer_friend') {
      setSelectedPresetId('customer_choice');
    }
  };

  // Filtered vouchers history
  const filteredVouchers = useMemo(() => {
    return vouchersList.filter(v => {
      if (historyStatusFilter !== 'all' && v.status !== historyStatusFilter) return false;
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchCode = v.code.toLowerCase().includes(q);
        const matchOwner = (v.customerName || '').toLowerCase().includes(q);
        const matchDog = (v.dogName || '').toLowerCase().includes(q);
        const matchPhone = (v.phone || '').includes(q);
        if (!matchCode && !matchOwner && !matchDog && !matchPhone) return false;
      }
      return true;
    });
  }, [vouchersList, historyStatusFilter, historySearch]);

  const activeCount = vouchersList.filter(v => v.status === 'active').length;
  const redeemedCount = vouchersList.filter(v => v.status === 'redeemed').length;

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
                ניהול והפקת שוברי הטבה דיגיטליים
              </h3>
              <p className="text-xs text-amber-100 font-medium mt-0.5">
                שובר פינוק לפעם הבאה, כרטיס מתנה של ״חבר מביא חבר״ ומעקב שוברים
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

        {/* Top-level Navigation Tabs (Create vs History) */}
        <div className="bg-slate-100 p-2 flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'create'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>הפקת שובר חדש</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <List className="w-4 h-4 text-amber-600" />
            <span>שוברים שהופקו ומעקב ({vouchersList.length})</span>
            {activeCount > 0 && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-1.5 py-0.2 rounded-full border border-emerald-300">
                {activeCount} פעילים
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Create Voucher View */}
        {activeTab === 'create' && (
          <>
            {/* Voucher Sub-type Selection */}
            <div className="bg-slate-50/80 px-4 py-2 flex gap-2 border-b border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => handleTypeChange('loyalty')}
                className={`flex-1 py-2 px-3 rounded-xl font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  voucherType === 'loyalty'
                    ? 'bg-white text-emerald-950 shadow-2xs border border-slate-300 ring-1 ring-emerald-500/20'
                    : 'text-slate-600 hover:bg-white/70'
                }`}
              >
                <span>{isFrequentClient ? '👑' : '💎'}</span>
                <span>{isFrequentClient ? 'הטבת VIP: יום כיף מתנה (09:00-19:00)' : 'שובר לפעם הבאה (נאמנות ללקוח חוזר)'}</span>
                {isFrequentClient && (
                  <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold shadow-2xs">
                    מתנה לכלב
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('refer_friend')}
                className={`flex-1 py-2 px-3 rounded-xl font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  voucherType === 'refer_friend'
                    ? 'bg-white text-emerald-950 shadow-2xs border border-slate-300 ring-1 ring-emerald-500/20'
                    : 'text-slate-600 hover:bg-white/70'
                }`}
              >
                <span>🤝</span>
                <span>חבר מביא חבר (שלח לחבר עם כלב)</span>
                {isFrequentClient && (
                  <span className="bg-emerald-100 text-emerald-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold border border-emerald-300">
                    זיכוי 100 ₪
                  </span>
                )}
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
              
              {/* 4th Stay Rule Alert Banner */}
              {isFrequentClient && (
                <div className="p-3 bg-gradient-to-r from-amber-500/15 via-amber-400/20 to-emerald-500/10 border-2 border-amber-400/70 rounded-2xl flex items-start gap-2.5 text-xs text-amber-950 animate-in fade-in">
                  <Crown className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-snug">
                    <div className="font-black text-amber-950 text-xs sm:text-sm flex items-center gap-2">
                      <span>🌟 לקוח VIP ותיק ({staysCount} אירוחים בריזורט!)</span>
                      <span className="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-2xs">
                        2 הטבות מיוחדות
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 mt-1">
                      ללקוחות של 4 פעמים ומעלה מוענקות 2 הטבות:
                      <br />
                      1. <strong>☀️ יום כיף לכלב בריזורט במתנה (09:00-19:00)</strong> – שובר נאמנות אישי ישיר ללא עלות!
                      <br />
                      2. <strong>🤝 חבר מביא חבר</strong> – שובר מתנה לחברים (החבר מקבל הטבה, והלקוח הוותיק זוכה ב-100 ₪ זיכוי לשהות הבאה).
                    </p>
                  </div>
                </div>
              )}

              {/* Customer & Dog Inputs - Dog First (Shmulik's preference) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Dog className="w-3.5 h-3.5 text-emerald-600" />
                    <span>שם הכלב *</span>
                  </label>
                  <input
                    type="text"
                    value={dogName}
                    onChange={(e) => {
                      setDogName(e.target.value);
                      setVoucherCode(generateInitialCode(voucherType, e.target.value));
                    }}
                    placeholder="למשל: תיאו"
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <span>שם הבעלים *</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="למשל: הדס שקל"
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-amber-600" />
                    <span>הגדרת סוג ההטבה של השובר:</span>
                  </label>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    הלקוח יכול לבחור הטבה בטופס הקליטה
                  </span>
                </div>

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
                            ? 'bg-amber-50/90 border-amber-400 ring-1 ring-amber-400/40 text-amber-950 font-black shadow-2xs'
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
                      placeholder="הקלד תיאור הטבה אישית (לדוגמה: ₪150 הנחה / שדרוג לסוויטה)..."
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
                    onChange={(e) => setVoucherCode(e.target.value.trim())}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 focus:outline-none focus:border-emerald-500 tracking-wider font-mono"
                    dir="auto"
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
                    <div className="text-[10px] text-amber-200/90 font-medium">הלקוח בוחר 1 מתוך תפריט ההטבות · ללא כפל מבצעים</div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-xs border border-white/20 px-3 py-1.5 rounded-xl font-mono text-xs font-black text-amber-300 tracking-wider">
                    קוד: {voucherCode}
                  </div>
                </div>
              </div>

              {/* Graphic Voucher PNG Download Button */}
              <button
                type="button"
                onClick={downloadVoucherImage}
                disabled={isGeneratingImage}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-700 hover:from-amber-600 hover:to-emerald-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs hover:shadow-md active:scale-[0.99]"
                title="הורד תמונה גרפית יוקרתית באיכות גבוהה לשליחה בוואטסאפ או הדפסה"
              >
                {isGeneratingImage ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>יוצר כרטיס שובר מעוצב...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-white" />
                    <span>הורד כרטיס שובר מעוצב גרפית (PNG לשליחה בוואטסאפ)</span>
                  </>
                )}
              </button>

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
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
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

                <button
                  type="button"
                  onClick={handleSaveVoucher}
                  className="bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                >
                  {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Ticket className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>{saveSuccess ? 'נשמר במערכת!' : 'שמור שובר במערכת'}</span>
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
          </>
        )}

        {/* Tab 2: Vouchers History & Tracking View */}
        {activeTab === 'history' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* History Filter & Search Bar */}
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-2.5 text-xs">
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="חיפוש לפי קוד שובר, שם לקוח או שם הכלב..."
                    className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setHistoryStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      historyStatusFilter === 'all'
                        ? 'bg-emerald-800 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    הכל ({vouchersList.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryStatusFilter('active')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      historyStatusFilter === 'active'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    <span>🟢 פעילים ({activeCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryStatusFilter('redeemed')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      historyStatusFilter === 'redeemed'
                        ? 'bg-purple-700 text-white shadow-2xs'
                        : 'bg-white text-purple-800 border border-purple-200 hover:bg-purple-50'
                    }`}
                  >
                    <span>🟣 נוצלו ({redeemedCount})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* List of Vouchers */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredVouchers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Ticket className="w-10 h-10 mx-auto opacity-40" />
                  <p className="font-bold text-sm">לא נמצאו שוברים תואמים</p>
                  <p className="text-xs text-slate-500">הפיקו שובר חדש בלשונית "הפקת שובר חדש"</p>
                </div>
              ) : (
                filteredVouchers.map((v) => {
                  const isRedeemed = v.status === 'redeemed';
                  return (
                    <div
                      key={v.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs ${
                        isRedeemed
                          ? 'bg-slate-50/70 border-slate-200 opacity-80'
                          : 'bg-white border-emerald-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-300">
                            {v.code}
                          </span>
                          
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            isRedeemed
                              ? 'bg-purple-100 text-purple-800 border-purple-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}>
                            {isRedeemed ? '🟣 נוצל' : '🟢 פעיל למימוש'}
                          </span>

                          <span className="text-[10px] font-bold text-slate-500">
                            {v.type === 'refer_friend' ? '🤝 חבר מביא חבר' : '💎 שובר נאמנות'}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black text-emerald-800">🐾 {v.dogName || 'כלב'}</span>
                          <span className="text-slate-600 font-medium">· בעלים: <strong className="text-slate-800">{v.customerName || 'לקוח'}</strong></span>
                          {v.phone && <span className="text-slate-500 font-mono text-[11px]" dir="ltr">({v.phone})</span>}
                        </div>

                        <div className="text-[11px] text-slate-600">
                          <span>הטבה: <strong>{v.benefitText}</strong></span>
                          {v.expiryDate && <span className="text-slate-400 mr-2">· תוקף: {formatDateIL(v.expiryDate)}</span>}
                        </div>

                        {isRedeemed && (
                          <div className="text-[10px] text-purple-900 font-medium bg-purple-50 p-1.5 rounded-lg border border-purple-200 inline-block">
                            מומש {v.redeemedAt ? `ב-${formatDateIL(v.redeemedAt)}` : ''} {v.redeemedByOwner ? `ע״י ${v.redeemedByOwner}` : ''}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <button
                          type="button"
                          onClick={async () => {
                            const newStatus: VoucherStatus = isRedeemed ? 'active' : 'redeemed';
                            await updateVoucherStatusInDb(v.id, newStatus);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            isRedeemed
                              ? 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-white hover:bg-purple-50 text-purple-800 border-purple-300'
                          }`}
                        >
                          {isRedeemed ? 'החזר לסטטוס פעיל 🟢' : 'סמן כנוצל 🟣'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/?intake=true&voucher=${encodeURIComponent(v.code)}`);
                            alert(`הקישור לשובר ${v.code} הועתק בהצלחה!`);
                          }}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
                          title="העתק קישור ישיר לשובר זה"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {v.phone && (
                          <button
                            type="button"
                            onClick={() => {
                              const cleanPhone = cleanPhoneNumber(v.phone);
                              const intl = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
                              const url = `https://wa.me/${intl}?text=${encodeURIComponent(`שלום ${v.customerName}! קוד השובר שלך בריזורט לכלב: ${v.code}`)}`;
                              window.open(url, '_blank');
                            }}
                            className="p-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#1EBE5D] border border-[#25D366]/30 rounded-xl cursor-pointer"
                            title="שלח תזכורת בוואטסאפ"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
              >
                סגור
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
