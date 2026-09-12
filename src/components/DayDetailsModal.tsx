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
  Trash2
} from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import { formatFullHebrewDate, getDailyBreakdown, formatDateIL, getTodayStr } from '../utils/dateUtils';
import { getServiceTypeHebrew, generatePaymentReminderMessage, openWhatsAppMessage } from '../utils/whatsappUtils';
import { getDateShabbatOrHoliday } from '../utils/jewishCalendar';
import { ShabbatHolidayGreetingModal } from './ShabbatHolidayGreetingModal';

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
  onToggleStayStatus: (bookingId: string, newStatus: Booking['stayStatus']) => void;
  onInitiateRelease?: (booking: Booking) => void;
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
  onToggleStayStatus,
  onInitiateRelease,
}) => {
  if (!dateStr) return null;

  const breakdown = getDailyBreakdown(bookings, dateStr);
  const isOverbooked = breakdown.total > settings.maxCapacity;
  const holidayInfo = getDateShabbatOrHoliday(dateStr);
  const [isGreetingModalOpen, setIsGreetingModalOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-3xl lg:max-w-4xl w-full p-5 sm:p-6 text-slate-900 max-h-[90vh] overflow-y-auto">
        
        {/* Header with Full Hebrew Date & Capacity */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
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

        {/* Shabbat / Holiday Greeting Button Banner */}
        {breakdown.staying.length > 0 && (
          <div className="mt-4 p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
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
        <div className="my-5 space-y-5">
          
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
                    onInitiateRelease={() => onInitiateRelease && onInitiateRelease(b)}
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
                    onInitiateRelease={() => onInitiateRelease && onInitiateRelease(b)}
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
                    onInitiateRelease={() => onInitiateRelease && onInitiateRelease(b)}
                    actionType="departure"
                  />
                ))}
              </div>
            )}
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
  onInitiateRelease?: () => void;
  actionType: 'arrival' | 'staying' | 'departure';
}

const DogBookingCard: React.FC<DogBookingCardProps> = React.memo(({
  booking,
  settings,
  onSelect,
  onDelete,
  onMarkPaid,
  onOpenPayment,
  onInitiateRelease,
}) => {
  const todayStr = getTodayStr();
  const isEnded = booking.stayStatus === 'checked_out' || (booking.endDate < todayStr);
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
      className={`p-3.5 rounded-2xl border transition-all hover:shadow-xs cursor-pointer ${paymentBorder}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Dog & Owner Info */}
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-extrabold text-base ${isEnded ? 'text-slate-700' : 'text-slate-900'}`}>{booking.dogName}</span>
            {booking.dogBreed && (
              <span className="text-xs text-slate-500 font-normal">({booking.dogBreed})</span>
            )}
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium border border-slate-200">
              {getServiceTypeHebrew(booking.serviceType)}
            </span>
            {isEnded && (
              <span className="text-[10px] bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                הסתיים
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1 font-medium">
              <User className="w-3.5 h-3.5 text-indigo-500" /> {booking.ownerName}
            </span>
            <span className="flex items-center gap-1 font-mono text-slate-700 font-semibold" dir="ltr">
              <Phone className="w-3.5 h-3.5 text-green-600" /> {booking.ownerPhone}
            </span>
            <span className="flex items-center gap-1 font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>{formatDateIL(booking.startDate)} עד {formatDateIL(booking.endDate)}</span>
            </span>
          </div>

          {booking.notes && (
            <p className="text-[11px] text-amber-800/90 italic mt-0.5 line-clamp-1">
              הערות: {booking.notes}
            </p>
          )}
        </div>

        {/* Payment & Actions */}
        <div className="flex flex-wrap items-center gap-1.5 justify-start md:justify-end shrink-0">
          {paymentTag}

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
    </div>
  );
});
