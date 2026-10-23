import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  CreditCard, 
  Send, 
  MessageSquare, 
  Copy, 
  Check, 
  Sparkles, 
  Lock, 
  Loader2, 
  RefreshCw,
  Tag,
  CheckCircle2
} from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import { formatDateIL, formatStayDatesDisplay } from '../utils/dateUtils';
import { cleanPhoneNumber, getFirstName, getServiceTypeHebrew } from '../utils/whatsappUtils';
import { sendGreenApiDirectMessage } from '../services/notificationService';
import { createGrowDynamicPaymentLink } from '../services/growPaymentService';
import { isRealTrainingBooking } from '../utils/trainerPaymentUtils';
import { TrainingAgreementModal } from './TrainingAgreementModal';



interface SendPaymentLinkModalProps {
  isOpen: boolean;
  booking: Booking | null;
  settings: ResortSettings;
  onClose: () => void;
  onSentSuccess?: (msg: string) => void;
  onUpdateBooking?: (updatedBooking: Booking) => Promise<void> | void;
}

export const SendPaymentLinkModal: React.FC<SendPaymentLinkModalProps> = ({
  isOpen,
  booking,
  settings,
  onClose,
  onSentSuccess,
  onUpdateBooking,
}) => {
  if (!isOpen || !booking) return null;

  const currentDebt = Math.max(0, (Number(booking.totalPrice) || 0) - (Number(booking.depositAmount) || 0));
  const initialAmount = currentDebt > 0 ? currentDebt : (Number(booking.totalPrice) || 0);

  const defaultStaticLink = (
    settings.growPaymentLink || 
    settings.payboxPaymentLink || 
    settings.payboxLink || 
    'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg'
  );

  const isCheckedOutOrPast = booking.stayStatus === 'checked_out' || (booking.endDate && new Date(booking.endDate).getTime() < new Date().setHours(0,0,0,0));
  const isCurrentlyStaying = booking.stayStatus === 'checked_in' || (
    Boolean(booking.startDate && booking.endDate &&
    new Date(booking.startDate).getTime() <= Date.now() &&
    new Date(booking.endDate).getTime() >= new Date().setHours(0,0,0,0) &&
    booking.stayStatus !== 'checked_out' &&
    booking.stayStatus !== 'cancelled')
  );

  // Auto-detect initial payment reason:
  // If stay is already fully paid (debt = 0), Shmulik most likely wants to charge an extra!
  const [reasonType, setReasonType] = useState<'extra_day' | 'extra_service' | 'general_booking'>(() => {
    if (isCheckedOutOrPast) return 'extra_day';
    if (currentDebt === 0) return 'extra_service';
    return 'general_booking';
  });

  // Extras configuration state (free-text description that appears directly on invoice)
  const [extraDescription, setExtraDescription] = useState<string>('');
  const [extraAmount, setExtraAmount] = useState<number>(60);
  const [includeStayDebt, setIncludeStayDebt] = useState<boolean>(false);
  const [saveToBookingRecord, setSaveToBookingRecord] = useState<boolean>(true);
  const [addExtraToTotalBookingPrice, setAddExtraToTotalBookingPrice] = useState<boolean>(true);

  // Compute effective initial target amount
  const initialTargetAmt = reasonType === 'extra_service'
    ? (includeStayDebt && currentDebt > 0 ? 60 + currentDebt : 60)
    : initialAmount;

  const [amount, setAmount] = useState<number>(initialTargetAmt);
  const [customLink, setCustomLink] = useState<string>(defaultStaticLink);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isLockedLink, setIsLockedLink] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isManuallyEdited, setIsManuallyEdited] = useState<boolean>(false);

  // Training Agreement Blocking Rule: "אין לאפשר תשלום של דמי האילוף למי שלא חתם על ההסכם"
  const isTraining = isRealTrainingBooking(booking) || booking.serviceType === 'training' || booking.serviceType === 'day_training';
  const [isAgreementSigned, setIsAgreementSigned] = useState<boolean>(() => {
    return Boolean(
      booking.isTrainingAgreementSigned || 
      booking.trainingAgreement?.ownerSignatureDataUrl || 
      booking.signatureDataUrl
    );
  });
  const [isTrainingAgreementModalOpen, setIsTrainingAgreementModalOpen] = useState(false);
  const [managerOverride, setManagerOverride] = useState<boolean>(false);

  // Exemption 1: Grandfathered training dogs admitted or created before digital agreement feature (~20/10/2026)
  // Until all pre-agreement dogs complete their stays, they are exempt from agreement blocking
  const isLegacyPreAgreementBooking = Boolean(
    (booking.startDate && booking.startDate < '2026-10-20') ||
    (booking.createdAt && booking.createdAt < '2026-10-20T00:00:00')
  );

  // Exemption 2: If training fee was already paid in full, any new link is for extras/debts, not core training fee
  const isTrainingFeeAlreadyPaid = booking.paymentStatus === 'fully_paid' || 
    (Number(booking.depositAmount) >= Number(booking.totalPrice) && Number(booking.totalPrice) > 0);

  // Exemption 3: Extra services / extra days are incidental charges during stay, not core training fee
  const isExtraCharge = reasonType === 'extra_service' || reasonType === 'extra_day';

  // Hard blocking is only for genuinely new unpaid training bookings where agreement is unsigned
  const isHardBlocked = isTraining && 
    !isAgreementSigned && 
    !isLegacyPreAgreementBooking && 
    !isTrainingFeeAlreadyPaid && 
    !isExtraCharge && 
    !managerOverride;

  const cleanPhone = cleanPhoneNumber(booking.ownerPhone);
  const intlPhone = cleanPhone.startsWith('0') 
    ? '972' + cleanPhone.substring(1) 
    : (cleanPhone.startsWith('5') && cleanPhone.length === 9 ? '972' + cleanPhone : cleanPhone);
  const firstName = getFirstName(booking.ownerName);
  const serviceHebrew = getServiceTypeHebrew(booking.serviceType);
  const stayDates = formatStayDatesDisplay(booking.startDate, booking.endDate, booking.serviceType);

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

  // Construct official payment message according to reason and extras
  const buildDefaultMessage = (
    amt: number,
    rawLink: string,
    locked: boolean,
    reason: 'extra_day' | 'extra_service' | 'general_booking',
    extDesc = extraDescription,
    extAmt = extraAmount,
    incStay = includeStayDebt
  ) => {
    const formattedLink = formatLink(rawLink);
    const amountSection = amt > 0 ? `\n💰 *הסכום לתשלום:* ₪${amt}\n` : '';
    const amountHint = locked 
      ? ` (סכום ₪${amt} מעודכן ונעול לתשלום)` 
      : (amt > 0 ? ` (יש להזין ₪${amt} בעמוד התשלום)` : '');

    if (reason === 'extra_day') {
      return `היי ${firstName}! 🐾
בהמשך לשהייה של *${booking.dogName}* בריזורט לכלב, מצורף קישור מאובטח להסדרת התשלום עבור היום הנוסף / סיום השהייה:${amountSection}
👉 ${formattedLink}${amountHint}

💡 *לתשלום ב-Bit, Apple Pay, Google Pay, PayBox, אשראי או העברה בנקאית:* פשוט לוחצים על הקישור למעלה ובוחרים באמצעי התשלום הרצוי (התשלום נקלט ומעדכן את המערכת אוטומטית עם קבלה וחשבונית מס מיידית!).

נשמח לראותכם שוב בריזורט! 🐕🤍
שמוליק וצוות הריזורט לכלב 🐾`;
    }

    if (reason === 'extra_service') {
      const descText = extDesc.trim() || 'שירות נוסף / אקסטרה';
      if (incStay && currentDebt > 0) {
        return `היי ${firstName}! 🐾
בהמשך לשהייה של *${booking.dogName}* בריזורט לכלב, מצורף קישור מאובטח להסדרת התשלום הכולל (שהייה + תוספת אקסטרה):
✨ *תוספת:* ${descText} (₪${extAmt})
🏠 *יתרת שהייה:* ₪${currentDebt}
💰 *סה״כ לתשלום:* ₪${amt}

👉 ${formattedLink}${amountHint}

💡 *לתשלום ב-Bit, Apple Pay, Google Pay, PayBox, אשראי או העברה בנקאית:* פשוט לוחצים על הקישור למעלה ובוחרים באמצעי התשלום הרצוי (התשלום נקלט ומעדכן את המערכת אוטומטית עם קבלה וחשבונית מס מיידית!).

נשמח לעמוד לרשותכם לכל שאלה! 🐕🤍
שמוליק וצוות הריזורט לכלב 🐾`;
      }

      return `היי ${firstName}! 🐾
בהמשך לשהייה של *${booking.dogName}* בריזורט לכלב, מצורף קישור מאובטח להסדרת תשלום עבור:
✨ *עבור:* ${descText}
💰 *סכום לתשלום:* ₪${amt}

👉 ${formattedLink}${amountHint}

💡 *לתשלום ב-Bit, Apple Pay, Google Pay, PayBox, אשראי או העברה בנקאית:* פשוט לוחצים על הקישור למעלה ובוחרים באמצעי התשלום הרצוי (התשלום נקלט ומעדכן את המערכת אוטומטית עם קבלה וחשבונית מס מיידית!).

נשמח לעמוד לרשותכם לכל שאלה! 🐕🤍
שמוליק וצוות הריזורט לכלב 🐾`;
    }

    const isDaily = booking.serviceType === 'daycare' || booking.startDate === booking.endDate;
    const datesIntro = isDaily ? 'לשהות יומית:' : 'לתאריכים:';

    return `היי ${firstName}! 🐾
שמחים לעדכן שהמקום עבור *${booking.dogName}* (${serviceHebrew}) שוריין בריזורט לכלב ${datesIntro}
📅 ${stayDates}.${amountSection}
להשלמת השריון / הסדרת התשלום, יש ללחוץ על הקישור המאובטח${amountHint}:
👉 ${formattedLink}

💡 *לתשלום ב-Bit, Apple Pay, Google Pay, PayBox, אשראי או העברה בנקאית:* פשוט לוחצים על הקישור למעלה ובוחרים באמצעי התשלום הרצוי (התשלום נקלט ומעדכן את המערכת אוטומטית עם קבלה וחשבונית מס מיידית למייל ולטלפון!).

⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:30 - 18:30*
• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:30
• מעבר לשעות הפעילות (לפני 09:30 ואחרי 18:30), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾

נשמח לראותכם בריזורט! 🐕🤍
שמוליק וצוות הריזורט לכלב 🐾`;
  };

  const [messageText, setMessageText] = useState<string>(() => 
    buildDefaultMessage(initialTargetAmt, defaultStaticLink, false, reasonType, extraDescription, extraAmount, includeStayDebt)
  );

  // Auto-generate dynamic locked Grow link
  const fetchDynamicLink = async (
    targetAmt: number,
    currentReason = reasonType,
    extDesc = extraDescription,
    extAmt = extraAmount,
    incStay = includeStayDebt
  ) => {
    if (isHardBlocked) {
      return; // "אין לאפשר תשלום של דמי האילוף למי שלא חתם על ההסכם"
    }

    if (!targetAmt || targetAmt <= 0) {
      setCustomLink(defaultStaticLink);
      setIsLockedLink(false);
      if (!isManuallyEdited) {
        setMessageText(buildDefaultMessage(targetAmt, defaultStaticLink, false, currentReason, extDesc, extAmt, incStay));
      }
      return;
    }

    setIsGeneratingLink(true);
    try {
      const reasonLabel = currentReason === 'extra_service'
        ? (extDesc && extDesc.trim()
            ? (incStay && currentDebt > 0
                ? `${extDesc.trim()} + יתרת שהייה (${booking.dogName})`
                : `${extDesc.trim()} (${booking.dogName})`)
            : (incStay && currentDebt > 0
                ? `תשלום שהייה ואקסטרה (${booking.dogName})`
                : `חיוב אקסטרה / שירות נוסף (${booking.dogName})`))
        : currentReason === 'extra_day'
        ? `תשלום יום נוסף - ${booking.dogName}`
        : `שריון אירוח בריזורט לכלב - ${booking.dogName} (${stayDates})`;

      const res = await createGrowDynamicPaymentLink({
        amount: targetAmt,
        bookingId: booking.id,
        dogName: booking.dogName,
        ownerName: booking.ownerName,
        ownerPhone: booking.ownerPhone,
        description: reasonLabel
      });

      if (res && res.paymentUrl) {
        setCustomLink(res.paymentUrl);
        setIsLockedLink(res.isLocked);
        if (!isManuallyEdited) {
          setMessageText(buildDefaultMessage(targetAmt, res.paymentUrl, res.isLocked, currentReason, extDesc, extAmt, incStay));
        }
      }
    } catch (err) {
      console.warn('Failed to generate dynamic Grow link:', err);
      setCustomLink(defaultStaticLink);
      setIsLockedLink(false);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  useEffect(() => {
    fetchDynamicLink(initialTargetAmt, reasonType, extraDescription, extraAmount, includeStayDebt);
  }, []);

  const handleAmountChange = (newAmt: number) => {
    setAmount(newAmt);
    if (reasonType === 'extra_service') {
      if (!includeStayDebt) {
        setExtraAmount(newAmt);
      }
    }
    if (!isManuallyEdited) {
      setMessageText(buildDefaultMessage(newAmt, customLink, isLockedLink, reasonType, extraDescription, extraAmount, includeStayDebt));
    }
    fetchDynamicLink(newAmt, reasonType, extraDescription, extraAmount, includeStayDebt);
  };

  const handleReasonChange = (newReason: 'extra_day' | 'extra_service' | 'general_booking') => {
    setReasonType(newReason);
    setIsManuallyEdited(false);
    let newAmt = amount;
    if (newReason === 'extra_service') {
      newAmt = includeStayDebt && currentDebt > 0 ? (extraAmount + currentDebt) : extraAmount;
    } else if (newReason === 'extra_day') {
      newAmt = currentDebt > 0 ? currentDebt : (Number(settings.defaultDailyRateBoarding) || 180);
    } else {
      newAmt = currentDebt > 0 ? currentDebt : (Number(booking.totalPrice) || 0);
    }
    setAmount(newAmt);
    setMessageText(buildDefaultMessage(newAmt, customLink, isLockedLink, newReason, extraDescription, extraAmount, includeStayDebt));
    fetchDynamicLink(newAmt, newReason, extraDescription, extraAmount, includeStayDebt);
  };


  const handleExtraDescriptionChange = (newDesc: string) => {
    setExtraDescription(newDesc);
    if (!isManuallyEdited) {
      setMessageText(buildDefaultMessage(amount, customLink, isLockedLink, 'extra_service', newDesc, extraAmount, includeStayDebt));
    }
    fetchDynamicLink(amount, 'extra_service', newDesc, extraAmount, includeStayDebt);
  };

  const handleExtraAmountChange = (newPrice: number) => {
    setExtraAmount(newPrice);
    const newAmt = includeStayDebt && currentDebt > 0 ? (newPrice + currentDebt) : newPrice;
    setAmount(newAmt);
    if (!isManuallyEdited) {
      setMessageText(buildDefaultMessage(newAmt, customLink, isLockedLink, 'extra_service', extraDescription, newPrice, includeStayDebt));
    }
    fetchDynamicLink(newAmt, 'extra_service', extraDescription, newPrice, includeStayDebt);
  };

  const handleIncludeStayDebtChange = (incStay: boolean) => {
    setIncludeStayDebt(incStay);
    const newAmt = incStay && currentDebt > 0 ? (extraAmount + currentDebt) : extraAmount;
    setAmount(newAmt);
    if (!isManuallyEdited) {
      setMessageText(buildDefaultMessage(newAmt, customLink, isLockedLink, 'extra_service', extraDescription, extraAmount, incStay));
    }
    fetchDynamicLink(newAmt, 'extra_service', extraDescription, extraAmount, incStay);
  };

  const handleLinkChange = (newLink: string) => {
    setCustomLink(newLink);
    setIsLockedLink(false);
    if (!isManuallyEdited) {
      setMessageText(buildDefaultMessage(amount, newLink, false, reasonType, extraDescription, extraAmount, includeStayDebt));
    }
  };

  const handleResetToDefault = () => {
    setMessageText(buildDefaultMessage(amount, customLink, isLockedLink, reasonType, extraDescription, extraAmount, includeStayDebt));
    setIsManuallyEdited(false);
  };

  // Sync extra service & audit note into Booking record in Supabase / Local state
  const syncExtraToBooking = async () => {
    if (!onUpdateBooking || reasonType !== 'extra_service' || !extraAmount || extraAmount <= 0) return;
    try {
      const nowStr = new Date().toLocaleDateString('he-IL');
      const itemDesc = extraDescription.trim() || 'תוספת אקסטרה';
      const extraNote = `[אקסטרה ${nowStr}] ${itemDesc}: ₪${extraAmount}`;
      const existingNotes = booking.notes || '';
      const updatedNotes = existingNotes.includes(extraNote) 
        ? existingNotes 
        : (existingNotes ? `${existingNotes} | ${extraNote}` : extraNote);

      const currentExtraServices = booking.extraServices || [];
      const newServiceItem = {
        id: 'extra_' + Date.now(),
        name: itemDesc,
        price: extraAmount
      };

      const updatedBooking: Booking = {
        ...booking,
        notes: updatedNotes,
        extraServices: [...currentExtraServices, newServiceItem],
        totalPrice: addExtraToTotalBookingPrice 
          ? (Number(booking.totalPrice) || 0) + extraAmount 
          : (Number(booking.totalPrice) || 0),
        updatedAt: new Date().toISOString()
      };

      await onUpdateBooking(updatedBooking);
    } catch (err) {
      console.warn('Could not sync extra to booking:', err);
    }
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
        if (saveToBookingRecord) {
          await syncExtraToBooking();
        }
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
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-lg w-full p-4 sm:p-6 text-slate-900 overflow-hidden flex flex-col max-h-[94vh]">
        
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

        {/* Scrollable Form Body or Hard Blocking Rule for Unsigned Training Agreement */}
        {isHardBlocked ? (
          <div className="flex-1 overflow-y-auto py-5 px-2 space-y-4 text-center">
            <div className="w-16 h-16 rounded-3xl bg-red-100 text-red-700 border-2 border-red-300 flex items-center justify-center text-3xl mx-auto shadow-sm">
              🛑
            </div>
            
            <div className="space-y-1.5">
              <h4 className="text-base sm:text-lg font-black text-red-950">
                חסימת תשלום – הסכם אילוף טרם נחתם!
              </h4>
              <p className="text-xs text-red-800 font-bold leading-relaxed max-w-md mx-auto">
                על פי נהלי הריזורט לכלב: <br />
                <span className="text-red-900 font-black text-xs sm:text-sm bg-red-100/90 px-3 py-1 rounded-xl border border-red-300 inline-block mt-1">
                  אין לאפשר תשלום של דמי האילוף למי שלא חתם על ההסכם
                </span>
              </p>
              <p className="text-[11px] text-slate-500 pt-1">
                עבור <strong>{booking.dogName}</strong> ({booking.ownerName}), חובה להשלים חתימה על הסכם האילוף לפני הפקת קישור תשלום או גבייה.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-right text-xs space-y-1.5">
              <div className="font-bold text-amber-950 flex items-center gap-1.5">
                <span>📝 כיצד ממשיכים?</span>
              </div>
              <p className="text-amber-900 leading-normal text-[11px]">
                שלחו ללקוח קישור ישיר לוואטסאפ למילוי וחתימה דיגיטלית, או פתחו את ההסכם כעת לחתימה במקום (בטלפון / טאבלט). מיד עם סיום החתימה – אפשרות התשלום תשתחרר אוטומטית!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTrainingAgreementModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <span>✍️ פתח הסכם לחתימה כעת</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://rezort-webapp.vercel.app';
                  const agrLink = `${origin}/?agreement=training&bookingId=${booking.id}&phone=${cleanPhoneNumber(booking.ownerPhone)}&name=${encodeURIComponent(booking.ownerName)}&dog=${encodeURIComponent(booking.dogName)}`;
                  const msg = `שלום ${booking.ownerName}! 🐾🐶\nבהמשך להזמנת תהליך האילוף עבור *${booking.dogName}* בריזורט לכלב, מצורף קישור אישי לחתימה על הסכם האילוף:\n\n👉 ${agrLink}\n\n*לתשומת לבכם:* על פי נהלי הריזורט, לא ניתן להסדיר את תשלום דמי האילוף לפני חתימת הלקוח על ההסכם. אנא מלאו את הפרטים וחתמו דיגיטלית כדי שנוכל להמשיך להסדרת התשלום.\n\nבברכה,\nשמוליק וצוות הריזורט לכלב 🐾`;
                  const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
                  window.open(waUrl, '_blank');
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <span>📲 שלח הסכם לחתימה בוואטסאפ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setManagerOverride(true);
                  fetchDynamicLink(amount, reasonType, extraDescription, extraAmount, includeStayDebt);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <span>⚡ עקוף חסימה (אישור מנהל / אקסטרה)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                סגור
              </button>
            </div>

            {/* Embedded Training Agreement Modal */}
            <TrainingAgreementModal
              isOpen={isTrainingAgreementModalOpen}
              onClose={() => setIsTrainingAgreementModalOpen(false)}
              booking={booking}
              settings={settings}
              onAgreementSigned={() => {
                setIsAgreementSigned(true);
                setIsTrainingAgreementModalOpen(false);
              }}
            />
          </div>
        ) : (
          <>
            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3.5">
              
              {/* Grandfathered / Unsigned Agreement Notice for Allowed Links */}
              {isTraining && !isAgreementSigned && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl px-3.5 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-950 font-bold shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">ℹ️</span>
                    <span>
                      {isLegacyPreAgreementBooking
                        ? 'כלב נקלט לפני השקת הסכם האילוף (אירוח ותיק) – שליחת קישור מאופשרת'
                        : isTrainingFeeAlreadyPaid
                        ? 'דמי האילוף שולמו במלואם – שליחת קישור עבור תוספות ואקסטרה מאופשרת'
                        : isExtraCharge
                        ? 'חיוב אקסטרה / שירות נוסף – פטור מחסימת הסכם אילוף'
                        : 'מאושר לשליחה באישור מנהל'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTrainingAgreementModalOpen(true)}
                    className="text-amber-800 hover:text-amber-950 underline font-bold text-[11px] cursor-pointer"
                  >
                    פתח הסכם לחתימה בכל זאת 📜
                  </button>
                </div>
              )}

              {/* Active Stay Banner (If dog is currently staying in resort) */}
              {isCurrentlyStaying && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl px-3 py-2 flex items-center justify-between text-xs text-emerald-950 font-bold shadow-2xs">
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                    </span>
                    <span>🐾 כלב שוהה כעת בריזורט (נקלט בתאריך {formatDateIL(booking.startDate)})</span>
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-black">
                    שהייה פעילה
                  </span>
                </div>
              )}

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
                  <span className="font-bold text-slate-700">יתרת חוב על השהייה:</span>
                  <span className={`font-black text-sm ${currentDebt > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {currentDebt > 0 ? `₪${currentDebt}` : '₪0 (מוסדר במלואו 🟢)'}
                  </span>
                </div>
              </div>

              {/* Reason Selector Tabs */}
              <div>
                <label className="text-xs font-black text-slate-800 mb-1.5 block">
                  סוג בקשת התשלום:
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => handleReasonChange('general_booking')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                      reasonType === 'general_booking'
                        ? 'bg-white text-emerald-900 shadow-xs font-black border border-emerald-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    📅 שריון / יתרה
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReasonChange('extra_service')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center relative ${
                      reasonType === 'extra_service'
                        ? 'bg-emerald-700 text-white shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    ✨ תוספת אקסטרה
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReasonChange('extra_day')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                      reasonType === 'extra_day'
                        ? 'bg-white text-emerald-900 shadow-xs font-black border border-emerald-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    ➕ יום נוסף
                  </button>
                </div>
              </div>

              {/* DEDICATED EXTRAS CONFIGURATION CARD (When reasonType === 'extra_service') */}
              {reasonType === 'extra_service' && (
                <div className="bg-gradient-to-br from-emerald-50/70 via-white to-amber-50/40 border-2 border-emerald-300 rounded-2xl p-3.5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                    <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm text-emerald-950">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>הגדרת חיוב אקסטרה (קולר, וטרינר, תרופות, שירות נוסף)</span>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                      תשלום מאובטח
                    </span>
                  </div>

                  {/* Free-Text Description Input - Enters directly into the customer's invoice */}
                  <div>
                    <label className="text-xs font-black text-slate-800 flex items-center justify-between mb-1.5">
                      <span>עבור מה בוצעה התוספת? *</span>
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        📄 ייכנס ישירות לחשבונית של הלקוח
                      </span>
                    </label>
                    <input
                      type="text"
                      value={extraDescription}
                      onChange={(e) => handleExtraDescriptionChange(e.target.value)}
                      placeholder="הקלד כאן פירוט חופשי (לדוגמה: קולר סרסטו, ביקור וטרינר, תרופות...)"
                      className="w-full bg-white text-slate-900 font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none shadow-2xs transition-all placeholder:text-slate-400 placeholder:font-normal"
                      autoFocus
                    />
                  </div>

                  {/* Extra Amount & Staying Debt Mode */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 block mb-1">
                        סכום האקסטרה לתשלום (₪) *
                      </label>
                      <div className="relative">
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-black text-slate-400">₪</span>
                        <input
                          type="number"
                          min="1"
                          value={extraAmount === 0 ? '' : extraAmount}
                          onChange={(e) => handleExtraAmountChange(Number(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-white text-slate-900 font-black text-base pr-8 pl-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                        />
                      </div>
                    </div>

                    {currentDebt > 0 ? (
                      <div className="bg-white/80 border border-slate-200 rounded-xl p-2 text-xs space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 block">אופן החיוב מול יתרת השהייה:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
                          <input
                            type="radio"
                            name="debtMode"
                            checked={!includeStayDebt}
                            onChange={() => handleIncludeStayDebtChange(false)}
                            className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span>אקסטרה בלבד (₪{extraAmount})</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
                          <input
                            type="radio"
                            name="debtMode"
                            checked={includeStayDebt}
                            onChange={() => handleIncludeStayDebtChange(true)}
                            className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span>אקסטרה + שהייה (₪{extraAmount + currentDebt})</span>
                        </label>
                      </div>
                    ) : (
                      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2 text-[11px] text-emerald-900 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>השהייה שולמה במלואה – החיוב בקישור הוא על האקסטרה בלבד (₪{extraAmount})</span>
                      </div>
                    )}
                  </div>

                  {/* Sync Options */}
                  <div className="pt-2 border-t border-emerald-100 flex flex-col gap-1.5 text-[11px] text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={saveToBookingRecord}
                        onChange={(e) => setSaveToBookingRecord(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span>📝 תעד את האקסטרה בהערות ובשירותי ההזמנה של {booking.dogName}</span>
                    </label>
                    {saveToBookingRecord && (
                      <label className="flex items-center gap-2 cursor-pointer mr-5 text-slate-600">
                        <input
                          type="checkbox"
                          checked={addExtraToTotalBookingPrice}
                          onChange={(e) => setAddExtraToTotalBookingPrice(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>הוסף את סכום האקסטרה (+₪{extraAmount}) לסך העלות הכוללת של ההזמנה</span>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Amount to request in link (For general booking or extra day) */}
              {reasonType !== 'extra_service' && (
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
              )}

              {/* Payment Link URL */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                    <span>קישור לתשלום (Grow / Bit / Apple Pay):</span>
                  </label>
                  {isGeneratingLink ? (
                    <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-bold animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>מייצר קישור עם סכום נעול...</span>
                    </span>
                  ) : isLockedLink ? (
                    <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-black">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>סכום נעול (₪{amount})</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fetchDynamicLink(amount, reasonType, extraDescription, extraAmount, includeStayDebt)}
                      className="text-[11px] text-slate-500 hover:text-emerald-700 flex items-center gap-1 cursor-pointer font-bold"
                      title="נסה להפיק קישור עם סכום נעול מחדש"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>הפק קישור נעול</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={customLink}
                    onChange={(e) => handleLinkChange(e.target.value)}
                    placeholder="https://pay.grow.link/..."
                    className={`w-full text-xs px-3 py-2 rounded-xl border focus:outline-none transition-all ${
                      isLockedLink 
                        ? 'bg-emerald-50/40 border-emerald-300 text-emerald-950 font-medium focus:border-emerald-600 focus:bg-white' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600 focus:bg-white'
                    }`}
                  />
                </div>
                {isLockedLink && (
                  <p className="text-[11px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
                    <span>✓ הלקוח יפתח את הקישור ויראה ישירות ₪{amount} לתשלום מיידי ב-Bit או אשראי (ללא צורך בהקלדה עצמאית).</span>
                  </p>
                )}
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
                  rows={7}
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

            {/* Action Buttons Footer - Only visible when NOT blocked */}
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
                    if (saveToBookingRecord) {
                      syncExtraToBooking();
                    }
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
          </>
        )}

      </div>
    </div>
  );
};
