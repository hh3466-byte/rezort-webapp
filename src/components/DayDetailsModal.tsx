import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Home, 
  Plus, 
  CheckCircle, 
  MessageSquare, 
  Phone, 
  DollarSign, 
  Dog, 
  User, 
  AlertCircle,
  Clock,
  ShieldAlert,
  Edit2,
  Trash2,
  Gift,
  CreditCard,
  MapPin
} from 'lucide-react';
import { getWazeNavigationUrl } from '../utils/geolocationUtils';
import { Booking, ResortSettings } from '../types';
import { formatFullHebrewDate, getDailyBreakdown, formatDateIL, getTodayStr } from '../utils/dateUtils';
import { getServiceTypeHebrew, generatePaymentReminderMessage, openWhatsAppMessage, cleanPhoneNumber } from '../utils/whatsappUtils';
import { getDateShabbatOrHoliday } from '../utils/jewishCalendar';
import { ShabbatHolidayGreetingModal } from './ShabbatHolidayGreetingModal';
import { getPlacementDisplayName, normalizePlacementKey } from '../utils/kennelUtils';

interface DayDetailsModalProps {
  dateStr: string | null;
  bookings: Booking[];
  settings: ResortSettings;
  onClose: () => void;
  onSelectBooking: (booking: Booking) => void;
  onNewBookingForDate: (dateStr: string) => void;
  onDeleteBooking?: (bookingId: string) => void;
  onMarkAsPaid: (bookingId: string) => void;
  onOpenPaymentModal: (booking: Booking) => void;
  onOpenSendPaymentLink?: (booking: Booking) => void;
  onToggleStayStatus: (bookingId: string, newStatus: Booking['stayStatus']) => void;
  onInitiateRelease?: (booking: Booking) => void;
  onToggleReviewRequest?: (booking: Booking) => void;
  onOpenVoucher?: (data: { customerName: string; dogName: string; phone: string; staysCount?: number }) => void;
}

