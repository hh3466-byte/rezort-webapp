import React, { useState, useEffect, useMemo } from 'react';
import { DaycarePass, ResortSettings, IntakeRequest } from '../types';
import { formatDateIL, getTodayStr, addDays, getDayNameHebrew, calculateDaysCount } from '../utils/dateUtils';
import { cleanPhoneNumber, formatIsraeliPhoneDisplay, openWhatsAppMessage } from '../utils/whatsappUtils';
import { findDaycarePassByCode, findActiveDaycarePassByPhone, saveIntakeRequestToDb } from '../services/dbService';
import { sendGreenApiDirectMessage } from '../services/notificationService';
import { supabase } from '../utils/supabase';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  Calendar, 
  Dog, 
  User, 
  ExternalLink, 
  Ticket, 
  Sparkles, 
  MessageCircle, 
  AlertCircle, 
  Clock,
  Send,
  ShieldCheck,
  Check,
  ChevronLeft
} from 'lucide-react';

interface DigitalPassCustomerViewProps {
  passCode: string;
  settings?: ResortSettings;
  onBackToApp?: () => void;
}

export const DigitalPassCustomerView: React.FC<DigitalPassCustomerViewProps> = ({
  passCode,
  settings,
  onBackToApp
}) => {
  const [pass, setPass] = useState<DaycarePass | null>(null);
  const [loading, setLoading] = useState(true);

  // Booking next stay state
  const today = getTodayStr();
  const [bookingDate, setBookingDate] = useState(() => addDays(today, 1));
  const [bookingEndDate, setBookingEndDate] = useState(() => addDays(today, 2));
  const [arrivalTime, setArrivalTime] = useState('08:30 - 10:00');
  const [pickupTime, setPickupTime] = useState('17:00 - 18:30');
  const [bookingNotes, setBookingNotes] = useState('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Fetch Pass directly from Supabase / settings
  useEffect(() => {
    let isMounted = true;
    async function loadPass() {
      setLoading(true);
      try {
        const cleanCode = passCode.trim().toUpperCase();
        const rawPhone = cleanPhoneNumber(passCode);

        // 1. Try settings resort_config
        const { data: sData } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();
        const pList: DaycarePass[] = sData?.data?.daycare_passes || [];
        const matched = pList.find(p => 
          p.passCode.trim().toUpperCase() === cleanCode || 
          p.id === cleanCode ||
          (rawPhone.length >= 7 && cleanPhoneNumber(p.ownerPhone) === rawPhone)
        );

        if (matched && isMounted) {
          setPass(matched);
          setLoading(false);
          return;
        }

        // 2. Try fallback search via dbService
        const fallback = findDaycarePassByCode(cleanCode) || (rawPhone.length >= 7 ? findActiveDaycarePassByPhone(rawPhone) : null);
        if (fallback && isMounted) {
          setPass(fallback);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Error loading pass:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPass();
    return () => { isMounted = false; };
  }, [passCode]);

  const isBoarding = pass?.serviceType === 'boarding';
  const remainingDays = pass ? Math.max(0, pass.totalDays - pass.usedDays) : 0;
  const isUnpaid = pass?.paymentStatus === 'unpaid';
  
  // Calculate nights for boarding
  const nightsCount = useMemo(() => {
    if (!isBoarding) return 1;
    return Math.max(1, calculateDaysCount(bookingDate, bookingEndDate));
  }, [isBoarding, bookingDate, bookingEndDate]);

  // Parse available dogs from pass.dogName and notes
  const availableDogs = useMemo(() => {
    if (!pass) return [];
    const raw = pass.dogName || '';
    const regex = /(?:\s+ו-|\s+ו(?=[\u0590-\u05fe\w])|\s*\+\s*|\s*,\s*|\s*\/\s*|\s*&\s*)/;
    const parts = raw
      .split(regex)
      .map(s => s.trim())
      .filter(Boolean);

    if (pass.notes) {
      const match = pass.notes.match(/אורחים בטופס:\s*([^\]|]+)/);
      if (match) {
        const extra = match[1]
          .replace(/\(.*?\)/g, '')
          .split(regex)
          .map(s => s.trim())
          .filter(Boolean);
        for (const d of extra) {
          if (!parts.some(p => p.toLowerCase() === d.toLowerCase())) {
            parts.push(d);
          }
        }
      }
    }
    return Array.from(new Set(parts));
  }, [pass]);

  // Specific dog chosen for this reservation
  const [selectedDogName, setSelectedDogName] = useState('');

  // Sync initial selected dog when pass loads
  useEffect(() => {
    if (pass && !selectedDogName) {
      setSelectedDogName(pass.dogName || '');
    }
  }, [pass]);

  // Check if multiple / both dogs are selected for this reservation
  const isBothDogs = useMemo(() => {
    if (!selectedDogName) return false;
    const lower = selectedDogName.toLowerCase();
    if (lower.includes('שניהם') || lower.includes('2 כלבים') || lower.includes('זוג')) return true;
    if (availableDogs.length >= 2) {
      const matchesAll = availableDogs.every(d => lower.includes(d.toLowerCase()));
      if (matchesAll) return true;
    }
    return /(?:\s+ו(?=[\u0590-\u05fe\w])|\s*\+\s*|\s*,\s*)/.test(selectedDogName);
  }, [selectedDogName, availableDogs]);

  const dogCount = isBothDogs ? Math.max(2, availableDogs.length) : 1;
  const singleStayUnits = isBoarding ? nightsCount : 1;
  const totalDaysToDeduct = singleStayUnits * dogCount;

  // Official Grow Production Payment URL
  const paymentUrl = pass?.paymentUrl || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

  // Handle single-click reservation
  const handleReserveStay = async () => {
    if (!pass) return;
    const targetDogName = selectedDogName.trim() || pass.dogName;
    if (!targetDogName) {
      alert('נא לציין את שם הכלב עבורו משריינים');
      return;
    }
    setIsSubmittingBooking(true);

    try {
      const daysToDeduct = totalDaysToDeduct;
      const targetEndDate = isBoarding ? bookingEndDate : bookingDate;
      const reqId = `req-pass-${Date.now()}`;

      // 1. Save standard intake request to DB and sync channels
      const cleanOwner = (pass.ownerName || '')
        .replace(/\[חדש\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/הכלב\s+\S+/g, '')
        .replace(/\s+/g, ' ')
        .trim() || pass.ownerName;

      // Handle primary vs additional dogs if multiple dogs are booked together
      const primaryDog = isBothDogs && availableDogs.length >= 2 ? availableDogs[0] : targetDogName;
      const additionalDogsList = isBothDogs && availableDogs.length >= 2
        ? availableDogs.slice(1).map(d => ({
            dogName: d,
            dogBreed: '',
            serviceType: pass.serviceType,
            startDate: bookingDate,
            endDate: targetEndDate,
            sameDatesAsPrimary: true
          }))
        : undefined;

      const intakeReq: IntakeRequest = {
        id: reqId,
        dogName: primaryDog,
        dogBreed: pass.dogBreed || '',
        additionalDogs: additionalDogsList,
        ownerName: cleanOwner,
        ownerPhone: pass.ownerPhone,
        ownerAddress: '',
        ownerEmail: pass.ownerEmail || undefined,
        serviceType: pass.serviceType,
        startDate: bookingDate,
        endDate: targetEndDate,
        status: 'pending',
        calculatedPrice: 0,
        daycarePassCode: pass.passCode,
        isFriendlyWithDogs: 'yes',
        isNeutered: true,
        isVaccinated: true,
        isHouseTrained: true,
        isTreatedParasites: true,
        notes: `[🎟️ תיאום הגעה מכרטיסייה #${pass.passCode} (שולם מראש / בנק ימים)] שעות: ${arrivalTime} עד ${pickupTime} | עבור: ${targetDogName}${isBothDogs ? ` (${dogCount} כלבים, ${daysToDeduct} ${isBoarding ? 'יממות' : 'ימים'} לקיזוז)` : ` (כלב יחיד, ${daysToDeduct} ${isBoarding ? 'יממות' : 'ימים'} לקיזוז)`}${bookingNotes ? ` | הערות: ${bookingNotes}` : ''}`,
        internalNotes: '',
        createdAt: new Date().toISOString(),
        termsAccepted: true
      };

      await saveIntakeRequestToDb(intakeReq);

      // 2. Direct autonomous WhatsApp notification to Shmulik (050-6336896) via Green-API from official resort number (054-8765888)
      const directCalendarLink = `https://rezort-webapp.vercel.app/?view=calendar&date=${bookingDate}&reqId=${reqId}`;
      const shmulikAlertMsg = `🎟️ *בקשה חדשה לשיריון מתוך כרטיסייה!*
--------------------------------
👤 *בעלים:* ${pass.ownerName}
📞 *טלפון:* ${pass.ownerPhone}
🐶 *כלב/ים לשריון:* ${targetDogName}${isBothDogs ? ` (${dogCount} כלבים)` : ''}
🏷️ *סוג:* ${isBoarding ? 'בנק 21 יממות פנסיון VIP' : `כרטיסיית ${pass.totalDays} יומיות`} (#${pass.passCode})
📅 *תאריכים:* ${formatDateIL(bookingDate)}${isBoarding ? ` עד ${formatDateIL(targetEndDate)}` : ''} (${singleStayUnits} ${isBoarding ? 'יממות' : 'ימים'})
⏰ *שעות:* הגעה ב-${arrivalTime} | איסוף ב-${pickupTime}
📊 *קיזוז מהכרטיסייה:* ${daysToDeduct} ${isBoarding ? 'יממות' : 'ימים'} ${isBothDogs ? `(${singleStayUnits} יממות × ${dogCount} כלבים)` : ''}
📊 *יתרה בכרטיסייה:* נותרו ${remainingDays} ${isBoarding ? 'יממות' : 'ימים'} לניצול (לאחר שריון זה: ${Math.max(0, remainingDays - daysToDeduct)})
${bookingNotes ? `💬 *הערות לקוח:* ${bookingNotes}\n` : ''}ℹ️ *מדיניות ביטולים:* ביטול או עדכון שריון יום מתאפשר עד 24 שעות מראש (נשמר מקום ייעודי).
--------------------------------
🗓️ *לבדיקה ביומן על התאריכים המבוקשים, אישור או דחייה בלחיצה:*
${directCalendarLink}

צוות הריזורט לכלב 🐾`;

      try {
        const shmulikPhone = settings?.shmulikWhatsAppPhone || '050-6336896';
        await sendGreenApiDirectMessage(
          shmulikPhone,
          shmulikAlertMsg,
          settings?.greenApiIdInstance,
          settings?.greenApiToken,
          { skipHolidayCheck: true }
        );
      } catch (notifyErr) {
        console.warn('Could not send Green-API notification to Shmulik:', notifyErr);
      }

      // 3. Fire celebratory confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      setBookingSuccess(true);

      // 4. Prepare direct WhatsApp text for Shmulik (client backup action)
      const cancellationClauseNotice = `ℹ️ *מדיניות ביטולים וזיכויים:* ביטול מתאפשר עד 24 שעות מראש. בביטול בפחות מ-24 שעות יחויב יום אחד והיתרה תישמר כזיכוי לפעמים הבאות.`;
      const shmulikMsg = isBoarding 
        ? `היי שמוליק! 🐾🐶
מבקש לשריין פנסיון מלא עבור *${targetDogName}* מתוך *בנק 21 יממות VIP (כרטיסייה #${pass.passCode})*:
📅 *תאריך כניסה:* ${formatDateIL(bookingDate)} (יום ${getDayNameHebrew(bookingDate)}) - ${arrivalTime}
🌙 *תאריך יציאה:* ${formatDateIL(bookingEndDate)} (יום ${getDayNameHebrew(bookingEndDate)}) - ${pickupTime}
⏱️ *משך שהייה:* ${singleStayUnits} יממות ${isBothDogs ? `עבור ${dogCount} כלבים (${daysToDeduct} יממות סה"כ לקיזוז מהבנק)` : `(${daysToDeduct} יממות לקיזוז מהבנק)`}
📊 *יתרה בבנק:* נותרו ${remainingDays} יממות (לאחר השריון: ${Math.max(0, remainingDays - daysToDeduct)} יממות)
${bookingNotes ? `💬 *הערות:* ${bookingNotes}\n` : ''}${cancellationClauseNotice}
תודה רבה!
${pass.ownerName} (${pass.ownerPhone})`
        : `היי שמוליק! 🐾🐶
מבקש לשריין יום כיף עבור *${targetDogName}* מתוך *כרטיסיית ${pass.totalDays} יומיות (כרטיסייה #${pass.passCode})*:
📅 *תאריך הגעה:* ${formatDateIL(bookingDate)} (יום ${getDayNameHebrew(bookingDate)})
⏰ *שעות:* הגעה ב-${arrivalTime}, איסוף ב-${pickupTime}
🎟️ *קיזוז:* ${daysToDeduct} ימים מתוך היתרה ${isBothDogs ? `(עבור ${dogCount} כלבים)` : ''} (לאחר השריון: ${Math.max(0, remainingDays - daysToDeduct)} ימים)
${bookingNotes ? `💬 *הערות:* ${bookingNotes}\n` : ''}${cancellationClauseNotice}
תודה רבה!
${pass.ownerName} (${pass.ownerPhone})`;

      // Open WhatsApp directly to Shmulik (050-6336896)
      const shmulikPhone = settings?.shmulikWhatsAppPhone || '050-6336896';
      setTimeout(() => {
        openWhatsAppMessage(shmulikPhone, shmulikMsg);
      }, 700);

    } catch (e: any) {
      alert(`שגיאה ברישום השריון: ${e?.message || 'נסה שוב'}`);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white font-sans" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-3xl animate-bounce mb-4">
          🐾
        </div>
        <h2 className="text-xl font-bold">טוען את הכרטיסייה שלך...</h2>
        <p className="text-sm text-slate-400 mt-1">מאמת נתונים מול הריזורט לכלב</p>
      </div>
    );
  }

  if (!pass) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white font-sans text-center" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-400/30 flex items-center justify-center text-3xl mb-4">
          ⚠️
        </div>
        <h2 className="text-2xl font-black text-red-300">כרטיסייה לא נמצאה</h2>
        <p className="text-sm text-slate-300 mt-2 max-w-md">
          לא הצלחנו לאתר כרטיסייה עם המספר <strong>{passCode}</strong>. אנא בדקו את הקישור שקיבלתם משמוליק.
        </p>
        <a
          href="https://wa.me/972506336896?text=%D7%A9%D7%9C%D7%95%D7%9D%20%D7%A9%D7%9E%D7%95%D7%9C%D7%99%D7%A2%2C%20%D7%A4%D7%95%D7%A0%D7%94%20%D7%9C%D7%92%D7%91%D7%99%20%D7%94%D7%9B%D7%A8%D7%98%D7%99%D7%A1%D7%99%D7%94%20%D7%A9%D7%9C%D7%99"
          className="mt-6 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center gap-2"
        >
          <MessageCircle className="w-5 h-5" />
          <span>פנייה לעזרה לשמוליק מנהל הריזורט (050-6336896)</span>
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white font-sans py-6 px-3 sm:px-6" dir="rtl">
      <div className="max-w-xl mx-auto space-y-5">
        
        {/* Top Resort Branding Bar */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🐾</span>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                <span>הריזורט לכלב</span>
                <span className="text-amber-400 text-xs px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30">
                  VIP Club
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">כרטיסיית מועדון דיגיטלית אישית</p>
            </div>
          </div>

          <a
            href="https://wa.me/972506336896?text=%D7%A9%D7%9C%D7%95%D7%9D%20%D7%A9%D7%9E%D7%95%D7%9C%D7%99%D7%A2%2C%20%D7%A4%D7%95%D7%A0%D7%94%20%D7%9C%D7%92%D7%91%D7%99%20%D7%94%D7%9B%D7%A8%D7%98%D7%99%D7%A1%D7%99%D7%94%20%D7%A9%D7%9C%D7%99"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
            title="עזרה משמוליק מנהל הריזורט"
          >
            <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">שמוליק מנהל הריזורט:</span>
            <span className="font-mono font-bold">050-6336896</span>
          </a>
        </div>

        {/* ========================================================================= */}
        {/* THE MAIN DIGITAL PUNCH CARD (Apple Wallet / VIP Club Style) */}
        {/* ========================================================================= */}
        <div className={`rounded-3xl p-6 sm:p-7 shadow-2xl border-2 space-y-6 relative overflow-hidden text-white transition-all ${
          isBoarding 
            ? 'bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 border-indigo-400/70 shadow-indigo-950/40' 
            : 'bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 border-emerald-400/70 shadow-emerald-950/40'
        }`}>
          {/* Background Watermark */}
          <div className="absolute -left-10 -bottom-10 text-white/5 pointer-events-none text-[13rem] font-black select-none leading-none">
            {isBoarding ? '🌙' : '🐾'}
          </div>

          {/* Top Card Info Row */}
          <div className="flex items-start justify-between flex-wrap gap-4 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner backdrop-blur-md border ${
                isBoarding ? 'bg-amber-400/20 border-amber-400/40 text-amber-300' : 'bg-white/15 border-white/20 text-white'
              }`}>
                {isBoarding ? '🌙' : '🎟️'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    isBoarding ? 'bg-amber-400 text-slate-950' : 'bg-emerald-400 text-slate-950'
                  }`}>
                    {isBoarding ? 'בנק 21 יממות פנסיון VIP' : `כרטיסיית ${pass.totalDays} יומיות`}
                  </span>
                  <span className="text-xs font-mono font-bold bg-white/15 px-2 py-0.5 rounded-lg border border-white/20">
                    #{pass.passCode}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black mt-1 tracking-tight text-white">
                  {pass.dogName} 🐾
                </h2>
                <p className="text-xs text-slate-200 mt-0.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{pass.ownerName}</span>
                  <span className="opacity-60">|</span>
                  <span className="font-mono opacity-80">{formatIsraeliPhoneDisplay(pass.ownerPhone)}</span>
                </p>
              </div>
            </div>

            {/* Remaining Days Counter */}
            <div className="text-left bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-2xl">
              <span className={`text-base sm:text-lg font-black block leading-none ${isBoarding ? 'text-amber-300' : 'text-emerald-300'}`}>
                נותרו {remainingDays} מתוך {pass.totalDays} {isBoarding ? 'יממות' : 'ימים'}
              </span>
              <span className="text-[11px] text-slate-300 block mt-1">
                תוקף עד: {formatDateIL(pass.validUntil)}
              </span>
            </div>
          </div>

          {/* Visual Punch Circles Grid */}
          <div className="relative z-10 pt-1">
            <div className="text-xs font-bold text-slate-200 mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>🏷️ כרטיסיית ניקוב שהיות:</span>
              </span>
              <span className="text-[11px] text-slate-300 bg-white/10 px-2 py-0.5 rounded-md">
                {pass.usedDays} נוצלו · {remainingDays} פנויים לניצול
              </span>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {Array.from({ length: pass.totalDays }).map((_, idx) => {
                const isUsed = idx < pass.usedDays;
                return (
                  <div
                    key={idx}
                    className={`p-2 rounded-2xl border text-center transition-all flex flex-col items-center justify-center min-h-[58px] ${
                      isUsed
                        ? 'bg-emerald-500 text-white border-emerald-300 shadow-md ring-2 ring-emerald-400/40'
                        : 'bg-white/10 border-white/20 text-slate-200 hover:bg-white/15'
                    }`}
                    title={isUsed ? `שהייה ${idx + 1} נוצלה בהצלחה` : `שהייה ${idx + 1} פנויה לשריון`}
                  >
                    <span className="text-base leading-none">
                      {isUsed ? '🐾' : '⚪'}
                    </span>
                    <span className="text-xs font-black mt-1 leading-none">
                      {idx + 1}
                    </span>
                    <span className="text-[9px] opacity-80 mt-0.5 leading-none font-medium">
                      {isUsed ? 'נוצל' : 'פנוי'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Section (Unpaid Alert vs Paid Confirmation) */}
          <div className="relative z-10 pt-2 border-t border-white/15">
            {isUnpaid ? (
              <div className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 p-4 sm:p-5 rounded-2xl shadow-xl border-2 border-amber-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-950/10 flex items-center justify-center text-xl shrink-0 font-bold">
                      💳
                    </div>
                    <div>
                      <h4 className="font-black text-sm sm:text-base text-slate-950 leading-tight">
                        סכום הכרטיסייה שסוכם: ₪{pass.pricePaid}
                      </h4>
                      <p className="text-xs font-semibold text-slate-800 mt-0.5">
                        לתשלום מאובטח בלחיצה אחת דרך Bit, Apple Pay, Google Pay או כרטיס אשראי
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black bg-slate-950 text-amber-300 px-2.5 py-1 rounded-lg">
                    טרם שולם
                  </span>
                </div>

                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-slate-950 hover:bg-slate-900 active:scale-98 text-amber-300 hover:text-amber-200 font-black text-sm sm:text-base rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>לתשלום מאובטח עכשיו (₪{pass.pricePaid}) 💳</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <div className="bg-emerald-500/20 border border-emerald-400/50 p-3.5 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="flex items-center gap-2 font-bold text-emerald-200 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                  <span>כרטיסייה שולמה במלואה ופעילה ✅ (יתרה מובטחת)</span>
                </span>
                <span className="font-mono text-emerald-300 font-bold bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-400/30">
                  ₪0 לתשלום לשריון הבא
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FAST 1-CLICK STAY RESERVATION (ZERO FORMS, ZERO RE-REGISTRATION) */}
        {/* ========================================================================= */}
        <div className="bg-slate-900/90 border-2 border-slate-700/80 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <span>רוצים לתאם את ההגעה הבאה בריזורט?</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                הכלב כבר מאושר במערכת! פשוט בוחרים מועד ולוחצים לשריון מהיר
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded-xl">
              קיזוז אוטומטי מהכרטיסייה
            </span>
          </div>

          {bookingSuccess ? (
            <div className="p-5 bg-emerald-500/20 border-2 border-emerald-400/80 rounded-2xl text-center space-y-3 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center text-2xl mx-auto shadow-md">
                ✓
              </div>
              <h4 className="text-base sm:text-lg font-black text-emerald-200">
                בקשת השריון נשלחה בהצלחה לשמוליק! 🐾
              </h4>
              <p className="text-xs text-slate-200 max-w-md mx-auto">
                ההודעה הועברה ישירות לוואטסאפ של שמוליק לאישור ביומן הריזורט. נותרו בכרטיסייה שלכם <strong>{remainingDays}</strong> ימים לניצול.
              </p>
              <button
                type="button"
                onClick={() => setBookingSuccess(false)}
                className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition-all cursor-pointer"
              >
                תיאום מועד נוסף
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Dog Selection Section - Specific Dog for this Booking */}
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                    <Dog className="w-4 h-4 text-emerald-400" />
                    <span>עבור איזה כלב משריינים שהייה זו? *</span>
                  </label>
                  {isBothDogs ? (
                    <span className="text-[11px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 px-2.5 py-0.5 rounded-full">
                      🐾 שריון זוגי ({dogCount} כלבים)
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      🐶 שריון לכלב בודד
                    </span>
                  )}
                </div>

                {/* Quick Selection Buttons if Multiple Dogs on Pass */}
                {availableDogs.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {availableDogs.map(dName => {
                      const isSel = selectedDogName.trim().toLowerCase() === dName.trim().toLowerCase();
                      return (
                        <button
                          key={dName}
                          type="button"
                          onClick={() => setSelectedDogName(dName)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSel
                              ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                              : 'bg-slate-700/80 hover:bg-slate-700 text-slate-200 border border-slate-600'
                          }`}
                        >
                          <span>🐶</span>
                          <span>{dName}</span>
                        </button>
                      );
                    })}

                    {/* Both dogs button */}
                    {availableDogs.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDogName(availableDogs.join(' ו'))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isBothDogs
                            ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400'
                            : 'bg-slate-700/80 hover:bg-slate-700 text-slate-200 border border-slate-600'
                        }`}
                      >
                        <span>🐾</span>
                        <span>שניהם ({availableDogs.join(' ו')})</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Input for custom / specific dog name */}
                <div>
                  <input
                    type="text"
                    value={selectedDogName}
                    onChange={(e) => setSelectedDogName(e.target.value)}
                    placeholder="שם הכלב עבורו משריינים (למשל: ירדנה, קצח או שניהם)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Live deduction explanation */}
                <div className="text-[11px] text-slate-300 flex items-center justify-between pt-0.5 flex-wrap gap-1">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>
                      {isBothDogs
                        ? `שריון עבור 2 כלבים: יקוזזו ${totalDaysToDeduct} ${isBoarding ? 'יממות' : 'ימים'} מהבנק (${singleStayUnits} לכל כלב)`
                        : `שריון עבור ${selectedDogName || 'הכלב'}: יקוזזו ${totalDaysToDeduct} ${isBoarding ? 'יממות' : 'ימים'} מהבנק`}
                    </span>
                  </span>
                  <span className={totalDaysToDeduct > remainingDays ? 'text-red-400 font-bold' : 'text-emerald-300 font-bold'}>
                    {totalDaysToDeduct > remainingDays
                      ? `⚠️ חריגה: נותרו ${remainingDays} בלבד`
                      : `יתרה לאחר שריון: ${remainingDays - totalDaysToDeduct}`}
                  </span>
                </div>
              </div>
              {/* Date Selection Mode */}
              {isBoarding ? (
                /* Boarding Check-in and Checkout Dates */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      🏨 תאריך כניסה לפנסיון *
                    </label>
                    <input
                      type="date"
                      min={today}
                      value={bookingDate}
                      onChange={(e) => {
                        setBookingDate(e.target.value);
                        if (e.target.value >= bookingEndDate) {
                          setBookingEndDate(addDays(e.target.value, 1));
                        }
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:border-indigo-500 focus:outline-none font-mono"
                    />
                    <span className="text-[11px] text-indigo-300 block mt-1 font-bold">
                      יום {getDayNameHebrew(bookingDate)}, {formatDateIL(bookingDate)}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      🌙 תאריך יציאה / איסוף *
                    </label>
                    <input
                      type="date"
                      min={addDays(bookingDate, 1)}
                      value={bookingEndDate}
                      onChange={(e) => setBookingEndDate(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:border-indigo-500 focus:outline-none font-mono"
                    />
                    <span className="text-[11px] text-indigo-300 block mt-1 font-bold">
                      יום {getDayNameHebrew(bookingEndDate)}, {formatDateIL(bookingEndDate)} ({nightsCount} יממות)
                    </span>
                  </div>
                </div>
              ) : (
                /* Daycare Single Day Selection */
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300">
                      ☀️ בחרו את יום ההגעה לריזורט *
                    </label>
                    <span className="text-[11px] text-emerald-400 font-bold">
                      שעות פעילות: 09:30 - 18:30
                    </span>
                  </div>

                  {/* Quick Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {[
                      { label: 'מחר', date: addDays(today, 1) },
                      { label: 'מחרתיים', date: addDays(today, 2) },
                      { 
                        label: 'יום ראשון הקרוב', 
                        date: (() => {
                          const d = new Date(today + 'T00:00:00');
                          const day = d.getDay();
                          let daysToSun = (0 - day + 7) % 7;
                          if (daysToSun === 0) daysToSun = 7;
                          return addDays(today, daysToSun);
                        })()
                      }
                    ].map(chip => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setBookingDate(chip.date)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          bookingDate === chip.date
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {chip.label} ({formatDateIL(chip.date)})
                      </button>
                    ))}
                  </div>

                  <input
                    type="date"
                    min={today}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none font-mono"
                  />
                  <span className="text-[11px] text-emerald-400 block mt-1 font-bold">
                    יום {getDayNameHebrew(bookingDate)}, {formatDateIL(bookingDate)} (יום 1 יקוזז מהכרטיסייה)
                  </span>
                </div>
              )}

              {/* Time Slots */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    שעת הגעה משוערת
                  </label>
                  <select
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="08:30 - 10:00">08:30 - 10:00 (בוקר)</option>
                    <option value="09:30 - 11:00">09:30 - 11:00 (בוקר מאוחר)</option>
                    <option value="11:00 - 13:00">11:00 - 13:00 (צהריים)</option>
                    <option value="14:00 - 16:00">14:00 - 16:00 (אחר הצהריים)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    שעת איסוף משוערת
                  </label>
                  <select
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="16:00 - 17:30">16:00 - 17:30 (אחה״צ)</option>
                    <option value="17:00 - 18:30">17:00 - 18:30 (סוף יום)</option>
                    <option value="18:30 - 19:30">18:30 - 19:30 (ערב)</option>
                  </select>
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <input
                  type="text"
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="הערה קצרה לשמוליק (למשל: תספורת, האכלה וכו' - לא חובה)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none placeholder:text-slate-500"
                />
              </div>

              {/* Cancellation Policy Note */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 text-xs text-slate-300 flex items-start gap-2.5">
                <span className="text-sm shrink-0 mt-0.5">ℹ️</span>
                <div className="leading-relaxed">
                  <span className="font-semibold text-slate-200">מדיניות ביטולים וזיכויים: </span>
                  <span className="text-slate-400">
                    ביטול או עדכון שריון יום מתאפשר עד 24 שעות מראש. בביטול שהות ארוכה בפחות מ-24 שעות יחויב היום הראשון בלבד והיתרה תישמר כזיכוי מלא לפעמים הבאות.
                  </span>
                </div>
              </div>

              {/* Big 1-Click Action Button */}
              <button
                type="button"
                disabled={isSubmittingBooking}
                onClick={handleReserveStay}
                className={`w-full py-4 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                  isBoarding
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-indigo-900/40'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-900/40'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>
                  {isSubmittingBooking 
                    ? 'מעביר בקשה לשמוליק...' 
                    : isBoarding
                    ? isBothDogs
                      ? `שמוליק, שריין עבור ${selectedDogName || pass.dogName} (${totalDaysToDeduct} יממות מהבנק ל-${dogCount} כלבים) 🌙`
                      : `שמוליק, שריין עבור ${selectedDogName || pass.dogName} (${totalDaysToDeduct} יממות מהבנק) 🌙`
                    : isBothDogs
                    ? `שמוליק, שריין עבור ${selectedDogName || pass.dogName} (${totalDaysToDeduct} ימים מהכרטיסייה) 🐾`
                    : `שמוליק, שריין עבור ${selectedDogName || pass.dogName} (יום 1 מהכרטיסייה) 🐾`}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Support Info */}
        <div className="text-center text-xs text-slate-500 space-y-1 pt-2 pb-6">
          <p>הריזורט לכלב · המקום המוביל בישראל לפנסיון, מעון יום ואירוח כלבים</p>
          <p>שירות לקוחות וסיוע: חגי הילמן <span className="font-mono text-slate-400">054-3200007</span></p>
        </div>

      </div>
    </div>
  );
};
