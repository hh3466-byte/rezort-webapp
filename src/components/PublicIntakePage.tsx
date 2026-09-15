import React, { useState, useMemo, useEffect } from 'react';
import { ResortSettings, ServiceType, IntakeRequest, RESORT_BENEFIT_OPTIONS } from '../types';
import { addDays, getTodayStr, calculateDaysCount, getDayNameHebrew, formatDateIL } from '../utils/dateUtils';
import { saveIntakeRequestToDb, findVoucherByCode, verifyCustomerByPhone, PhoneVerificationResult } from '../services/dbService';
import { sendResortEmailNotification, sendResortWhatsAppNotification, formatIntakeNotification } from '../services/notificationService';
import { 
  CheckCircle2, 
  Send, 
  Calendar, 
  User, 
  Phone, 
  Heart, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  MessageSquare,
  PhoneCall,
  AlertCircle,
  Plus,
  Minus,
  Clock,
  MessageCircle,
  Copy,
  Check,
  Gift,
  Users,
  Tag,
  FileText,
  X,
  Shield,
  Search
} from 'lucide-react';
import { SendIntakeModal } from './SendIntakeModal';

// 7 Clauses of Resort By-Laws (תקנון הריזורט לכלב)
const RESORT_BYLAWS_SECTIONS = [
  {
    num: 1,
    title: '1. תשלום ושחרור הכלב בתום השהייה',
    icon: '💳',
    content: 'תנאי לשחרור הכלב בתום תקופת השהייה הוא תשלום מלא בגין כל שירות נוסף שניתן לכלב במהלך שהייתו, מעבר לשירותים שסוכמו מראש בין הצדדים. הריזורט רשאי לעכב את מסירת הכלב עד להסדרת מלוא התשלום כאמור. הלקוח יחוייב על העלויות הנוספות בגין זה.'
  },
  {
    num: 2,
    title: '2. אספקת מזון',
    icon: '🥣',
    content: 'מזון הכלב יסופק על ידי בעל הכלב עבור כל תקופת השהייה. במידה ומזון זה ייגמר במהלך השהייה, הריזורט יהא רשאי לרכוש עבור הכלב מזון חלופי, ועלות הרכישה תחול במלואה על בעל הכלב.'
  },
  {
    num: 3,
    title: '3. קולר הכלב',
    icon: '🐕',
    content: 'ככל שיימצא כי קולר הכלב אינו תקין או אינו בטוח לשימוש, הריזורט יהא רשאי לרכוש עבור הכלב קולר חלופי, ועלות הרכישה תחויב לבעל הכלב.'
  },
  {
    num: 4,
    title: '4. פטור מאחריות – אירועים עם כלבים אחרים או חיות בר',
    icon: '🛡️',
    content: 'הריזורט פועל במיטב יכולתו לשמירה על שלומם וביטחונם של הכלבים השוהים במתקן. עם זאת, בעל הכלב מצהיר כי ידוע לו שמדובר בבעלי חיים, ולא ניתן להבטיח מניעה מוחלטת של אירועים בלתי צפויים. הריזורט לא יישא באחריות לכל נזק, פציעה או תקיפה שייגרמו לכלב כתוצאה מתקיפת כלב אחר, בין אם במתקן ובין אם במהלך פעילות מחוצה לו, וכן לא יישא באחריות לכל נזק שייגרם לכלב כתוצאה מתקיפה או נשיכה של חיית בר.'
  },
  {
    num: 5,
    title: '5. הצהרת בריאות וגילוי נאות',
    icon: '🩺',
    content: 'בעל הכלב מצהיר ומאשר כי הכלב מחוסן כדין בהתאם לדרישות החוק. בעל הכלב מתחייב לגלות לריזורט, טרם מסירת הכלב, כל מידע רלוונטי לגביו, לרבות: מקרי תקיפה או נשיכה שביצע הכלב בעבר; צורך בנטילת תרופות קבועות; מצב רפואי המצריך התייחסות או תשומת לב מיוחדת; ורגישות לתנאי מזג אוויר. האחריות למסירת מידע מלא ומדויק כאמור חלה במלואה על בעל הכלב.'
  },
  {
    num: 6,
    title: '6. טיפול מונע והרשאה לטיפול וטרינרי',
    icon: '💉',
    content: 'בעל הכלב מתחייב למסור את הכלב לריזורט רק לאחר שעבר טיפול מונע נגד פרעושים וקרציות בסמוך למועד מסירתו. בעל הכלב מתיר בזאת לריזורט להזעיק וטרינר ו/או לספק לכלב כל טיפול רפואי דחוף אחר, ככל שיתעורר צורך בכך במהלך השהייה, ומתחייב לשאת במלוא העלויות הכרוכות בטיפול כאמור.'
  },
  {
    num: 7,
    title: '7. שעות פעילות',
    icon: '⏰',
    content: 'שעות פעילות המתקן הן בימים א׳–ה׳ בין השעות 09:00–17:00, ובימי שישי עד השעה 14:00. בשבתות המתקן סגור למעט מקרה חירום. מסירה או איסוף של הכלב מחוץ לשעות אלה, ככל שתואמו מראש, יחויבו בתשלום נוסף.'
  }
];

interface PublicIntakePageProps {
  settings: ResortSettings;
  onBackToApp?: () => void;
  isStaffPreview?: boolean;
  onStaffLoginClick?: () => void;
}