export const DayDetailsModal: React.FC<DayDetailsModalProps> = ({
  dateStr,
  bookings,
  settings,
  onClose,
  onSelectBooking,
  onNewBookingForDate,
  onDeleteBooking,
  onMarkAsPaid,
  onOpenPaymentModal,
  onOpenSendPaymentLink,
  onToggleStayStatus,
  onInitiateRelease,
  onToggleReviewRequest,
  onOpenVoucher,
}) => {
  if (!dateStr) return null;

  const breakdown = getDailyBreakdown(bookings, dateStr);
  const isOverbooked = breakdown.total > settings.maxCapacity;
  const holidayInfo = getDateShabbatOrHoliday(dateStr);
  const [isGreetingModalOpen, setIsGreetingModalOpen] = useState(false);

  const getStaysCount = (phone: string) => {
    const clean = cleanPhoneNumber(phone);
    if (!clean) return 0;
    return bookings.filter(bk => cleanPhoneNumber(bk.ownerPhone) === clean).length;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-3xl lg:max-w-4xl w-full max-h-[90vh] flex flex-col text-slate-900 overflow-hidden my-auto">
        
        {/* Header with Full Hebrew Date & Capacity (Fixed / Pinned) */}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 pb-3.5 border-b border-slate-100 shrink-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-600" />
              <h3 className="font-extrabold text-lg sm:text-xl text-slate-900">
                {formatFullHebrewDate(dateStr)}
              </h3>
            </div>
            
            {/* Capacity Meter */}
            <div className="flex items-center gap-2 mt-2">
              <div className={`text-xs px-2.5 py-1 rounded-full font-bold border flex items-center gap-1.5 ${
                isOverbooked 
                  ? 'bg-red-100 text-red-700 border-red-300'
                  : breakdown.total >= settings.maxCapacity
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-green-100 text-green-800 border-green-300'
              }`}>
                {isOverbooked ? <ShieldAlert className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
                <span>תפוסה יומית: {breakdown.total} / {settings.maxCapacity} כלבים</span>
              </div>

              {isOverbooked && (
                <span className="text-xs text-red-600 font-semibold">
                  ⚠️ חריגה של {breakdown.total - settings.maxCapacity} מעל הקיבולת!
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNewBookingForDate(dateStr);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>הזמנה ליום זה</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-4 sm:p-5 pt-3 overflow-y-auto overflow-x-hidden flex-1 space-y-4">

        {/* Shabbat / Holiday Greeting Button Banner */}
        {breakdown.staying.length > 0 && (
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center font-black text-xl shadow-2xs shrink-0">
                💬
              </div>
              <div>
                <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                  <span>עדכון ד״ש מהכלבים {holidayInfo.isSpecial ? `(${holidayInfo.label})` : ''}</span>
                  {holidayInfo.isSpecial && (
                    <span className="text-[10px] bg-emerald-200/80 text-emerald-950 px-2 py-0.2 rounded-full font-black">
                      {holidayInfo.icon} חג / שבת
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-emerald-800 font-medium">
                  שליחת הודעת וואטסאפ אישית וחמה לבעלי {breakdown.staying.length} הכלבים ששוהים כעת בריזורט
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsGreetingModalOpen(true)}
              className="bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 text-white font-black px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-xs cursor-pointer hover:shadow-md shrink-0"
            >
              <MessageSquare className="w-4 h-4 fill-white/20 shrink-0" />
              <span>שלח ד״ש לבעלים ({breakdown.staying.length} כלבים)</span>
            </button>
          </div>
        )}

        {/* 3 Sections: Arrivals, Stayers, Departures */}
        <div className="space-y-5">
          
          {/* 1. מגיעים היום (Arrivals) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-extrabold text-green-700 flex items-center gap-1.5">
                <ArrowDownLeft className="w-4 h-4" />
                <span>מגיעים היום ({breakdown.arrivals.length})</span>
              </h4>
            </div>

            {breakdown.arrivals.length === 0 ? (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                אין כניסות מתוכננות ליום זה
              </p>
            ) : (
              <div className="space-y-2.5">
                {breakdown.arrivals.map(b => (
                  <DogBookingCard
                    key={b.id}
                    booking={b}
                    settings={settings}
                    onSelect={() => onSelectBooking(b)}
                    onDelete={() => onDeleteBooking && onDeleteBooking(b.id)}
                    onMarkPaid={() => onMarkAsPaid(b.id)}
                    onOpenPayment={() => onOpenPaymentModal(b)}
                    onOpenSendPaymentLink={() => onOpenSendPaymentLink && onOpenSendPaymentLink(b)}
                    onInitiateRelease={() => onInitiateRelease && onInitiateRelease(b)}
                    onToggleReviewRequest={() => onToggleReviewRequest && onToggleReviewRequest(b)}
                    onOpenVoucher={() => onOpenVoucher && onOpenVoucher({ customerName: b.ownerName, dogName: b.dogName, phone: b.ownerPhone, staysCount: getStaysCount(b.ownerPhone) })}
                    actionType="arrival"
                  />
                ))}
              </div>
            )}
          </div>

          {/* 2. שוהים בריזורט (Stayers) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-extrabold text-indigo-700 flex items-center gap-1.5">
                <Home className="w-4 h-4" />
                <span>שוהים בריזורט ({breakdown.staying.length})</span>
              </h4>
            </div>

            {breakdown.staying.length === 0 ? (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                אין כלבים נוספים השוהים ביום זה
              </p>
            ) : (
              <div className="space-y-2.5">
                {breakdown.staying.map(b => (
                  <DogBookingCard
                    key={b.id}
                    booking={b}
                    settings={settings}
                    onSelect={() => onSelectBooking(b)}
                    onDelete={() => onDeleteBooking && onDeleteBooking(b.id)}
                    onMarkPaid={() => onMarkAsPaid(b.id)}
                    onOpenPayment={() => onOpenPaymentModal(b)}
                    onOpenSendPaymentLink={() => onOpenSendPaymentLink && onOpenSendPaymentLink(b)}
                    onInitiateRelease={() => onInitiateRelease && onInitiateRelease(b)}
                    onToggleReviewRequest={() => onToggleReviewRequest && onToggleReviewRequest(b)}
                    onOpenVoucher={() => onOpenVoucher && onOpenVoucher({ customerName: b.ownerName, dogName: b.dogName, phone: b.ownerPhone, staysCount: getStaysCount(b.ownerPhone) })}
                    actionType="staying"
                  />
                ))}
              </div>
            )}
          </div>

          {/* 3. יוצאים הביתה (Departures) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-extrabold text-amber-700 flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4" />
                <span>חוזרים הביתה היום ({breakdown.departures.length})</span>
              </h4>
            </div>

            {breakdown.departures.length === 0 ? (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                אין יציאות מתוכננות ליום זה
              </p>
            ) : (
              <div className="space-y-2.5">
                {breakdown.departures.map(b => (
                  <DogBookingCard
                    key={b.id}
                    booking={b}
                    settings={settings}
                    onSelect={() => onSelectBooking(b)}
                    onDelete={() => onDeleteBooking && onDeleteBooking(b.id)}
                    onMarkPaid={() => onMarkAsPaid(b.id)}
                    onOpenPayment={() => onOpenPaymentModal(b)}
                    onOpenSendPaymentLink={() => onOpenSendPaymentLink && onOpenSendPaymentLink(b)}
                    onInitiateRelease={() => onInitiateRelease && onInitiateRelease(b)}
                    onToggleReviewRequest={() => onToggleReviewRequest && onToggleReviewRequest(b)}
                    onOpenVoucher={() => onOpenVoucher && onOpenVoucher({ customerName: b.ownerName, dogName: b.dogName, phone: b.ownerPhone, staysCount: getStaysCount(b.ownerPhone) })}
                    actionType="departure"
                  />
                ))}
              </div>
            )}
          </div>

          </div>
        </div>

        {/* Shabbat / Holiday Greeting Modal */}
        {isGreetingModalOpen && (
          <ShabbatHolidayGreetingModal
            dateStr={dateStr}
            bookings={bookings}
            settings={settings}
            onClose={() => setIsGreetingModalOpen(false)}
          />
        )}

      </div>
    </div>
  );
};

interface DogBookingCardProps {
  booking: Booking;
  settings: ResortSettings;
  onSelect: () => void;
  onDelete?: () => void;
  onMarkPaid: () => void;
  onOpenPayment: () => void;
  onOpenSendPaymentLink?: () => void;
  onInitiateRelease?: () => void;
  onToggleReviewRequest?: () => void;
  onOpenVoucher?: () => void;
  actionType: 'arrival' | 'staying' | 'departure';
}

const DogBookingCard: React.FC<DogBookingCardProps> = React.memo(({
  booking,
  settings,
  onSelect,
  onDelete,
  onMarkPaid,
  onOpenPayment,
  onOpenSendPaymentLink,
  onInitiateRelease,
  onToggleReviewRequest,
  onOpenVoucher,
}) => {
  const todayStr = getTodayStr();
  const isEnded = booking.stayStatus === 'checked_out' || (booking.endDate < todayStr);
  const isEndingToday = booking.endDate === todayStr;
  const remainingDebt = Math.max(0, Math.round(booking.totalPrice - booking.depositAmount));
  const roundedTotal = Math.round(booking.totalPrice || 0);
  const roundedDeposit = Math.round(booking.depositAmount || 0);

  // Status color styles matching design
  let paymentBorder = isEnded 
    ? 'border-slate-200 bg-slate-50/70 text-slate-600 opacity-80' 
    : 'border-red-300 bg-red-50/40';

  let paymentTag = isEnded ? (
    <span className="text-[11px] bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-2xs whitespace-nowrap">
      <span>🏁 הסתיים ושוחרר</span>
    </span>
  ) : (
    <span className="text-[11px] bg-red-500 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-xs whitespace-nowrap">
      <span>לא שולם (חוב ₪{remainingDebt.toLocaleString('he-IL')})</span>
    </span>
  );

  if (!isEnded) {
    if (booking.paymentStatus === 'fully_paid' || (remainingDebt === 0 && roundedTotal > 0)) {
      paymentBorder = 'border-green-300 bg-green-50/40';
      paymentTag = (
        <span className="text-[11px] bg-green-600 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-xs whitespace-nowrap">
          <span>שולם מלא (₪{roundedTotal.toLocaleString('he-IL')})</span>
        </span>
      );
    } else if (booking.paymentStatus === 'deposit_paid' || roundedDeposit > 0) {
      paymentBorder = 'border-dashed border-green-400 bg-green-50/20';
      paymentTag = (
        <span className="text-[11px] border-2 border-dashed border-green-600 bg-green-50 text-green-900 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 whitespace-nowrap">
          <span>מקדמה ₪{roundedDeposit.toLocaleString('he-IL')} (יתרה ₪{remainingDebt.toLocaleString('he-IL')})</span>
        </span>
      );
    }
  }

  const handleSendWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = generatePaymentReminderMessage(booking, settings);
    openWhatsAppMessage(booking.ownerPhone, msg);
  };

  return (
    <div
      onClick={onSelect}
      className={`p-3.5 sm:p-4 rounded-2xl border transition-all hover:shadow-xs cursor-pointer ${paymentBorder}`}
    >
      {/* Top Row: Dog Details & Payment Tag */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 pb-2.5 border-b border-slate-200/60">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base shrink-0">🐾</span>
            <span className={`font-black text-base sm:text-lg ${isEnded ? 'text-slate-700' : 'text-slate-900'}`}>{booking.dogName}</span>
            <span className="text-xs sm:text-sm font-bold text-slate-500">({booking.ownerName})</span>
            {booking.dogBreed && (
              <span className="text-xs text-slate-500 font-normal">({booking.dogBreed})</span>
            )}
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium border border-slate-200">
              {getServiceTypeHebrew(booking.serviceType)}
            </span>
            {booking.kennelNumber && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-black border ${
                normalizePlacementKey(booking.kennelNumber) === 'home'
                  ? 'bg-amber-100 text-amber-950 border-amber-300'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                📍 {getPlacementDisplayName(booking.kennelNumber)}
              </span>
            )}
            {isEnded && (
              <span className="text-[10px] bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                הסתיים
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 mt-1">
            <span className="flex items-center gap-1 font-bold text-slate-800">
              <User className="w-3.5 h-3.5 text-indigo-500" />
              <span>בעלים: <strong className="text-slate-900">{booking.ownerName}</strong></span>
            </span>
            <span className="flex items-center gap-1 font-mono text-slate-700 font-semibold" dir="ltr">
              <Phone className="w-3.5 h-3.5 text-green-600" /> {booking.ownerPhone}
            </span>
            <span className="flex items-center gap-1 font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>{formatDateIL(booking.startDate)} עד {formatDateIL(booking.endDate)}</span>
            </span>
            {booking.ownerAddress && (
              <span className="flex items-center gap-1.5 font-bold text-slate-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{booking.ownerAddress}</span>
                <a
                  href={getWazeNavigationUrl(booking.ownerAddress, booking.ownerCoordinates)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mr-1 text-[11px] text-sky-700 hover:text-sky-900 font-black underline flex items-center gap-0.5"
                  title="נווט לבית הבעלים ב-Waze במקרה חירום"
                >
                  <span>🚗 Waze</span>
                </a>
              </span>
            )}
          </div>

          {/* Feeding & Medication Details Line */}
          {(booking.feedingSchedule || booking.foodPortion || booking.medicationSchedule || booking.specialDiet) && (
            <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
              {(booking.feedingSchedule || booking.foodPortion || booking.specialDiet) && (
                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-medium">
                  🥣 מזון: {booking.feedingSchedule ? `⏰ ${booking.feedingSchedule} ` : ''}{[booking.foodPortion, booking.specialDiet].filter(Boolean).join(' | ')}
                </span>
              )}
              {(booking.medicationSchedule || (booking.medications && !booking.medications.includes('אין') && !booking.medications.includes('בריא'))) && (
                <span className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-bold">
                  💊 תרופות: {booking.medicationSchedule || booking.medications}
                </span>
              )}
              {booking.complexitySurcharge && booking.complexitySurcharge > 0 && (
                <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                  💰 תוספת מורכבות: ₪{booking.complexitySurcharge}
                </span>
              )}
            </div>
          )}

          {booking.placementNotes && (
            <div className="bg-amber-100/90 border border-amber-300 text-amber-950 font-black text-xs px-2.5 py-1 rounded-xl inline-flex items-center gap-1.5 shadow-2xs mt-1">
              <span>🚩 דגש שיבוץ:</span>
              <span className="text-slate-900 font-bold">{booking.placementNotes}</span>
            </div>
          )}

          {booking.notes && (
            <p className="text-[11px] text-amber-800/90 italic mt-0.5 line-clamp-2">
              הערות: {booking.notes}
            </p>
          )}
        </div>

        {/* Payment Tag (Top Corner) */}
        <div className="shrink-0 self-start">
          {paymentTag}
        </div>
      </div>

      {/* Bottom Row: Actions Bar (Full width, wraps cleanly, nothing clipped) */}
      <div className="pt-2.5 flex flex-wrap items-center justify-end gap-1.5">
        {/* Primary Edit Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          title="ערוך פרטי הזמנה, תאריכים, מחיר או דרישות מיוחדות"
          className="bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-indigo-200 shadow-2xs"
        >
          <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
          <span>ערוך</span>
        </button>

        {/* Release Dog Button */}
        {!isEnded && onInitiateRelease && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInitiateRelease();
            }}
            title="שחרר כלב הביתה (בודק חוב פתוח ומאפשר לסמן כשולם ולסגור שחרור)"
            className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
          >
            <Home className="w-3.5 h-3.5" />
            <span>שחרר הביתה</span>
          </button>
        )}

        {/* Review & VIP Voucher Auto-Send toggle for departing/checked out dogs */}
        {(booking.stayStatus === 'checked_out' || isEnded || isEndingToday) && onToggleReviewRequest && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleReviewRequest();
            }}
            title={booking.skipReviewRequest 
              ? "שליחת שובר VIP וסקר מבוטלת ללקוח זה. לחץ להפעלה מחדש" 
              : "שובר VIP וסקר יישלחו אוטומטית מחר. לחץ לביטול (אם לא הלך טוב עם הלקוח)"}
            className={`text-xs px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer border shadow-2xs active:scale-95 shrink-0 ${
              booking.skipReviewRequest
                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
            }`}
          >
            <span>{booking.skipReviewRequest ? '🚫 שובר בוטל' : '⭐ שובר מתוזמן למחר'}</span>
          </button>
        )}

        {/* Send Voucher Button */}
        {onOpenVoucher && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenVoucher();
            }}
            title="הפק ושלח שובר הטבה לפעם הבאה או חבר מביא חבר"
            className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
          >
            <Gift className="w-3.5 h-3.5 text-amber-600" />
            <span>שובר</span>
          </button>
        )}

        {/* Quick Pay Action */}
        {remainingDebt > 0 && !isEnded && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkPaid();
              }}
              title="סמן כעת כשולם הכל במלואו"
              className="bg-green-600 hover:bg-green-700 active:scale-95 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>סמן כשולם</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              title="שלח תזכורת תשלום בוואטסאפ ללקוח"
              className="bg-green-500 hover:bg-green-600 active:scale-95 text-white text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>וואטסאפ</span>
            </button>

            {onOpenSendPaymentLink && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSendPaymentLink();
                }}
                title="שלח קישור Grow / Bit לתשלום בוואטסאפ ללא ביטול הזמנה"
                className="bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-950 border border-emerald-300 text-xs px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                <span>קישור לתשלום 💳</span>
              </button>
            )}
          </>
        )}

        {/* Direct Delete Button */}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="מחק הזמנה זו מהיומן ומהענן"
            className="bg-slate-100 hover:bg-rose-50 active:scale-95 text-slate-500 hover:text-rose-600 text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer border border-slate-200 hover:border-rose-200"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>מחק</span>
          </button>
        )}
      </div>
    </div>
  );
});
