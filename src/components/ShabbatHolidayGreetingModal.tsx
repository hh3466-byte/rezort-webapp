import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Copy, Check, Calendar, Sparkles, Dog, Phone, RotateCcw, AlertCircle, Send, Zap, CheckCircle2, Ban, ShieldAlert, Users } from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import { getBookingsForDate, formatDateIL, getDayNameHebrew } from '../utils/dateUtils';
import { cleanPhoneNumber } from '../utils/whatsappUtils';
import { getDateShabbatOrHoliday, formatShabbatHolidayGreeting, getOccasionWord, isCustomerMessagingRestrictedNow } from '../utils/jewishCalendar';
import { sendGreenApiDirectMessage } from '../services/notificationService';

export const PERMANENT_OPTOUT_STORAGE_KEY = 'shabbat_greetings_permanent_optout';

export const canonicalPhone = (phone?: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return '0' + digits.slice(3);
  return digits;
};

export interface PermanentOptOutEntry {
  phone: string;
  ownerName?: string;
  dogName?: string;
  optOutAt: string;
}

interface ShabbatHolidayGreetingModalProps {
  dateStr: string;
  bookings: Booking[];
  settings: ResortSettings;
  onClose: () => void;
}

export const ShabbatHolidayGreetingModal: React.FC<ShabbatHolidayGreetingModalProps> = ({
  dateStr,
  bookings,
  settings,
  onClose,
}) => {
  const activeBookings = (bookings || []).filter(b => b.stayStatus !== 'cancelled');
  const dayBookings = getBookingsForDate(activeBookings, dateStr);

  const holidayInfo = getDateShabbatOrHoliday(dateStr);
  const dayName = getDayNameHebrew(dateStr);
  const occasionWord = getOccasionWord(dateStr);
  const occasionThis = occasionWord === 'בחג' ? 'בחג הזה' : occasionWord === 'בסופ"ש ובחג' ? 'בסופ"ש ובחג הזה' : 'בסופ"ש הזה';

  // Template state
  const defaultTemplate = `שלום (שם הבעלים) למרות שאין שירות לקוחות להולכים על 2 ${occasionWord}.
אבל כל מי שיש לו 4 רגליים וזנב, מקבל פה שירות של מלכים.
${occasionThis} טרחו סביבי על מלא ונתנו לי הרגשה טובה.
אז רציתי רק להגיד לכם שממש טוב לי בריזורט לכלב ואיזה כיף היה לי ${occasionWord}.
(שם הכלב)`;
  const [template, setTemplate] = useState<string>(defaultTemplate);
  const [isEditingTemplate, setIsEditingTemplate] = useState<boolean>(false);

  // Sent tracking stored in localStorage by date
  const storageKey = `shabbat_greetings_${dateStr}`;
  const [sentMap, setSentMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Cancelled/Skipped tracking stored in localStorage by date
  const cancelStorageKey = `shabbat_greetings_cancelled_${dateStr}`;
  const [cancelledMap, setCancelledMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(cancelStorageKey);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Permanent Opt-Out tracking stored in localStorage across all dates
  const [permanentOptOutMap, setPermanentOptOutMap] = useState<Record<string, PermanentOptOutEntry>>(() => {
    try {
      const saved = localStorage.getItem(PERMANENT_OPTOUT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [activeCancelChoiceId, setActiveCancelChoiceId] = useState<string | null>(null);
  const [showPermanentList, setShowPermanentList] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(sentMap));
      window.dispatchEvent(new CustomEvent('shabbat-greetings-updated'));
    } catch (e) {
      // ignore storage errors
    }
  }, [sentMap, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(cancelStorageKey, JSON.stringify(cancelledMap));
      window.dispatchEvent(new CustomEvent('shabbat-greetings-updated'));
    } catch (e) {
      // ignore storage errors
    }
  }, [cancelledMap, cancelStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(PERMANENT_OPTOUT_STORAGE_KEY, JSON.stringify(permanentOptOutMap));
      window.dispatchEvent(new CustomEvent('shabbat-greetings-updated'));
    } catch (e) {
      // ignore storage errors
    }
  }, [permanentOptOutMap]);

  // Checkers
  const isDogPermanentlyOptedOut = (b: Booking) => {
    const p = canonicalPhone(b.ownerPhone);
    return !!permanentOptOutMap[p];
  };

  const isDogCancelledForDate = (b: Booking) => {
    return !!cancelledMap[b.id];
  };

  const isDogCancelledAny = (b: Booking) => {
    return isDogPermanentlyOptedOut(b) || isDogCancelledForDate(b);
  };

  // Handlers
  const handleCancelForToday = (bookingId: string) => {
    setCancelledMap(prev => ({ ...prev, [bookingId]: true }));
    setActiveCancelChoiceId(null);
  };

  const handleCancelPermanently = (b: Booking) => {
    const phone = canonicalPhone(b.ownerPhone);
    if (!phone) return;
    setPermanentOptOutMap(prev => ({
      ...prev,
      [phone]: {
        phone,
        ownerName: b.ownerName,
        dogName: b.dogName,
        optOutAt: new Date().toISOString()
      }
    }));
    setCancelledMap(prev => ({ ...prev, [b.id]: true }));
    setActiveCancelChoiceId(null);
  };

  const handleRestoreForToday = (bookingId: string) => {
    setCancelledMap(prev => {
      const next = { ...prev };
      delete next[bookingId];
      return next;
    });
  };

  const handleRemovePermanentOptOut = (b: Booking) => {
    const phone = canonicalPhone(b.ownerPhone);
    setPermanentOptOutMap(prev => {
      const next = { ...prev };
      delete next[phone];
      return next;
    });
    setCancelledMap(prev => {
      const next = { ...prev };
      delete next[b.id];
      return next;
    });
  };

  const customerRestriction = isCustomerMessagingRestrictedNow();

  const handleSendWhatsApp = (booking: Booking) => {
    if (customerRestriction.isRestricted) {
      alert(`${customerRestriction.reason}\n\nההודעה תשלח אוטומטית: ${customerRestriction.allowedSendTime}`);
      return;
    }
    const cleanPhone = cleanPhoneNumber(booking.ownerPhone);
    const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
    const msg = formatShabbatHolidayGreeting(booking.ownerName, booking.dogName, template, dateStr);
    const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;

    // Mark as sent
    setSentMap(prev => ({ ...prev, [booking.id]: true }));

    // Open WhatsApp in new tab
    window.open(url, '_blank');
  };

  const handleCopyMessage = (booking: Booking) => {
    const msg = formatShabbatHolidayGreeting(booking.ownerName, booking.dogName, template, dateStr);
    navigator.clipboard.writeText(msg);
    setCopiedId(booking.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const hasGreenApi = Boolean(settings.greenApiIdInstance && settings.greenApiToken);
  const [isBulkSending, setIsBulkSending] = useState<boolean>(false);
  const [bulkStatusText, setBulkStatusText] = useState<string | null>(null);
  const [singleSendingId, setSingleSendingId] = useState<string | null>(null);

  const handleSendGreenApiSingle = async (b: Booking) => {
    if (customerRestriction.isRestricted) {
      alert(`${customerRestriction.reason}\n\nההודעה תשלח אוטומטית: ${customerRestriction.allowedSendTime}`);
      return;
    }
    if (!settings.greenApiIdInstance || !settings.greenApiToken) {
      handleSendWhatsApp(b);
      return;
    }
    setSingleSendingId(b.id);
    const msg = formatShabbatHolidayGreeting(b.ownerName, b.dogName, template, dateStr);
    const res = await sendGreenApiDirectMessage(
      b.ownerPhone,
      msg,
      settings.greenApiIdInstance,
      settings.greenApiToken
    );
    setSingleSendingId(null);
    if (res.success) {
      setSentMap(prev => ({ ...prev, [b.id]: true }));
    } else {
      alert(`שגיאה בשליחת Green-API: ${res.error || 'בדוק את הגדרות המערכת'}\n\nפותח את WhatsApp Web במקום...`);
      handleSendWhatsApp(b);
    }
  };

  const handleBulkSendGreenApi = async () => {
    if (customerRestriction.isRestricted) {
      alert(`${customerRestriction.reason}\n\nההודעות ישלחו אוטומטית: ${customerRestriction.allowedSendTime}`);
      return;
    }
    if (!settings.greenApiIdInstance || !settings.greenApiToken) return;
    const unsentBookings = dayBookings.filter(b => !sentMap[b.id] && !isDogCancelledAny(b));
    if (unsentBookings.length === 0) {
      alert('כל הד״שים הפעילים להיום כבר נשלחו או בוטלו!');
      return;
    }

    if (!confirm(`לשלוח עכשיו ברקע ד״ש ל-${unsentBookings.length} כלבים דרך Green-API?`)) {
      return;
    }

    setIsBulkSending(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < unsentBookings.length; i++) {
      const booking = unsentBookings[i];
      setBulkStatusText(`שולח ד״ש עבור ${booking.dogName} (${i + 1}/${unsentBookings.length})...`);

      const msg = formatShabbatHolidayGreeting(booking.ownerName, booking.dogName, template, dateStr);
      const res = await sendGreenApiDirectMessage(
        booking.ownerPhone,
        msg,
        settings.greenApiIdInstance,
        settings.greenApiToken
      );

      if (res.success) {
        setSentMap(prev => ({ ...prev, [booking.id]: true }));
        successCount++;
      } else {
        failCount++;
      }

      if (i < unsentBookings.length - 1) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }

    setIsBulkSending(false);
    setBulkStatusText(null);
    alert(`סיום שליחה: ${successCount} הודעות נשלחו בהצלחה!${failCount > 0 ? ` (${failCount} נכשלו)` : ''}`);
  };

  const sentCount = dayBookings.filter(b => sentMap[b.id]).length;
  const totalCancelledCount = dayBookings.filter(b => isDogCancelledAny(b)).length;
  const permanentInDayCount = dayBookings.filter(b => isDogPermanentlyOptedOut(b)).length;
  const handledCount = sentCount + totalCancelledCount;
  const progressPercent = dayBookings.length > 0 ? Math.round((handledCount / dayBookings.length) * 100) : 0;

  // חסימה מוחלטת ביום כיפור: יום קדוש - לא שולחים שום הודעות ללקוחות!
  if (holidayInfo.isYomKippur) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in" dir="rtl">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-3xl shadow-inner">
            🕯️
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900">יום כיפור – יום קדוש</h3>
            <p className="text-sm font-medium text-slate-600 leading-relaxed">
              יום כיפור הוא יום קדוש – לא משנה מה, לא שולחים הודעות אוטומטיות או ד״ש ללקוחות ביום כיפור. המערכת חסומה לחלוטין לשליחה.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl cursor-pointer transition-all shadow-md active:scale-95"
          >
            הבנתי, סגור חלון
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-2xl shadow-sm shrink-0">
              {holidayInfo.icon || '🐾'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-slate-900">
                  ד״ש חם לבעלים מהריזורט
                </h3>
                {holidayInfo.isSpecial && (
                  <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black px-2.5 py-0.5 rounded-full shadow-2xs">
                    {holidayInfo.label}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-600 mt-0.5">
                יום {dayName}, {formatDateIL(dateStr)} · {dayBookings.length} כלבים נוכחים בריזורט
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer border border-slate-200 shadow-2xs transition-all shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Iron Rule Restriction Banner */}
        {customerRestriction.isRestricted && (
          <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/10 border-b-2 border-amber-500 text-amber-950 p-3.5 px-4 sm:px-5 flex items-start gap-3 shadow-2xs text-xs leading-relaxed" dir="rtl">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-base shrink-0 shadow-xs mt-0.5">
              🛡️
            </div>
            <div className="space-y-0.5">
              <div className="font-black text-amber-950 text-xs sm:text-sm">
                כלל ברזל: שקט מוחלט ללקוחות משישי 14:00 וכל השבת והחג
              </div>
              <p className="text-slate-700 font-medium">
                חל איסור מוחלט על שליחת הודעות ללקוחות במהלך השבת או החג.
                ההודעה האמורה תישלח לבעלים באופן אוטומטי בענן <strong>במוצאי שבת בשעה {customerRestriction.sendTimeStr}</strong> (40 דק׳ בדיוק לאחר צאת השבת) – גם כשהדפדפנים סגורים!
              </p>
            </div>
          </div>
        )}

        {/* Progress Bar & Template Customizer */}
        <div className="bg-slate-50 px-4 sm:px-5 py-3 border-b border-slate-200 space-y-2.5 text-xs">
          {/* Progress Bar & Bulk Action */}
          <div className="flex items-center justify-between font-bold flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-700 font-extrabold flex items-center gap-1.5 flex-wrap">
                <span>סטטוס טיפול:</span>
                <span className="text-emerald-700">{sentCount} נשלחו</span>
                {totalCancelledCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-rose-600 font-black">
                      {totalCancelledCount} בוטלו
                      {permanentInDayCount > 0 && (
                        <span className="text-purple-700 font-bold mr-1">({permanentInDayCount} לצמיתות)</span>
                      )}
                    </span>
                  </>
                )}
                <span className="text-slate-500">מתוך {dayBookings.length} כלבים</span>
              </span>
              <span className="text-slate-500 font-mono">({progressPercent}%)</span>
            </div>

            {hasGreenApi && (
              <button
                type="button"
                disabled={isBulkSending || customerRestriction.isRestricted || (dayBookings.length > 0 && sentCount === dayBookings.length)}
                onClick={handleBulkSendGreenApi}
                className={`font-black px-3.5 py-1.5 rounded-xl shadow-xs text-xs flex items-center gap-1.5 transition-all ${
                  customerRestriction.isRestricted
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95'
                }`}
                title={customerRestriction.isRestricted ? customerRestriction.reason : 'שליחה אוטומטית ברקע לכל הכלבים'}
              >
                <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300 shrink-0" />
                <span>
                  {customerRestriction.isRestricted
                    ? `שליחה נעולה (תשלח במוצ״ש ב-${customerRestriction.sendTimeStr})`
                    : isBulkSending
                    ? (bulkStatusText || 'שולח ברקע...')
                    : 'שלח לכל הכלבים ברקע (Green-API)'}
                </span>
              </button>
            )}
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Template Preview & Edit Toggle */}
          <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                <span>📝 נוסח ההודעה (נשלח מהכלב/ה):</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTemplate(defaultTemplate)}
                  className="text-[10px] text-slate-500 hover:text-slate-800 font-bold flex items-center gap-0.5 cursor-pointer"
                  title="שחזר לנוסח המקורי"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>שחזר ברירת מחדל</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-black cursor-pointer underline"
                >
                  {isEditingTemplate ? 'שמור וסגור עריכה' : 'ערוך נוסח'}
                </button>
              </div>
            </div>

            {isEditingTemplate ? (
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={3}
                className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none font-sans leading-relaxed"
                placeholder="הקלד נוסח..."
              />
            ) : (
              <p className="text-xs text-slate-700 whitespace-pre-wrap font-medium bg-slate-50/70 p-2 rounded-lg border border-slate-100 italic">
                {template}
              </p>
            )}
            <div className="text-[10px] text-slate-400">
              * המערכת מחליפה אוטומטית את <strong>(שם הבעלים)</strong>, <strong>(שם הכלב)</strong> ומתאימה בין סופ"ש לחג לפי התאריך.
            </div>
          </div>
        </div>

        {/* Dogs List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {dayBookings.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="text-4xl">🐕</div>
              <h4 className="text-base font-black text-slate-700">אין כלבים נוכחים בתאריך זה</h4>
              <p className="text-xs text-slate-400">בתאריך {formatDateIL(dateStr)} לא רשומות הזמנות שהות פעילות.</p>
            </div>
          ) : (
            dayBookings.map((b) => {
              const isSent = !!sentMap[b.id];
              const isPermBlocked = isDogPermanentlyOptedOut(b);
              const isDateBlocked = isDogCancelledForDate(b);
              const isCancelled = isPermBlocked || isDateBlocked;
              const isMenuOpen = activeCancelChoiceId === b.id;
              const cleanPhone = cleanPhoneNumber(b.ownerPhone);
              const previewText = formatShabbatHolidayGreeting(b.ownerName, b.dogName, template, dateStr);

              return (
                <div
                  key={b.id}
                  className={`rounded-2xl border p-3.5 sm:p-4 transition-all space-y-2.5 shadow-2xs ${
                    isPermBlocked
                      ? 'bg-purple-50/30 border-purple-300 opacity-85'
                      : isDateBlocked
                      ? 'bg-rose-50/25 border-rose-200 opacity-80'
                      : isSent 
                      ? 'bg-emerald-50/40 border-emerald-300' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Top: Dog and Owner Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-center font-black text-lg shadow-2xs shrink-0">
                        🐕
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-base font-black ${isCancelled ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                            {b.dogName}
                          </h4>
                          {b.dogBreed && (
                            <span className="text-xs text-slate-500 font-bold">({b.dogBreed})</span>
                          )}
                          {isPermBlocked ? (
                            <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                              <ShieldAlert className="w-3 h-3 text-purple-700" />
                              <span>חסום לצמיתות ⛔</span>
                            </span>
                          ) : isDateBlocked ? (
                            <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                              <Ban className="w-3 h-3 text-rose-600" />
                              <span>בוטל לסופ״ש זה 📅</span>
                            </span>
                          ) : isSent ? (
                            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black px-2 py-0.2 rounded-md flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>נשלח בהצלחה</span>
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-600 font-medium flex items-center gap-2 mt-0.5">
                          <span>בעלים: <strong className="text-slate-800">{b.ownerName}</strong></span>
                          <span>·</span>
                          <span className="font-mono font-bold text-slate-800" dir="ltr">{b.ownerPhone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                      {/* Cancel / Skip choice actions */}
                      {isPermBlocked ? (
                        <button
                          type="button"
                          onClick={() => handleRemovePermanentOptOut(b)}
                          className="bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 font-black px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                          title="בטל חסימה קבועה והחזר את הלקוח לרשימת השליחה"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-purple-700" />
                          <span>בטל חסימה קבועה</span>
                        </button>
                      ) : isDateBlocked ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRestoreForToday(b.id)}
                            className="bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 font-black px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                            title="החזר את הלקוח לרשימת השליחה לסופ״ש זה"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-700" />
                            <span>החזר לשליחה</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelPermanently(b)}
                            className="bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold px-2 py-1.5 rounded-xl text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                            title="העבר לחסימה לצמיתות (לעולם לא לשלוח ללקוח זה)"
                          >
                            <ShieldAlert className="w-3 h-3 text-purple-700" />
                            <span>הפוך לקבוע</span>
                          </button>
                        </div>
                      ) : isMenuOpen ? (
                        <div className="flex items-center gap-1.5 p-1 bg-rose-50 border border-rose-300 rounded-xl shadow-xs animate-in fade-in">
                          <span className="text-[11px] font-black text-rose-900 px-1">בטל:</span>
                          <button
                            type="button"
                            onClick={() => handleCancelForToday(b.id)}
                            className="bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                            title="ביטול עבור סופ״ש/חג זה בלבד"
                          >
                            <span>📅 רק לסופ״ש זה</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelPermanently(b)}
                            className="bg-purple-700 hover:bg-purple-800 text-white font-black px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                            title="ביטול קבוע - הלקוח לא יקבל ד״ש שבת/חג לעולם"
                          >
                            <ShieldAlert className="w-3 h-3 shrink-0" />
                            <span>⛔ לצמיתות</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveCancelChoiceId(null)}
                            className="text-slate-400 hover:text-slate-700 px-1.5 py-0.5 text-xs font-bold cursor-pointer"
                            title="סגור תפריט"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveCancelChoiceId(b.id)}
                          className="bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                          title="בטל שליחת הודעה ללקוח זה (לבחירה: רק לסופ״ש זה או לצמיתות)"
                        >
                          <Ban className="w-3.5 h-3.5 text-rose-500" />
                          <span>בטל שליחה</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopyMessage(b)}
                        className="bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                        title="העתק נוסח הודעה"
                      >
                        {copiedId === b.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">הועתק!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>העתק</span>
                          </>
                        )}
                      </button>

                      {hasGreenApi && (
                        <button
                          type="button"
                          disabled={isCancelled || singleSendingId === b.id || isBulkSending || customerRestriction.isRestricted}
                          onClick={() => handleSendGreenApiSingle(b)}
                          className={`font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs ${
                            isCancelled
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                              : customerRestriction.isRestricted
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              : isSent
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300 cursor-pointer active:scale-95'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 cursor-pointer active:scale-95'
                          }`}
                          title={
                            isPermBlocked
                              ? 'הלקוח חסום לצמיתות משליחת שבת/חג. לחץ "בטל חסימה קבועה" כדי לאפשר שליחה'
                              : isDateBlocked
                              ? 'השליחה בוטלה לסופ״ש זה. לחץ "החזר לשליחה" כדי לאפשר שליחה'
                              : customerRestriction.isRestricted
                              ? customerRestriction.reason
                              : "שליחה מיידית ברקע ללא פתיחת לשונית בדפדפן"
                          }
                        >
                          <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300 shrink-0" />
                          <span>
                            {isCancelled
                              ? 'שליחה בוטלה'
                              : customerRestriction.isRestricted
                              ? 'שליחה נעולה'
                              : singleSendingId === b.id
                              ? 'שולח...'
                              : isSent
                              ? 'שלח שוב ברקע'
                              : 'שלח ברקע (API)'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isCancelled || customerRestriction.isRestricted}
                        onClick={() => handleSendWhatsApp(b)}
                        className={`font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs ${
                          isCancelled
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                            : customerRestriction.isRestricted
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            : isSent
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95'
                            : 'bg-[#25D366] hover:bg-[#1EBE5D] text-white shadow-emerald-500/20 cursor-pointer active:scale-95'
                        }`}
                        title={
                          isPermBlocked
                            ? 'הלקוח חסום לצמיתות משליחת שבת/חג. לחץ "בטל חסימה קבועה" כדי לאפשר שליחה'
                            : isDateBlocked
                            ? 'השליחה בוטלה לסופ״ש זה. לחץ "החזר לשליחה" כדי לאפשר שליחה'
                            : customerRestriction.isRestricted
                            ? customerRestriction.reason
                            : "פתח ב-WhatsApp Web"
                        }
                      >
                        <MessageCircle className="w-4 h-4 fill-white/20 shrink-0" />
                        <span>{isCancelled ? 'שליחה בוטלה' : customerRestriction.isRestricted ? 'נעול' : isSent ? 'שלח שוב בוואטסאפ' : 'פתח בוואטסאפ'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Message Preview Quote */}
                  <div className={`rounded-xl p-2.5 border text-xs leading-relaxed whitespace-pre-wrap ${
                    isCancelled 
                      ? 'bg-slate-100/60 border-slate-200 text-slate-500 line-through' 
                      : 'bg-slate-50 border-slate-100 text-slate-700'
                  }`}>
                    <span className="text-slate-400 font-bold block mb-0.5 text-[10px] no-underline">תצוגה מקדימה להודעה שתשלח:</span>
                    {previewText}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Permanent Opt-Out Section & Collapsible Manager */}
        {Object.keys(permanentOptOutMap).length > 0 && (
          <div className="bg-purple-50/80 border-t border-purple-200 px-4 sm:px-5 py-2.5 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-900 font-bold">
                <ShieldAlert className="w-4 h-4 text-purple-700 shrink-0" />
                <span>
                  {Object.keys(permanentOptOutMap).length} לקוחות מוגדרים כחסומים לצמיתות משליחת הודעות שבת/חג
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPermanentList(!showPermanentList)}
                className="text-purple-700 hover:text-purple-950 font-black underline cursor-pointer text-xs"
              >
                {showPermanentList ? 'הסתר רשימה' : 'הצג ונהל רשימת חסומים'}
              </button>
            </div>

            {showPermanentList && (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                {Object.values(permanentOptOutMap).map((entry) => (
                  <div key={entry.phone} className="flex items-center justify-between bg-white p-2 rounded-xl border border-purple-200 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{entry.ownerName || 'לקוח'}</span>
                      {entry.dogName && <span className="text-slate-500 font-medium">({entry.dogName})</span>}
                      <span className="font-mono text-slate-400 text-[11px]" dir="ltr">{entry.phone}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPermanentOptOutMap(prev => {
                          const next = { ...prev };
                          delete next[entry.phone];
                          return next;
                        });
                      }}
                      className="text-rose-600 hover:text-rose-800 font-bold text-xs underline cursor-pointer"
                    >
                      בטל חסימה לצמיתות
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            💡 לחיצה על "שלח ד״ש בוואטסאפ" פותחת את הצ'אט עם הלקוח כשההודעה כבר מוקלדת בפנים.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-2xs"
          >
            סגור חלון
          </button>
        </div>

      </div>
    </div>
  );
};