export const PublicIntakePage: React.FC<PublicIntakePageProps> = ({ 
  settings, 
  onBackToApp, 
  isStaffPreview = false,
  onStaffLoginClick
}) => {
  const today = getTodayStr();

  // Form State
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [dogName, setDogName] = useState('');
  const [dogBreed, setDogBreed] = useState('');
  const [dogAge, setDogAge] = useState('');
  const [dogGender, setDogGender] = useState<'male' | 'female'>('male');
  const [dogSize, setDogSize] = useState<'small' | 'medium' | 'large' | 'giant'>('medium');
  const [serviceType, setServiceType] = useState<ServiceType>('boarding');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 3));
  const [isFlexibleDates, setIsFlexibleDates] = useState(false);
  
  // Mandatory Vetting Questions State
  const [isFriendlyWithDogs, setIsFriendlyWithDogs] = useState<'yes' | 'no' | 'depends'>('yes');
  const [isNeutered, setIsNeutered] = useState<boolean>(true);
  const [isVaccinated, setIsVaccinated] = useState<boolean>(true);
  const [isHouseTrained, setIsHouseTrained] = useState<boolean>(true);
  const [isTreatedParasites, setIsTreatedParasites] = useState<boolean>(true);
  const [specialNeeds, setSpecialNeeds] = useState('');
  const [freeText, setFreeText] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isQuickCallback, setIsQuickCallback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saturdayWarning, setSaturdayWarning] = useState<string | null>(null);
  const [isSendIntakeModalOpen, setIsSendIntakeModalOpen] = useState(false);
  const [copiedDirectLink, setCopiedDirectLink] = useState(false);

  // Phone Identification & Verification State
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [phoneCheckResult, setPhoneCheckResult] = useState<PhoneVerificationResult | null>(null);
  const [hasCheckedPhone, setHasCheckedPhone] = useState(false);
  const [showVoucherOrReferralBox, setShowVoucherOrReferralBox] = useState(false);

  // Mandatory Terms & Conditions Acceptance State
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  // Client Relationship & Voucher Code State
  type ClientOriginType = 'new' | 'returning' | 'referral';
  const [clientOrigin, setClientOrigin] = useState<ClientOriginType>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const v = (params.get('voucher') || '').trim();
      const vUpper = v.toUpperCase();
      if (vUpper.startsWith('FRIEND-') || v.startsWith('חבר-')) return 'referral';
      if (vUpper.startsWith('VIP-') || v.startsWith('פינוק-') || v.startsWith('ויאיפי-') || v.startsWith('יום-כיף-')) return 'returning';
    }
    return 'new';
  });
  const [referralFriendName, setReferralFriendName] = useState('');
  const [voucherCode, setVoucherCode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return (params.get('voucher') || '').trim();
    }
    return '';
  });

  const matchedVoucher = useMemo(() => {
    if (!voucherCode.trim()) return null;
    return findVoucherByCode(voucherCode.trim());
  }, [voucherCode]);

  // Customer's choice of perk/benefit
  const [selectedBenefitId, setSelectedBenefitId] = useState<string>('discount_100');

  // Phone number verification hook (debounce 400ms)
  useEffect(() => {
    const clean = (ownerPhone || '').replace(/\D/g, '');
    if (clean.length < 8) {
      setPhoneCheckResult(null);
      setHasCheckedPhone(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingPhone(true);
      try {
        const result = await verifyCustomerByPhone(ownerPhone);
        setPhoneCheckResult(result);
        setHasCheckedPhone(true);
        if (result.isKnown) {
          setClientOrigin('returning');
          // Autofill empty fields if available
          if (result.name && !ownerName.trim()) {
            setOwnerName(result.name);
          }
          if (result.dogName && !dogName.trim()) {
            setDogName(result.dogName);
          }
          if (result.dogBreed && !dogBreed.trim()) {
            setDogBreed(result.dogBreed);
          }
        } else {
          setClientOrigin('new');
        }
      } catch (err) {
        console.warn('Phone check error:', err);
      } finally {
        setIsCheckingPhone(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [ownerPhone]);

  // Benefits are unlocked ONLY if phone is verified/known OR an active voucher is entered
  const isBenefitsUnlocked = Boolean(
    phoneCheckResult?.isKnown || (matchedVoucher && matchedVoucher.status === 'active') || voucherCode.trim().length >= 4
  );

  // Auto adjust dates when service is selected
  const handleServiceChange = (st: ServiceType) => {
    setServiceType(st);
    if (st === 'daycare' || st === 'training') {
      setEndDate(startDate);
    }
  };

  const daysCount = Math.max(1, calculateDaysCount(startDate, endDate));
  const nightsCount = Math.max(1, calculateDaysCount(startDate, endDate));

  const handleNightsChange = (delta: number) => {
    let newNights = Math.max(1, nightsCount + delta);
    let targetEnd = addDays(startDate, newNights);
    const endD = new Date(targetEnd + 'T00:00:00');
    if (endD.getDay() === 6 && serviceType === 'boarding') {
      // Cannot check out on Saturday - advance or back to avoid Saturday
      if (delta > 0) {
        newNights += 1;
        targetEnd = addDays(startDate, newNights);
      } else {
        newNights = Math.max(1, newNights - 1);
        targetEnd = addDays(startDate, newNights);
      }
    }
    setEndDate(targetEnd);
    setSaturdayWarning(null);
  };

  const handleStartDateChange = (newStart: string) => {
    if (!newStart) return;
    const currentNights = Math.max(1, calculateDaysCount(startDate, endDate));
    setStartDate(newStart);
    if (serviceType === 'daycare' || serviceType === 'training') {
      setEndDate(newStart);
    } else {
      let targetEnd = addDays(newStart, currentNights);
      const endD = new Date(targetEnd + 'T00:00:00');
      if (endD.getDay() === 6) {
        targetEnd = addDays(targetEnd, 1);
      }
      setEndDate(targetEnd);
    }
    setSaturdayWarning(null);
  };

  const handleEndDateChange = (val: string) => {
    if (!val) return;
    const d = new Date(val + 'T00:00:00');
    if (d.getDay() === 6 && serviceType === 'boarding') {
      const sun = addDays(val, 1);
      setEndDate(sun);
      setSaturdayWarning('⚠️ היציאה אינה יכולה להיות ביום שבת (אין שחרורים בשבת). תאריך היציאה עודכן ליום ראשון בשעה 09:00.');
    } else {
      setEndDate(val);
      setSaturdayWarning(null);
    }
  };

  const applyDatePreset = (preset: 'weekend' | 'next_weekend' | 'midweek' | 'week' | 'twoweeks') => {
    const d = new Date(today + 'T00:00:00');
    const day = d.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat

    if (preset === 'weekend') {
      // Upcoming Friday to Sunday (2 nights)
      let daysToFri = (5 - day + 7) % 7;
      if (day === 6) daysToFri = 6;
      const s = addDays(today, daysToFri);
      setStartDate(s);
      setEndDate(addDays(s, 2)); // Friday + 2 days = Sunday!
      setSaturdayWarning(null);
    } else if (preset === 'next_weekend') {
      // Following Friday to Sunday (2 nights)
      let daysToFri = (5 - day + 7) % 7;
      if (day === 6) daysToFri = 6;
      const s = addDays(today, daysToFri + 7);
      setStartDate(s);
      setEndDate(addDays(s, 2)); // Friday + 2 days = Sunday!
      setSaturdayWarning(null);
    } else if (preset === 'midweek') {
      // Upcoming Sunday to Friday (5 nights: Sunday to Friday morning, including Thursday night)
      let daysToSun = (7 - day) % 7;
      if (day === 0) daysToSun = 7;
      const s = addDays(today, daysToSun);
      setStartDate(s);
      setEndDate(addDays(s, 5)); // Sunday + 5 days = Friday!
      setSaturdayWarning(null);
    } else if (preset === 'week') {
      let targetEnd = addDays(startDate, 7);
      const endD = new Date(targetEnd + 'T00:00:00');
      if (endD.getDay() === 6) targetEnd = addDays(targetEnd, 1); // skip Saturday
      setEndDate(targetEnd);
      setSaturdayWarning(null);
    } else if (preset === 'twoweeks') {
      let targetEnd = addDays(startDate, 14);
      const endD = new Date(targetEnd + 'T00:00:00');
      if (endD.getDay() === 6) targetEnd = addDays(targetEnd, 1); // skip Saturday
      setEndDate(targetEnd);
      setSaturdayWarning(null);
    }
  };

  // Strict Validation Function
  const validateForm = (): boolean => {
    setErrorMessage(null);
    if (!ownerName.trim()) {
      setErrorMessage('נא למלא שם בעלים מלא (שדה חובה)');
      return false;
    }
    if (!ownerPhone.trim()) {
      setErrorMessage('נא למלא מספר טלפון נייד (שדה חובה)');
      return false;
    }
    if (!dogName.trim()) {
      setErrorMessage('נא למלא את שם הכלב/ה (שדה חובה)');
      return false;
    }
    if (!dogBreed.trim()) {
      setErrorMessage('נא למלא את גזע הכלב (שדה חובה - אם מעורב כתבו מעורב)');
      return false;
    }
    if (!startDate) {
      setErrorMessage(serviceType === 'training' 
        ? 'נא לבחור תאריך כניסה / הגעה לאילוף (שדה חובה)'
        : 'נא לבחור תאריך כניסה / הגעה לריזורט (שדה חובה)');
      return false;
    }
    if (serviceType !== 'training') {
      if (!endDate) {
        setErrorMessage('נא לבחור תאריך איסוף / יציאה מהריזורט (שדה חובה)');
        return false;
      }
      if (endDate < startDate) {
        setErrorMessage('תאריך היציאה אינו יכול להיות מוקדם מתאריך הכניסה');
        return false;
      }
      if (serviceType === 'boarding') {
        const endD = new Date(endDate + 'T00:00:00');
        if (endD.getDay() === 6) {
          setErrorMessage('היציאה לא יכולה להיות ביום שבת (אין שחרורים בשבת). היציאה מסופ״ש הינה ביום ראשון בשעה 09:00.');
          return false;
        }
      }
    }
    if (!specialNeeds.trim()) {
      setErrorMessage('סעיף 6 הינו שדה חובה: לחצו על הכפתור "הכלב בריא לחלוטין" או פרטו תרופות/צרכים מיוחדים בתיבה');
      return false;
    }
    if (!termsAccepted) {
      setErrorMessage('יש לקרוא ולאשר את תקנון הריזורט לכלב לצורך שליחת הבקשה (שדה חובה)');
      return false;
    }
    return true;
  };

  // Submit Handler
  const handleProcessSubmit = async (isCallbackOnly: boolean) => {
    if (!validateForm()) {
      // Scroll to error
      window.scrollTo({ top: 300, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    setIsQuickCallback(isCallbackOnly);

    const finalEndDate = serviceType === 'training' ? startDate : endDate;
    const requestId = `${isCallbackOnly ? 'call' : 'req'}-${Date.now()}`;
    const chosenBenefit = RESORT_BENEFIT_OPTIONS.find(b => b.id === selectedBenefitId);
    const newRequest: IntakeRequest = {
      id: requestId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerEmail: ownerEmail.trim() || undefined,
      dogName: dogName.trim(),
      dogBreed: dogBreed.trim(),
      dogAge: dogAge.trim() || undefined,
      dogGender,
      dogSize,
      serviceType,
      startDate,
      endDate: finalEndDate,
      isFriendlyWithDogs,
      isNeutered,
      isVaccinated,
      isHouseTrained,
      isTreatedParasites,
      specialNeeds: specialNeeds.trim(),
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
      isPhoneVerified: Boolean(phoneCheckResult?.isKnown),
      clientOrigin: phoneCheckResult?.isKnown ? 'returning' : (clientOrigin === 'referral' ? 'referral' : 'new'),
      selectedBenefitId: isBenefitsUnlocked ? selectedBenefitId : undefined,
      voucherCode: voucherCode.trim() || undefined,
      notes: [
        isCallbackOnly ? '[בקשת שיחה חוזרת טלפונית]' : '',
        isFlexibleDates ? '[תאריכים גמישים / בירור זמינות כללי]' : '',
        phoneCheckResult?.isKnown ? `[💎 לקוח חוזר מוכר: ${phoneCheckResult.name || ownerName} (${phoneCheckResult.totalVisits} ביקורים)]` : '[🐶 לקוח חדש]',
        clientOrigin === 'referral' ? `[🤝 חבר מביא חבר${referralFriendName.trim() ? `: הופנה ע״י ${referralFriendName.trim()}` : ''}]` : '',
        (isBenefitsUnlocked && chosenBenefit) ? `[🎁 הטבה שנבחרה: ${chosenBenefit.title} (${chosenBenefit.badge})]` : '',
        voucherCode.trim() ? `[🎟️ קוד שובר: ${voucherCode.trim()}]` : '',
        '[📜 תקנון הריזורט אושר כחוק]',
        freeText.trim()
      ].filter(Boolean).join(' | ') || undefined,
    };

    try {
      // 1. Save to Supabase and LocalStorage
      await saveIntakeRequestToDb(newRequest);

      // 2. Send instant email notification to shinshin1964@gmail.com
      const emailSubject = isCallbackOnly
        ? `📞 בקשת שיחה חוזרת מלקוח: ${dogName} (${ownerName} - ${ownerPhone})`
        : `🐾 בקשת קליטה חדשה בריזורט לכלב: ${dogName} (${ownerName})`;

      await sendResortEmailNotification(
        emailSubject,
        newRequest,
        freeText.trim()
      );

      // 3. Fallback WhatsApp notification
      sendResortWhatsAppNotification(formatIntakeNotification(newRequest), settings);

      setIsSubmitted(true);
    } catch (err) {
      console.error('Error submitting intake request:', err);
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success Screen
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100 text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-[#0f4c3a] leading-snug">
              תודה על משלוח שאלון בקשת הקליטה, בבקשה להמתין לתשובה. 🐾
            </h2>
            <p className="text-sm font-bold text-slate-700">
              פרטי הבקשה עבור {dogName} נקלטו בהצלחה בריזורט לכלב.
            </p>
          </div>

          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 text-center space-y-2 text-xs text-slate-700">
            <p className="text-emerald-950 font-bold leading-relaxed text-sm">
              צוות הריזורט קיבל את השאלון ויחזור אליכם בהקדם למספר <span className="font-mono font-black text-emerald-800">{ownerPhone}</span>.
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <a
              href={`https://wa.me/${settings.managerPhone?.replace(/\D/g, '') || '0548765888'}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md"
            >
              <span>💬 פתח שיחה ישירה עם צוות הריזורט</span>
            </a>

            {/* Back to Management App is ONLY allowed for authorized staff during preview */}
            {isStaffPreview && onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-2xl text-xs transition-all cursor-pointer border border-slate-200"
              >
                חזרה ליומן הניהול (תצוגת מנהל)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans py-6 px-3 sm:px-6 selection:bg-emerald-200" dir="rtl">
      <div className="max-w-xl mx-auto space-y-5">
        
        {/* Header with Resort Logo */}
        <header className="text-center space-y-2 pt-2">
          {isStaffPreview && onBackToApp && (
            <div className="flex justify-between items-center mb-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-amber-900 font-bold">
              <span>👁️ תצוגה מקדימה למנהל</span>
              <button
                type="button"
                onClick={onBackToApp}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>חזרה ליומן</span>
              </button>
            </div>
          )}

          <div className="inline-flex items-center justify-center p-3 bg-white rounded-3xl shadow-sm border border-slate-100">
            <img 
              src="/resort-logo.svg" 
              alt="לוגו הריזורט לכלב" 
              className="w-16 h-16 object-contain drop-shadow-xs" 
            />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-[#0f4c3a] tracking-tight">
            הריזורט לכלב
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-md mx-auto">
            שאלון בקשה לקליטה ושריון מקום 🐾 מלאו את פרטי הבקשה ונחזור אליכם טלפונית לתיאום והסדרת השריון.
          </p>

          {/* Proactive Send Form to Callers Banner (For staff preview only) */}
          {isStaffPreview && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-2xl p-3.5 sm:p-4 text-emerald-950 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-right mt-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-2xs shrink-0">
                  📲
                </div>
                <div>
                  <div className="font-black text-xs sm:text-sm text-emerald-950">
                    לקוח התקשר זה עתה? שלחו לו את השאלון ישירות למילוי
                  </div>
                  <div className="text-[11px] text-emerald-800 font-medium">
                    שליחת הודעת וואטסאפ מנומסת מוכנה מראש עם קישור ישיר לשאלון בקשה לקליטה זה
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSendIntakeModalOpen(true)}
                  className="w-full sm:w-auto bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>שלח שאלון ללקוח בוואטסאפ</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?intake=true`);
                    setCopiedDirectLink(true);
                    setTimeout(() => setCopiedDirectLink(false), 2500);
                  }}
                  className="bg-white hover:bg-emerald-100/60 border border-emerald-300 text-emerald-900 font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow-2xs cursor-pointer transition-all shrink-0"
                >
                  {copiedDirectLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDirectLink ? 'הועתק!' : 'העתק קישור'}</span>
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Active Voucher Detected Banner */}
        {voucherCode && (
          <div className="bg-gradient-to-r from-amber-500/15 via-amber-400/25 to-emerald-500/15 border-2 border-amber-400/60 rounded-3xl p-4 sm:p-5 shadow-md flex items-center gap-3.5 animate-in fade-in slide-in-from-top-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shrink-0 shadow-xs text-2xl">
              🎁
            </div>
            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-amber-950 uppercase tracking-wide">שובר הטבה מופעל:</span>
                <span className="font-mono font-black text-sm text-amber-950 bg-white/90 px-3 py-1 rounded-xl border border-amber-300 shadow-2xs">
                  {voucherCode}
                </span>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-lg border border-emerald-300">
                  100 ₪ הנחה
                </span>
              </div>
              <p className="text-xs text-amber-950 font-bold mt-1">
                ההטבה תקפה בהזמנת שהות של 3 ימים ומעלה (סופ״ש ארוך) · תוקף השובר הינו ל-6 חודשים · אין כפל הטבות ומבצעים
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                קוד השובר יישמר בשאלון וצוות הריזורט יעדכן את ההנחה בשריון ההזמנה 🐾
              </p>
            </div>
          </div>
        )}

        {/* Error Alert if validation fails */}
        {errorMessage && (
          <div className="bg-red-50 border-2 border-red-300 text-red-900 rounded-2xl p-4 flex items-center gap-3 text-xs font-black animate-shake">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Intake Form */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleProcessSubmit(false);
          }} 
          className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-5 sm:p-7 space-y-6"
        >
          
          {/* Section 0: Phone Identification & VIP Club Benefits */}
          <div className="bg-gradient-to-br from-emerald-50/80 via-slate-50 to-amber-50/60 border-2 border-emerald-200/90 rounded-3xl p-4 sm:p-6 space-y-4 shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                  <span className="text-base">📱</span>
                  <span>הזדהות לפי מספר טלפון נייד</span>
                  <span className="text-red-500">*</span>
                </label>
                {phoneCheckResult?.isKnown ? (
                  <span className="text-[11px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>לקוח חוזר מאומת</span>
                  </span>
                ) : hasCheckedPhone ? (
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                    לקוח חדש
                  </span>
                ) : null}
              </div>

              <div className="relative">
                <input
                  type="tel"
                  required
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="הזינו מספר נייד (למשל: 05X-XXXXXXX)"
                  className="w-full bg-white border-2 border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 rounded-2xl px-4 py-3 text-sm sm:text-base font-black text-slate-900 focus:outline-none transition-all shadow-xs font-mono"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {isCheckingPhone && (
                    <span className="text-xs text-slate-400 flex items-center gap-1 animate-pulse">
                      <span>בודק...</span>
                    </span>
                  )}
                  {phoneCheckResult?.isKnown && (
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </div>

              {/* Status Hints & Identification Feedback */}
              {!ownerPhone || ownerPhone.replace(/\D/g, '').length < 8 ? (
                <p className="text-[11px] text-slate-500 font-medium mt-1.5">
                  הזינו מספר טלפון נייד מלא לצורך זיהוי במערכת ובדיקת זכאות להטבות מועדון הריזורט 🐾
                </p>
              ) : isCheckingPhone ? (
                <p className="text-[11px] text-emerald-800 font-bold mt-1.5 flex items-center gap-1 animate-pulse">
                  <span>⏳</span>
                  <span>בודק זכאות להטבות במאגר הלקוחות...</span>
                </p>
              ) : phoneCheckResult?.isKnown ? (
                <div className="mt-3 p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 border-2 border-emerald-400 rounded-2xl text-xs space-y-1.5 shadow-xs animate-in fade-in">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💎</span>
                      <span className="font-black text-emerald-950 text-xs sm:text-sm">
                        שלום {phoneCheckResult.name || 'לקוח יקר'}! זוהית כלקוח חוזר של הריזורט 🐾
                      </span>
                    </div>
                    {phoneCheckResult.isVip && (
                      <span className="bg-amber-400 text-amber-950 font-black text-[10px] px-2 py-0.5 rounded-md shadow-2xs">
                        חבר VIP ותיק ({phoneCheckResult.totalVisits} אירוחים)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-900 font-medium leading-relaxed">
                    {phoneCheckResult.dogName 
                      ? `איזה כיף לפגוש שוב אתכם ואת ${phoneCheckResult.dogName}! פרטי התיק הקודם שלכם נטענו להקלה על המילוי.`
                      : 'איזה כיף לראות אתכם שוב! נשתמש בתיק הקיים שלכם במערכת.'}
                  </p>
                  {phoneCheckResult.isVip && (
                    <div className="pt-1.5 border-t border-emerald-200/80 text-[11px] font-black text-amber-950 flex items-center gap-1.5">
                      <span>🌟</span>
                      <span>זכאות VIP: עומדת לרשותכם גם הטבת יום כיף VIP מלא במתחם הדשא (09:00-19:00) מתנה!</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-2 shadow-2xs animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🐶</span>
                      <span className="font-black text-slate-800">
                        ברוכים הבאים לריזורט לכלב!
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                      אורח חדש
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    מספר הטלפון לא נמצא במאגר לקוחות העבר שלנו, נשמח להכיר אתכם ואת כלבכם לראשונה! הטבות מועדון לקוחות חוזרים מיועדות ללקוחות מוכרים במערכת.
                  </p>
                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowVoucherOrReferralBox(!showVoucherOrReferralBox)}
                      className="text-xs font-bold text-teal-800 hover:text-teal-950 flex items-center gap-1.5 cursor-pointer underline"
                    >
                      <span>🎁</span>
                      <span>{showVoucherOrReferralBox ? 'הסתר הזנת שובר / חבר מביא חבר' : 'יש לכם קוד שובר הטבה או הגעתם דרך ״חבר מביא חבר״? לחצו כאן'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Voucher / Referral Code Section for New Clients or Voucher holders */}
            {(showVoucherOrReferralBox || voucherCode || clientOrigin === 'referral') && (
              <div className="pt-3 border-t border-slate-200/80 space-y-3 animate-in fade-in">
                {/* Referral Friend Note */}
                <div className="p-3 bg-teal-50/90 border border-teal-200 rounded-xl text-xs text-teal-950 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🤝</span>
                    <span className="font-bold leading-snug">
                      הגעתם בהמלצת חבר שהתארח אצלנו? שניכם תיהנו מ-100 ₪ הנחה לשהות של 3 ימים ומעלה (סופ״ש ארוך).
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-teal-900 block mb-1">
                      מי החבר/ה שהמליצו לכם? (שם בעלים או שם כלב):
                    </label>
                    <input
                      type="text"
                      value={referralFriendName}
                      onChange={(e) => {
                        setReferralFriendName(e.target.value);
                        if (e.target.value.trim()) setClientOrigin('referral');
                      }}
                      placeholder="למשל: דנה כהן (הכלב מקס)"
                      className="w-full bg-white border border-teal-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Voucher Code Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-amber-600" />
                      <span>קוד שובר הטבה / קופון (אופציונלי):</span>
                    </label>
                    {voucherCode && (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>הקוד הוזן בהצלחה</span>
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.trim())}
                      placeholder="הזינו קוד שובר (למשל: חבר-מקס-123, VIP-מקס-456, פינוק-789)"
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none tracking-wider font-mono placeholder:font-sans placeholder:font-normal shadow-2xs"
                      dir="auto"
                    />
                    {voucherCode && (
                      <button
                        type="button"
                        onClick={() => setVoucherCode('')}
                        className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        נקה
                      </button>
                    )}
                  </div>

                  {voucherCode && (
                    matchedVoucher?.status === 'redeemed' ? (
                      <div className="mt-2 p-2.5 bg-red-50 border border-red-300 rounded-xl text-xs text-red-950 flex items-start gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="leading-snug">
                          <span className="font-black text-red-900">קוד שובר זה כבר נוצל בעבר! ⚠️</span>
                          <div className="text-[10px] text-red-800 mt-0.5">
                            השובר מומש {matchedVoucher.redeemedAt ? `בתאריך ${formatDateIL(matchedVoucher.redeemedAt)}` : ''} {matchedVoucher.redeemedByOwner ? `ע״י ${matchedVoucher.redeemedByOwner}` : ''}. שוברי הטבה תקפים לשימוש חד-פעמי בלבד.
                          </div>
                        </div>
                      </div>
                    ) : matchedVoucher && (matchedVoucher.status === 'expired' || (matchedVoucher.expiryDate && matchedVoucher.expiryDate < today)) ? (
                      <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="leading-snug">
                          <span className="font-black text-amber-900">תוקף השובר פג</span>
                          <div className="text-[10px] text-amber-800 mt-0.5">
                            תוקף שובר זה פג בתאריך {formatDateIL(matchedVoucher.expiryDate)}.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-400/90 rounded-xl text-xs text-emerald-950 flex items-start gap-2 animate-in fade-in">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="leading-snug">
                          <span className="font-black text-emerald-900">
                            {matchedVoucher ? '✅ שובר מאומת ופעיל!' : '🎁 קוד שובר זוהה:'}
                          </span>{' '}
                          <span className="font-bold text-emerald-950">
                            {matchedVoucher?.benefitText || 'שובר תקף לבחירת הטבה'}
                          </span>
                          <div className="text-[10px] text-emerald-800 font-medium mt-0.5">
                            * תנאי המבצע: תוקף השובר הינו 6 חודשים · בהזמנת מינימום 3 ימים (סופ״ש ארוך) · אין כפל הטבות ומבצעים · ההטבה תאושר ע״י הריזורט בתיאום ההזמנה.
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Interactive VIP Benefit Choice Menu - ONLY SHOWN IF PHONE IS VERIFIED IN DB OR AN ACTIVE VOUCHER IS ENTERED */}
            {isBenefitsUnlocked && (
              <div className="space-y-2 pt-3 mt-3 border-t border-emerald-200/90 animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>בחרו את פינוק ה-VIP שלכם לשהות זו (מתנה 1 מתוך התפריט לבחירתכם):</span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-lg border border-amber-300">
                    ללא כפל הטבות
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {RESORT_BENEFIT_OPTIONS.map((opt) => {
                    const isSelected = selectedBenefitId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedBenefitId(opt.id)}
                        className={`p-2.5 rounded-xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-amber-50 to-amber-100/80 border-amber-500 ring-2 ring-amber-500/30 text-amber-950 shadow-xs font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-xl shrink-0 mt-0.5">{opt.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-black text-slate-900 leading-snug">{opt.title}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-200/70 text-amber-950 shrink-0">
                              {opt.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{opt.description}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0 mt-1" />}
                      </button>
                    );
                  })}
                </div>

                <div className="text-[10px] text-amber-900 font-medium">
                  * תנאי המבצע: תוקף ההטבה הינו 6 חודשים מיום הנפקתה · בהזמנת שהות של 3 ימים ומעלה (סופ״ש ארוך) · אין כפל הטבות ומבצעים · ההטבה שנבחרה תאושר ע״י הריזורט בתיאום ההזמנה.
                </div>
              </div>
            )}
          </div>
          
          {/* Section 1: Owner Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-[#0f4c3a] pb-1 border-b border-slate-100">
              <User className="w-4 h-4 text-emerald-600" />
              <span>פרטי איש קשר (הבעלים) <span className="text-red-500">*</span></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  שם מלא <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="למשל: דני לוי"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  כתובת אימייל (אופציונלי)
                </label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Dog Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-[#0f4c3a] pb-1 border-b border-slate-100">
              <Heart className="w-4 h-4 text-emerald-600" />
              <span>פרטי הכלב/ה <span className="text-red-500">*</span></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  שם הכלב/ה <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={dogName}
                  onChange={(e) => setDogName(e.target.value)}
                  placeholder="למשל: מקס"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  גזע הכלב <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={dogBreed}
                  onChange={(e) => setDogBreed(e.target.value)}
                  placeholder="למשל: לברדור / מעורב"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  גיל הכלב
                </label>
                <input
                  type="text"
                  value={dogAge}
                  onChange={(e) => setDogAge(e.target.value)}
                  placeholder="למשל: שנתיים / גור"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>
            </div>

            {/* Gender and Size row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Dog Gender */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  מין הכלב/ה <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDogGender('male')}
                    className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      dogGender === 'male'
                        ? 'bg-blue-600 text-white font-extrabold border-blue-600 shadow-xs ring-2 ring-blue-400/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    <span className="text-sm">זכר</span>
                    <span>♂️</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDogGender('female')}
                    className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      dogGender === 'female'
                        ? 'bg-pink-600 text-white font-extrabold border-pink-600 shadow-xs ring-2 ring-pink-400/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    <span className="text-sm">נקבה</span>
                    <span>♀️</span>
                  </button>
                </div>
              </div>

              {/* Dog Size */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  גודל ומשקל משוער <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'small', label: 'קטן', desc: 'עד 10 ק״ג' },
                    { id: 'medium', label: 'בינוני', desc: '10-25 ק״ג' },
                    { id: 'large', label: 'גדול', desc: '25-45 ק״ג' },
                    { id: 'giant', label: 'ענק', desc: 'מעל 45 ק״ג' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDogSize(s.id as any)}
                      className={`py-2 px-1 rounded-xl border text-center transition-all cursor-pointer ${
                        dogSize === s.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold">{s.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Service Type */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-[#0f4c3a] pb-1 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>השירות המבוקש <span className="text-red-500">*</span></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'boarding', icon: '🏨', title: 'פנסיון לינה', desc: 'אירוח מלא בריזורט' },
                { id: 'training', icon: '🎓', title: 'אילוף', desc: 'תכנית אילוף ושיקום' },
                { id: 'daycare', icon: '✂️', title: 'יום כיף (דייקר)', desc: 'שהות יומית ומשחקים' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleServiceChange(s.id as ServiceType)}
                  className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                    serviceType === s.id
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="text-xs font-bold">{s.title}</div>
                  <div className="text-[10px] text-slate-500 font-normal">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Dates */}
          <div className="space-y-3.5 bg-emerald-50/50 p-4 sm:p-5 rounded-2xl border-2 border-emerald-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-emerald-200/80">
              <div className="flex items-center gap-2 text-sm font-black text-[#0f4c3a]">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>תאריכי השהות המבוקשים <span className="text-red-500">*</span></span>
              </div>
              <span className="text-xs font-black text-emerald-800 bg-white px-3 py-1 rounded-full border border-emerald-200 shadow-2xs self-start sm:self-auto">
                {serviceType === 'training' 
                  ? 'תחילת אילוף (משך יקבע בשיחה)' 
                  : serviceType === 'daycare' 
                  ? 'שהות יומית (ללא לינה)' 
                  : `סה״כ ${daysCount} ${daysCount === 1 ? 'יום' : 'ימים'} (${nightsCount} ${nightsCount === 1 ? 'לילה' : 'לילות'})`}
              </span>
            </div>

            {/* DAYCARE SINGLE-DAY MODE */}
            {serviceType === 'daycare' ? (
              <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 block">
                    ☀️ בחר את תאריך יום הכיף המבוקש *
                  </label>
                  <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                    שעות פעילות: 09:00 - 19:00
                  </span>
                </div>

                {/* Quick Chips for Daycare */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 self-center ml-1">בחירה מהירה:</span>
                  {[
                    { label: 'היום', date: today },
                    { label: 'מחר', date: addDays(today, 1) },
                    { label: 'מחרתיים', date: addDays(today, 2) },
                  ].map(chip => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => { setStartDate(chip.date); setEndDate(chip.date); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        startDate === chip.date
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-emerald-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      {chip.label} (יום {getDayNameHebrew(chip.date)})
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="date"
                    required
                    min={today}
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setEndDate(e.target.value);
                    }}
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono transition-all"
                  />
                  <div className="mt-1.5 text-xs text-emerald-800 font-black flex items-center gap-1">
                    <span>📅 יום {getDayNameHebrew(startDate)}, {formatDateIL(startDate)}</span>
                  </div>
                </div>
              </div>
            ) : serviceType === 'training' ? (
              /* TRAINING DEDICATED START DATE MODE */
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black text-slate-900 block">
                      🎓 תאריך הגעה / כניסה לאילוף *
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      בחר מתי תרצו להתחיל את תהליך האילוף בריזורט
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    תכנית מותאמת אישית
                  </span>
                </div>

                {/* Quick Start Chips for Training */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 self-center ml-1">התחלה מהירה:</span>
                  {[
                    { label: 'מחר', date: addDays(today, 1) },
                    { 
                      label: 'תחילת שבוע הבא', 
                      date: (() => {
                        const d = new Date(today + 'T00:00:00');
                        const day = d.getDay();
                        let daysToSun = (0 - day + 7) % 7;
                        if (daysToSun === 0) daysToSun = 7;
                        return addDays(today, daysToSun);
                      })() 
                    },
                    { label: 'בעוד שבוע', date: addDays(today, 7) },
                    { label: 'בעוד שבועיים', date: addDays(today, 14) },
                  ].map(chip => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => { setStartDate(chip.date); setEndDate(chip.date); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        startDate === chip.date
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-emerald-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      {chip.label} (יום {getDayNameHebrew(chip.date)})
                    </button>
                  ))}
                </div>

                {/* Date Input */}
                <div className="relative">
                  <input
                    type="date"
                    required
                    min={today}
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setEndDate(e.target.value);
                    }}
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono transition-all"
                  />
                  <div className="mt-1.5 text-xs text-emerald-800 font-black flex items-center gap-1">
                    <span>📅 יום {getDayNameHebrew(startDate)}, {formatDateIL(startDate)}</span>
                  </div>
                </div>

                {/* Helpful Note */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 flex items-start gap-2">
                  <span className="text-base shrink-0">💡</span>
                  <p className="leading-relaxed">
                    <strong>לידיעתכם:</strong> כל אילוף בריזורט הינו תהליך ייחודי ומותאם אישית. תאריך הסיום ומשך התכנית יסוכמו בשיחה אישית עם שמוליק לאחר אבחון הצרכים.
                  </p>
                </div>
              </div>
            ) : (
              /* BOARDING OVERNIGHT MODE */
              <div className="space-y-3">
                
                {/* 1. Check-in Date */}
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🏨 1. תאריך הגעה / כניסה לריזורט *</span>
                    </label>
                    <span className="text-xs text-emerald-800 font-black">
                      {startDate ? `יום ${getDayNameHebrew(startDate)}` : ''}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      min={today}
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono transition-all"
                    />
                    <div className="mt-1 text-[11px] text-slate-500 font-bold flex items-center justify-between">
                      <span>כניסה: {startDate ? formatDateIL(startDate) : ''}</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartDateChange(today)}
                          className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer font-bold"
                        >
                          היום
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartDateChange(addDays(today, 1))}
                          className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer font-bold"
                        >
                          מחר
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. BETWEEN: Popular Presets & Duration Across FULL WIDTH */}
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-emerald-300/80 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⏱️</span>
                      <div>
                        <span className="text-xs font-black text-slate-900 block">
                          תקופות נפוצות ומשך השהות (בחירה מהירה):
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          הקליקו על תקופה מוכנה או כווננו את כמות הלילות
                        </span>
                      </div>
                    </div>

                    {/* Interactive Nights Stepper */}
                    <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-700">לילות:</span>
                      <div className="flex items-center border border-slate-300 rounded-lg bg-white shadow-2xs overflow-hidden">
                        <button
                          type="button"
                          disabled={nightsCount <= 1}
                          onClick={() => handleNightsChange(-1)}
                          className="w-7 h-7 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 flex items-center justify-center font-black text-slate-700 transition-all cursor-pointer border-l border-slate-200"
                          title="הפחת לילה (-1)"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-black text-emerald-950 min-w-[2rem] text-center font-mono">
                          {nightsCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleNightsChange(1)}
                          className="w-7 h-7 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center font-black text-emerald-800 transition-all cursor-pointer border-r border-slate-200"
                          title="הוסף לילה (+1)"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-800">
                        ({daysCount} ימים)
                      </span>
                    </div>
                  </div>

                  {/* 5 Preset Cards Arranged Cleanly Across Full Width */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 w-full">
                    {[
                      { 
                        id: 'weekend', 
                        icon: '🌟', 
                        title: 'סופ״ש הקרוב', 
                        subtitle: 'שישי 14:00 ➔ ראשון 09:00', 
                        detail: '2 לילות',
                        matches: nightsCount === 2 && getDayNameHebrew(startDate) === 'שישי' && getDayNameHebrew(endDate) === 'ראשון'
                      },
                      { 
                        id: 'next_weekend', 
                        icon: '📅', 
                        title: 'סופ״ש הבא', 
                        subtitle: 'שישי הבא ➔ ראשון', 
                        detail: '2 לילות',
                        matches: false
                      },
                      { 
                        id: 'midweek', 
                        icon: '💼', 
                        title: 'אמצע שבוע', 
                        subtitle: 'ראשון ➔ שישי (עד 14:00)', 
                        detail: '5 לילות',
                        matches: nightsCount === 5 && getDayNameHebrew(startDate) === 'ראשון' && getDayNameHebrew(endDate) === 'שישי'
                      },
                      { 
                        id: 'week', 
                        icon: '🏖️', 
                        title: 'שבוע מלא', 
                        subtitle: '7 לילות', 
                        detail: '8 ימים',
                        matches: nightsCount === 7
                      },
                      { 
                        id: 'twoweeks', 
                        icon: '🌴', 
                        title: 'שבועיים', 
                        subtitle: '14 לילות', 
                        detail: '15 ימים',
                        matches: nightsCount === 14
                      },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyDatePreset(preset.id as any)}
                        className={`w-full p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          preset.matches
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-500/30'
                            : 'bg-slate-50 hover:bg-emerald-50/80 text-slate-800 border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="text-base">{preset.icon}</div>
                        <div className={`text-xs font-extrabold ${preset.matches ? 'text-white' : 'text-slate-900'}`}>
                          {preset.title}
                        </div>
                        <div className={`text-[10px] font-medium leading-tight ${preset.matches ? 'text-emerald-100' : 'text-slate-500'}`}>
                          {preset.subtitle}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          preset.matches ? 'bg-white/20 text-white' : 'bg-emerald-100/70 text-emerald-800'
                        }`}>
                          {preset.detail}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold text-center mt-2.5">
                    💡 בחירה בלחצן מהיר מגדירה תאריכים מראש, אך ניתן תמיד לערוך ולשנות את התאריכים באופן חופשי בשדות למטה לפי רצונכם.
                  </p>
                </div>

                {/* 3. Check-out Date */}
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🚗 2. תאריך איסוף / יציאה מהריזורט *</span>
                    </label>
                    <span className="text-xs text-emerald-800 font-black">
                      {endDate ? `יום ${getDayNameHebrew(endDate)}` : ''}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      min={startDate}
                      value={endDate}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono transition-all"
                    />
                    <div className="mt-1 text-[11px] text-slate-500 font-bold flex items-center justify-between">
                      <span>יציאה: {endDate ? formatDateIL(endDate) : ''}</span>
                      <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        איסוף ביום {getDayNameHebrew(endDate)} (סה״כ {nightsCount} לילות)
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Mandatory Operating Hours & Customer Service Policy */}
                <div className="bg-amber-50/95 border-2 border-amber-300/90 rounded-2xl p-3.5 sm:p-4 text-xs text-amber-950 space-y-2.5 shadow-2xs">
                  <div className="font-black text-amber-950 flex items-center gap-2 text-xs sm:text-sm">
                    <span className="text-base">⏰</span>
                    <span>שעות פעילות הריזורט לכלב בימים א-ה הן 09:00 - 19:00</span>
                  </div>
                  <div className="space-y-2 font-bold leading-relaxed pr-1">
                    <p>
                      • <strong>בשישי וערב חג:</strong> עד שעה <strong>14:00</strong>, ובצאת השבת / החג (למחרת השבת / חג) משעה <strong>09:00</strong>.
                    </p>
                    <div className="text-amber-950 bg-amber-100/90 p-2.5 sm:p-3 rounded-xl border border-amber-300/90 font-black leading-relaxed space-y-1 mt-1">
                      <p className="text-[11px] sm:text-xs">
                        מעבר לשעות הפעילות (לפני 09:00 ואחרי 19:00), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾
                      </p>
                    </div>
                  </div>
                </div>

                {saturdayWarning && (
                  <div className="bg-red-50 border-2 border-red-300 text-red-900 rounded-xl p-3 text-xs font-black flex items-center gap-2 animate-shake">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{saturdayWarning}</span>
                  </div>
                )}

              </div>
            )}

            {/* Flexible dates toggle */}
            <label className="flex items-center gap-2 pt-1 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isFlexibleDates}
                onChange={(e) => setIsFlexibleDates(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="font-semibold text-slate-700">התאריכים גמישים / עדיין לא סופיים (בירור זמינות ראשוני)</span>
            </label>
          </div>

          {/* Section 5: Mandatory Vetting Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-black text-[#0f4c3a]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>שאלות סינון מקצועיות (חובה) <span className="text-red-500">*</span></span>
              </div>
              <span className="text-[10px] bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded-full border border-red-200">
                שדות חובה
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              
              {/* Question 1: Friendly with other dogs */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border-2 border-emerald-200/80 space-y-2">
                <label className="font-extrabold text-slate-900 block text-xs">
                  🐕 1. האם הכלב מסתדר עם כלבים אחרים? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'yes', label: 'כן, חברותי מאוד 🟢' },
                    { id: 'depends', label: 'תלוי בסיטואציה 🟡' },
                    { id: 'no', label: 'לא / תוקפני / לבד / חייב בידוד 🔴' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setIsFriendlyWithDogs(f.id as any)}
                      className={`py-2.5 px-2 rounded-xl border text-center font-black transition-all cursor-pointer ${
                        isFriendlyWithDogs === f.id
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/20'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 2, 3, 4, 5: Yes/No Vetting Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 2. Neutered */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border-2 border-emerald-200/80 flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs">
                    ✂️ 2. {dogGender === 'female' ? 'מעוקרת?' : 'מסורס?'} <span className="text-red-500">*</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsNeutered(true)}
                      className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                        isNeutered ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs' : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      כן
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNeutered(false)}
                      className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                        !isNeutered ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      לא
                    </button>
                  </div>
                </div>

                {/* 3. Vaccinated */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border-2 border-emerald-200/80 flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs">
                    💉 3. חיסונים בתוקף? <span className="text-red-500">*</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsVaccinated(true)}
                      className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                        isVaccinated ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs' : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      כן בתוקף
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsVaccinated(false)}
                      className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                        !isVaccinated ? 'bg-red-600 text-white border-red-600 shadow-xs' : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      לא בטוח
                    </button>
                  </div>
                </div>

                {/* 4. House / Potty Trained */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border-2 border-emerald-200/80 flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs">
                    🚽 4. מחונך לצרכים? <span className="text-red-500">*</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsHouseTrained(true)}
                      className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                        isHouseTrained ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs' : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      כן
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsHouseTrained(false)}
                      className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                        !isHouseTrained ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      לא
                    </button>
                  </div>
                </div>

                {/* 5. Treated against Ticks and Fleas */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border-2 border-emerald-200/80 flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs">
                    🛡️ 5. מטופל נגד קרציות ופשפשים? <span className="text-red-500">*</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsTreatedParasites(true)}
                      className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                        isTreatedParasites ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs' : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      כן
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTreatedParasites(false)}
                      className={`px-4 py-1.5 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                        !isTreatedParasites ? 'bg-red-600 text-white border-red-600 shadow-xs' : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      לא
                    </button>
                  </div>
                </div>
              </div>

              {/* Question 6: Special needs or medication */}
              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-emerald-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-slate-900 block text-xs">
                    🩺 6. מצב בריאותי, צרכים מיוחדים או תרופות <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    שדה חובה
                  </span>
                </div>

                {/* Dominant "Completely Healthy" Button - Prominent, full box size */}
                <button
                  type="button"
                  onClick={() => setSpecialNeeds('בריא לחלוטין (אין תרופות או צרכים מיוחדים)')}
                  className={`w-full py-3.5 px-4 rounded-xl border-2 text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                    specialNeeds === 'בריא לחלוטין (אין תרופות או צרכים מיוחדים)'
                      ? 'bg-[#065f46] text-white border-[#065f46] ring-2 ring-emerald-500/40 shadow-emerald-900/20'
                      : 'bg-emerald-50 hover:bg-emerald-100/90 text-emerald-950 border-emerald-300 hover:border-emerald-400 hover:shadow-md'
                  }`}
                >
                  {specialNeeds === 'בריא לחלוטין (אין תרופות או צרכים מיוחדים)' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                      <span>✅ נבחר: הכלב בריא לחלוטין (אין תרופות או צרכים מיוחדים)</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">🟢</span>
                      <span>לחצו כאן אם הכלב בריא לחלוטין (ללא תרופות או מזון מיוחד)</span>
                    </>
                  )}
                </button>

                {/* Input box for special needs / medication */}
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-slate-600 block">
                    או הקלידו כאן פירוט אם הכלב נוטל תרופות, מזון רפואי או רגישויות:
                  </label>
                  <input
                    type="text"
                    value={specialNeeds === 'בריא לחלוטין (אין תרופות או צרכים מיוחדים)' ? '' : specialNeeds}
                    onChange={(e) => setSpecialNeeds(e.target.value)}
                    placeholder='למשל: "מקבל חצי כדור בבוקר", "אוכל רפואי בלבד", "רגישות לעוף"...'
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Question 5: Free Text Field */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  💬 שדה טקסט חופשי / מה תרצו לשאול או לספר לנו?
                </label>
                <textarea
                  rows={3}
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="כתבו לנו כאן כל שאלה לגבי השהות, בקשה מיוחדת או פרט שחשוב שנדע..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

            </div>
          </div>

          {/* Mandatory Terms & Conditions Acceptance */}
          <div className="bg-slate-50 border-2 border-emerald-300 rounded-2xl p-4 space-y-2.5 shadow-2xs">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="termsAccepted"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-[#065f46] rounded cursor-pointer shrink-0"
              />
              <label htmlFor="termsAccepted" className="text-xs sm:text-sm font-black text-slate-900 cursor-pointer select-none leading-snug">
                קראתי ואישרתי את <button type="button" onClick={() => setIsTermsModalOpen(true)} className="text-emerald-700 hover:text-emerald-900 underline font-black cursor-pointer mx-1">תקנון הריזורט לכלב</button> <span className="text-red-500">*</span>
              </label>
            </div>
            
            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-slate-200 flex-wrap gap-1">
              <span className="font-medium text-slate-500">
                אישור התקנון הינו תנאי מחייב להגשת בקשת שהייה בריזורט
              </span>
              <button
                type="button"
                onClick={() => setIsTermsModalOpen(true)}
                className="text-emerald-800 hover:text-emerald-950 font-bold underline flex items-center gap-1 cursor-pointer transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                <span>לקריאת התקנון המלא (7 סעיפים)</span>
              </button>
            </div>
          </div>

          {/* Action Buttons: Full Submit & Please Call Me */}
          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#065f46] hover:bg-[#044e45] active:scale-[0.99] text-white font-black py-4 rounded-2xl text-base shadow-lg shadow-emerald-950/10 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>שולח שאלון לריזורט...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>שלח שאלון בקשה לקליטה</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleProcessSubmit(true)}
              disabled={isSubmitting}
              className="w-full bg-emerald-50 hover:bg-emerald-100 active:scale-[0.99] text-emerald-900 border-2 border-emerald-400 font-black py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <PhoneCall className="w-4 h-4 text-emerald-700" />
              <span>📞 אנא התקשרו אלי (שיחה טלפונית לתיאום)</span>
            </button>

            {/* Direct WhatsApp Call & Chat Button */}
            <a
              href={`https://wa.me/${(settings.whatsappNotificationPhone || settings.managerPhone || '0548765888').replace(/\D/g, '').replace(/^0/, '972')}?text=${encodeURIComponent('שלום צוות הריזורט לכלב 🐾 רציתי לברר פרטים או לשוחח בוואטסאפ לגבי שהות/קליטה')}`}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-[#25D366] hover:bg-[#1EBE5D] active:scale-[0.99] text-white font-black py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <MessageSquare className="w-4 h-4" />
              <span>שיחה לוואטסאפ של הריזורט</span>
            </a>

            <p className="text-center text-[11px] text-slate-400 font-medium mt-2">
              🔒 הפרטים נשלחים ישירות לצוות הריזורט לכלב לצורך תיאום טלפוני ובדיקת זמינות.
            </p>
          </div>

        </form>

        <footer className="text-center text-xs text-slate-400 font-medium pb-6">
          הריזורט לכלב · פנסיון, אילוף ושיקום התנהגותי 🐾
        </footer>

        {/* Full Terms & Conditions Modal */}
        {isTermsModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in" dir="rtl">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
              
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-slate-50 to-emerald-50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-lg shadow-xs shrink-0">
                    📜
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      תקנון הריזורט לכלב
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      התנאים הבאים חלים על שהיית הכלב במתקן הריזורט לכלב
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content: 7 Clauses */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-slate-800 text-xs sm:text-sm leading-relaxed">
                {RESORT_BYLAWS_SECTIONS.map((clause) => (
                  <div key={clause.num} className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 space-y-1.5">
                    <div className="flex items-center gap-2 font-black text-slate-900 text-xs sm:text-sm">
                      <span className="text-base">{clause.icon}</span>
                      <span>{clause.title}</span>
                    </div>
                    <p className="text-slate-700 text-xs leading-normal pr-6">
                      {clause.content}
                    </p>
                  </div>
                ))}

                {/* Summary note */}
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs font-black text-amber-950 text-center">
                  ביצוע התשלום מהווה אישור מצד הלקוח כי קרא את התנאים לעיל והסכים להם במלואם.
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setTermsAccepted(true);
                    setIsTermsModalOpen(false);
                  }}
                  className="w-full sm:w-auto bg-[#065f46] hover:bg-[#044e45] text-white font-black px-6 py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>קראתי ואני מאשר/ת את התקנון</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(false)}
                  className="w-full sm:w-auto bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition-colors"
                >
                  סגור
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Proactive Send Form Modal */}
        <SendIntakeModal
          isOpen={isSendIntakeModalOpen}
          onClose={() => setIsSendIntakeModalOpen(false)}
          settings={settings}
        />

        {/* Discreet Staff Portal Link */}
        {onStaffLoginClick && (
          <div className="pt-6 pb-2 text-center">
            <button
              type="button"
              onClick={onStaffLoginClick}
              className="text-[11px] text-slate-400 hover:text-slate-600 font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>🔒 כניסת צוות ומנהלים</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
