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
  HeartPulse
} from 'lucide-react';
import { Booking, ResortSettings, ServiceType, PaymentStatus, StayStatus, PaymentMethod } from '../types';
import { calculateDaysCount, checkRangeOccupancy, getTodayStr, addDays, formatDateIL } from '../utils/dateUtils';
import { parseVoiceOrWhatsAppText } from '../services/agentService';

interface BookingFormModalProps {
  initialData?: Partial<Booking> | null;
  existingBookings: Booking[];
  settings: ResortSettings;
  onClose: () => void;
  onSave: (booking: Booking) => void;
}

export const BookingFormModal: React.FC<BookingFormModalProps> = ({
  initialData,
  existingBookings,
  settings,
  onClose,
  onSave,
}) => {
  const todayStr = getTodayStr();

  // Form state
  const [dogName, setDogName] = useState(initialData?.dogName || '');
  const [dogBreed, setDogBreed] = useState(initialData?.dogBreed || '');
  const [ownerName, setOwnerName] = useState(initialData?.ownerName || '');
  const [ownerPhone, setOwnerPhone] = useState(initialData?.ownerPhone || '');
  const [ownerEmail, setOwnerEmail] = useState(initialData?.ownerEmail || '');
  const [serviceType, setServiceType] = useState<ServiceType>(initialData?.serviceType || 'boarding');
  const [startDate, setStartDate] = useState(initialData?.startDate || todayStr);
  const [endDate, setEndDate] = useState(initialData?.endDate || addDays(todayStr, 3));
  
  // Pricing mode: Per Day vs Fixed Period
  const [pricingMode, setPricingMode] = useState<'daily' | 'period'>('daily');
  const [dailyRate, setDailyRate] = useState<number>(() => {
    if (initialData?.serviceType === 'day_training') return settings.defaultDailyRateDayTraining || 250;
    if (initialData?.serviceType === 'daycare') return settings.defaultDailyRateDaycare;
    return settings.defaultDailyRateBoarding;
  });
  const [totalPrice, setTotalPrice] = useState<number>(initialData?.totalPrice || 0);
  const [depositAmount, setDepositAmount] = useState<number>(initialData?.depositAmount || 0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialData?.paymentMethod || 'bit');
  const [stayStatus, setStayStatus] = useState<StayStatus>(initialData?.stayStatus || 'booked');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [specialDiet, setSpecialDiet] = useState(initialData?.specialDiet || '');
  const [vaccinationValid, setVaccinationValid] = useState(initialData?.vaccinationValid ?? true);

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
    if (newType === 'training') {
      const newEndDate = addDays(startDate, 70);
      setEndDate(newEndDate);
      setPricingMode('period');
      setTotalPrice(settings.defaultDailyRateTraining || 6500);
    } else {
      setPricingMode('daily');
      let rate = settings.defaultDailyRateBoarding;
      if (newType === 'day_training') rate = settings.defaultDailyRateDayTraining || 250;
      if (newType === 'daycare') rate = settings.defaultDailyRateDaycare;
      setDailyRate(rate);

      const days = calculateDaysCount(startDate, endDate);
      setTotalPrice(days * rate);
    }
  };

  // Recompute total price
  useEffect(() => {
    if (serviceType === 'training') {
      setTotalPrice(settings.defaultDailyRateTraining || 6500);
    } else if (pricingMode === 'daily') {
      const days = calculateDaysCount(startDate, endDate);
      setTotalPrice(days * dailyRate);
    }
  }, [startDate, endDate, dailyRate, pricingMode, serviceType, settings.defaultDailyRateTraining]);

  // If initialData had custom price not matching days * rate, default to matching or keep
  useEffect(() => {
    if (initialData?.totalPrice && initialData.totalPrice > 0) {
      const days = calculateDaysCount(startDate, endDate);
      const expectedDaily = days * dailyRate;
      if (initialData.totalPrice !== expectedDaily) {
        setTotalPrice(initialData.totalPrice);
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

    // Determine payment status
    let paymentStatus: PaymentStatus = 'unpaid';
    if (depositAmount >= totalPrice && totalPrice > 0) {
      paymentStatus = 'fully_paid';
    } else if (depositAmount > 0) {
      paymentStatus = 'deposit_paid';
    }

    const booking: Booking = {
      id: initialData?.id || `b-${Date.now()}`,
      dogName: dogName.trim(),
      dogBreed: dogBreed.trim(),
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerEmail: ownerEmail.trim(),
      serviceType,
      startDate,
      endDate,
      totalPrice: Number(totalPrice) || 0,
      depositAmount: Number(depositAmount) || 0,
      paymentStatus,
      paymentMethod,
      stayStatus,
      notes: notes.trim(),
      specialDiet: specialDiet.trim(),
      vaccinationValid,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(booking);
  };

  const remainingDebt = Math.max(0, totalPrice - depositAmount);
  const daysCount = calculateDaysCount(startDate, endDate);

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
                {initialData?.id ? 'עריכת הזמנה' : 'שריון הזמנה חדשה ביומן'}
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
                  <span className="text-[10px] font-bold text-amber-700">₪{settings.defaultDailyRateTraining || 6500}</span>
                </div>
                <div className="text-xs font-bold mt-1">תהליך אילוף (70 יום)</div>
                <div className="text-[10px] text-slate-500 font-normal">תכנית מלאה ל-70 יום</div>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-700 font-bold block mb-1">
                מצב שהות נוכחי
              </label>
              <select
                value={stayStatus}
                onChange={(e) => setStayStatus(e.target.value as StayStatus)}
                className="w-full bg-slate-50 text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none cursor-pointer font-semibold"
              >
                <option value="booked">📅 שוריין / עתידי</option>
                <option value="checked_in">🐕 שוהה כעת בפנסיון</option>
                <option value="checked_out">🏁 הסתיים ושוחרר</option>
                <option value="cancelled">❌ מבוטל</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-700 font-bold block mb-1">
                תאריך כניסה
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-700 font-bold block mb-1">
                תאריך יציאה ({daysCount} ימים)
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Section 5: Pricing Strategy (Per Day vs Fixed Period) & Payment */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
            
            {/* Top row: Pricing Mode Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                חיוב, מקדמה ותשלום (קביעת צבע ביומן)
              </h4>

              {/* Toggle Mode: Daily Rate vs Period Rate */}
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
            </div>

            {/* Inputs based on pricing mode */}
            {pricingMode === 'daily' ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-slate-600 font-semibold block mb-1">
                    תעריף ליום (₪)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={dailyRate}
                    onChange={(e) => {
                      const r = Number(e.target.value) || 0;
                      setDailyRate(r);
                      setTotalPrice(daysCount * r);
                    }}
                    className="w-full bg-white text-slate-900 font-bold text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
                    placeholder="מחיר ליום"
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
                    value={totalPrice}
                    onChange={(e) => setTotalPrice(Number(e.target.value) || 0)}
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
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
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
              /* Period / Global Price Mode */
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-600 font-semibold block mb-1">
                    מחיר קבוע / חבילה לכל התקופה (₪) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={totalPrice}
                    onChange={(e) => setTotalPrice(Number(e.target.value) || 0)}
                    placeholder="למשל: 900"
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
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
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
          </div>

          {/* Form Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
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

        </form>

      </div>
    </div>
  );
};
