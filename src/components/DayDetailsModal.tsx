import React from 'react';
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
}) => {
  if (!dateStr) return null;

  const breakdown = getDailyBreakdown(bookings, dateStr);
  const isOverbooked = breakdown.total > settings.maxCapacity;

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
                    actionType="departure"
                  />
                ))}
              </div>
            )}
          </div>

        </div>

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
  actionType: 'arrival' | 'staying' | 'departure';
}

const DogBookingCard: React.FC<DogBookingCardProps> = React.memo(({
  booking,
  settings,
  onSelect,
  onDelete,
  onMarkPaid,
  onOpenPayment,
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
