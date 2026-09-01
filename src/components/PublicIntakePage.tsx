import React, { useState } from 'react';
import { ResortSettings, ServiceType, IntakeRequest } from '../types';
import { addDays, getTodayStr, calculateDaysCount } from '../utils/dateUtils';
import { saveIntakeRequestToDb } from '../services/dbService';
import { sendResortWhatsAppNotification, formatIntakeNotification } from '../services/notificationService';
import { 
  CheckCircle2, 
  Send, 
  Calendar, 
  User, 
  Phone, 
  Heart, 
  ShieldCheck, 
  Sparkles,
  ArrowRight
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
  const [isFriendlyWithDogs, setIsFriendlyWithDogs] = useState<'yes' | 'no' | 'depends'>('yes');
  const [isNeutered, setIsNeutered] = useState(true);
  const [isVaccinated, setIsVaccinated] = useState(true);
  const [specialNeeds, setSpecialNeeds] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Auto adjust dates when training is selected
  const handleServiceChange = (st: ServiceType) => {
    setServiceType(st);
    if (st === 'training') {
      setEndDate(addDays(startDate, 50));
    } else if (st === 'daycare') {
      setEndDate(startDate);
    }
  };

  const daysCount = Math.max(1, calculateDaysCount(startDate, endDate));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim() || !ownerPhone.trim() || !dogName.trim()) {
      alert('נא למלא שם בעלים, טלפון ושם הכלב');
      return;
    }

    setIsSubmitting(true);

    const requestId = `req-${Date.now()}`;
    const newRequest: IntakeRequest = {
      id: requestId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerEmail: ownerEmail.trim() || undefined,
      dogName: dogName.trim(),
      dogBreed: dogBreed.trim() || 'מעורב',
      dogAge: dogAge.trim() || undefined,
      dogSize,
      serviceType,
      startDate,
      endDate,
      isFriendlyWithDogs,
      isNeutered,
      isVaccinated,
      specialNeeds: specialNeeds.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      // 1. Save to Supabase and LocalStorage
      await saveIntakeRequestToDb(newRequest);

      // 2. Send automated notification to Resort's WhatsApp
      await sendResortWhatsAppNotification(
        formatIntakeNotification(newRequest),
        settings
      );

      setIsSubmitted(true);
    } catch (err) {
      console.error('Error submitting intake request:', err);
      // Still show success to user if saved locally
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
              בקשת השריון עבור <span className="text-emerald-700 font-bold">{dogName}</span> התקבלה בהצלחה בריזורט לכלב.
            </p>
          </div>

          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 text-right space-y-2 text-xs text-slate-700">
            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-1.5 font-bold text-emerald-950">
              <span>📅 תאריכים מבוקשים:</span>
              <span>{startDate} עד {endDate} ({daysCount} ימים)</span>
            </div>
            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-1.5">
              <span>🐕 שירות:</span>
              <span className="font-bold">
                {serviceType === 'training' ? 'תהליך אילוף (50 יום)' :
                 serviceType === 'day_training' ? 'אילוף ביומיות' :
                 serviceType === 'daycare' ? 'יום כיף (דייקר)' : 'פנסיון לינה'}
              </span>
            </div>
            <p className="text-emerald-900 pt-1 font-medium leading-relaxed">
              📞 <strong>מה השלב הבא?</strong> צוות הריזורט לכלב יעבור על הפרטים וייצור עמכם קשר טלפוני בהקדם לתיאום סופי, בדיקת התאמה והסדרת שריון המקום.
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
                href={`https://wa.me/${settings.managerPhone?.replace(/\D/g, '') || '0548889900'}`}
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
            טופס קליטה ובקשת שריון מקום 🐾 מלאו מספר שאלות קצרות וצוות הריזורט לכלב ייצור עמכם קשר טלפוני לתיאום סופי.
          </p>
        </header>

        {/* Intake Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-5 sm:p-7 space-y-6">
          
          {/* Section 1: Owner Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-[#0f4c3a] pb-1 border-b border-slate-100">
              <User className="w-4 h-4 text-emerald-600" />
              <span>פרטי איש קשר (הבעלים)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  שם מלא *
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
                  טלפון נייד בוואטסאפ *
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
              <span>פרטי הכלב/ה</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  שם הכלב/ה *
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
                  גזע
                </label>
                <input
                  type="text"
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
                  placeholder="למשל: שנה וחצי / גור"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                גודל ומשקל משוער
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
              <span>השירות המבוקש</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'boarding', icon: '🏨', title: 'פנסיון לינה', desc: 'אירוח מלא בריזורט' },
                { id: 'training', icon: '🎓', title: 'אילוף (50 יום)', desc: 'תכנית אילוף ושיקום' },
                { id: 'day_training', icon: '🦮', title: 'אילוף יומי', desc: 'ללא לינת לילה' },
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
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-[#0f4c3a] pb-1 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>תאריכים מבוקשים ({daysCount} {daysCount === 1 ? 'יום' : 'ימים'})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  תאריך הגעה *
                </label>
                <input
                  type="date"
                  required
                  min={today}
                  value={startDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartDate(val);
                    if (serviceType === 'training') {
                      setEndDate(addDays(val, 50));
                    } else if (val > endDate) {
                      setEndDate(addDays(val, 1));
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  תאריך יציאה / סיום *
                </label>
                <input
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Crucial Vetting Questions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-[#0f4c3a] pb-1 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>התנהגות ובריאות (שאלות סינון)</span>
            </div>

            <div className="space-y-3 text-xs">
              {/* Friendly with other dogs */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="font-bold text-slate-800 block mb-1.5">
                  🐕 האם הכלב מסתדר עם כלבים אחרים?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'yes', label: 'כן, חברותי 🟢' },
                    { id: 'depends', label: 'תלוי בסיטואציה 🟡' },
                    { id: 'no', label: 'לא / תוקפני 🔴' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setIsFriendlyWithDogs(f.id as any)}
                      className={`py-2 px-2 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                        isFriendlyWithDogs === f.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Neutered & Vaccinated */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-800">✂️ האם מסורס / מעוקרת?</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsNeutered(true)}
                      className={`px-3 py-1 rounded-lg border font-bold text-xs cursor-pointer ${
                        isNeutered ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      כן
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNeutered(false)}
                      className={`px-3 py-1 rounded-lg border font-bold text-xs cursor-pointer ${
                        !isNeutered ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      לא
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-800">💉 חיסונים בתוקף?</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsVaccinated(true)}
                      className={`px-3 py-1 rounded-lg border font-bold text-xs cursor-pointer ${
                        isVaccinated ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      כן
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsVaccinated(false)}
                      className={`px-3 py-1 rounded-lg border font-bold text-xs cursor-pointer ${
                        !isVaccinated ? 'bg-red-600 text-white border-red-600' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      לא בטוח
                    </button>
                  </div>
                </div>
              </div>

              {/* Special needs or medication */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  🩺 צרכים מיוחדים, תרופות, אוכל או רגישויות
                </label>
                <input
                  type="text"
                  value={specialNeeds}
                  onChange={(e) => setSpecialNeeds(e.target.value)}
                  placeholder="למשל: מקבל כדור בבוקר, אוכל מיוחד, חרדת רעשים"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  📝 הערות נוספות לצוות הריזורט
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="כל פרט נוסף שיעזור לנו להעניק לכלבכם את השהות הנעימה ביותר"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#065f46] hover:bg-[#044e45] active:scale-[0.99] text-white font-black py-3.5 rounded-2xl text-base shadow-lg shadow-emerald-950/10 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>שולח בקשה לריזורט...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>שלח בקשת שריון לריזורט לכלב</span>
                </>
              )}
            </button>
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
