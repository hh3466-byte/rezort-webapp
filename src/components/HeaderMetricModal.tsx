import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Dog, 
  User, 
  Phone, 
  Calendar, 
  CreditCard, 
  CheckCircle, 
  Edit3, 
  MessageSquare, 
  Sparkles, 
  Building2, 
  GraduationCap, 
  DollarSign, 
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { Booking, ResortSettings, StayStatus } from '../types';
import { getTodayStr, calculateDaysCount, formatDateIL, getBookingsForDate } from '../utils/dateUtils';
import { generatePaymentReminderMessage, openWhatsAppMessage } from '../utils/whatsappUtils';

export type HeaderMetricType = 'occupancy' | 'boarding' | 'training' | 'debt' | 'revenue';

interface HeaderMetricModalProps {
  metricType: HeaderMetricType | null;
  onClose: () => void;
  bookings: Booking[];
  settings: ResortSettings;
  onEditBooking: (booking: Booking) => void;
  onMarkAsPaid: (bookingId: string) => void;
  onOpenPaymentModal: (booking: Booking) => void;
  onToggleStayStatus?: (bookingId: string, current: StayStatus) => void;
}

export const HeaderMetricModal: React.FC<HeaderMetricModalProps> = ({
  metricType,
  onClose,
  bookings,
  settings,
  onEditBooking,
  onMarkAsPaid,
  onOpenPaymentModal,
  onToggleStayStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [trainingFilter, setTrainingFilter] = useState<'all' | 'full' | 'day'>('all');

  if (!metricType) return null;

  const todayStr = getTodayStr();
  const activeBookings = bookings.filter(b => b.stayStatus !== 'cancelled');
  const todayBookings = getBookingsForDate(activeBookings, todayStr);

  // Filter items based on selected metric
  let title = '';
  let subtitle = '';
  let icon = <Sparkles className="w-5 h-5" />;
  let badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  let filteredItems: Booking[] = [];

  switch (metricType) {
    case 'occupancy':
      title = 'תפוסה כללית להיום';
      subtitle = `סך הכל ${todayBookings.length} כלבים שוהים בריזורט היום מתוך קיבולת של ${settings.maxCapacity}`;
      icon = <Dog className="w-5 h-5 text-emerald-700" />;
      badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      filteredItems = todayBookings;
      break;

    case 'boarding':
      title = 'כלבים בפנסיון ומשפחתון היום';
      subtitle = 'כלבים השוהים בפנסיון עם לינה או יום כיף (דייקר)';
      icon = <Building2 className="w-5 h-5 text-sky-700" />;
      badgeColor = 'bg-sky-50 text-sky-800 border-sky-200';
      filteredItems = todayBookings.filter(b => b.serviceType === 'boarding' || b.serviceType === 'daycare');
      break;

    case 'training':
      title = 'כלבים בתהליך אילוף היום';
      subtitle = 'תהליך אילוף מלא (50 יום) ואילוף ביומיות ללא לינה';
      icon = <GraduationCap className="w-5 h-5 text-purple-700" />;
      badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';
      filteredItems = todayBookings.filter(b => {
        if (trainingFilter === 'full') return b.serviceType === 'training';
        if (trainingFilter === 'day') return b.serviceType === 'day_training';
        return b.serviceType === 'training' || b.serviceType === 'day_training';
      });
      break;

    case 'debt': {
      const debtItems = activeBookings.filter(b => {
        const debt = Math.max(0, (Number(b.totalPrice) || 0) - (Number(b.depositAmount) || 0));
        return b.paymentStatus !== 'fully_paid' && debt > 0;
      });
      const totalDebtSum = debtItems.reduce((acc, b) => {
        return acc + Math.max(0, (Number(b.totalPrice) || 0) - (Number(b.depositAmount) || 0));
      }, 0);
      title = 'הזמנות עם חוב פתוח לתשלום';
      subtitle = `${debtItems.length} הזמנות פעילות עם יתרת חוב לתשלום (סה״כ ₪${totalDebtSum.toLocaleString()})`;
      icon = <AlertCircle className="w-5 h-5 text-red-600" />;
      badgeColor = 'bg-red-50 text-red-700 border-red-200';
      filteredItems = debtItems;
      break;
    }

    case 'revenue': {
      const paidItems = activeBookings.filter(b => {
        return (Number(b.depositAmount) || 0) > 0 || b.paymentStatus === 'fully_paid';
      });
      const totalCollectedSum = activeBookings.reduce((acc, b) => {
        if (b.paymentStatus === 'fully_paid') return acc + (Number(b.totalPrice) || 0);
        return acc + (Number(b.depositAmount) || 0);
      }, 0);
      title = 'פירוט הכנסות ותקבולים';
      subtitle = `סך הכל נגבו בפועל ₪${totalCollectedSum.toLocaleString()} מתוך ${paidItems.length} הזמנות`;
      icon = <DollarSign className="w-5 h-5 text-emerald-700" />;
      badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      filteredItems = paidItems;
      break;
    }
  }

  // Apply search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredItems = filteredItems.filter(b => {
      const matchDog = (b.dogName || '').toLowerCase().includes(q);
      const matchOwner = (b.ownerName || '').toLowerCase().includes(q);
      const matchPhone = (b.ownerPhone || '').includes(q);
      const matchNotes = (b.notes || '').toLowerCase().includes(q);
      return matchDog || matchOwner || matchPhone || matchNotes;
    });
  }

  const handleSendWhatsApp = (b: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = generatePaymentReminderMessage(b, settings);
    openWhatsAppMessage(b.ownerPhone, msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-900">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${badgeColor} shadow-2xs`}>
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg sm:text-xl text-slate-900">{title}</h3>
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                  {filteredItems.length} פריטים
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">{subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            title="סגור חלון"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search and Sub-filters */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לפי שם כלב, בעלים, טלפון, הערות..."
              className="w-full bg-slate-50 text-slate-900 text-xs sm:text-sm pl-3 pr-9 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sub-filter for Training metric */}
          {metricType === 'training' && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setTrainingFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  trainingFilter === 'all' ? 'bg-white text-purple-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                הכל
              </button>
              <button
                type="button"
                onClick={() => setTrainingFilter('full')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  trainingFilter === 'full' ? 'bg-purple-50 text-purple-800 border border-purple-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                תהליך מלא (50 יום)
              </button>
              <button
                type="button"
                onClick={() => setTrainingFilter('day')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  trainingFilter === 'day' ? 'bg-purple-50 text-purple-800 border border-purple-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ביומיות
              </button>
            </div>
          )}
        </div>

        {/* Bookings List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Dog className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700 text-sm">לא נמצאו פריטים להצגה</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery ? 'נסה לשנות את מילות החיפוש' : 'אין כרגע נתונים בקטגוריה זו'}
              </p>
            </div>
          ) : (
            filteredItems.map(b => {
              const totalPrice = Number(b.totalPrice) || 0;
              const depositAmount = Number(b.depositAmount) || 0;
              const remainingDebt = Math.max(0, totalPrice - depositAmount);
              const daysCount = calculateDaysCount(b.startDate, b.endDate);
              const isEnded = b.stayStatus === 'checked_out' || (b.endDate < todayStr);

              return (
                <div
                  key={b.id}
                  className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-3.5 sm:p-4 shadow-xs transition-all hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  {/* Left / Info */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-base sm:text-lg text-slate-900">
                        {b.dogName}
                      </span>
                      {b.dogBreed && (
                        <span className="text-xs text-slate-500 font-medium">
                          ({b.dogBreed})
                        </span>
                      )}

                      {/* Service Badge */}
                      <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200 font-bold">
                        {b.serviceType === 'training' ? '🎓 תהליך אילוף (50 יום)' :
                         b.serviceType === 'day_training' ? '🦮 אילוף ביומיות' :
                         b.serviceType === 'boarding' ? '🏨 פנסיון' : '✂️ יום כיף'}
                      </span>

                      {/* Stay Status */}
                      {isEnded ? (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                          🏁 הסתיים
                        </span>
                      ) : b.stayStatus === 'checked_in' ? (
                        <span className="text-xs bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5">
                          <ArrowDownLeft className="w-3 h-3" /> שוהה כעת
                        </span>
                      ) : (
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold">
                          📅 שוריין
                        </span>
                      )}
                    </div>

                    {/* Metadata: Owner, Phone, Dates */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-semibold text-slate-800">
                        <User className="w-3.5 h-3.5 text-indigo-500" /> {b.ownerName}
                      </span>
                      <a 
                        href={`tel:${b.ownerPhone}`} 
                        className="flex items-center gap-1 font-mono text-emerald-700 hover:underline"
                      >
                        <Phone className="w-3.5 h-3.5" /> {b.ownerPhone}
                      </a>
                      <span className="flex items-center gap-1 text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        <span>{formatDateIL(b.startDate)} עד {formatDateIL(b.endDate)}</span>
                        <span className="text-slate-400 font-semibold">({daysCount} ימים)</span>
                      </span>
                    </div>

                    {b.notes && (
                      <p className="text-xs text-amber-800/90 italic bg-amber-50/60 px-2 py-1 rounded-lg border border-amber-200/60 max-w-xl">
                        הערות: {b.notes}
                      </p>
                    )}
                  </div>

                  {/* Right / Finance & Actions */}
                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    
                    {/* Financial Badge */}
                    <div className="text-right pl-2">
                      <div className="text-xs text-slate-500 font-medium">
                        סה״כ: <span className="font-bold text-slate-900">₪{totalPrice.toLocaleString()}</span>
                      </div>
                      {remainingDebt > 0 && b.paymentStatus !== 'fully_paid' ? (
                        <div className="text-xs font-black text-red-600 flex items-center gap-1">
                          <span>חוב: ₪{remainingDebt.toLocaleString()}</span>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>שולם מלא</span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      
                      {/* Mark Paid fast action */}
                      {remainingDebt > 0 && b.stayStatus !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => onMarkAsPaid(b.id)}
                          className="bg-green-600 hover:bg-green-700 active:scale-98 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                          title="סמן כעת כשולם במלואו"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>סמן כשולם</span>
                        </button>
                      )}

                      {/* Custom payment */}
                      {b.stayStatus !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenPaymentModal(b);
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                          title="הוסף תשלום או מקדמה"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-green-600" />
                          <span>תשלום</span>
                        </button>
                      )}

                      {/* WhatsApp reminder */}
                      {b.ownerPhone && (
                        <button
                          type="button"
                          onClick={(e) => handleSendWhatsApp(b, e)}
                          className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-semibold px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                          title="שלח וואטסאפ"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                          <span>וואטסאפ</span>
                        </button>
                      )}

                      {/* Edit Booking button */}
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onEditBooking(b);
                        }}
                        className="bg-[#0f766e] hover:bg-[#0f6760] active:scale-98 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                        title="ערוך פרטי הזמנה"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ערוך</span>
                      </button>

                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            💡 ניתן לערוך כל פרט בהזמנה, לסמן תשלומים או לעדכן תאריכים ישירות מכאן.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-2xs cursor-pointer transition-colors"
          >
            סגור
          </button>
        </div>

      </div>
    </div>
  );
};
