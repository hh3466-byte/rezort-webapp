import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Dog, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign, 
  Sparkles, 
  Mic, 
  Square, 
  Keyboard, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  HeartPulse,
  Trash2
} from 'lucide-react';
import { Booking, ResortSettings, ServiceType, PaymentStatus, StayStatus, PaymentMethod } from '../types';
import { calculateDaysCount, checkRangeOccupancy, getTodayStr, addDays, formatDateIL } from '../utils/dateUtils';
import { calculateBoardingRate } from '../utils/pricingUtils';
import { parseVoiceOrWhatsAppText } from '../services/agentService';
import { getLearnedRefundReasons, saveLearnedRefundReason } from '../utils/refundUtils';

interface BookingFormModalProps {
  initialData?: Partial<Booking> | null;
  existingBookings: Booking[];
  settings: ResortSettings;
  onClose: () => void;
  onSave: (booking: Booking) => void;
  onDeleteBooking?: (bookingId: string) => void;
}

export const BookingFormModal: React.FC<BookingFormModalProps> = ({
  initialData,
  existingBookings,
  settings,
  onClose,
  onSave,
  onDeleteBooking,
}) => {
  const todayStr = getTodayStr();

  // Form state
  const [dogName, setDogName] = useState(initialData?.dogName || '');
  const [dogBreed, setDogBreed] = useState(initialData?.dogBreed || '');
  const [dogGender, setDogGender] = useState<'male_neutered' | 'female_spayed' | 'male_intact' | 'female_intact' | undefined>(initialData?.dogGender);
  const [ownerName, setOwnerName] = useState(initialData?.ownerName || '');
  const [ownerPhone, setOwnerPhone] = useState(initialData?.ownerPhone || '');
  const [ownerEmail, setOwnerEmail] = useState(initialData?.ownerEmail || '');
  const [serviceType, setServiceType] = useState<ServiceType>(initialData?.serviceType || 'boarding');
  const [startDate, setStartDate] = useState(initialData?.startDate || todayStr);
  const [endDate, setEndDate] = useState(initialData?.endDate || addDays(todayStr, 3));
  
  // Pricing mode: Per Day vs Fixed Period
  const [pricingMode, setPricingMode] = useState<'daily' | 'period'>('daily');
  const [dailyRate, setDailyRate] = useState<number>(() => {
    if (initialData?.dailyRate && initialData.dailyRate > 0) return initialData.dailyRate;
    if (initialData?.serviceType === 'day_training') return settings.defaultDailyRateDayTraining || 250;
    if (initialData?.serviceType === 'daycare') return settings.defaultDailyRateDaycare || 90;
    const initialDays = Math.max(1, calculateDaysCount(initialData?.startDate || todayStr, initialData?.endDate || addDays(todayStr, 3)));
    return calculateBoardingRate(initialDays, settings.defaultDailyRateBoarding || 180, { dogGender: initialData?.dogGender, isolationRate: 230 }).dailyRate;
  });
  const [totalPrice, setTotalPrice] = useState<number>(initialData?.totalPrice || 0);
  const [depositAmount, setDepositAmount] = useState<number>(initialData?.depositAmount || 0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialData?.paymentMethod || 'bit');
  const [stayStatus, setStayStatus] = useState<StayStatus>(initialData?.stayStatus || 'booked');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [specialDiet, setSpecialDiet] = useState(initialData?.specialDiet || '');
  const [vaccinationValid, setVaccinationValid] = useState(initialData?.vaccinationValid ?? true);
  const [skipReviewRequest, setSkipReviewRequest] = useState<boolean>(
    Boolean(initialData?.skipReviewRequest || (initialData?.notes && initialData.notes.indexOf('ללא_סקר') !== -1))
  );
  const [placementNotes, setPlacementNotes] = useState(initialData?.placementNotes || '');
  const [kennelPlacement, setKennelPlacement] = useState<number | 'home' | ''>(
    initialData?.kennelNumber !== undefined ? initialData.kennelNumber : ''
  );
  const [feedingSchedule, setFeedingSchedule] = useState(initialData?.feedingSchedule || '');
  const [foodPortion, setFoodPortion] = useState(initialData?.foodPortion || '');
  const [medicationSchedule, setMedicationSchedule] = useState(
    initialData?.medicationSchedule || initialData?.medications || ''
  );
  const [complexitySurcharge, setComplexitySurcharge] = useState<number>(
    initialData?.complexitySurcharge || 0
  );
  const [complexityReason, setComplexityReason] = useState(initialData?.complexityReason || '');
  const [placementError, setPlacementError] = useState<string>('');
  const [showDebtCheckoutConfirm, setShowDebtCheckoutConfirm] = useState(false);

  // Cancellation refund tracking
  const [refundAmount, setRefundAmount] = useState<number | undefined>(initialData?.refundAmount);
  const [refundDate, setRefundDate] = useState<string>(initialData?.refundDate || getTodayStr());
  const [refundNotes, setRefundNotes] = useState<string>(initialData?.refundNotes || 'בוצע ביטול והחזר כספי');
  const [refundReason, setRefundReason] = useState<string>(initialData?.refundReason || 'הזמנה בוטלה יותר משבוע לפני הקליטה');
  const [customRefundReason, setCustomRefundReason] = useState<string>(() => {
    if (initialData?.refundReason && !['הזמנה בוטלה יותר משבוע לפני הקליטה', 'בעיה רפואית של הכלב', 'כלב ברח', 'בעיה רפואית של הבעלים'].includes(initialData.refundReason)) {
      return initialData.refundReason;
    }
    return '';
  });
  const [isOtherReasonSelected, setIsOtherReasonSelected] = useState<boolean>(() => {
    if (initialData?.refundReason && !['הזמנה בוטלה יותר משבוע לפני הקליטה', 'בעיה רפואית של הכלב', 'כלב ברח', 'בעיה רפואית של הבעלים'].includes(initialData.refundReason)) {
      return true;
    }
    return false;
  });
  const learnedReasons = getLearnedRefundReasons(existingBookings);
  const [showRefundPrompt, setShowRefundPrompt] = useState<boolean>(false);
  const [refundWillExecute, setRefundWillExecute] = useState<boolean>(Boolean(initialData?.refundAmount && initialData.refundAmount > 0));
  const [tempRefundAmount, setTempRefundAmount] = useState<string>(() => {
    if (initialData?.refundAmount !== undefined) return String(initialData.refundAmount);
    return String(initialData?.depositAmount || 0);
  });

  // Free stay / Second dog payment consolidation state
  const [isFreeStay, setIsFreeStay] = useState<boolean>(() => {
    if (initialData?.isFreeStay) return true;
    if (initialData?.id && initialData.totalPrice === 0) return true;
    if (initialData?.notes && (
      initialData.notes.includes('חינם') || 
      initialData.notes.includes('ללא תשלום') || 
      initialData.notes.includes('כלב נוסף') ||
      initialData.notes.includes('כלב שני')
    )) return true;
    return false;
  });
  const [freeStayReason, setFreeStayReason] = useState<'free' | 'second_dog'>(() => {
    if (initialData?.notes && (initialData.notes.includes('כלב נוסף') || initialData.notes.includes('כלב שני'))) {
      return 'second_dog';
    }
    return 'free';
  });
  const [linkedMainDogName, setLinkedMainDogName] = useState<string>(initialData?.linkedDogName || '');

  // Voice dictation state inside modal (DEFAULT is voice dictation enabled)
  const [voiceMode, setVoiceMode] = useState<'voice' | 'manual'>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // Update default rate & dates when serviceType changes
  const handleServiceTypeChange = (newType: ServiceType) => {
    setServiceType(newType);
    if (isFreeStay) {
      setTotalPrice(0);
      setDailyRate(0);
      return;
    }
    if (newType === 'training') {
      setPricingMode('period');
      setTotalPrice(settings.defaultDailyRateTraining || 6500);
    } else {
      setPricingMode('daily');
      const days = calculateDaysCount(startDate, endDate);
      let rate = settings.defaultDailyRateBoarding || 180;
      if (newType === 'boarding') {
        rate = calculateBoardingRate(days, settings.defaultDailyRateBoarding || 180, { dogGender, isolationRate: 230 }).dailyRate;
      } else if (newType === 'day_training') {
        rate = settings.defaultDailyRateDayTraining || 250;
      } else if (newType === 'daycare') {
        rate = settings.defaultDailyRateDaycare || 90;
      }
      setDailyRate(rate);
      setTotalPrice(days * rate);
    }
  };

  // Auto-update daily rate for boarding when duration or dog gender changes
  useEffect(() => {
    if (serviceType === 'boarding' && pricingMode === 'daily' && !isFreeStay) {
      const days = calculateDaysCount(startDate, endDate);
      const calculated = calculateBoardingRate(
        days,
        settings.defaultDailyRateBoarding || 180,
        { dogGender, isolationRate: 230 }
      );
      setDailyRate(calculated.dailyRate);
    }
  }, [serviceType, startDate, endDate, dogGender, settings.defaultDailyRateBoarding, pricingMode, isFreeStay]);

  // Recompute total price
  useEffect(() => {
    if (isFreeStay) {
      setTotalPrice(0);
      setDailyRate(0);
      setDepositAmount(0);
      return;
    }
    if (serviceType === 'training') {
      if (!totalPrice || totalPrice === 0) {
        setTotalPrice(settings.defaultDailyRateTraining || 6500);
      }
    } else if (pricingMode === 'daily') {
      const days = calculateDaysCount(startDate, endDate);
      setTotalPrice(days * dailyRate);
    }
  }, [isFreeStay, startDate, endDate, dailyRate, pricingMode, serviceType, settings.defaultDailyRateTraining]);

  // If initialData had custom price not matching days * rate, default to matching or keep
  useEffect(() => {
    if (initialData?.totalPrice !== undefined) {
      if (initialData.totalPrice === 0) {
        setIsFreeStay(true);
        setTotalPrice(0);
        setDailyRate(0);
        setDepositAmount(0);
      } else {
        const days = calculateDaysCount(startDate, endDate);
        const expectedDaily = days * dailyRate;
        if (initialData.totalPrice !== expectedDaily) {
          setTotalPrice(initialData.totalPrice);
        }
      }
    }
  }, []);

  // Check occupancy for real-time overbooking alert
  const overbookingCheck = checkRangeOccupancy(
    existingBookings,
    startDate,
    endDate,
    settings.maxCapacity,
    initialData?.id
  );

  // Setup Web Speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'he-IL';

      rec.onresult = (e: any) => {
        let text = '';
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        setTranscript(text);
      };

      rec.onerror = () => setIsRecording(false);
      rec.onend = () => setIsRecording(false);
      recognitionRef.current = rec;
    }
  }, []);

  const handleStartVoice = () => {
    setVoiceError(null);
    setTranscript('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        setIsRecording(false);
      }
    } else {
      setVoiceError('המיקרופון אינו נתמך בדפדפן זה. מלא את הטופס ידנית.');
      setVoiceMode('manual');
    }
  };

  const handleStopVoice = async () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);

    if (!transcript.trim()) return;

    setIsParsingVoice(true);
    try {
      const proposal = await parseVoiceOrWhatsAppText({
        text: transcript,
        existingBookings,
        settings,
      });

      const p = proposal.parsedBooking;
      if (p.dogName) setDogName(p.dogName);
      if (p.dogBreed) setDogBreed(p.dogBreed);
      if (p.ownerName) setOwnerName(p.ownerName);
      if (p.ownerPhone) setOwnerPhone(p.ownerPhone);
      if (p.serviceType) setServiceType(p.serviceType);
      if (p.startDate) setStartDate(p.startDate);
      if (p.endDate) setEndDate(p.endDate);
      if (p.totalPrice) setTotalPrice(p.totalPrice);
      if (p.depositAmount) setDepositAmount(p.depositAmount);
      if (p.paymentMethod) setPaymentMethod(p.paymentMethod);
      if (p.notes) setNotes(p.notes);

      setTranscript('');
    } catch (err: any) {
      setVoiceError('שגיאה בזיהוי הפרטים. נסה שוב או מלא ידנית.');
    } finally {
      setIsParsingVoice(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!dogName.trim()) {
      alert('נא להזין את שם הכלב');
      return;
    }

    if (!ownerName.trim()) {
      alert('נא להזין את שם הבעלים');
      return;
    }

    if (startDate > endDate) {
      alert('תאריך סיום אינו יכול להיות מוקדם מתאריך ההתחלה');
      return;
    }

    // Mandatory rule: Cannot book/check-in without kennel 1-11 or home boarding
    if ((kennelPlacement === '' || kennelPlacement === undefined) && stayStatus !== 'cancelled') {
      setPlacementError('חובה לבחור תא 1–11 או הלנה ביתית לקליטת הכלב!');
      return;
    }
    setPlacementError('');

    const calcDebt = Math.max(0, Number(totalPrice) - Number(depositAmount));
    if (stayStatus === 'checked_out' && calcDebt > 0 && Number(depositAmount) < Number(totalPrice) && !showDebtCheckoutConfirm) {
      setShowDebtCheckoutConfirm(true);
      return;
    }

    const paidSoFar = Number(depositAmount) || 0;
    if (stayStatus === 'cancelled' && paidSoFar > 0 && !showRefundPrompt && refundAmount === undefined && !initialData?.refundAmount) {
      setTempRefundAmount(String(paidSoFar));
      setRefundWillExecute(true);
      setShowRefundPrompt(true);
      return;
    }

    doSave();
  };

  const doSave = (customDeposit?: number, customPaymentStatus?: PaymentStatus) => {
    const finalDeposit = isFreeStay ? 0 : (customDeposit !== undefined ? Number(customDeposit) : (Number(depositAmount) || 0));
    let finalPaymentStatus: PaymentStatus = isFreeStay ? 'fully_paid' : (customPaymentStatus || 'unpaid');
    if (!isFreeStay && !customPaymentStatus) {
      if (finalDeposit >= totalPrice && totalPrice > 0) {
        finalPaymentStatus = 'fully_paid';
      } else if (finalDeposit > 0) {
        finalPaymentStatus = 'deposit_paid';
      }
    }

    let finalRefundAmount = refundAmount;
    let finalRefundDate = refundDate;
    let finalRefundNotes = refundNotes;
    let finalRefundReason: string | undefined = refundReason;

    if (stayStatus === 'cancelled') {
      if (refundWillExecute) {
        finalRefundAmount = Number(tempRefundAmount) || 0;
        finalRefundDate = refundDate || getTodayStr();
        finalRefundNotes = refundNotes || 'בוצע ביטול והחזר כספי';
        if (isOtherReasonSelected && customRefundReason.trim()) {
          finalRefundReason = customRefundReason.trim();
          saveLearnedRefundReason(finalRefundReason, existingBookings);
        } else {
          finalRefundReason = refundReason || 'הזמנה בוטלה יותר משבוע לפני הקליטה';
        }
      } else {
        finalRefundAmount = 0;
        finalRefundReason = undefined;
      }
    }

    let formattedNotes = notes.trim();
    if (isFreeStay) {
      const freeTag = freeStayReason === 'second_dog'
        ? (linkedMainDogName.trim() ? `[כלב נוסף - התשלום נרשם על הכלב ${linkedMainDogName.trim()}]` : '[כלב נוסף - התשלום נרשם על הכלב הראשי]')
        : '[אירוח ללא תשלום (חינם)]';
      if (!formattedNotes.includes('חינם') && !formattedNotes.includes('כלב נוסף') && !formattedNotes.includes('כלב שני') && !formattedNotes.includes('ללא תשלום')) {
        formattedNotes = `${freeTag} ${formattedNotes}`.trim();
      }
    }

    const booking: Booking = {
      id: initialData?.id || `b-${Date.now()}`,
      dogName: dogName.trim(),
      dogBreed: dogBreed.trim(),
      dogGender,
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerEmail: ownerEmail.trim(),
      serviceType,
      startDate,
      endDate,
      totalPrice: isFreeStay ? 0 : (Number(totalPrice) || 0),
      dailyRate: isFreeStay ? 0 : (Number(dailyRate) || 0),
      depositAmount: finalDeposit,
      paymentStatus: finalPaymentStatus,
      paymentMethod,
      stayStatus,
      skipReviewRequest,
      isFreeStay,
      linkedDogName: isFreeStay && freeStayReason === 'second_dog' ? linkedMainDogName.trim() : undefined,
      placementNotes: placementNotes.trim() || undefined,
      kennelNumber: (kennelPlacement === '' || kennelPlacement === undefined) ? undefined : kennelPlacement,
      feedingSchedule: feedingSchedule.trim() || undefined,
      foodPortion: foodPortion.trim() || undefined,
      medicationSchedule: medicationSchedule.trim() || undefined,
      complexitySurcharge: Number(complexitySurcharge) || 0,
      complexityReason: complexityReason.trim() || undefined,
      refundAmount: finalRefundAmount,
      refundDate: finalRefundDate,
      refundNotes: finalRefundNotes,
      refundReason: finalRefundReason,
      notes: skipReviewRequest
        ? (formattedNotes.includes('[ללא_סקר]') ? formattedNotes : `${formattedNotes} [ללא_סקר]`.trim())
        : formattedNotes.replace(/\[ללא_סקר\]/g, '').trim(),
      specialDiet: specialDiet.trim(),
      vaccinationValid,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(booking);
  };

  const remainingDebt = Math.max(0, totalPrice - depositAmount);
  const daysCount = calculateDaysCount(startDate, endDate);
  const [trainingDaysInput, setTrainingDaysInput] = useState<string>(() => String(daysCount));

  useEffect(() => {
    setTrainingDaysInput(String(daysCount));
  }, [daysCount]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full p-5 sm:p-6 text-slate-900 max-h-[92vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 border border-green-200 flex items-center justify-center font-bold">
              <Dog className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg sm:text-xl text-slate-900">
                {initialData?.id 
                  ? `עריכת שהות: 🐾 ${initialData.dogName || 'כלב'} (בעלים: ${initialData.ownerName || 'לקוח'})`
                  : 'שריון הזמנה חדשה ביומן'}
              </h3>
              <p className="text-xs text-slate-500">
                מלא את הפרטים או הכרז בקולך לסוכן החכם
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Voice Dictation Bar inside Form (Default as requested) */}
        <div className="my-4 p-3.5 rounded-xl bg-slate-50 border border-green-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-green-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-green-600" />
              הכתבה קולית חכמה למילוי מהיר:
            </span>

            {voiceMode === 'voice' ? (
              <button
                type="button"
                onClick={() => setVoiceMode('manual')}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>עבור להקלדה</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setVoiceMode('voice')}
                className="text-xs text-green-700 hover:underline flex items-center gap-1 cursor-pointer font-bold"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>עבור להקלטה</span>
              </button>
            )}
          </div>

          {voiceMode === 'voice' && (
            <div>
              {!isRecording ? (
                <button
                  type="button"
                  onClick={handleStartVoice}
                  disabled={isParsingVoice}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 rounded-xl font-bold text-sm shadow-xs transition-all cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>🎙️ לחץ עלי על מנת להתחיל (הכתב פרטי הזמנה)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopVoice}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 rounded-xl font-bold text-sm animate-pulse shadow-xs transition-all cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>⏹️ סיים הכתבה ומלא שדות</span>
                </button>
              )}

              {isRecording && (
                <p className="text-xs text-green-800 italic mt-1.5 truncate font-medium">
                  {transcript ? `"${transcript}"` : 'מקשיב... (למשל: "בלו של כהן, פנסיון עד ראשון, 800 שקל, מקדמה 200")'}
                </p>
              )}
            </div>
          )}

          {voiceError && (
            <p className="text-xs text-red-600 mt-1 font-semibold">{voiceError}</p>
          )}
        </div>

        {/* Real-time Overbooking Alert */}
        {overbookingCheck.hasOverbooking && (
          <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-xl p-3.5 text-red-900 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-extrabold text-red-900 block text-sm">
                אזהרת עומס: הריזורט יגיע ל-{overbookingCheck.highestCount + 1} כלבים!
              </span>
              <span className="text-red-700 font-medium">
                הקיבולת שהוגדרה היא {settings.maxCapacity} כלבים. תוכל לשמור את ההזמנה בכל זאת או לבחור תאריכים חלופיים.
              </span>
            </div>
          </div>
        )}

        {/* The Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Section 1: Dog Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-700 font-bold block mb-1">
                שם הכלב *
              </label>
              <input
                type="text"
                required
                value={dogName}
                onChange={(e) => setDogName(e.target.value)}
                placeholder="למשל: בלו, מקס, בובי"
                className="w-full bg-slate-50 text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-slate-700 font-bold block mb-1">
                גזע / מאפיינים
              </label>
              <input
                type="text"
                value={dogBreed}
                onChange={(e) => setDogBreed(e.target.value)}
                placeholder="למשל: גולדן רטריבר, מעורב"
                className="w-full bg-slate-50 text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
              />
            </div>

            {/* מין הכלב/ה */}
            <div className="col-span-1 sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="text-xs text-slate-700 font-bold block mb-1.5">
                מין ועיקור / סירוס 🐾
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setDogGender('female_spayed')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    dogGender === 'female_spayed'
                      ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-pink-50 hover:text-pink-900'
                  }`}
                >
                  <span>🌸</span>
                  <span>נקבה מעוקרת</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDogGender('female_intact')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    dogGender === 'female_intact'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-900'
                  }`}
                >
                  <span>🌸</span>
                  <span>נקבה לא מעוקרת</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDogGender('male_neutered')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    dogGender === 'male_neutered'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-900'
                  }`}
                >
                  <span>🔷</span>
                  <span>זכר מסורס</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDogGender('male_intact')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    dogGender === 'male_intact'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-900'
                  }`}
                >
                  <span>🔷</span>
                  <span>זכר לא מסורס (בידוד)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Owner Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-700 font-bold block mb-1">
                שם הבעלים *
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="שם מלא"
                className="w-full bg-slate-50 text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-slate-700 font-bold block mb-1">
                מספר טלפון (לוואטסאפ) *
              </label>
              <input
                type="tel"
                required
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="050-0000000"
                className="w-full bg-slate-50 text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs text-slate-700 font-bold block mb-1">
                כתובת אימייל (אופציונלי / לקבלות)
              </label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="yourname@gmail.com"
                className="w-full bg-slate-50 text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none text-left"
                dir="ltr"
              />
            </div>
          </div>

          {/* Section 3: Service Type Selection (Boarding vs Training vs Combined vs Daycare) */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-700 font-bold block">
              סוג השירות המבוקש *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleServiceTypeChange('boarding')}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                  serviceType === 'boarding'
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">🏨</span>
                  <span className="text-[10px] font-bold text-slate-500">₪{settings.defaultDailyRateBoarding}/יום</span>
                </div>
                <div className="text-xs font-bold mt-1">פנסיון (לינה)</div>
                <div className="text-[10px] text-slate-500 font-normal">אירוח וטיפול מלא</div>
              </button>

              <button
                type="button"
                onClick={() => handleServiceTypeChange('training')}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                  serviceType === 'training'
                    ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">🎓</span>
                  <span className="text-[10px] font-bold text-amber-700">מחיר כולל ₪{settings.defaultDailyRateTraining || 6500}</span>
                </div>
                <div className="text-xs font-bold mt-1">תהליך אילוף</div>
                <div className="text-[10px] text-slate-500 font-normal">לינה ואילוף מלא</div>
              </button>

              <button
                type="button"
                onClick={() => handleServiceTypeChange('day_training')}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                  serviceType === 'day_training'
                    ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">🦮</span>
                  <span className="text-[10px] font-bold text-purple-700">₪{settings.defaultDailyRateDayTraining || 250}/יום</span>
                </div>
                <div className="text-xs font-bold mt-1">אילוף ביומיות</div>
                <div className="text-[10px] text-slate-500 font-normal">אילוף יומי ללא לינה</div>
              </button>

              <button
                type="button"
                onClick={() => handleServiceTypeChange('daycare')}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                  serviceType === 'daycare'
                    ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 text-sky-950 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">✂️</span>
                  <span className="text-[10px] font-bold text-slate-500">₪{settings.defaultDailyRateDaycare}/יום</span>
                </div>
                <div className="text-xs font-bold mt-1">יום כיף / דייקר</div>
                <div className="text-[10px] text-slate-500 font-normal">ללא לינת לילה</div>
              </button>
            </div>
          </div>

          {/* Section 4: Stay Status & Dates */}
          <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  מצב שהות נוכחי
                </label>
                <select
                  value={stayStatus}
                  onChange={(e) => setStayStatus(e.target.value as StayStatus)}
                  className="w-full bg-slate-50 text-slate-900 text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none cursor-pointer font-semibold"
                >
                  <option value="booked">📅 שוריין / עתידי</option>
                  <option value="checked_in">🐕 שוהה כעת בפנסיון</option>
                  <option value="checked_out">🏁 הסתיים ושוחרר</option>
                  <option value="cancelled">❌ מבוטל</option>
                </select>

                {/* Cancellation & Refund Control in status section */}
                {stayStatus === 'cancelled' && (depositAmount > 0 || Number(tempRefundAmount) > 0) && (
                  <div className="mt-2.5 p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-xs font-black text-rose-900 flex items-center gap-1">
                        <span>🔄</span>
                        <span>האם תבצע החזר כספי?</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRefundWillExecute(true)}
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-black cursor-pointer transition-all ${
                            refundWillExecute ? 'bg-rose-600 text-white shadow-2xs' : 'bg-white text-rose-800 border border-rose-200'
                          }`}
                        >
                          כן, יבוצע החזר
                        </button>
                        <button
                          type="button"
                          onClick={() => setRefundWillExecute(false)}
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                            !refundWillExecute ? 'bg-slate-700 text-white shadow-2xs' : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          ללא החזר
                        </button>
                      </div>
                    </div>

                    {refundWillExecute && (
                      <div className="space-y-2 pt-1.5 border-t border-rose-200">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-black text-rose-950 block mb-0.5">
                              סכום שיוחזר (₪):
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={tempRefundAmount}
                              onChange={(e) => setTempRefundAmount(e.target.value)}
                              className="w-full bg-white border border-rose-300 rounded-lg px-2 py-1 text-xs font-black text-rose-950 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-rose-950 block mb-0.5">
                              תאריך החזר:
                            </label>
                            <input
                              type="date"
                              value={refundDate}
                              onChange={(e) => setRefundDate(e.target.value)}
                              className="w-full bg-white border border-rose-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                            />
                          </div>
                        </div>

                        {/* Quick Refund Reason Selection */}
                        <div>
                          <label className="text-[10px] font-black text-rose-950 block mb-1">
                            סיבת ההחזר (בחר סיבה מהירה או הקלד אחר):
                          </label>
                          <div className="flex flex-wrap gap-1">
                            {learnedReasons.map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => {
                                  setRefundReason(r);
                                  setIsOtherReasonSelected(false);
                                }}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                                  !isOtherReasonSelected && refundReason === r
                                    ? 'bg-rose-600 text-white shadow-2xs'
                                    : 'bg-white text-rose-950 border border-rose-200 hover:bg-rose-100/70'
                                }`}
                              >
                                {r}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setIsOtherReasonSelected(true);
                                setRefundReason('אחר');
                              }}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                                isOtherReasonSelected
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'bg-white text-rose-950 border border-rose-200 hover:bg-rose-100/70'
                              }`}
                            >
                              אחר...
                            </button>
                          </div>

                          {isOtherReasonSelected && (
                            <div className="mt-1.5">
                              <input
                                type="text"
                                value={customRefundReason}
                                onChange={(e) => setCustomRefundReason(e.target.value)}
                                placeholder="פרט סיבה אחרת (תתווסף לכפתורים המהירים להבא)..."
                                className="w-full bg-white border border-rose-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Skip Review Request toggle */}
              <div className={`sm:col-span-2 p-3 rounded-xl border transition-all ${
                skipReviewRequest ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'
              }`}>
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipReviewRequest}
                    onChange={(e) => setSkipReviewRequest(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-red-600 focus:ring-red-500 border-slate-300 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      🚫 בטל שליחת בקשת חוות דעת ודירוג בוואטסאפ
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      סמן אפשרות זו אם בעל הכלב לא הסתדר איתנו, או שאין טעם לשלוח לו סקר ומועדון VIP.
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  תאריך כניסה
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setStartDate(newStart);
                    if (newStart > endDate) {
                      setEndDate(addDays(newStart, 1));
                    }
                  }}
                  className="w-full bg-slate-50 text-slate-900 text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none font-mono font-semibold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  תאריך יציאה ({daysCount} {daysCount === 1 ? 'יום' : 'ימים'})
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none font-mono font-semibold"
                />
              </div>
            </div>

            {/* If Training: Dedicated Estimated Days Input */}
            {serviceType === 'training' && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <span>🎓 מספר ימי אילוף משוערים</span>
                  </span>
                  <p className="text-[11px] text-amber-800">
                    הזן את הערכת הימים לאילוף הכלב — תאריך הסיום יתעדכן בהתאם:
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const newDays = Math.max(1, daysCount - 5);
                      setEndDate(addDays(startDate, newDays));
                    }}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 font-black text-amber-900 flex items-center justify-center cursor-pointer text-xs"
                    title="הפחת 5 ימים"
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newDays = Math.max(1, daysCount - 1);
                      if (newDays === 1) setEndDate(startDate);
                      else setEndDate(addDays(startDate, newDays));
                    }}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 font-black text-amber-900 flex items-center justify-center cursor-pointer text-sm"
                    title="הפחת יום 1"
                  >
                    -
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={trainingDaysInput}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setTrainingDaysInput(raw);
                      const parsed = parseInt(raw, 10);
                      if (!isNaN(parsed) && parsed >= 1 && parsed <= 365) {
                        setEndDate(addDays(startDate, parsed));
                      }
                    }}
                    onBlur={() => {
                      const parsed = parseInt(trainingDaysInput, 10);
                      if (isNaN(parsed) || parsed < 1) {
                        setTrainingDaysInput(String(daysCount));
                      } else {
                        const clamped = Math.min(365, Math.max(1, parsed));
                        setTrainingDaysInput(String(clamped));
                        setEndDate(addDays(startDate, clamped));
                      }
                    }}
                    className="w-16 bg-white border border-amber-300 rounded-lg py-1.5 text-center font-black text-amber-950 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newDays = daysCount + 1;
                      setEndDate(addDays(startDate, newDays));
                    }}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 font-black text-amber-900 flex items-center justify-center cursor-pointer text-sm"
                    title="הוסף יום 1"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newDays = daysCount + 5;
                      setEndDate(addDays(startDate, newDays));
                    }}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 font-black text-amber-900 flex items-center justify-center cursor-pointer text-xs"
                    title="הוסף 5 ימים"
                  >
                    +5
                  </button>
                  <span className="text-xs font-bold text-amber-900 mr-1">ימים</span>
                </div>
              </div>
            )}

            {/* Quick Days Selector & Stepper */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-500 font-medium ml-1">עדכון כמות ימים:</span>
                <button
                  type="button"
                  onClick={() => {
                    const newDays = Math.max(1, daysCount - 1);
                    if (newDays === 1) setEndDate(startDate);
                    else setEndDate(addDays(startDate, newDays));
                  }}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-black flex items-center justify-center cursor-pointer transition-colors"
                  title="הפחת יום"
                >
                  -
                </button>
                <span className="font-extrabold text-slate-900 bg-slate-100 px-3 py-1 rounded-lg text-xs min-w-[50px] text-center">
                  {daysCount} ימים
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const newDays = daysCount + 1;
                    setEndDate(addDays(startDate, newDays));
                  }}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-black flex items-center justify-center cursor-pointer transition-colors"
                  title="הוסף יום"
                >
                  +
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {[
                  { label: 'יום 1', days: 1 },
                  { label: '3 ימים', days: 3 },
                  { label: 'שבוע (7)', days: 7 },
                  { label: 'שבועיים (14)', days: 14 },
                  { label: '3 שבועות (21)', days: 21 },
                  { label: 'חודש (30)', days: 30 },
                  { label: '45 יום', days: 45 }
                ].map(p => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => {
                      if (p.days === 1) {
                        setEndDate(startDate);
                      } else {
                        setEndDate(addDays(startDate, p.days));
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      daysCount === p.days
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 5: Pricing Strategy & Payment */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
            
            {/* Free Stay / Multi-dog Payment Consolidation Box */}
            <div className={`p-3.5 rounded-2xl border transition-all ${
              isFreeStay ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-400/20' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isFreeStay}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsFreeStay(checked);
                      if (checked) {
                        setTotalPrice(0);
                        setDailyRate(0);
                        setDepositAmount(0);
                      } else {
                        const days = calculateDaysCount(startDate, endDate);
                        const rate = settings.defaultDailyRateBoarding;
                        setDailyRate(rate);
                        setTotalPrice(days * rate);
                      }
                    }}
                    className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>🎁 סמן כאירוח ללא תשלום (חינם / כלב נוסף)</span>
                      {isFreeStay && (
                        <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                          פעיל - ₪0
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      סמן כאן אם השהות היא בחינם, או שמדובר בכלב שני/נוסף של אותו לקוח שהתשלום נרשם על הכלב הראשי (כדי לשלוח ללקוח לינק תשלום יחיד).
                    </span>
                  </div>
                </label>
              </div>

              {isFreeStay && (
                <div className="mt-3 pt-2.5 border-t border-emerald-200/80 space-y-2.5 animate-in fade-in">
                  <span className="text-[11px] font-bold text-emerald-950 block">
                    סיבת הפטור מתשלום:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFreeStayReason('free')}
                      className={`p-2 rounded-xl border text-right text-xs transition-all cursor-pointer ${
                        freeStayReason === 'free'
                          ? 'bg-emerald-100/90 border-emerald-500 text-emerald-950 font-black shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      🎁 שהות בחינם / הטבה / סגירה מיוחדת
                    </button>
                    <button
                      type="button"
                      onClick={() => setFreeStayReason('second_dog')}
                      className={`p-2 rounded-xl border text-right text-xs transition-all cursor-pointer ${
                        freeStayReason === 'second_dog'
                          ? 'bg-emerald-100/90 border-emerald-500 text-emerald-950 font-black shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      🐕 כלב שני/נוסף – התשלום נרשם על הכלב הראשי
                    </button>
                  </div>

                  {freeStayReason === 'second_dog' && (
                    <div className="pt-1">
                      <input
                        type="text"
                        value={linkedMainDogName}
                        onChange={(e) => setLinkedMainDogName(e.target.value)}
                        placeholder="שם הכלב הראשי עליו נרשם התשלום המרוכז (למשל: מקס)"
                        className="w-full bg-white text-slate-900 text-xs px-3 py-2 rounded-xl border border-emerald-300 focus:outline-none font-bold"
                      />
                    </div>
                  )}

                  <div className="bg-emerald-100/80 text-emerald-950 text-[11px] font-semibold p-2.5 rounded-xl flex items-center gap-1.5 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>ההזמנה מוגדרת ב-₪0, שולמה במלואה ללא חוב, ולא יישלח קישור תשלום כפול ללקוח.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Top row: Pricing Mode Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                {serviceType === 'training' ? 'תמחור תהליך אילוף (מחיר כולל)' : 'חיוב, מקדמה ותשלום'}
              </h4>

              {/* Toggle Mode: Daily Rate vs Period Rate (Hidden for training since training has NO daily rate) */}
              {serviceType !== 'training' ? (
                <div className="inline-flex p-0.5 bg-slate-200 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setPricingMode('daily');
                      setTotalPrice(daysCount * dailyRate);
                    }}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      pricingMode === 'daily'
                        ? 'bg-white text-emerald-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📅 תשלום לפי מחיר ליום
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingMode('period')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      pricingMode === 'period'
                        ? 'bg-white text-indigo-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🏷️ מחיר פיקס / לתקופה
                  </button>
                </div>
              ) : (
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200">
                  🎓 באילוף אין מחיר ליום — יש רק מחיר כולל
                </span>
              )}
            </div>

            {/* Inputs based on pricing mode */}
            {serviceType === 'training' ? (
              /* Training: Pure Total Price, no daily rate */
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-700 font-bold block mb-1">
                    מחיר כולל לתהליך האילוף (₪) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={totalPrice === 0 ? '' : totalPrice}
                    onChange={(e) => setTotalPrice(e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                    placeholder="6500"
                    className="w-full bg-white text-amber-950 font-black text-base px-3.5 py-2.5 rounded-xl border-2 border-amber-400 focus:border-amber-600 focus:outline-none shadow-2xs"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    ברירת מחדל ₪6,500 — ניתן לעריכה לפי הסיכום עם הלקוח
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-700 font-bold block mb-1">
                    מקדמה ששולמה (₪)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalPrice}
                    value={depositAmount === 0 ? '' : depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-white text-green-600 font-black text-base px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {depositAmount > 0 
                      ? (depositAmount >= totalPrice ? '🟢 שולם במלואו' : `יתרת חוב לתשלום: ₪${Math.max(0, totalPrice - depositAmount)}`)
                      : '🔴 טרם שולם (חוב פתוח)'}
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-700 font-bold block mb-1">
                    אמצעי תשלום
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-white text-slate-900 text-sm font-semibold px-3 py-2.5 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none cursor-pointer"
                  >
                    <option value="bit">ביט (Bit)</option>
                    <option value="paybox">פייבוקס (PayBox)</option>
                    <option value="cash">מזומן</option>
                    <option value="credit">כרטיס אשראי / Grow</option>
                    <option value="bank_transfer">העברה בנקאית</option>
                    <option value="other">אחר</option>
                  </select>
                </div>
              </div>
            ) : pricingMode === 'daily' ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-slate-600 font-semibold block mb-1">
                    תעריף ליום (₪)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={dailyRate === 0 ? '' : dailyRate}
                    onChange={(e) => {
                      const r = e.target.value === '' ? 0 : Number(e.target.value) || 0;
                      setDailyRate(r);
                      setTotalPrice(daysCount * r);
                    }}
                    className="w-full bg-white text-slate-900 font-bold text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
                    placeholder="0"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {daysCount} ימים × ₪{dailyRate}
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-semibold block mb-1">
                    סה״כ לתשלום (₪)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={totalPrice === 0 ? '' : totalPrice}
                    onChange={(e) => setTotalPrice(e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-slate-100 text-slate-900 font-extrabold text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
                    מחושב אוטומטית
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-semibold block mb-1">
                    מקדמה ששולמה (₪)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalPrice}
                    value={depositAmount === 0 ? '' : depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-white text-green-600 font-bold text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {depositAmount > 0 ? `שולם ₪${depositAmount}` : 'לא שולם עדיין'}
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-semibold block mb-1">
                    אמצעי תשלום
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-white text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none cursor-pointer"
                  >
                    <option value="bit">ביט (Bit)</option>
                    <option value="paybox">פייבוקס (PayBox)</option>
                    <option value="cash">מזומן</option>
                    <option value="credit">כרטיס אשראי</option>
                    <option value="bank_transfer">העברה בנקאית</option>
                    <option value="other">אחר</option>
                  </select>
                </div>
              </div>
            ) : (
              /* Period / Global Price Mode for other services */
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-600 font-semibold block mb-1">
                    מחיר קבוע / חבילה לכל התקופה (₪) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={totalPrice === 0 ? '' : totalPrice}
                    onChange={(e) => setTotalPrice(e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-white text-indigo-950 font-extrabold text-sm px-3 py-2 rounded-xl border-2 border-indigo-300 focus:border-indigo-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-indigo-600 mt-0.5 block">
                    (שווה ערך ל-₪{daysCount > 0 ? Math.round(totalPrice / daysCount) : 0} ליום ל-{daysCount} ימים)
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-semibold block mb-1">
                    מקדמה ששולמה (₪)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalPrice}
                    value={depositAmount === 0 ? '' : depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-white text-green-600 font-bold text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {depositAmount > 0 ? `שולם ₪${depositAmount}` : 'חוב פתוח'}
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-semibold block mb-1">
                    אמצעי תשלום
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-white text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none cursor-pointer"
                  >
                    <option value="bit">ביט (Bit)</option>
                    <option value="paybox">פייבוקס (PayBox)</option>
                    <option value="cash">מזומן</option>
                    <option value="credit">כרטיס אשראי</option>
                    <option value="bank_transfer">העברה בנקאית</option>
                    <option value="other">אחר</option>
                  </select>
                </div>
              </div>
            )}

            {/* Calculated Remaining Debt & Resulting Color Status */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">
                יתרה לתשלום:{' '}
                <span className={`font-bold ${remainingDebt > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  ₪{remainingDebt}
                </span>
              </span>

              <div>
                {remainingDebt === 0 && totalPrice > 0 ? (
                  <span className="bg-green-500 text-white px-2.5 py-0.5 rounded-lg font-bold shadow-xs">
                    🟢 ירוק מלא (שולם)
                  </span>
                ) : depositAmount > 0 ? (
                  <span className="border-2 border-dashed border-green-500 bg-green-50 text-green-800 px-2.5 py-0.5 rounded-lg font-bold">
                    🟡 ירוק מקווקו (מקדמה)
                  </span>
                ) : (
                  <span className="bg-red-500 text-white px-2.5 py-0.5 rounded-lg font-bold shadow-xs">
                    🔴 אדום (חוב פתוח)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section: Mandatory Placement (תא 1-11 או הלנה ביתית) & Feeding */}
          <div className={`p-4 rounded-2xl border-2 space-y-3 transition-all ${
            placementError ? 'border-red-500 bg-red-50/50' : 'border-indigo-200 bg-indigo-50/30'
          }`}>
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>🏠 מיקום לינה ושיבוץ תא:</span>
                <span className="text-red-500 font-black">* (שדה חובה)</span>
              </label>
              {placementError && (
                <span className="text-xs text-red-600 font-bold animate-pulse">
                  {placementError}
                </span>
              )}
            </div>

            {/* Placement Buttons: 1..11 and Home */}
            <div className="space-y-2">
              <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setKennelPlacement(num);
                      setPlacementError('');
                    }}
                    className={`py-2 rounded-xl border text-center transition-all cursor-pointer font-black text-xs ${
                      kennelPlacement === num
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs scale-105'
                        : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-800'
                    }`}
                  >
                    תא {num}
                  </button>
                ))}
              </div>

              {/* Home Boarding Button */}
              <button
                type="button"
                onClick={() => {
                  setKennelPlacement('home');
                  setPlacementError('');
                }}
                className={`w-full p-2.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between text-xs font-bold ${
                  kennelPlacement === 'home'
                    ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                    : 'bg-amber-50/80 border-amber-300 hover:bg-amber-100 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>🏡</span>
                  <span>הלנה ביתית (בבית של שמוליק) | 🪣 דלי הלנה ביתית</span>
                </div>
                {kennelPlacement === 'home' && <span>✓ נבחר</span>}
              </button>
            </div>

            {/* Feeding Schedule & Food Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ⏰ שעות האכלה:
                </label>
                <input
                  type="text"
                  value={feedingSchedule}
                  onChange={(e) => setFeedingSchedule(e.target.value)}
                  placeholder="למשל: 08:00, 18:00"
                  className="w-full bg-white text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  🥣 כמות מנה והנחיות מזון:
                </label>
                <input
                  type="text"
                  value={foodPortion}
                  onChange={(e) => setFoodPortion(e.target.value)}
                  placeholder="למשל: 1 כוס בוקר וערב, להרטיב במים"
                  className="w-full bg-white text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none font-medium"
                />
              </div>
            </div>

            {/* Medication Schedule & Instructions */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                💊 תרופות, שעות ומינון (אם יש):
              </label>
              <input
                type="text"
                value={medicationSchedule}
                onChange={(e) => setMedicationSchedule(e.target.value)}
                placeholder="למשל: אפוקוול חצי כדור ב-08:00 עם האוכל, טיפות עיניים פעמיים ביום"
                className="w-full bg-white text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-rose-500 focus:outline-none font-medium"
              />
            </div>

            {/* Complexity Surcharge (תוספת שקלים להנחיה מורכבת) */}
            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1">
                <label className="text-xs font-black text-amber-950 flex items-center gap-1 mb-0.5">
                  <span>💰 תוספת הנחיה מורכבת (בשקלים):</span>
                </label>
                <input
                  type="text"
                  value={complexityReason}
                  onChange={(e) => setComplexityReason(e.target.value)}
                  placeholder="סיבה: טיפול תרופתי מורכב / מזון מבושל מיוחד..."
                  className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none"
                />
              </div>

              <div className="w-full sm:w-32 shrink-0">
                <label className="text-[11px] font-bold text-amber-900 block mb-0.5">
                  סכום תוספת (₪):
                </label>
                <input
                  type="number"
                  min="0"
                  value={complexitySurcharge || ''}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    const prev = complexitySurcharge || 0;
                    setComplexitySurcharge(val);
                    setTotalPrice(prevTotal => Math.max(0, prevTotal - prev + val));
                  }}
                  placeholder="0 ₪"
                  className="w-full bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 font-mono font-bold focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Notes & Vaccination */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="vaccination-valid"
                checked={vaccinationValid}
                onChange={(e) => setVaccinationValid(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded bg-white border-slate-300 cursor-pointer"
              />
              <label htmlFor="vaccination-valid" className="text-xs text-slate-700 font-semibold cursor-pointer">
                פנקס חיסונים (משושה וכלבת) בתוקף ומאושר
              </label>
            </div>

            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות מיוחדות, מזון, תרופות, אופי הכלב, חיברות..."
              className="w-full bg-slate-50 text-slate-900 text-xs sm:text-sm p-2.5 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none resize-none"
            />

            {/* 🚩 Dedicated Placement & Special Instructions Field */}
            <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-3 space-y-1.5 shadow-2xs">
              <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                <span>🚩 דגש שיבוץ והוראות מיוחדות (מופיע בראש כרטיסיית הכלב ביומן):</span>
              </label>
              <input
                type="text"
                value={placementNotes}
                onChange={(e) => setPlacementNotes(e.target.value)}
                placeholder="למשל: שיבוץ אך ורק עם ג'נגו / לא להוציא עם נקבות / תוקפת דרך גדר..."
                className="w-full bg-white text-slate-900 text-xs sm:text-sm p-2.5 rounded-xl border border-amber-300 focus:border-amber-600 focus:ring-1 focus:ring-amber-500 focus:outline-none font-bold"
              />
            </div>
          </div>

          {/* Checkout Debt Warning Prompt */}
          {showDebtCheckoutConfirm && (
            <div className="p-3.5 bg-red-50 border-2 border-red-300 rounded-2xl text-slate-900 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-red-700 font-black text-sm">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span>שים לב: סימנת את הכלב כמשוחרר, אך נותר חוב פתוח של ₪{remainingDebt.toLocaleString('he-IL')}!</span>
              </div>
              <p className="text-xs text-slate-600">
                האם ברצונך לסמן את ההזמנה כשולמה במלואה ולסגור שחרור, או לשחרר עם יתרת חוב פתוחה?
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDepositAmount(totalPrice);
                    doSave(totalPrice, 'fully_paid');
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>סמן כשולם מלא וסגור שחרור</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    doSave(depositAmount, depositAmount > 0 ? 'deposit_paid' : 'unpaid');
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer"
                >
                  שמור ושחרר עם חוב פתוח
                </button>
                <button
                  type="button"
                  onClick={() => setShowDebtCheckoutConfirm(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline pr-1 cursor-pointer"
                >
                  חזור לעריכה
                </button>
              </div>
            </div>
          )}

          {/* Refund Confirmation Modal Dialog when cancelling order with payments */}
          {showRefundPrompt && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
              <div className="bg-white border-2 border-rose-400 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center gap-2.5 text-rose-800 font-black text-lg border-b border-rose-100 pb-3">
                  <span className="text-2xl">🔄</span>
                  <span>ביטול הזמנה: האם תבצע החזר כספי?</span>
                </div>

                <div className="text-sm text-slate-700 space-y-2">
                  <p className="font-bold">
                    עבור הזמנה זו שולם סכום של <strong className="text-emerald-700 font-mono text-base">₪{depositAmount}</strong>.
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    כדי שקוביית ההכנסות תתעדכן במדויק בנטו, יש לציין האם יבוצע החזר כספי ללקוח ומה הסכום שיוחזר.
                  </p>
                </div>

                {/* Choice Buttons */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRefundWillExecute(true)}
                    className={`p-3 rounded-2xl border-2 text-center transition-all cursor-pointer font-black text-sm ${
                      refundWillExecute
                        ? 'bg-rose-50 border-rose-500 text-rose-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-lg mb-0.5">🟢</div>
                    <div>כן, יבוצע החזר כספי</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundWillExecute(false)}
                    className={`p-3 rounded-2xl border-2 text-center transition-all cursor-pointer font-black text-sm ${
                      !refundWillExecute
                        ? 'bg-slate-800 border-slate-900 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-lg mb-0.5">⚪</div>
                    <div>לא, ללא החזר</div>
                  </button>
                </div>

                {refundWillExecute && (
                  <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3.5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-xs font-black text-rose-950 block mb-1">
                          סכום שיוחזר ללקוח (₪):
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={tempRefundAmount}
                          onChange={(e) => setTempRefundAmount(e.target.value)}
                          className="w-full bg-white border border-rose-300 rounded-xl px-3 py-2 text-sm font-black font-mono text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                          placeholder="288"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-black text-rose-950 block mb-1">
                          תאריך ביצוע ההחזר:
                        </label>
                        <input
                          type="date"
                          value={refundDate}
                          onChange={(e) => setRefundDate(e.target.value)}
                          className="w-full bg-white border border-rose-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        />
                      </div>
                    </div>

                    {/* Quick Reason Selection in Prompt Modal */}
                    <div>
                      <label className="text-xs font-black text-rose-950 block mb-1.5">
                        סיבת ביצוע ההחזר (בחר סיבה מהירה או הקלד אחר):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {learnedReasons.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              setRefundReason(r);
                              setIsOtherReasonSelected(false);
                            }}
                            className={`text-xs font-bold px-2.5 py-1 rounded-xl cursor-pointer transition-all ${
                              !isOtherReasonSelected && refundReason === r
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'bg-white text-rose-950 border border-rose-200 hover:bg-rose-100/70'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setIsOtherReasonSelected(true);
                            setRefundReason('אחר');
                          }}
                          className={`text-xs font-bold px-2.5 py-1 rounded-xl cursor-pointer transition-all ${
                            isOtherReasonSelected
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'bg-white text-rose-950 border border-rose-200 hover:bg-rose-100/70'
                          }`}
                        >
                          אחר...
                        </button>
                      </div>

                      {isOtherReasonSelected && (
                        <div className="mt-2">
                          <input
                            type="text"
                            value={customRefundReason}
                            onChange={(e) => setCustomRefundReason(e.target.value)}
                            placeholder="פרט סיבה אחרת (תתווסף לכפתורים המהירים להבא)..."
                            className="w-full bg-white border border-rose-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 shadow-2xs"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Confirmation buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRefundPrompt(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    חזור לעריכה
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRefundPrompt(false);
                      doSave();
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer active:scale-95"
                  >
                    אשר ושמור ביטול
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            {/* Delete button if editing existing booking */}
            {initialData?.id && onDeleteBooking ? (
              <button
                type="button"
                onClick={() => {
                  onDeleteBooking(initialData.id!);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-rose-200"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>מחק הזמנה</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
              >
                בטל
              </button>

              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 active:scale-98 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                <span>שמור והוסף ליומן</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
