import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  Dog, 
  User, 
  Phone, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Filter,
  CalendarDays,
  CalendarRange
} from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import { 
  HEBREW_DAYS, 
  HEBREW_MONTHS, 
  getMonthGrid, 
  getWeekDays,
  getTodayStr, 
  getBookingsForDate, 
  formatDateIL, 
  formatFullHebrewDate,
  addDays,
  getDailyBreakdown
} from '../utils/dateUtils';
import { getServiceTypeHebrew } from '../utils/whatsappUtils';

export type CalendarDisplayMode = 'month' | 'week' | 'day';

interface CalendarViewProps {
  bookings: Booking[];
  settings: ResortSettings;
  onSelectDate: (dateStr: string) => void;
  onSelectBooking: (booking: Booking) => void;
  onNewBookingForDate: (dateStr: string) => void;
  currentYear: number;
  currentMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSetMonth?: (month: number) => void;
  onSetYear?: (year: number) => void;
  onJumpToToday?: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  bookings,
  settings,
  onSelectDate,
  onSelectBooking,
  onNewBookingForDate,
  currentYear,
  currentMonth,
  onPrevMonth,
  onNextMonth,
  onSetMonth,
  onSetYear,
  onJumpToToday,
}) => {
  const todayStr = getTodayStr();
  const [displayMode, setDisplayMode] = useState<CalendarDisplayMode>('month');
  const [focusedDate, setFocusedDate] = useState<string>(todayStr);

  const activeBookings = bookings.filter(b => b.stayStatus !== 'cancelled');
  const daysGrid = getMonthGrid(currentYear, currentMonth);
  const weekDays = getWeekDays(focusedDate);
  const dayBreakdown = getDailyBreakdown(activeBookings, focusedDate);

  const handlePrevWeek = () => {
    setFocusedDate(prev => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setFocusedDate(prev => addDays(prev, 7));
  };

  const handlePrevDay = () => {
    setFocusedDate(prev => addDays(prev, -1));
  };

  const handleNextDay = () => {
    setFocusedDate(prev => addDays(prev, 1));
  };

  const handleJumpTodayInternal = () => {
    setFocusedDate(todayStr);
    if (onJumpToToday) {
      onJumpToToday();
    }
  };

  const handleMonthSelect = (mIndex: number) => {
    if (onSetMonth) {
      onSetMonth(mIndex);
    }
    // update focusedDate to 1st of that month
    const newDate = `${currentYear}-${String(mIndex + 1).padStart(2, '0')}-01`;
    setFocusedDate(newDate);
  };

  const handleYearSelect = (year: number) => {
    if (onSetYear) {
      onSetYear(year);
    }
    const newDate = `${year}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    setFocusedDate(newDate);
  };

  // Generate Year options
  const yearOptions = [
    currentYear - 2,
    currentYear - 1,
    currentYear,
    currentYear + 1,
    currentYear + 2
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-xs select-none" dir="rtl">
      
      {/* Top Controls: Navigation + Fast Dropdowns + View Mode Switcher */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        
        {/* Navigation Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {displayMode === 'month' && (
            <>
              {/* Prev Month Button (RTL: right arrow goes to previous) */}
              <button
                type="button"
                onClick={onPrevMonth}
                title="חודש קודם"
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                <span>›</span>
                <span>קודם</span>
              </button>

              {/* Fast Month Dropdown */}
              <select
                value={currentMonth}
                onChange={(e) => handleMonthSelect(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-hidden cursor-pointer shadow-2xs"
              >
                {HEBREW_MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              {/* Fast Year Dropdown */}
              <select
                value={currentYear}
                onChange={(e) => handleYearSelect(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-hidden cursor-pointer shadow-2xs"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              {/* Next Month Button */}
              <button
                type="button"
                onClick={onNextMonth}
                title="חודש הבא"
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                <span>הבא</span>
                <span>‹</span>
              </button>
            </>
          )}

          {displayMode === 'week' && (
            <>
              <button
                type="button"
                onClick={handlePrevWeek}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                <span>›</span>
                <span>שבוע קודם</span>
              </button>

              <div className="font-bold text-xs sm:text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                {formatDateIL(weekDays[0].dateStr)} - {formatDateIL(weekDays[6].dateStr)}
              </div>

              <button
                type="button"
                onClick={handleNextWeek}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                <span>שבוע הבא</span>
                <span>‹</span>
              </button>
            </>
          )}

          {displayMode === 'day' && (
            <>
              <button
                type="button"
                onClick={handlePrevDay}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                <span>›</span>
                <span>יום קודם</span>
              </button>

              <div className="font-bold text-xs sm:text-sm text-emerald-900 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                {formatFullHebrewDate(focusedDate)}
              </div>

              <button
                type="button"
                onClick={handleNextDay}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                <span>יום הבא</span>
                <span>‹</span>
              </button>
            </>
          )}

          {/* Quick Jump to Today */}
          <button
            type="button"
            onClick={handleJumpTodayInternal}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            היום
          </button>
        </div>

        {/* View Mode Toggle: חודש / שבוע / יום בודד */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setDisplayMode('month')}
            className={`flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              displayMode === 'month'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>חודש</span>
          </button>

          <button
            type="button"
            onClick={() => setDisplayMode('week')}
            className={`flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              displayMode === 'week'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>שבוע</span>
          </button>

          <button
            type="button"
            onClick={() => setDisplayMode('day')}
            className={`flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              displayMode === 'day'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>יום בודד</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          MODE 1: MONTH VIEW (לוח חודשי מלא מיושר מימין לשמאל: ראשון -> שבת)
         ========================================================================= */}
      {displayMode === 'month' && (
        <div className="animate-in fade-in" dir="rtl">
          {/* Weekday Headers from Right to Left: ראשון, שני, שלישי, רביעי, חמישי, שישי, שבת */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs sm:text-sm font-bold text-slate-600">
            {HEBREW_DAYS.map((day) => (
              <div key={day} className="py-1 bg-slate-50 rounded-lg border border-slate-100">
                {day}
              </div>
            ))}
          </div>

          {/* 7 Columns Days Grid with proper RTL flow */}
          <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
            {daysGrid.map((dayObj) => {
              const dateBookings = getBookingsForDate(activeBookings, dayObj.dateStr);
              const isToday = dayObj.dateStr === todayStr;
              const isCurrentMonth = dayObj.isCurrentMonth;
              const occupancyRatio = (dateBookings.length / settings.maxCapacity) * 100;
              const isFull = dateBookings.length >= settings.maxCapacity;

              return (
                <div
                  key={dayObj.dateStr}
                  onClick={() => {
                    setFocusedDate(dayObj.dateStr);
                    onSelectDate(dayObj.dateStr);
                  }}
                  className={`min-h-[90px] sm:min-h-[110px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                    isToday
                      ? 'bg-[#eafaf1] border-2 border-[#10b981] shadow-xs'
                      : isFull
                      ? 'bg-red-50/30 border-red-200 hover:border-red-300'
                      : isCurrentMonth
                      ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                      : 'bg-slate-50/40 border-slate-100 opacity-40'
                  }`}
                >
                  {/* Day Header (Number + Occupancy Count) */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-bold ${
                        isToday
                          ? 'text-emerald-900 font-extrabold bg-emerald-200/60 px-1.5 py-0.2 rounded-md'
                          : isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {dayObj.dayNumber}
                    </span>

                    {dateBookings.length > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                        isFull 
                          ? 'bg-red-500 text-white' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {dateBookings.length} {dateBookings.length === 1 ? 'כלב' : 'כלבים'}
                      </span>
                    )}
                  </div>

                  {/* Bookings inside the day cell */}
                  <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-[58px] no-scrollbar pointer-events-none">
                    {dateBookings.slice(0, 2).map((b) => {
                      const isEnded = b.stayStatus === 'checked_out' || (b.endDate < todayStr);
                      const isPaid = b.paymentStatus === 'fully_paid';
                      const isDeposit = b.paymentStatus === 'deposit_paid';

                      let chipStyle = 'bg-red-500 text-white';
                      if (isEnded) {
                        chipStyle = 'bg-slate-200 text-slate-700 border border-slate-300 font-medium';
                      } else if (isPaid) {
                        chipStyle = 'bg-emerald-600 text-white';
                      } else if (isDeposit) {
                        chipStyle = 'bg-emerald-50 text-emerald-900 border border-dashed border-emerald-500';
                      }

                      return (
                        <div
                          key={b.id}
                          className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold truncate flex items-center justify-between ${chipStyle}`}
                          title={`${b.dogName} (${getServiceTypeHebrew(b.serviceType)})${isEnded ? ' - הסתיים' : ''}`}
                        >
                          <span className="truncate">{b.dogName}</span>
                          {isEnded && <span className="text-[9px] opacity-70 shrink-0">🏁</span>}
                        </div>
                      );
                    })}

                    {dateBookings.length > 2 && (
                      <div className="text-[9px] text-center text-slate-500 font-bold">
                        +{dateBookings.length - 2} נוספים
                      </div>
                    )}
                  </div>

                  {/* Quick Action Button */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center pt-1 border-t border-slate-100 mt-1">
                    <span className="text-[9px] text-slate-400">פרטים ›</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNewBookingForDate(dayObj.dateStr);
                      }}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODE 2: WEEK VIEW (תצוגה שבועית רחבה: 7 עמודות מראשון עד שבת)
         ========================================================================= */}
      {displayMode === 'week' && (
        <div className="animate-in fade-in space-y-4" dir="rtl">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((day) => {
              const dayBookings = getBookingsForDate(activeBookings, day.dateStr);
              const isToday = day.isToday;
              const isFull = dayBookings.length >= settings.maxCapacity;

              return (
                <div
                  key={day.dateStr}
                  className={`rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                    isToday
                      ? 'bg-emerald-50/50 border-2 border-emerald-500 shadow-sm'
                      : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Header: Day Name + Date */}
                  <div className="pb-2 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-sm text-slate-900 block">
                        יום {day.dayName}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDateIL(day.dateStr)}
                      </span>
                    </div>
                    {isToday && (
                      <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                        היום
                      </span>
                    )}
                  </div>

                  {/* Occupancy Mini Progress Bar */}
                  <div className="my-2 bg-white p-2 rounded-xl border border-slate-200/80">
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span>תפוסה:</span>
                      <span className={isFull ? 'text-red-600' : 'text-slate-900'}>
                        {dayBookings.length}/{settings.maxCapacity}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isFull
                            ? 'bg-red-500'
                            : dayBookings.length > settings.maxCapacity * 0.7
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, (dayBookings.length / settings.maxCapacity) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Dogs in this day */}
                  <div className="space-y-1.5 flex-1 min-h-[140px] max-h-[220px] overflow-y-auto no-scrollbar my-1">
                    {dayBookings.length === 0 ? (
                      <div className="text-center text-xs text-slate-400 py-6">
                        אין כלבים רשומים ליום זה
                      </div>
                    ) : (
                      dayBookings.map((b) => {
                        const isEnded = b.stayStatus === 'checked_out' || (b.endDate < todayStr);
                        const isPaid = b.paymentStatus === 'fully_paid';
                        const isDeposit = b.paymentStatus === 'deposit_paid';
                        const isArrival = b.startDate === day.dateStr;
                        const isDeparture = b.endDate === day.dateStr;

                        return (
                          <div
                            key={b.id}
                            onClick={() => onSelectBooking(b)}
                            className={`border rounded-xl p-2 text-xs transition-colors cursor-pointer shadow-2xs ${
                              isEnded
                                ? 'bg-slate-100/80 border-slate-200 text-slate-500 opacity-80'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1">
                                <Dog className={`w-3 h-3 shrink-0 ${isEnded ? 'text-slate-400' : 'text-emerald-600'}`} />
                                <span className="truncate">{b.dogName}</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                {isEnded ? '🏁 הסתיים' : getServiceTypeHebrew(b.serviceType)}
                              </span>
                            </div>

                            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                              <span>{b.ownerName}</span>
                              {!isEnded && isArrival && <span className="text-emerald-700 font-bold">📥 כניסה</span>}
                              {!isEnded && isDeparture && <span className="text-amber-700 font-bold">📤 יציאה</span>}
                            </div>

                            <div className="mt-1 flex items-center justify-between text-[10px] pt-1 border-t border-slate-100">
                              <span className={`px-1.5 py-0.2 rounded-md font-bold ${
                                isEnded
                                  ? 'bg-slate-200 text-slate-600'
                                  : isPaid
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isDeposit
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {isEnded ? 'הסתיים ושוחרר' : isPaid ? 'שולם מלא' : isDeposit ? `מקדמה ₪${b.depositAmount}` : 'חוב פתוח'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Day Actions */}
                  <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectDate(day.dateStr)}
                      className="flex-1 text-center bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold py-1.5 rounded-lg border border-slate-200 transition-colors"
                    >
                      פירוט מלא
                    </button>
                    <button
                      type="button"
                      onClick={() => onNewBookingForDate(day.dateStr)}
                      title="הוסף הזמנה ליום זה"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODE 3: SINGLE DAY VIEW (תצוגה יומית ממוקדת ומפורטת של יום בודד)
         ========================================================================= */}
      {displayMode === 'day' && (
        <div className="animate-in fade-in space-y-4" dir="rtl">
          
          {/* Day Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5">
              <span className="text-xs text-emerald-800 font-bold block">סה״כ שוהים ביום זה</span>
              <div className="text-2xl font-black text-emerald-950 mt-1">
                {dayBreakdown.total} / {settings.maxCapacity}
              </div>
              <span className="text-[11px] text-emerald-700 font-medium">
                {Math.max(0, settings.maxCapacity - dayBreakdown.total)} מקומות פנויים
              </span>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5">
              <span className="text-xs text-blue-800 font-bold block">📥 כניסות מתוכננות</span>
              <div className="text-2xl font-black text-blue-950 mt-1">
                {dayBreakdown.arrivals.length}
              </div>
              <span className="text-[11px] text-blue-700 font-medium">הגעת כלבים חדשים</span>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5">
              <span className="text-xs text-amber-800 font-bold block">📤 יציאות וסיום שהות</span>
              <div className="text-2xl font-black text-amber-950 mt-1">
                {dayBreakdown.departures.length}
              </div>
              <span className="text-[11px] text-amber-700 font-medium">איסוף ע״י הבעלים</span>
            </div>

            <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3.5">
              <span className="text-xs text-purple-800 font-bold block">🐾 שהות רציפה</span>
              <div className="text-2xl font-black text-purple-950 mt-1">
                {dayBreakdown.staying.length}
              </div>
              <span className="text-[11px] text-purple-700 font-medium">כלבים שבאמצע השהות</span>
            </div>
          </div>

          {/* Detailed Dogs List for this Single Day */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Dog className="w-4 h-4 text-emerald-600" />
                <span>רשימת הכלבים ליום {formatFullHebrewDate(focusedDate)} ({dayBreakdown.all.length})</span>
              </h3>
              
              <button
                type="button"
                onClick={() => onNewBookingForDate(focusedDate)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ הזמנה ליום זה</span>
              </button>
            </div>

            {dayBreakdown.all.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-slate-200">
                <p className="text-slate-500 font-bold text-sm">אין כלבים רשומים ליום זה בריזורט</p>
                <p className="text-slate-400 text-xs mt-1">הריזורט פנוי לחלוטין בתאריך זה</p>
                <button
                  type="button"
                  onClick={() => onNewBookingForDate(focusedDate)}
                  className="mt-3 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>הוסף הזמנה ראשונה ליום זה</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dayBreakdown.all.map((booking) => {
                  const remainingDebt = Math.max(0, Math.round(booking.totalPrice - booking.depositAmount));
                  const isArrival = booking.startDate === focusedDate;
                  const isDeparture = booking.endDate === focusedDate;
                  const isPaid = booking.paymentStatus === 'fully_paid' || remainingDebt === 0;
                  const isDeposit = booking.paymentStatus === 'deposit_paid' || (!isPaid && booking.depositAmount > 0);

                  return (
                    <div
                      key={booking.id}
                      onClick={() => onSelectBooking(booking)}
                      className="bg-white hover:bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-base text-slate-900">{booking.dogName}</span>
                            {booking.dogBreed && (
                              <span className="text-xs text-slate-500">({booking.dogBreed})</span>
                            )}
                            <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-md">
                              {getServiceTypeHebrew(booking.serviceType)}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-indigo-500" /> {booking.ownerName}
                            </span>
                            <span className="flex items-center gap-1 font-mono" dir="ltr">
                              <Phone className="w-3 h-3 text-emerald-600" /> {booking.ownerPhone}
                            </span>
                          </div>
                        </div>

                        {/* Stay Status Tag */}
                        <div className="text-right">
                          {isArrival && (
                            <span className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-lg">
                              📥 כניסה
                            </span>
                          )}
                          {isDeparture && !isArrival && (
                            <span className="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-lg">
                              📤 יציאה
                            </span>
                          )}
                          {!isArrival && !isDeparture && (
                            <span className="inline-block bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded-lg">
                              🐾 שוהה
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notes / Special requirements */}
                      {booking.notes && (
                        <div className="my-2 text-xs bg-amber-50/70 border border-amber-200 text-amber-900 p-2 rounded-lg">
                          <span className="font-bold">הערות:</span> {booking.notes}
                        </div>
                      )}

                      {/* Footer: Date Range + Payment Status */}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">
                          {formatDateIL(booking.startDate)} עד {formatDateIL(booking.endDate)}
                        </span>

                        <span className={`px-2 py-0.5 rounded-md font-bold ${
                          isPaid
                            ? 'bg-emerald-600 text-white'
                            : isDeposit
                            ? 'bg-emerald-50 text-emerald-900 border border-dashed border-emerald-500'
                            : 'bg-red-500 text-white'
                        }`}>
                          {isPaid
                            ? `שולם מלא (₪${Math.round(booking.totalPrice)})`
                            : isDeposit
                            ? `מקדמה ₪${Math.round(booking.depositAmount)} (חוב ₪${remainingDebt})`
                            : `חוב ₪${remainingDebt}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
