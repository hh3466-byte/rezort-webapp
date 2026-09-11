import React, { useState } from 'react';
import { ResortSettings, ServiceType, IntakeRequest } from '../types';
import { addDays, getTodayStr, calculateDaysCount, getDayNameHebrew, formatDateIL } from '../utils/dateUtils';
import { saveIntakeRequestToDb } from '../services/dbService';
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
  Clock
} from 'lucide-react';

interface PublicIntakePageProps {
  settings: ResortSettings;
  onBackToApp?: () => void;
}

export const PublicIntakePage: React.FC<PublicIntakePageProps> = ({ settings, onBackToApp }) => {
  const today = getTodayStr();

  // Form State
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [dogName, setDogName] = useState('');
  const [dogBreed, setDogBreed] = useState('');
  const [dogAge, setDogAge] = useState('');
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

  // Auto adjust dates when service is selected
  const handleServiceChange = (st: ServiceType) => {
    setServiceType(st);
    if (st === 'daycare') {
      setEndDate(startDate);
    }
  };

  const daysCount = Math.max(1, calculateDaysCount(startDate, endDate));
  const nightsCount = Math.max(1, calculateDaysCount(startDate, endDate));

  const handleNightsChange = (delta: number) => {
    const newNights = Math.max(1, nightsCount + delta);
    setEndDate(addDays(startDate, newNights));
  };

  const handleStartDateChange = (newStart: string) => {
    if (!newStart) return;
    const currentNights = Math.max(1, calculateDaysCount(startDate, endDate));
    setStartDate(newStart);
    if (serviceType === 'daycare') {
      setEndDate(newStart);
    } else {
      setEndDate(addDays(newStart, currentNights));
    }
  };

  const applyDatePreset = (preset: 'weekend' | 'next_weekend' | 'midweek' | 'week' | 'twoweeks' | 'training_month') => {
    const d = new Date(today + 'T00:00:00');
    const day = d.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat

    if (preset === 'weekend') {
      let daysToThu = (4 - day + 7) % 7;
      if (day === 5 || day === 6) daysToThu += 7;
      const s = addDays(today, daysToThu);
      setStartDate(s);
      setEndDate(addDays(s, 2));
    } else if (preset === 'next_weekend') {
      let daysToThu = (4 - day + 7) % 7;
      daysToThu += 7;
      const s = addDays(today, daysToThu);
      setStartDate(s);
      setEndDate(addDays(s, 2));
    } else if (preset === 'midweek') {
      let daysToSun = (0 - day + 7) % 7;
      if (daysToSun === 0 && day > 0) daysToSun = 7;
      const s = addDays(today, daysToSun);
      setStartDate(s);
      setEndDate(addDays(s, 4));
    } else if (preset === 'week') {
      setEndDate(addDays(startDate, 7));
    } else if (preset === 'twoweeks') {
      setEndDate(addDays(startDate, 14));
    } else if (preset === 'training_month') {
      setEndDate(addDays(startDate, 30));
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
      setErrorMessage('נא לבחור תאריך כניסה / הגעה לריזורט (שדה חובה)');
      return false;
    }
    if (!endDate) {
      setErrorMessage('נא לבחור תאריך איסוף / יציאה מהריזורט (שדה חובה)');
      return false;
    }
    if (endDate < startDate) {
      setErrorMessage('תאריך היציאה אינו יכול להיות מוקדם מתאריך הכניסה');
      return false;
    }
    if (!specialNeeds.trim()) {
      setErrorMessage('סעיף 6 הינו שדה חובה: לחצו על הכפתור "הכלב בריא לחלוטין" או פרטו תרופות/צרכים מיוחדים בתיבה');
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

    const requestId = `${isCallbackOnly ? 'call' : 'req'}-${Date.now()}`;
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
      dogSize,
      serviceType,
      startDate,
      endDate,
      isFriendlyWithDogs,
      isNeutered,
      isVaccinated,
      isHouseTrained,
      isTreatedParasites,
      specialNeeds: specialNeeds.trim(),
      notes: [
        isCallbackOnly ? '[בקשת שיחה חוזרת טלפונית]' : '',
        isFlexibleDates ? '[תאריכים גמישים / בירור זמינות כללי]' : '',
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

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-[#0f4c3a]">
              תודה רבה, {ownerName}! 🐾
            </h2>
            <p className="text-sm font-semibold text-slate-600">
              {isQuickCallback
                ? `בקשתכם לשיחה טלפונית עבור ${dogName} התקבלה בהצלחה בריזורט לכלב.`
                : `שאלון הקליטה עבור ${dogName} התקבל בהצלחה בריזורט לכלב.`}
            </p>
          </div>

          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 text-right space-y-2 text-xs text-slate-700">
            <p className="text-emerald-950 font-bold leading-relaxed">
              📞 <strong>מה השלב הבא?</strong> צוות הריזורט לכלב קיבל את כל הפרטים ויחזור אליכם טלפונית בהקדם למספר <span className="font-mono font-black text-emerald-800">{ownerPhone}</span> לתיאום סופי, מענה על שאלות והסדרת השריון.
            </p>
          </div>

          <div className="pt-2">
            {onBackToApp ? (
              <button
                type="button"
                onClick={onBackToApp}
                className="w-full bg-[#065f46] hover:bg-[#044e45] text-white font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md"
              >
                חזרה ליומן הראשי
              </button>
            ) : (
              <a
                href={`https://wa.me/${settings.managerPhone?.replace(/\D/g, '') || '0548765888'}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer shadow-md"
              >
                <span>💬 פתח שיחה ישירה עם צוות הריזורט</span>
              </a>
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
          {onBackToApp && (
            <div className="flex justify-start mb-2">
              <button
                type="button"
                onClick={onBackToApp}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs"
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
            שאלון קליטה ובקשת שריון מקום 🐾 מלאו את שאלות הסינון ונחזור אליכם טלפונית לתיאום והסדרת השריון.
          </p>
        </header>

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
                  טלפון נייד לחזרה / וואטסאפ <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="05X-XXXXXXX"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono"
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

            <div>
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
                {serviceType === 'daycare' ? 'שהות יומית (ללא לינה)' : `סה״כ ${daysCount} ${daysCount === 1 ? 'יום' : 'ימים'} (${nightsCount} ${nightsCount === 1 ? 'לילה' : 'לילות'})`}
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
                    שעות פעילות: 08:00 - 18:00
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
            ) : (
              /* BOARDING / TRAINING OVERNIGHT MODE */
              <div className="space-y-3">
                
                {/* Visual Duration Stepper Banner */}
                <div className="bg-white rounded-2xl p-3 sm:p-4 border border-emerald-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl font-bold shrink-0">
                      🌙
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 font-bold">משך השהות בריזורט:</div>
                      <div className="text-sm sm:text-base font-black text-emerald-950">
                        {nightsCount} {nightsCount === 1 ? 'לילה' : 'לילות'} ({daysCount} {daysCount === 1 ? 'יום' : 'ימים'})
                      </div>
                    </div>
                  </div>

                  {/* Interactive Nights Stepper */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 bg-slate-50 sm:bg-transparent p-1.5 sm:p-0 rounded-xl border sm:border-0 border-slate-200">
                    <span className="text-xs font-bold text-slate-600">שינוי לילות מהיר:</span>
                    <div className="flex items-center border border-slate-300 rounded-xl bg-white shadow-2xs overflow-hidden">
                      <button
                        type="button"
                        disabled={nightsCount <= 1}
                        onClick={() => handleNightsChange(-1)}
                        className="w-9 h-8 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center font-black text-slate-700 transition-all cursor-pointer border-l border-slate-200"
                        title="הפחת לילה אחד (-1)"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-xs font-black text-slate-900 min-w-[2.75rem] text-center font-mono">
                        {nightsCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleNightsChange(1)}
                        className="w-9 h-8 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center font-black text-emerald-800 transition-all cursor-pointer border-r border-slate-200"
                        title="הוסף לילה אחד (+1)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Two Date Inputs with Israeli Hebrew Day Display */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Arrival Date */}
                  <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between mb-1.5">
                      <span>🏨 תאריך הגעה / כניסה לריזורט *</span>
                      <span className="text-[11px] text-emerald-700 font-black">
                        {startDate ? `יום ${getDayNameHebrew(startDate)}` : ''}
                      </span>
                    </label>
                    <input
                      type="date"
                      required
                      min={today}
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-emerald-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono transition-all"
                    />
                    <div className="mt-1 text-[11px] text-slate-500 font-semibold">
                      {startDate ? formatDateIL(startDate) : ''}
                    </div>
                  </div>

                  {/* Departure Date */}
                  <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between mb-1.5">
                      <span>🚗 תאריך איסוף / יציאה מהריזורט *</span>
                      <span className="text-[11px] text-emerald-700 font-black">
                        {endDate ? `יום ${getDayNameHebrew(endDate)}` : ''}
                      </span>
                    </label>
                    <input
                      type="date"
                      required
                      min={startDate}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-emerald-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono transition-all"
                    />
                    <div className="mt-1 text-[11px] text-slate-500 font-semibold">
                      {endDate ? formatDateIL(endDate) : ''}
                    </div>
                  </div>
                </div>

                {/* Quick Presets Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className="text-[11px] font-bold text-slate-500">תקופות נפוצות:</span>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('weekend')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-900 transition-colors cursor-pointer shadow-2xs"
                  >
                    סופ״ש הקרוב (חמישי-שבת)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('next_weekend')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-900 transition-colors cursor-pointer shadow-2xs"
                  >
                    סופ״ש הבא
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('midweek')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-900 transition-colors cursor-pointer shadow-2xs"
                  >
                    אמצע שבוע (ראשון-חמישי)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('week')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-900 transition-colors cursor-pointer shadow-2xs"
                  >
                    שבוע מלא (7 לילות)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('twoweeks')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-900 transition-colors cursor-pointer shadow-2xs"
                  >
                    שבועיים (14 לילות)
                  </button>
                  {serviceType === 'training' && (
                    <button
                      type="button"
                      onClick={() => applyDatePreset('training_month')}
                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-bold text-purple-900 transition-colors cursor-pointer shadow-2xs"
                    >
                      חודש אילוף (30 יום)
                    </button>
                  )}
                </div>

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
                    { id: 'no', label: 'לא / תוקפני / לבד 🔴' },
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
                    ✂️ 2. מסורס / מעוקרת? <span className="text-red-500">*</span>
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
                  <span>🐾 שלח שאלון קליטה ובקשת שריון</span>
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
              <span>💬 חיוג / שיחה מהירה בוואטסאפ של הריזורט</span>
            </a>

            <p className="text-center text-[11px] text-slate-400 font-medium mt-2">
              🔒 הפרטים נשלחים ישירות לצוות הריזורט לכלב לצורך תיאום טלפוני ובדיקת זמינות.
            </p>
          </div>

        </form>

        <footer className="text-center text-xs text-slate-400 font-medium pb-6">
          הריזורט לכלב · פנסיון, אילוף ושיקום התנהגותי 🐾
        </footer>

      </div>
    </div>
  );
};
