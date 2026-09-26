import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  User, 
  Phone, 
  Dog, 
  Share2, 
  Clock, 
  Ticket, 
  Copy, 
  Check, 
  Search, 
  AlertCircle,
  CreditCard,
  Layers,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  CalendarDays
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  Booking, 
  Customer, 
  DaycarePass, 
  PassUsageEntry, 
  PaymentMethod, 
  PaymentStatus, 
  ResortSettings 
} from '../types';
import { 
  loadStoredDaycarePasses, 
  saveDaycarePassToDb, 
  deductDayFromPassInDb,
  subscribeToDaycarePasses 
} from '../services/dbService';
import { openWhatsAppMessage, cleanPhoneNumber } from '../utils/whatsappUtils';
import { formatDateIL, getTodayStr, addDays } from '../utils/dateUtils';

interface DaycarePassModalProps {
  settings: ResortSettings;
  customers: Customer[];
  bookings: Booking[];
  onClose: () => void;
  onSaveBooking: (booking: Booking) => Promise<void> | void;
}

export const DaycarePassModal: React.FC<DaycarePassModalProps> = ({
  settings,
  customers,
  bookings,
  onClose,
  onSaveBooking
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [passesList, setPassesList] = useState<DaycarePass[]>(() => loadStoredDaycarePasses());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPassForBooking, setSelectedPassForBooking] = useState<DaycarePass | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(getTodayStr());
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [createdPassResult, setCreatedPassResult] = useState<DaycarePass | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Form State for creating a new pass
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [dogName, setDogName] = useState<string>('');
  const [dogBreed, setDogBreed] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [ownerPhone, setOwnerPhone] = useState<string>('');
  const [ownerEmail, setOwnerEmail] = useState<string>('');
  const [serviceType, setServiceType] = useState<'daycare' | 'day_training'>('daycare');
  const [totalDays, setTotalDays] = useState<number>(10);
  const [dailyRate, setDailyRate] = useState<number>(() => settings.defaultDailyRateDaycare || 90);
  const [pricePaid, setPricePaid] = useState<number>(() => (settings.defaultDailyRateDaycare || 90) * 10);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('fully_paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bit');
  const [customNotes, setCustomNotes] = useState<string>('');

  // Subscribe to real-time daycare passes updates
  useEffect(() => {
    const unsub = subscribeToDaycarePasses((updatedList) => {
      setPassesList(updatedList);
    });
    return () => unsub();
  }, []);

  // Update rates when service type or totalDays changes
  const handleServiceTypeChange = (type: 'daycare' | 'day_training') => {
    setServiceType(type);
    const rate = type === 'day_training' 
      ? (settings.defaultDailyRateDayTraining || 250) 
      : (settings.defaultDailyRateDaycare || 90);
    setDailyRate(rate);
    setPricePaid(rate * totalDays);
  };

  const handleTotalDaysChange = (days: number) => {
    const d = Math.max(1, days);
    setTotalDays(d);
    setPricePaid(dailyRate * d);
  };

  // Handle selecting an existing customer
  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const match = customers.find(c => c.id === customerId);
    if (match) {
      setOwnerName(match.name);
      setOwnerPhone(match.phone);
      setOwnerEmail(match.email || '');
      const firstDog = match.dogs?.[0];
      setDogName(firstDog?.name || '');
      setDogBreed(firstDog?.breed || '');
    }
  };

  // Generate unique numeric pass code e.g. 8492
  const generatePassCode = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${rand}`;
  };

  // Calculate 6 months validity from today
  const calculateSixMonthsExpiry = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  };

  // Submit new pass
  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dogName.trim() || !ownerName.trim() || !ownerPhone.trim()) {
      alert('נא למלא את שם הכלב, שם הבעלים ומספר הטלפון');
      return;
    }

    const today = getTodayStr();
    const expiry = calculateSixMonthsExpiry();
    const passCode = generatePassCode();
    const passId = `pass-${Date.now()}`;

    const newPass: DaycarePass = {
      id: passId,
      passCode,
      dogName: dogName.trim(),
      dogBreed: dogBreed.trim() || undefined,
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerEmail: ownerEmail.trim() || undefined,
      serviceType,
      totalDays,
      usedDays: 0,
      pricePaid,
      dailyRate,
      paymentStatus,
      paymentMethod,
      notes: customNotes.trim() || undefined,
      validFrom: today,
      validUntil: expiry,
      status: 'active',
      usageHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveDaycarePassToDb(newPass);
    setCreatedPassResult(newPass);

    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Send WhatsApp to Customer with instructions and direct digital questionnaire link
  const handleSendWhatsAppToCustomer = (pass: DaycarePass) => {
    const remainingDays = pass.totalDays - pass.usedDays;
    const serviceName = pass.serviceType === 'day_training' 
      ? 'אילוף ביומיות (ללא לינה)' 
      : 'שהייה יומית בריזורט לכלב (מעון יום)';

    const cleanP = cleanPhoneNumber(pass.ownerPhone);
    const link = `https://rezort-webapp.vercel.app/?request=true&pass=${pass.passCode}&phone=${encodeURIComponent(cleanP)}&name=${encodeURIComponent(pass.ownerName)}&dog=${encodeURIComponent(pass.dogName)}`;

    const msg = `שלום ${pass.ownerName}! 🐾🐶
הונפקה עבורכם בהצלחה *כרטיסיית ${serviceName}* בריזורט לכלב!

🎟️ *מספר הכרטיסייה שלכם:* *${pass.passCode}*
📅 *כמות ימים:* *${pass.totalDays} ימים* (יתרה נוכחית: *${remainingDays} ימים*)
⏳ *תוקף הכרטיסייה:* עד לתאריך *${formatDateIL(pass.validUntil)}* (תוקף לחצי שנה)
💰 *סכום ששולם:* ₪${pass.pricePaid}

💡 *איך משריינים יום הגעה לריזורט?*
על מנת להבטיח שריון מקום ולוודא שאין עומס במתחם, *חובה להגיש בקשת שריון קצרה מראש לכל יום הגעה בנפרד*.
בכל פעם שתרצו להביא את ${pass.dogName}, פשוט נכנסים לקישור הבא ובוחרים את תאריך ההגעה:
👉 \u200E${link}

שמוליק יקבל את הבקשה ישירות במערכת ויאשר את שריון המקום ביומן הריזורט (ללא כל תשלום נוסף)! 🐕🤍`;

    openWhatsAppMessage(pass.ownerPhone, msg);
  };

  // Deduct a day and create a real booking in Calendar
  const handleConfirmDeductBooking = async () => {
    if (!selectedPassForBooking) return;
    if (!bookingDate) {
      alert('נא לבחור תאריך הגעה');
      return;
    }

    setIsBookingSubmitting(true);
    try {
      const bookingId = `b-pass-${Date.now()}`;
      const res = await deductDayFromPassInDb(
        selectedPassForBooking.id,
        bookingDate,
        bookingId,
        'shmulik',
        bookingNotes
      );

      if (!res.success || !res.pass) {
        alert(`שגיאה: ${res.error || 'לא ניתן לממש יום מהכרטיסייה'}`);
        setIsBookingSubmitting(false);
        return;
      }

      // Create booking in the Resort Calendar
      const newBooking: Booking = {
        id: bookingId,
        dogName: selectedPassForBooking.dogName,
        dogBreed: selectedPassForBooking.dogBreed || 'מעורב',
        ownerName: selectedPassForBooking.ownerName,
        ownerPhone: selectedPassForBooking.ownerPhone,
        ownerEmail: selectedPassForBooking.ownerEmail,
        serviceType: selectedPassForBooking.serviceType,
        startDate: bookingDate,
        endDate: bookingDate, // Daycare is single day
        totalPrice: 0, // Already prepaid via pass
        depositAmount: 0,
        paymentStatus: 'fully_paid',
        paymentMethod: selectedPassForBooking.paymentMethod || 'bit',
        stayStatus: 'booked',
        vaccinationValid: true,
        daycarePassId: selectedPassForBooking.id,
        daycarePassCode: selectedPassForBooking.passCode,
        notes: `מימוש מתוך כרטיסייה ${selectedPassForBooking.passCode} (יום ${res.pass.usedDays} מתוך ${res.pass.totalDays})${bookingNotes ? ` | ${bookingNotes}` : ''}`,
        arrivalTime: '08:30 - 10:00',
        pickupTime: '17:00 - 18:30',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSaveBooking(newBooking);

      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 }
      });

      // Prompt to send WhatsApp confirmation to client
      const remainingDays = res.pass.totalDays - res.pass.usedDays;
      if (confirm(`היום שוריין בהצלחה ביומן לתאריך ${formatDateIL(bookingDate)}!\nנותרו עוד ${remainingDays} ימים בכרטיסייה.\n\nלשלוח עכשיו הודעת אישור ללקוח בוואטסאפ?`)) {
        const confirmMsg = `היי ${selectedPassForBooking.ownerName}, שוריין בהצלחה מקום ל-${selectedPassForBooking.dogName} בריזורט לתאריך *${formatDateIL(bookingDate)}*! 🐾
🎟️ נוצל יום 1 מתוך כרטיסייה *${selectedPassForBooking.passCode}*.
📊 *יתרת הימים שנותרו לך בכרטיסייה:* *${remainingDays} מתוך ${selectedPassForBooking.totalDays} ימים*.
מחכים לראותכם! 🐶🤍`;
        openWhatsAppMessage(selectedPassForBooking.ownerPhone, confirmMsg);
      }

      setSelectedPassForBooking(null);
      setBookingNotes('');
    } catch (err: any) {
      alert(`שגיאה בשמירת שריון יום: ${err?.message || 'נסה שוב'}`);
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  // Filtered list of passes for search
  const filteredPasses = passesList.filter(p => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.passCode.toLowerCase().includes(q) ||
      p.dogName.toLowerCase().includes(q) ||
      p.ownerName.toLowerCase().includes(q) ||
      p.ownerPhone.includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col text-slate-900 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shadow-inner backdrop-blur-md">
              🎟️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">כרטיסיות פעילות יומית</h2>
                <span className="text-[11px] bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                  תוקף 6 חודשים
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                רכישת ימי שהות ואילוף ביומיות מראש, הנפקת שוברים ושריון ימי הגעה
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab('create'); setCreatedPassResult(null); }}
            className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>הנפקת כרטיסייה חדשה</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>כרטיסיות פעילות ({passesList.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: CREATE NEW PASS */}
          {activeTab === 'create' && (
            <div>
              {createdPassResult ? (
                /* Success Voucher View */
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-500/30 rounded-3xl p-6 text-center space-y-5 animate-in zoom-in-95">
                  <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/20">
                    🎟️
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
                      הכרטיסייה הונפקה ונשמרה בהצלחה!
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 mt-2">
                      {createdPassResult.dogName} ({createdPassResult.ownerName})
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {createdPassResult.serviceType === 'day_training' ? 'אילוף ביומיות' : 'שהייה יומית בריזורט'} • {createdPassResult.totalDays} ימים
                    </p>
                  </div>

                  {/* Voucher Card Box */}
                  <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm max-w-md mx-auto space-y-3 text-right">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs text-slate-500">קוד שובר למימוש:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-emerald-700 font-mono tracking-wider">
                          {createdPassResult.passCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(createdPassResult.passCode);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
                          title="העתק קוד"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block">סה״כ ימים:</span>
                        <span className="font-bold text-slate-800">{createdPassResult.totalDays} ימים</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">סכום ששולם:</span>
                        <span className="font-bold text-emerald-600">₪{createdPassResult.pricePaid}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">תוקף לחצי שנה:</span>
                        <span className="font-bold text-slate-800">{formatDateIL(createdPassResult.validUntil)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">סטטוס תשלום:</span>
                        <span className="font-bold text-slate-800">
                          {createdPassResult.paymentStatus === 'fully_paid' ? '🟢 שולם במלואו' : '🟡 טרם שולם'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => handleSendWhatsAppToCustomer(createdPassResult)}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>שלח שובר והסבר בוואטסאפ ללקוח 📲</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCreatedPassResult(null);
                        setActiveTab('list');
                      }}
                      className="px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-sm rounded-xl transition-all cursor-pointer"
                    >
                      צפה ברשימת הכרטיסיות
                    </button>
                  </div>
                </div>
              ) : (
                /* Pass Creation Form */
                <form onSubmit={handleCreatePass} className="space-y-5">
                  
                  {/* Step 1: Select Existing Customer or Enter New */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-emerald-600" />
                        <span>בחר לקוח קיים (או הזן ידנית למטה)</span>
                      </label>
                    </div>

                    <select
                      value={selectedCustomerId}
                      onChange={(e) => handleSelectCustomer(e.target.value)}
                      className="w-full bg-white text-slate-800 text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- בחר מרשימת הלקוחות או מלא ידנית --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.dogs?.[0]?.name || 'כלב'} ({c.name}) • {c.phone}
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-xs text-slate-600 font-bold block mb-1">שם הכלב *</label>
                        <input
                          type="text"
                          required
                          value={dogName}
                          onChange={(e) => setDogName(e.target.value)}
                          placeholder="למשל: רקסי"
                          className="w-full bg-white text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 font-bold block mb-1">גזע הכלב</label>
                        <input
                          type="text"
                          value={dogBreed}
                          onChange={(e) => setDogBreed(e.target.value)}
                          placeholder="למשל: גולדן רטריבר"
                          className="w-full bg-white text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 font-bold block mb-1">שם הבעלים *</label>
                        <input
                          type="text"
                          required
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                          placeholder="למשל: ישראל ישראלי"
                          className="w-full bg-white text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 font-bold block mb-1">טלפון נייד *</label>
                        <input
                          type="tel"
                          required
                          value={ownerPhone}
                          onChange={(e) => setOwnerPhone(e.target.value)}
                          placeholder="050-1234567"
                          className="w-full bg-white text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none text-left"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Service Type Selection */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-2">
                      סוג הפעילות היומית (ללא לינת לילה)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleServiceTypeChange('daycare')}
                        className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                          serviceType === 'daycare'
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xl">🐾</span>
                          <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-extrabold">
                            ₪{settings.defaultDailyRateDaycare || 90}/יום
                          </span>
                        </div>
                        <div className="text-sm font-black mt-2">שהייה יומית בריזורט (מעון יום)</div>
                        <div className="text-[11px] text-slate-500 font-normal">חצרות משחקים, חברה והשגחה מלאה</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleServiceTypeChange('day_training')}
                        className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                          serviceType === 'day_training'
                            ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950 font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xl">🦮</span>
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-extrabold">
                            ₪{settings.defaultDailyRateDayTraining || 250}/יום
                          </span>
                        </div>
                        <div className="text-sm font-black mt-2">אילוף ביומיות</div>
                        <div className="text-[11px] text-slate-500 font-normal">סשנים אישיים עם מאלף ללא לינה</div>
                      </button>
                    </div>
                  </div>

                  {/* Step 3: Days Quantity & Custom Price */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-700">כמות ימים בכרטיסייה:</label>
                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {totalDays} ימי פעילות
                        </span>
                      </div>

                      {/* Quick chip buttons */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {[5, 10, 15, 20].map(cnt => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => handleTotalDaysChange(cnt)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              totalDays === cnt
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {cnt} ימים {cnt === 10 ? '⭐ (פופולרי)' : ''}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={totalDays}
                          onChange={(e) => handleTotalDaysChange(Number(e.target.value) || 1)}
                          className="w-24 bg-slate-50 font-black text-center text-base py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                        <span className="text-xs text-slate-500">ימים שנרכשים מראש</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-700 font-bold block mb-1">
                          מחיר כולל לעסקה (₪) - <span className="text-emerald-700 font-normal">ניתן לעריכה חופשית ע״י שמוליק</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={pricePaid}
                          onChange={(e) => setPricePaid(Number(e.target.value) || 0)}
                          className="w-full bg-slate-50 font-black text-lg text-emerald-700 px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                        <span className="text-[11px] text-slate-400 mt-1 block">
                          מחושב: ₪{(pricePaid / (totalDays || 1)).toFixed(0)} ליום
                        </span>
                      </div>

                      <div>
                        <label className="text-xs text-slate-700 font-bold block mb-1">אמצעי תשלום</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                          className="w-full bg-slate-50 text-slate-800 text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none cursor-pointer"
                        >
                          <option value="bit">ביט (Bit / Grow)</option>
                          <option value="cash">מזומן (שולם לשמוליק)</option>
                          <option value="credit">כרטיס אשראי</option>
                          <option value="paybox">פייבוקס (PayBox)</option>
                          <option value="bank_transfer">העברה בנקאית</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="text-xs text-slate-500 block mb-1">הערות לשמוליק / אסמכתא (אופציונלי)</label>
                      <input
                        type="text"
                        value={customNotes}
                        onChange={(e) => setCustomNotes(e.target.value)}
                        placeholder="למשל: שילם מזומן מראש, מגיע בימי שלישי ורביעי"
                        className="w-full bg-slate-50 text-slate-800 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Validity Info Box */}
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold">תוקף הכרטיסייה: חצי שנה מיום ההנפקה</span> (עד {formatDateIL(calculateSixMonthsExpiry())}).
                      <p className="text-[11px] text-amber-800/90 mt-0.5">
                        הלקוח מקבל שובר דיגיטלי ומחויב לתאם מראש כל יום הגעה בנפרד למניעת עומס בריזורט.
                      </p>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-base rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>הנפק כרטיסייה והפק שובר דיגיטלי ✨</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: ACTIVE PASSES LIST */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              
              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חיפוש לפי שם כלב, בעלים, טלפון או קוד שובר (PASS-XXXX)..."
                  className="w-full bg-slate-50 text-slate-900 text-xs pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {filteredPasses.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Ticket className="w-10 h-10 mx-auto stroke-1" />
                  <p className="text-sm font-bold">לא נמצאו כרטיסיות פעילות</p>
                  <p className="text-xs">הנפק כרטיסייה חדשה בלשונית למעלה</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPasses.map(pass => {
                    const remaining = Math.max(0, pass.totalDays - pass.usedDays);
                    const isCompleted = pass.usedDays >= pass.totalDays;

                    return (
                      <div 
                        key={pass.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isCompleted 
                            ? 'bg-slate-50 border-slate-200 opacity-75' 
                            : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                              pass.serviceType === 'day_training' 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {pass.serviceType === 'day_training' ? '🦮' : '🐾'}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-sm text-slate-900">{pass.dogName}</h4>
                                <span className="text-xs text-slate-500 font-medium">({pass.ownerName})</span>
                                <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md font-bold">
                                  {pass.passCode}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                <span>📞 {pass.ownerPhone}</span>
                                <span>•</span>
                                <span>תוקף עד: {formatDateIL(pass.validUntil)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Remaining Badge */}
                          <div className="text-left">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-black inline-block ${
                              isCompleted 
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {remaining} / {pass.totalDays} ימים נותרו
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              שולם: ₪{pass.pricePaid} ({pass.paymentMethod})
                            </span>
                          </div>
                        </div>

                        {/* Visual Punch Circles */}
                        <div className="my-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 font-bold">
                            <span>ניצול ימי הכרטיסייה:</span>
                            <span>{pass.usedDays} נוצלו מתוך {pass.totalDays}</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from({ length: pass.totalDays }).map((_, idx) => {
                              const isUsed = idx < pass.usedDays;
                              return (
                                <div
                                  key={idx}
                                  className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center transition-all ${
                                    isUsed
                                      ? 'bg-emerald-500 text-white shadow-2xs'
                                      : 'bg-slate-100 text-slate-400 border border-slate-200 border-dashed'
                                  }`}
                                  title={isUsed ? `יום ${idx + 1} נוצל` : `יום ${idx + 1} פנוי`}
                                >
                                  {idx + 1}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Usage history preview if any */}
                        {pass.usageHistory && pass.usageHistory.length > 0 && (
                          <div className="bg-slate-50 p-2.5 rounded-xl text-[11px] text-slate-600 space-y-1 mb-3">
                            <span className="font-bold text-slate-700 block">היסטוריית הגעות:</span>
                            {pass.usageHistory.map((u, uIdx) => (
                              <div key={uIdx} className="flex items-center justify-between">
                                <span>📅 {formatDateIL(u.date)}</span>
                                <span className="text-slate-400">{u.notes || 'שריון רגיל'}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          {!isCompleted && (
                            <button
                              type="button"
                              onClick={() => setSelectedPassForBooking(pass)}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <CalendarDays className="w-3.5 h-3.5" />
                              <span>שריין יום מהכרטיסייה עכשיו 📅</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppToCustomer(pass)}
                            className="p-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-xl transition-all cursor-pointer"
                            title="שלח תזכורת יתרה בוואטסאפ"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SUB-MODAL: BOOK A DAY FROM PASS */}
        {selectedPassForBooking && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full p-5 text-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    📅
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900">
                      שריון יום ל-{selectedPassForBooking.dogName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      כרטיסייה {selectedPassForBooking.passCode} (נותרו {selectedPassForBooking.totalDays - selectedPassForBooking.usedDays} ימים)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPassForBooking(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  תאריך ההגעה לריזורט *
                </label>
                <input
                  type="date"
                  required
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-sm font-bold px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  הערות מיוחדות להגעה (אופציונלי)
                </label>
                <input
                  type="text"
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="למשל: מגיע ב-08:30, איסוף ע״י האבא"
                  className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                ✨ <strong>ללא תשלום נוסף:</strong> יום אחד יקוזז מהכרטיסייה, וייווצר אירוע ירוק סגור ביומן הריזורט לתאריך שנבחר.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isBookingSubmitting}
                  onClick={handleConfirmDeductBooking}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isBookingSubmitting ? 'משריין...' : 'אשר שריון יום וקזז מהכרטיסייה 🐾'}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPassForBooking(null)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
