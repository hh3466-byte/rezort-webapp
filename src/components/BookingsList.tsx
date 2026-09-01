import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  CheckCircle, 
  MessageSquare, 
  Edit3, 
  Trash2, 
  Plus, 
  DollarSign, 
  Calendar, 
  User, 
  Phone, 
  AlertCircle, 
  ShieldAlert, 
  CreditCard,
  Building2,
  GraduationCap,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Download
} from 'lucide-react';
import { Booking, ResortSettings, ServiceType, PaymentStatus, StayStatus } from '../types';
import { formatDateIL, calculateDaysCount } from '../utils/dateUtils';
import { getServiceTypeHebrew, generatePaymentReminderMessage, openWhatsAppMessage } from '../utils/whatsappUtils';
import { exportBookingsToCSV } from '../utils/exportUtils';

interface BookingsListProps {
  bookings: Booking[];
  settings: ResortSettings;
  onSelectBooking: (booking: Booking) => void;
  onEditBooking: (booking: Booking) => void;
  onDeleteBooking: (bookingId: string) => void;
  onMarkAsPaid: (bookingId: string) => void;
  onOpenPaymentModal: (booking: Booking) => void;
  onOpenNewBooking: () => void;
}

export const BookingsList: React.FC<BookingsListProps> = ({
  bookings,
  settings,
  onSelectBooking,
  onEditBooking,
  onDeleteBooking,
  onMarkAsPaid,
  onOpenPaymentModal,
  onOpenNewBooking,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  const [serviceFilter, setServiceFilter] = useState<'all' | ServiceType>('all');
  const [stayFilter, setStayFilter] = useState<'all' | StayStatus>('all');

  // Filter list
  const filtered = bookings.filter(b => {
    const remainingDebt = Math.max(0, (Number(b.totalPrice) || 0) - (Number(b.depositAmount) || 0));
    if (paymentFilter === 'unpaid') {
      // "חוב פתוח" filter matches any active booking with debt
      if (b.stayStatus === 'cancelled' || b.paymentStatus === 'fully_paid' || remainingDebt <= 0) return false;
    } else if (paymentFilter !== 'all' && b.paymentStatus !== paymentFilter) {
      return false;
    }
    if (serviceFilter !== 'all' && b.serviceType !== serviceFilter) return false;
    if (stayFilter !== 'all' && b.stayStatus !== stayFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDog = b.dogName.toLowerCase().includes(q);
      const matchOwner = b.ownerName.toLowerCase().includes(q);
      const matchPhone = b.ownerPhone.includes(q);
      const matchNotes = (b.notes || '').toLowerCase().includes(q);
      return matchDog || matchOwner || matchPhone || matchNotes;
    }
    return true;
  });

  // Calculate totals
  const activeBookings = bookings.filter(b => b.stayStatus !== 'cancelled');
  const totalRevenue = activeBookings.reduce((acc, b) => acc + (Number(b.totalPrice) || 0), 0);
  const totalCollected = activeBookings.reduce((acc, b) => {
    if (b.paymentStatus === 'fully_paid') return acc + (Number(b.totalPrice) || 0);
    return acc + (Number(b.depositAmount) || 0);
  }, 0);
  const totalDebt = Math.max(0, totalRevenue - totalCollected);
  const unpaidCount = activeBookings.filter(b => b.paymentStatus !== 'fully_paid' && ((Number(b.totalPrice) || 0) - (Number(b.depositAmount) || 0) > 0)).length;

  const handleSendWhatsAppReminder = (booking: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = generatePaymentReminderMessage(booking, settings);
    openWhatsAppMessage(booking.ownerPhone, msg);
  };

  return (
    <div className="space-y-4">
      
      {/* Top Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">סה״כ הזמנות</span>
          <span className="text-xl font-black text-slate-900">{bookings.length}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">מחזור הזמנות</span>
          <span className="text-xl font-black text-slate-900">₪{totalRevenue.toLocaleString()}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">סה״כ נגבה בפועל</span>
          <span className="text-xl font-black text-green-600">₪{totalCollected.toLocaleString()}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">חוב פתוח לתשלום ({unpaidCount})</span>
          <span className={`text-xl font-black ${totalDebt > 0 ? 'text-red-500' : 'text-slate-500'}`}>
            ₪{totalDebt.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לפי שם כלב, בעלים, טלפון, הערות..."
              className="w-full bg-slate-50 text-slate-900 text-xs sm:text-sm pl-3 pr-9 py-2.5 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none"
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

          {/* Quick Actions: New Booking + Export CSV */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportBookingsToCSV(filtered)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>ייצוא לאקסל (CSV)</span>
            </button>

            <button
              onClick={onOpenNewBooking}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>הזמנה חדשה</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          
          {/* Payment Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setPaymentFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                paymentFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              הכל ({bookings.length})
            </button>
            <button
              onClick={() => setPaymentFilter('unpaid')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                paymentFilter === 'unpaid' ? 'bg-red-50 text-red-700 border border-red-300' : 'text-red-600 hover:text-red-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span>חוב פתוח ({unpaidCount})</span>
            </button>
            <button
              onClick={() => setPaymentFilter('deposit_paid')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                paymentFilter === 'deposit_paid' ? 'bg-green-50 text-green-800 border border-dashed border-green-400' : 'text-green-700 hover:text-green-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span>מקדמה ({bookings.filter(b => b.paymentStatus === 'deposit_paid').length})</span>
            </button>
            <button
              onClick={() => setPaymentFilter('fully_paid')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                paymentFilter === 'fully_paid' ? 'bg-green-600 text-white shadow-xs' : 'text-green-700 hover:text-green-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-green-300"></span>
              <span>שולם מלא ({bookings.filter(b => b.paymentStatus === 'fully_paid').length})</span>
            </button>
          </div>

          {/* Service filter */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value as any)}
            className="bg-slate-50 text-slate-700 text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">כל השירותים</option>
            <option value="boarding">🏨 פנסיון</option>
            <option value="training">🎓 תהליך אילוף (50 יום)</option>
            <option value="day_training">🦮 אילוף ביומיות</option>
            <option value="daycare">✂️ יום כיף</option>
          </select>

          {/* Stay Status Filter */}
          <select
            value={stayFilter}
            onChange={(e) => setStayFilter(e.target.value as any)}
            className="bg-slate-50 text-slate-700 text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">כל סטטוסי השהות</option>
            <option value="booked">מוזמן / עתידי</option>
            <option value="checked_in">שוהה כעת בריזורט</option>
            <option value="checked_out">הסתיים / שוחרר</option>
            <option value="cancelled">בוטל</option>
          </select>

        </div>
      </div>

      {/* Bookings Cards / Table List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-slate-400" />
            <p className="font-bold text-base text-slate-700">לא נמצאו הזמנות התואמות את הסינון</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setPaymentFilter('all');
                setServiceFilter('all');
                setStayFilter('all');
              }}
              className="text-xs text-green-700 hover:underline font-bold"
            >
              נקה את כל הסינונים
            </button>
          </div>
        ) : (
          filtered.map(b => {
            const remainingDebt = Math.max(0, b.totalPrice - b.depositAmount);
            const daysCount = calculateDaysCount(b.startDate, b.endDate);

            // Visual Payment styling
            let paymentBadge = (
              <span className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 shadow-xs">
                <span>לא שולם (חוב ₪{remainingDebt})</span>
              </span>
            );

            if (b.paymentStatus === 'fully_paid') {
              paymentBadge = (
                <span className="text-xs bg-green-500 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 shadow-xs">
                  <span>שולם במלואו (₪{b.totalPrice})</span>
                </span>
              );
            } else if (b.paymentStatus === 'deposit_paid') {
              paymentBadge = (
                <span className="text-xs border-2 border-dashed border-green-500 bg-green-50 text-green-800 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5">
                  <span>מקדמה ₪{b.depositAmount} (יתרה ₪{remainingDebt})</span>
                </span>
              );
            }

            const todayStr = new Date().toISOString().split('T')[0];
            const isEnded = b.stayStatus === 'checked_out' || (b.endDate < todayStr);

            return (
              <div
                key={b.id}
                onClick={() => onSelectBooking(b)}
                className={`border rounded-2xl p-4 sm:p-5 transition-all hover:shadow-md cursor-pointer shadow-xs ${
                  isEnded
                    ? 'bg-slate-50/80 border-slate-200 opacity-80'
                    : b.paymentStatus === 'unpaid' && b.stayStatus !== 'cancelled'
                    ? 'bg-white border-red-300 ring-1 ring-red-100'
                    : b.paymentStatus === 'deposit_paid'
                    ? 'bg-white border-green-300 ring-1 ring-green-100'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left Column: Dog & Service Details */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`font-extrabold text-lg sm:text-xl ${isEnded ? 'text-slate-700' : 'text-slate-900'}`}>
                        {b.dogName}
                      </span>
                      {b.dogBreed && (
                        <span className="text-xs text-slate-500 font-normal">
                          ({b.dogBreed})
                        </span>
                      )}

                      {/* Service Tag */}
                      <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 font-semibold flex items-center gap-1">
                        {b.serviceType === 'training' && <GraduationCap className="w-3.5 h-3.5 text-amber-600" />}
                        {b.serviceType === 'day_training' && <GraduationCap className="w-3.5 h-3.5 text-purple-600" />}
                        {b.serviceType === 'boarding' && <Building2 className="w-3.5 h-3.5 text-sky-600" />}
                        {b.serviceType === 'daycare' && <Sparkles className="w-3.5 h-3.5 text-emerald-600" />}
                        <span>{getServiceTypeHebrew(b.serviceType)}</span>
                      </span>

                      {/* Stay Status Tag */}
                      {isEnded ? (
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                          🏁 הסתיים ושוחרר
                        </span>
                      ) : b.stayStatus === 'checked_in' ? (
                        <span className="text-xs bg-sky-50 text-sky-700 border border-sky-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                          <ArrowDownLeft className="w-3 h-3" /> שוהה כעת
                        </span>
                      ) : b.stayStatus === 'cancelled' ? (
                        <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-md">
                          בוטל
                        </span>
                      ) : (
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold">
                          📅 שוריין
                        </span>
                      )}
                    </div>

                    {/* Metadata: Owner, Phone, Dates, Days count */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1 text-slate-800 font-medium">
                        <User className="w-3.5 h-3.5 text-indigo-500" /> {b.ownerName}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-slate-800">
                        <Phone className="w-3.5 h-3.5 text-green-600" /> {b.ownerPhone}
                      </span>
                      <span className="flex items-center gap-1 text-slate-800">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        <span>{formatDateIL(b.startDate)} עד {formatDateIL(b.endDate)}</span>
                        <span className="text-slate-500 font-semibold">({daysCount} ימים)</span>
                      </span>
                    </div>

                    {b.notes && (
                      <p className="text-xs text-amber-800/90 italic line-clamp-2">
                        הערות: {b.notes}
                      </p>
                    )}
                  </div>

                  {/* Right Column: Pricing & Fast Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    
                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      {paymentBadge}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      
                      {/* Mark Paid button */}
                      {remainingDebt > 0 && b.stayStatus !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkAsPaid(b.id);
                          }}
                          title="סמן כעת כשולם במלואו"
                          className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>סמן כשולם</span>
                        </button>
                      )}

                      {/* Record partial payment */}
                      {b.stayStatus !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPaymentModal(b);
                          }}
                          title="רשום תשלום או מקדמה נוספת"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <CreditCard className="w-4 h-4 text-green-600" />
                          <span>תשלום</span>
                        </button>
                      )}

                      {/* Send WhatsApp Reminder */}
                      {remainingDebt > 0 && (
                        <button
                          type="button"
                          onClick={(e) => handleSendWhatsAppReminder(b, e)}
                          title="שלח תזכורת תשלום בוואטסאפ ללקוח"
                          className="bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>וואטסאפ</span>
                        </button>
                      )}

                      {/* Edit Booking */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditBooking(b);
                        }}
                        title="ערוך פרטי הזמנה"
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Delete / Cancel */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`האם לבטל/למחוק את ההזמנה של ${b.dogName}?`)) {
                            onDeleteBooking(b.id);
                          }
                        }}
                        title="בטל הזמנה"
                        className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
