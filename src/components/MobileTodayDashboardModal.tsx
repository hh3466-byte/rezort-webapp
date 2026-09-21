import React, { useMemo } from 'react';
import {
  X,
  Phone,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Dog,
  User,
  ExternalLink,
  ChevronLeft,
  DollarSign
} from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import {
  getTodayStr,
  getBookingsForDate,
  formatFullHebrewDate,
  formatDateIL
} from '../utils/dateUtils';
import { getServiceTypeHebrew } from '../utils/whatsappUtils';

interface MobileTodayDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  settings: ResortSettings;
  onSelectBooking?: (booking: Booking) => void;
  onOpenDailyDogUpdates?: () => void;
  onOpenTomorrowOverview?: () => void;
}

export const MobileTodayDashboardModal: React.FC<MobileTodayDashboardModalProps> = ({
  isOpen,
  onClose,
  bookings,
  settings,
  onSelectBooking,
  onOpenDailyDogUpdates,
  onOpenTomorrowOverview
}) => {
  const todayStr = getTodayStr();

  // Active dogs staying today
  const dogsToday = useMemo(() => {
    return getBookingsForDate(bookings, todayStr).filter(b => b.stayStatus !== 'cancelled');
  }, [bookings, todayStr]);

  // Dogs arriving today (startDate === todayStr)
  const arrivingToday = useMemo(() => {
    return bookings.filter(b => b.startDate === todayStr && b.stayStatus !== 'cancelled');
  }, [bookings, todayStr]);

  // Dogs departing today (endDate === todayStr)
  const departingToday = useMemo(() => {
    return bookings.filter(b => b.endDate === todayStr && b.stayStatus !== 'cancelled');
  }, [bookings, todayStr]);

  // Total open debt of departing dogs
  const departingDebtTotal = useMemo(() => {
    return departingToday.reduce((sum, b) => {
      const debt = Math.max(0, (b.totalPrice || 0) - (b.depositAmount || 0));
      return sum + debt;
    }, 0);
  }, [departingToday]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] sm:max-h-[85vh] w-full sm:max-w-lg flex flex-col overflow-hidden shadow-2xl border-t sm:border border-slate-200 animate-in slide-in-from-bottom-5 duration-250"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag Handle & Top Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-[#065f46] to-teal-900 text-white p-4 pb-5 relative shrink-0">
          <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto mb-3 sm:hidden" />
          
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-xl shadow-inner font-black">
                🐾
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  <span>סדר יום לשמוליק</span>
                  <span className="text-[10px] bg-white/20 border border-white/30 px-2 py-0.5 rounded-full font-bold">
                    היום בריזורט
                  </span>
                </h2>
                <p className="text-xs text-emerald-100 font-medium">
                  {formatFullHebrewDate(todayStr)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-white/15 text-center">
            <div className="bg-white/10 rounded-xl p-1.5 border border-white/15">
              <span className="text-[10px] text-emerald-100 block">סה&quot;כ בריזורט</span>
              <strong className="text-sm font-black">{dogsToday.length} / {settings.maxCapacity}</strong>
            </div>
            <div className="bg-white/10 rounded-xl p-1.5 border border-white/15">
              <span className="text-[10px] text-emerald-100 block">נכנסים היום</span>
              <strong className="text-sm font-black text-amber-300">📥 {arrivingToday.length}</strong>
            </div>
            <div className="bg-white/10 rounded-xl p-1.5 border border-white/15">
              <span className="text-[10px] text-emerald-100 block">יוצאים היום</span>
              <strong className="text-sm font-black text-rose-300">📤 {departingToday.length}</strong>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          
          {/* 1. ARRIVALS (נכנסים היום) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-[10px]">📥</span>
                <span>נכנסים היום ({arrivingToday.length})</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-400">הגעה לפנסיון / אילוף</span>
            </div>

            {arrivingToday.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2">אין כלבים שמגיעים היום 🎉</p>
            ) : (
              <div className="space-y-2">
                {arrivingToday.map(booking => {
                  const cleanPhone = booking.ownerPhone ? booking.ownerPhone.replace(/\D/g, '') : '';
                  const arrivalTime = (booking as any).arrivalTime || 'במהלך היום';
                  const waGreeting = encodeURIComponent(
                    `היי ${booking.ownerName}! 🐾\nמחכים לכם ול${booking.dogName} היום בריזורט לכלב!\nשעת הגעה משוערת: ${arrivalTime}.\nנסיעה טובה ולהתראות בקרוב! 🐕`
                  );

                  return (
                    <div
                      key={booking.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs hover:border-emerald-300 transition-all"
                    >
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => {
                          if (onSelectBooking) onSelectBooking(booking);
                          onClose();
                        }}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-sm text-slate-900">{booking.dogName}</span>
                          <span className="text-[10px] text-slate-500 font-bold">({booking.ownerName})</span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                            {getServiceTypeHebrew(booking.serviceType)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="flex items-center gap-0.5 text-amber-800 font-bold">
                            <Clock className="w-3 h-3" />
                            <span>שעת הגעה: {arrivalTime}</span>
                          </span>
                          <span>•</span>
                          <span>עד {formatDateIL(booking.endDate)}</span>
                        </div>
                      </div>

                      {/* Fast Action Buttons: Phone Call & WhatsApp */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {booking.ownerPhone && (
                          <>
                            <a
                              href={`tel:${cleanPhone}`}
                              className="w-8 h-8 rounded-xl bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-700 border border-sky-200 flex items-center justify-center transition-all shadow-2xs"
                              title="חייג ללקוח"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`https://wa.me/${cleanPhone.startsWith('972') ? cleanPhone : '972' + cleanPhone.replace(/^0/, '')}?text=${waGreeting}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 border border-emerald-200 flex items-center justify-center transition-all shadow-2xs"
                              title="שלח וואטסאפ מהיר"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. DEPARTURES (יוצאים היום) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center text-[10px]">📤</span>
                <span>יוצאים היום ({departingToday.length})</span>
              </h3>
              {departingDebtTotal > 0 && (
                <span className="text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded-md">
                  סה&quot;כ לגבייה: ₪{departingDebtTotal.toLocaleString()}
                </span>
              )}
            </div>

            {departingToday.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2">אין כלבים שיוצאים היום</p>
            ) : (
              <div className="space-y-2">
                {departingToday.map(booking => {
                  const cleanPhone = booking.ownerPhone ? booking.ownerPhone.replace(/\D/g, '') : '';
                  const departureTime = (booking as any).departureTime || 'במהלך היום';
                  const remainingDebt = Math.max(0, (booking.totalPrice || 0) - (booking.depositAmount || 0));
                  const waGreeting = encodeURIComponent(
                    `היי ${booking.ownerName}! 🐾\n${booking.dogName} מחכה ומצפה לכם היום לסיום הנופש!\nשעת איסוף משוערת: ${departureTime}.${
                      remainingDebt > 0 ? `\nלתשומת לבך, יתרת התשלום לסיום החשבון הינה ₪${remainingDebt.toLocaleString()}.` : ''
                    }\nנשמח לראותכם! צוות הריזורט לכלב 🐕`
                  );

                  return (
                    <div
                      key={booking.id}
                      className={`border rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs transition-all ${
                        remainingDebt > 0
                          ? 'bg-rose-50/50 border-rose-200 hover:border-rose-300'
                          : 'bg-slate-50 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => {
                          if (onSelectBooking) onSelectBooking(booking);
                          onClose();
                        }}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-sm text-slate-900">{booking.dogName}</span>
                          <span className="text-[10px] text-slate-500 font-bold">({booking.ownerName})</span>
                          {remainingDebt > 0 ? (
                            <span className="text-[10px] bg-rose-600 text-white font-black px-2 py-0.2 rounded-md animate-pulse">
                              ⚠️ לגבות: ₪{remainingDebt.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                              ✓ שולם מלא
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="flex items-center gap-0.5 text-rose-700 font-bold">
                            <Clock className="w-3 h-3" />
                            <span>שעת שחרור: {departureTime}</span>
                          </span>
                        </div>
                      </div>

                      {/* Fast Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {booking.ownerPhone && (
                          <>
                            <a
                              href={`tel:${cleanPhone}`}
                              className="w-8 h-8 rounded-xl bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-700 border border-sky-200 flex items-center justify-center transition-all shadow-2xs"
                              title="חייג ללקוח"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`https://wa.me/${cleanPhone.startsWith('972') ? cleanPhone : '972' + cleanPhone.replace(/^0/, '')}?text=${waGreeting}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 border border-emerald-200 flex items-center justify-center transition-all shadow-2xs"
                              title="שלח וואטסאפ מהיר"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. CURRENTLY STAYING DOGS CHIPS (שוהים כעת בריזורט) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <span>🐕</span>
                <span>כל הכלבים בריזורט כעת ({dogsToday.length})</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">
                {settings.maxCapacity - dogsToday.length > 0 ? `${settings.maxCapacity - dogsToday.length} מקומות פנויים` : 'תפוסה מלאה!'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {dogsToday.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    if (onSelectBooking) onSelectBooking(b);
                    onClose();
                  }}
                  className="bg-slate-100 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-800 font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                >
                  <span>🐾 {b.dogName}</span>
                  <span className="text-[10px] text-slate-400 font-normal">({b.ownerName.split(' ')[0]})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Quick Shortcuts */}
        <div className="bg-white p-3 border-t border-slate-200 flex items-center gap-2 shrink-0">
          {onOpenDailyDogUpdates && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDailyDogUpdates();
              }}
              className="flex-1 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-950 font-black py-2.5 px-2 rounded-xl text-xs border border-amber-300 shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>🐶</span>
              <span>עדכון ערב 20:00</span>
            </button>
          )}

          {onOpenTomorrowOverview && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTomorrowOverview();
              }}
              className="flex-1 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-950 font-black py-2.5 px-2 rounded-xl text-xs border border-indigo-300 shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>📋</span>
              <span>מה קורה מחר (19:00)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
