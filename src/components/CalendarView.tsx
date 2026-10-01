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
  CalendarRange,
  Search,
  X
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
  getDailyBreakdown,
  isTrainingBooking,
  getBookingPairInfo
} from '../utils/dateUtils';
import { getServiceTypeHebrew } from '../utils/whatsappUtils';
import { getDateShabbatOrHoliday } from '../utils/jewishCalendar';
import { ShabbatHolidayGreetingModal } from './ShabbatHolidayGreetingModal';

export type CalendarDisplayMode = 'month' | 'two_weeks' | 'week' | 'day';

interface CalendarViewProps {
  bookings: Booking[];
  settings: ResortSettings;
  onSelectDate: (dateStr: string) => void;
  onSelectBooking: (booking: Booking, targetDateStr?: string) => void;
  onNewBookingForDate: (dateStr: string) => void;
  currentYear: number;
  currentMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSetMonth?: (month: number) => void;
  onSetYear?: (year: number) => void;
  onJumpToToday?: () => void;
}

// Helper function to get high-contrast unified colors for dogs and owners according to stay status:
// 1. Released in past (checked_out / completed / cancelled / ended date in past) -> Light gray (text-slate-400)
// 2. Booked (reserved / not checked in yet - שוריין אך טרם נקלט) -> Prominent Vivid Purple (text-[#581c87], bg-purple-100/90, border-purple-300)
// 3. Releasing on this day (checked_in & releasing today - שוהה שמשתחרר באותו היום) -> Prominent Vivid Royal Blue (text-[#1e3a8a], bg-blue-100/95, border-blue-400)
// 4. Checked in (active stay / inside resort - שוהה פעיל בריזורט) -> Deep dark emerald green (text-[#065f46])
export function getStayStatusColors(
  stayStatus: Booking['stayStatus'] | string | undefined, 
  endDate: string, 
  todayStr: string,
  startDate?: string,
  currentDateStr?: string
) {
  const targetDate = currentDateStr || todayStr;

  const isEnded = stayStatus === 'checked_out' || 
                  (stayStatus as any) === 'completed' || 
                  stayStatus === 'cancelled' || 
                  (Boolean(endDate) && Boolean(currentDateStr) ? endDate < currentDateStr : endDate < todayStr);

  if (isEnded) {
    return {
      isEnded: true,
      isCheckedIn: false,
      isBooked: false,
      isReleasing: false,
      dogClass: 'text-slate-400 font-bold',
      ownerClass: 'text-slate-400 font-bold text-[11px]',
      textClass: 'text-slate-400',
      cardBorderBg: 'bg-slate-100/80 border-slate-200 hover:border-slate-300 opacity-75',
      monthChipBg: 'bg-slate-100 border-slate-200 text-slate-400 font-medium',
      iconClass: 'text-slate-400',
      badgeLabel: 'שוחרר'
    };
  }

  // 2. Booked / Reserved (שוריין אך טרם נקלט בצ'ק אין) -> סגול בולט ומודגש
  const isBooked = stayStatus === 'booked' || (!stayStatus && startDate && startDate > targetDate);
  if (isBooked) {
    return {
      isEnded: false,
      isCheckedIn: false,
      isBooked: true,
      isReleasing: false,
      dogClass: 'text-[#581c87] font-black', // Deep rich purple, high contrast
      ownerClass: 'text-[#6b21a8] font-black text-[11px]', // Vivid purple
      textClass: 'text-[#581c87]',
      cardBorderBg: 'bg-purple-100/90 border-purple-300 hover:border-purple-400 hover:bg-purple-100 text-[#581c87] shadow-2xs ring-1 ring-purple-300/60',
      monthChipBg: 'bg-purple-100 border-purple-300 text-[#581c87] font-black',
      iconClass: 'text-[#7e22ce]',
      badgeLabel: 'שוריין (טרם נקלט)'
    };
  }

  // 3. Releasing on this day (משתחרר באותו היום - כחול רויאל בולט ומודגש)
  const isReleasing = Boolean(endDate) && endDate === targetDate && stayStatus !== 'cancelled';
  if (isReleasing) {
    return {
      isEnded: false,
      isCheckedIn: true,
      isBooked: false,
      isReleasing: true,
      dogClass: 'text-[#1e3a8a] font-black', // Deep vivid royal blue, high contrast
      ownerClass: 'text-[#1d4ed8] font-black text-[10px]', // Deep royal blue
      textClass: 'text-[#1e3a8a]',
      cardBorderBg: 'bg-blue-100/95 border-blue-400 hover:border-blue-500 hover:bg-blue-100 text-[#1e3a8a] shadow-2xs ring-1 ring-blue-400/70',
      monthChipBg: 'bg-blue-100 border-blue-400 text-[#1e3a8a] font-black',
      iconClass: 'text-[#2563eb]',
      badgeLabel: 'משתחרר היום'
    };
  }

  // 4. Checked In (שוהה פעיל בריזורט - ירוק אמרלד עמוק)
  return {
    isEnded: false,
    isCheckedIn: true,
    isBooked: false,
    isReleasing: false,
    dogClass: 'text-[#065f46] font-black', // Deep dark emerald green, high sunlight contrast
    ownerClass: 'text-[#065f46] font-black text-[11px]', // Unified exact same color
    textClass: 'text-[#065f46]',
    cardBorderBg: 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50 shadow-2xs',
    monthChipBg: 'bg-emerald-50 border-emerald-300 text-[#065f46] font-black',
    iconClass: 'text-[#065f46]',
    badgeLabel: 'שוהה'
  };
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
  const [displayMode, setDisplayMode] = useState<CalendarDisplayMode>('two_weeks');
  const [focusedDate, setFocusedDate] = useState<string>(todayStr);
  const [greetingModalDate, setGreetingModalDate] = useState<string | null>(null);
  const [hoveredHousehold, setHoveredHousehold] = useState<string | null>(null);
  const [hoveredBookingId, setHoveredBookingId] = useState<string | null>(null);

  // Search state for Shmulik (חיפוש ביומן לפי שם כלב או בעלים)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeBookings = bookings.filter(b => b.stayStatus !== 'cancelled');

  // Filter bookings for live search
  const matchingBookings = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const qNorm = q.replace(/[״"׳']/g, '').replace(/[יו]/g, '');
    const qDigits = q.replace(/\D/g, '');

    return activeBookings.filter(b => {
      const dog = (b.dogName || '').toLowerCase();
      const dogNorm = dog.replace(/[״"׳']/g, '').replace(/[יו]/g, '');
      const breed = (b.dogBreed || '').toLowerCase();
      const owner = (b.ownerName || '').toLowerCase();
      const ownerNorm = owner.replace(/[״"׳']/g, '').replace(/[יו]/g, '');
      const phoneDigits = (b.ownerPhone || '').replace(/\D/g, '');

      return (
        dog.includes(q) ||
        (qNorm.length >= 2 && dogNorm.includes(qNorm)) ||
        breed.includes(q) ||
        owner.includes(q) ||
        (qNorm.length >= 2 && ownerNorm.includes(qNorm)) ||
        (qDigits.length >= 3 && phoneDigits.includes(qDigits))
      );
    }).sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [activeBookings, searchQuery]);

  // Jump calendar view directly to the selected booking date
  const handleSelectSearchResult = (booking: Booking) => {
    setFocusedDate(booking.startDate);
    const bDate = new Date(booking.startDate + 'T12:00:00');
    if (onSetMonth && bDate.getMonth() !== currentMonth) {
      onSetMonth(bDate.getMonth());
    }
    if (onSetYear && bDate.getFullYear() !== currentYear) {
      onSetYear(bDate.getFullYear());
    }
    setIsSearchDropdownOpen(false);
    onSelectBooking(booking);
  };

  const daysGrid = getMonthGrid(currentYear, currentMonth);
  const weekDays = getWeekDays(focusedDate);
  const dayBreakdown = getDailyBreakdown(activeBookings, focusedDate);

  // Two weeks view computation (14 days starting from focusedDate)
  const twoWeeksDays = React.useMemo(() => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      const dStr = addDays(focusedDate, i);
      const d = new Date(dStr + 'T12:00:00');
      days.push({
        dateStr: dStr,
        dayName: HEBREW_DAYS[d.getDay()],
        dayNumber: d.getDate(),
        monthNumber: d.getMonth() + 1,
        isToday: dStr === todayStr,
      });
    }
    return days;
  }, [focusedDate, todayStr]);

  const twoWeeksStart = twoWeeksDays[0]?.dateStr || focusedDate;
  const twoWeeksEnd = twoWeeksDays[13]?.dateStr || focusedDate;
  const twoWeeksActiveBookings = activeBookings.filter(b => b.startDate <= twoWeeksEnd && b.endDate >= twoWeeksStart);
  const twoWeeksUniqueDogs = new Set(twoWeeksActiveBookings.map(b => b.dogName)).size;

  const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const lastDayInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDayInMonth).padStart(2, '0')}`;
  const monthActiveBookings = activeBookings.filter(b => b.startDate <= monthEnd && b.endDate >= monthStart);
  const monthUniqueDogs = new Set(monthActiveBookings.map(b => b.dogName)).size;

  const weekStart = weekDays[0].dateStr;
  const weekEnd = weekDays[6].dateStr;
  const weekActiveBookings = activeBookings.filter(b => b.startDate <= weekEnd && b.endDate >= weekStart);
  const weekUniqueDogs = new Set(weekActiveBookings.map(b => b.dogName)).size;

  const handlePrevTwoWeeks = () => {
    setFocusedDate(prev => addDays(prev, -14));
  };

  const handleNextTwoWeeks = () => {
    setFocusedDate(prev => addDays(prev, 14));
  };

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
      
      {/* Top Controls: Navigation Toolbar + Dog/Owner Search + View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-4 pb-4 border-b border-slate-100">
        
        {/* Navigation Controls */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
          
          {displayMode === 'month' && (
            <>
              {/* Prev Month Button (RTL: right arrow goes to previous) */}
              <button
                type="button"
                onClick={onPrevMonth}
                title="חודש קודם"
                className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
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
                className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
              >
                <span>הבא</span>
                <span>‹</span>
              </button>
            </>
          )}

          {displayMode === 'two_weeks' && (
            <>
              <button
                type="button"
                onClick={handlePrevTwoWeeks}
                className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
                title="14 ימים קודמים"
              >
                <span>›</span>
                <span>שבועיים קודמים</span>
              </button>

              <div className="font-extrabold text-xs sm:text-sm text-emerald-950 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-300 shadow-2xs">
                {formatDateIL(twoWeeksStart)} - {formatDateIL(twoWeeksEnd)}
              </div>

              <button
                type="button"
                onClick={handleNextTwoWeeks}
                className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
                title="14 ימים הבאים"
              >
                <span>שבועיים הבאים</span>
                <span>‹</span>
              </button>
            </>
          )}

          {displayMode === 'week' && (
            <>
              <button
                type="button"
                onClick={handlePrevWeek}
                className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
              >
                <span>›</span>
                <span>שבוע קודם</span>
              </button>

              <div className="font-bold text-xs sm:text-sm text-slate-800 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
                {formatDateIL(weekDays[0].dateStr)} - {formatDateIL(weekDays[6].dateStr)}
              </div>

              <button
                type="button"
                onClick={handleNextWeek}
                className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
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
                className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
              >
                <span>›</span>
                <span>יום קודם</span>
              </button>

              <div className="font-bold text-xs sm:text-sm text-emerald-900 bg-white px-3 py-2 rounded-xl border border-emerald-200 shadow-2xs">
                {formatFullHebrewDate(focusedDate)}
              </div>

              <button
                type="button"
                onClick={handleNextDay}
                className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-3.5 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            היום
          </button>
        </div>

        {/* Center: Search Bar for Shmulik (חיפוש ביומן לפי שם כלב או בעלים) */}
        <div ref={searchContainerRef} className="relative flex-1 min-w-[220px] max-w-sm sm:max-w-md">
          <div className="relative flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchDropdownOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (matchingBookings.length > 0) {
                    handleSelectSearchResult(matchingBookings[0]);
                  }
                }
                if (e.key === 'Escape') {
                  setIsSearchDropdownOpen(false);
                }
              }}
              onFocus={() => {
                if (searchQuery.trim()) setIsSearchDropdownOpen(true);
              }}
              placeholder="חיפוש ביומן לפי שם כלב או בעלים (Enter למעבר)..."
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-emerald-600 rounded-xl pr-10 pl-9 py-2 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-hidden transition-all shadow-2xs focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              type="button"
              onClick={() => {
                if (matchingBookings.length > 0) {
                  handleSelectSearchResult(matchingBookings[0]);
                } else if (searchQuery.trim()) {
                  setIsSearchDropdownOpen(true);
                }
              }}
              className="absolute inset-y-0 right-0 pr-3 pl-2 flex items-center text-emerald-600 hover:text-emerald-800 cursor-pointer active:scale-95 transition-transform"
              title="חפש ועבור לתוצאה הראשונה"
            >
              <Search className="w-4 h-4" />
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchDropdownOpen(false);
                }}
                className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                title="נקה חיפוש"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Interactive Search Dropdown */}
          {isSearchDropdownOpen && searchQuery.trim().length > 0 && (
            <div className="absolute z-50 mt-1.5 w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-80 overflow-y-auto animate-in fade-in duration-150">
              <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>נמצאו {matchingBookings.length} הזמנות ביומן</span>
                <span className="text-[11px] text-emerald-700 font-semibold">לחץ למעבר ישיר לתאריך</span>
              </div>
              {matchingBookings.length === 0 ? (
                <div className="p-5 text-center text-slate-500 text-xs font-medium">
                  לא נמצאו הזמנות עבור "{searchQuery}"
                </div>
              ) : (
                matchingBookings.map((b) => {
                  const isPast = b.endDate < todayStr;
                  const isCurrent = b.startDate <= todayStr && b.endDate >= todayStr;
                  return (
                    <div
                      key={b.id}
                      onClick={() => handleSelectSearchResult(b)}
                      className="p-3 border-b border-slate-100 last:border-0 hover:bg-emerald-50/80 transition-all cursor-pointer flex items-center justify-between gap-3 text-right"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                          🐾
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-sm text-slate-900">{b.dogName}</span>
                            {b.dogBreed && <span className="text-xs text-slate-500">({b.dogBreed})</span>}
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700">
                              {getServiceTypeHebrew(b.serviceType)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>בעלים: <strong className="text-slate-800">{b.ownerName}</strong></span>
                            {b.ownerPhone && <span className="font-mono text-[11px]" dir="ltr">📞 {b.ownerPhone}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <div className="text-xs font-bold text-slate-800">
                          {formatDateIL(b.startDate)} - {formatDateIL(b.endDate)}
                        </div>
                        <div className="mt-0.5">
                          {isCurrent ? (
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              שוהה כעת בריזורט
                            </span>
                          ) : isPast ? (
                            <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                              שהות עבר
                            </span>
                          ) : (
                            <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                              שהות עתידית
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* View Mode Toggle: חודש / שבועיים קרובים / שבוע / יום בודד - הצמדה ישירה לתפריט */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0 shadow-2xs">
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
            onClick={() => {
              setDisplayMode('two_weeks');
              setFocusedDate(todayStr);
            }}
            className={`flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              displayMode === 'two_weeks'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5 text-emerald-600" />
            <span>שבועיים קרובים</span>
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
            <Clock className="w-3.5 h-3.5" />
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

      {/* Active Search Filter Banner */}
      {searchQuery.trim() && (
        <div className="mb-4 -mt-2 flex items-center justify-between bg-amber-50/90 border border-amber-300 rounded-2xl px-4 py-2.5 text-xs font-bold text-amber-950 animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">🔍</span>
            <span>סינון פעיל ביומן:</span>
            <span className="bg-amber-200/90 px-2 py-0.5 rounded-md font-black text-amber-950">
              "{searchQuery}"
            </span>
            <span className="text-amber-800">
              (נמצאו {matchingBookings.length} הזמנות תואמות — מודגשות בצהוב זוהר בלוח)
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setIsSearchDropdownOpen(false);
            }}
            className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs shrink-0"
          >
            איפוס חיפוש ✕
          </button>
        </div>
      )}

      {/* Mini Legend for Dog Status & Payment Colors */}
      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white/85 backdrop-blur-xs px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs w-fit mb-3 flex-wrap">
        <span className="text-[11px] text-slate-400 font-bold">שהייה:</span>
        <span className="flex items-center gap-1.5 text-[#065f46] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300 font-black">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>שוהה בריזורט</span>
        </span>
        <span className="flex items-center gap-1.5 text-[#1e3a8a] bg-blue-100 px-2 py-0.5 rounded-md border border-blue-400 font-black">
          <span>🚪</span>
          <span>משתחרר ביום זה</span>
        </span>
        <span className="flex items-center gap-1.5 text-[#581c87] bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 font-black">
          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
          <span>שוריין לעתיד</span>
        </span>
        <span className="flex items-center gap-1.5 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 font-normal">
          <span>🏁</span>
          <span>שוחרר (עבר)</span>
        </span>

        <span className="text-slate-300 mx-1">|</span>

        <span className="text-[11px] text-slate-400 font-bold">תשלום:</span>
        <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50/90 px-1.5 py-0.5 rounded-md border border-emerald-200 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>שולם מלא</span>
        </span>
        <span className="flex items-center gap-1 text-amber-900 bg-amber-50/90 px-1.5 py-0.5 rounded-md border border-amber-300 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>שולמה מקדמה (נותר חוב)</span>
        </span>
        <span className="flex items-center gap-1 text-red-700 bg-red-50/90 px-1.5 py-0.5 rounded-md border border-red-200 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span>חוב פתוח (0₪ מקדמה)</span>
        </span>
      </div>

      {/* =========================================================================
          MODE: TWO WEEKS VIEW (תצוגת שבועיים קרובים - 14 ימים עם כל הכלבים ומקומות פנויים ללא הסתרה)
         ========================================================================= */}
      {displayMode === 'two_weeks' && (
        <div className="animate-in fade-in space-y-4" dir="rtl">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4 items-start">
            {twoWeeksDays.map((day) => {
              const dayBookings = getBookingsForDate(activeBookings, day.dateStr);
              const isToday = day.isToday;
              const activeStayingBookings = dayBookings.filter(b => b.stayStatus !== 'checked_out');
              const occupiedCount = activeStayingBookings.length;
              const maxCap = settings.maxCapacity;
              const freeSpots = Math.max(0, maxCap - occupiedCount);
              const isFull = occupiedCount >= maxCap;
              const occupancyPercent = Math.min(100, Math.round((occupiedCount / maxCap) * 100));
              const exactOccupancyPercent = maxCap > 0 ? Math.round((occupiedCount / maxCap) * 100) : 0;
              const holidayInfo = getDateShabbatOrHoliday(day.dateStr);

              return (
                <div
                  key={day.dateStr}
                  className={`rounded-2xl border p-3 flex flex-col justify-start transition-all ${
                    isToday
                      ? 'bg-emerald-50/70 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                      : holidayInfo.isYomKippur
                      ? 'bg-purple-50/40 border-purple-200 hover:border-purple-300 shadow-2xs hover:shadow-xs'
                      : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs'
                  }`}
                >
                  {/* Header: Day Name + Date (Right) & Badges (Left empty space) */}
                  <div className="pb-2 border-b border-slate-200 flex items-start justify-between gap-1.5 min-h-[46px]">
                    <div className="flex flex-col justify-center">
                      <span className="font-extrabold text-sm text-slate-900 leading-tight">
                        יום {day.dayName}
                      </span>
                      <span className="text-xs text-slate-500 font-medium leading-tight mt-0.5">
                        {formatDateIL(day.dateStr)}
                      </span>
                    </div>

                    {/* Left side empty space: Badges */}
                    <div className="flex flex-col items-end justify-center gap-1 shrink-0">
                      {isToday && (
                        <span className="text-[11px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
                          היום ⭐
                        </span>
                      )}
                      {holidayInfo.calendarBadge && (
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-lg font-black inline-flex items-center gap-1 shadow-2xs tracking-wide ${holidayInfo.calendarBadge.badgeClass}`}
                          title={holidayInfo.calendarBadge.label}
                        >
                          <span>{holidayInfo.calendarBadge.icon}</span>
                          <span>{holidayInfo.calendarBadge.label}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Occupancy & Free Spots Badge (בצורה מלאה ולא מוסתרת) */}
                  <div className={`my-2 p-2 rounded-xl border ${
                    isFull
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : freeSpots <= 3
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span>תפוסה: {occupiedCount}/{maxCap}</span>
                      <span>
                        {isFull ? (
                          <span className="text-red-700 font-black">{exactOccupancyPercent}% תפוסה 🔴</span>
                        ) : (
                          <span className="text-emerald-700 font-black">{exactOccupancyPercent}% תפוסה ({freeSpots} פנויים)</span>
                        )}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-slate-200/60">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isFull
                            ? 'bg-red-500'
                            : occupiedCount > maxCap * 0.7
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${occupancyPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons: שריין מקום פנוי + פירוט יום (מתחת לתפוסה ולפני רשימת הכלבים) */}
                  <div className="space-y-1.5 mb-2.5">
                    {/* Free Spot Quick Booking Action */}
                    {freeSpots > 0 && (
                      <button
                        type="button"
                        onClick={() => onNewBookingForDate(day.dateStr)}
                        className="w-full py-1.5 px-2 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 hover:text-emerald-900 border border-dashed border-emerald-400 hover:border-emerald-500 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs group"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                        <span>שריין מקום פנוי ({freeSpots} נותרו)</span>
                      </button>
                    )}

                    {/* Day Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectDate(day.dateStr)}
                        className="flex-1 text-center bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                      >
                        פירוט יום
                      </button>

                      {/* Shabbat / Holiday Greeting Button in Two-Weeks View */}
                      {holidayInfo.isSpecial && dayBookings.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGreetingModalDate(day.dateStr);
                          }}
                          title={`שלח ד״ש ${holidayInfo.label} לכל בעלי הכלבים של יום זה`}
                          className="bg-[#25D366] hover:bg-[#1EBE5D] text-white text-[11px] font-black px-2 py-1.5 rounded-lg transition-all cursor-pointer shadow-2xs flex items-center gap-0.5 shrink-0"
                        >
                          <span>📲</span>
                          <span>ד״ש</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onNewBookingForDate(day.dateStr)}
                        title="הוסף הזמנה ליום זה"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Clean List of Dogs (שם הכלב בלבד ללא עומס) */}
                  <div className="space-y-1.5 flex-1">
                    {dayBookings.length === 0 ? (
                      <div className="text-center py-4 px-2 bg-white/70 rounded-xl border border-dashed border-slate-200">
                        <span className="text-xs text-slate-400 font-bold block">אין כלבים ביום זה</span>
                        <span className="text-[11px] text-emerald-600 font-medium">כל {maxCap} המקומות פנויים</span>
                      </div>
                    ) : (
                      dayBookings.map((b, bIdx) => {
                        const isEnded = b.stayStatus === 'checked_out' || (b.endDate < todayStr);
                        const remainingDebt = Math.max(0, Math.round((Number(b.totalPrice) || 0) - (Number(b.depositAmount) || 0)));
                        const isPaid = b.paymentStatus === 'fully_paid' || (remainingDebt === 0 && (Number(b.totalPrice) || 0) > 0);
                        const isDeposit = !isPaid && (b.paymentStatus === 'deposit_paid' || (Number(b.depositAmount) || 0) > 0);
                        const isUnpaid = !isPaid && !isDeposit && !b.isFreeStay && (Number(b.totalPrice) || 0) > 0;
                        const isMatch = Boolean(searchQuery.trim() && matchingBookings.some(m => m.id === b.id));
                        const isDimmed = Boolean(searchQuery.trim() && !isMatch);
                        const stayColors = getStayStatusColors(b.stayStatus, b.endDate, todayStr, b.startDate, day.dateStr);

                        // Pair detection & connected UI styling
                        const pairInfo = getBookingPairInfo(b, dayBookings);
                        const isPairHovered = Boolean(hoveredHousehold && hoveredHousehold === pairInfo.householdKey && pairInfo.isPair);
                        const isSingleHovered = Boolean(hoveredBookingId && hoveredBookingId === b.id && !pairInfo.isPair);
                        const prevSibling = bIdx > 0 && getBookingPairInfo(dayBookings[bIdx - 1], dayBookings).householdKey === pairInfo.householdKey && pairInfo.isPair;
                        const nextSibling = bIdx < dayBookings.length - 1 && getBookingPairInfo(dayBookings[bIdx + 1], dayBookings).householdKey === pairInfo.householdKey && pairInfo.isPair;

                        let cardClasses = `px-2 py-1.5 border transition-all cursor-pointer text-xs font-black flex items-center justify-between shadow-2xs hover:shadow-xs gap-1 relative `;
                        if (prevSibling && nextSibling) {
                          cardClasses += 'rounded-md ';
                        } else if (prevSibling) {
                          cardClasses += 'rounded-xl rounded-t-xs -mt-0.5 ';
                        } else if (nextSibling) {
                          cardClasses += 'rounded-xl rounded-b-xs ';
                        } else {
                          cardClasses += 'rounded-xl ';
                        }

                        if (isMatch) {
                          cardClasses += 'bg-amber-100 border-amber-400 text-amber-950 ring-2 ring-amber-400 shadow-md scale-[1.03]';
                        } else if (isPairHovered) {
                          cardClasses += 'bg-indigo-100/90 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500 shadow-md scale-[1.02] z-10';
                        } else if (isSingleHovered) {
                          cardClasses += 'bg-emerald-100/90 border-emerald-400 text-emerald-950 ring-2 ring-emerald-500 shadow-md scale-[1.02] z-10';
                        } else if (isDimmed) {
                          cardClasses += 'bg-white/60 border-slate-200 text-slate-400 opacity-30 hover:opacity-90';
                        } else if (pairInfo.isPair) {
                          cardClasses += `${stayColors.cardBorderBg} border-r-[3.5px] border-r-indigo-500`;
                        } else {
                          cardClasses += stayColors.cardBorderBg;
                        }

                        const tooltipTitle = `${b.dogName} (${b.ownerName}) - ${getServiceTypeHebrew(b.serviceType)}${
                          pairInfo.isPair ? ` - 🔗 זוג כלבים (${pairInfo.isSecondary ? `שולם דרך ${pairInfo.siblingNames}` : `יחד עם ${pairInfo.siblingNames}`})` : ''
                        }${
                          stayColors.isReleasing ? ' (משתחרר ביום זה!)' : isEnded ? ' (שוחרר הביתה)' : b.stayStatus === 'checked_in' ? ' (שוהה כעת בריזורט)' : ' (שוריין)'
                        } - תשלום: ${
                          b.isFreeStay 
                            ? `שולם במלואו (דרך כרטיס ${pairInfo.siblingNames || 'ראשון'})` 
                            : isPaid 
                            ? `שולם במלואו (₪${b.totalPrice})` 
                            : isDeposit 
                            ? `שולמה מקדמה ₪${b.depositAmount} (יתרה ₪${remainingDebt})` 
                            : `לא שולם (חוב ₪${remainingDebt || b.totalPrice})`
                        }`;

                        return (
                          <div
                            key={b.id}
                            onClick={() => onSelectBooking(b, day.dateStr)}
                            onMouseEnter={() => {
                              setHoveredBookingId(b.id);
                              if (pairInfo.isPair) {
                                setHoveredHousehold(pairInfo.householdKey);
                              }
                            }}
                            onMouseLeave={() => {
                              setHoveredBookingId(null);
                              setHoveredHousehold(null);
                            }}
                            className={cardClasses}
                            title={tooltipTitle}
                          >
                            <span className="flex items-center gap-1 truncate min-w-0 flex-1">
                              {isTrainingBooking(b) ? (
                                <img
                                  src="/resort-logo.svg"
                                  alt="אילוף"
                                  title="כלב בתהליך אילוף"
                                  className="w-3.5 h-3.5 object-contain shrink-0 rounded-full"
                                />
                              ) : (
                                <span className={`text-[11px] shrink-0 ${isMatch ? 'text-amber-700' : isPairHovered ? 'text-indigo-700' : isSingleHovered ? 'text-emerald-700' : stayColors.iconClass}`}>🐾</span>
                              )}
                              <span className="truncate text-[11px] sm:text-xs">
                                <span className={isMatch ? 'text-amber-950 font-black' : isPairHovered ? 'text-indigo-950 font-black' : isSingleHovered ? 'text-emerald-950 font-black' : stayColors.dogClass}>{b.dogName}</span>{' '}
                                <span className={isMatch ? 'text-amber-900 font-bold text-[10px]' : isPairHovered ? 'text-indigo-900 font-bold text-[10px]' : isSingleHovered ? 'text-emerald-900 font-bold text-[10px]' : stayColors.ownerClass}>({b.ownerName})</span>
                              </span>
                            </span>
                            {isEnded ? (
                              <span className="text-[9px] bg-slate-200 text-slate-600 font-bold px-1 py-0.2 rounded flex items-center gap-0.5 shrink-0" title="שוחרר הביתה">
                                <span>🏁</span>
                                <span>שוחרר</span>
                              </span>
                            ) : (
                              <div className="flex items-center gap-1 shrink-0">
                                {stayColors.isReleasing && (
                                  <span className="text-xs leading-none shrink-0" title="משתחרר ביום זה">
                                    🚪
                                  </span>
                                )}
                                {isUnpaid && !stayColors.isReleasing && (
                                  <span className="text-[9px] bg-red-100 text-red-700 font-black px-1 rounded flex items-center leading-none" title={`שריין מקום ללא מקדמה! חוב: ₪${remainingDebt}`}>
                                    0₪
                                  </span>
                                )}
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    isPaid || b.isFreeStay
                                      ? 'bg-emerald-500'
                                      : isDeposit
                                      ? 'bg-amber-400'
                                      : 'bg-red-500'
                                  }`}
                                  title={
                                    b.isFreeStay
                                      ? `שולם במלואו (דרך כרטיס ${pairInfo.siblingNames || 'ראשון'})`
                                      : isPaid
                                      ? `שולם במלואו (₪${b.totalPrice || 0})`
                                      : isDeposit
                                      ? `שולמה מקדמה ₪${b.depositAmount} (נותרו ₪${remainingDebt})`
                                      : `חוב פתוח ₪${remainingDebt || b.totalPrice}`
                                  }
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              const holidayInfo = getDateShabbatOrHoliday(dayObj.dateStr);

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
                  {/* Day Header (Number + Holiday Badge + Occupancy Count) */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
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
                      {holidayInfo.calendarBadge && (
                        <span 
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded leading-none truncate max-w-[70px] shadow-2xs ${holidayInfo.calendarBadge.badgeClass}`}
                          title={holidayInfo.calendarBadge.label}
                        >
                          {holidayInfo.calendarBadge.icon} {holidayInfo.calendarBadge.shortLabel || holidayInfo.calendarBadge.label}
                        </span>
                      )}
                    </div>

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
                  <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-[58px] no-scrollbar">
                    {dateBookings.slice(0, 2).map((b) => {
                      const isEnded = b.stayStatus === 'checked_out' || (b.endDate < todayStr);
                      const isPaid = b.paymentStatus === 'fully_paid' || b.isFreeStay;
                      const isDeposit = b.paymentStatus === 'deposit_paid';
                      const isMatch = Boolean(searchQuery.trim() && matchingBookings.some(m => m.id === b.id));
                      const isDimmed = Boolean(searchQuery.trim() && !isMatch);
                      const stayColors = getStayStatusColors(b.stayStatus, b.endDate, todayStr, b.startDate, dayObj.dateStr);
                      const pairInfo = getBookingPairInfo(b, dateBookings);
                      const isPairHovered = Boolean(hoveredHousehold && hoveredHousehold === pairInfo.householdKey && pairInfo.isPair);
                      const isSingleHovered = Boolean(hoveredBookingId && hoveredBookingId === b.id && !pairInfo.isPair);

                      let chipStyle = stayColors.monthChipBg;
                      if (isMatch) {
                        chipStyle = 'bg-amber-500 text-white ring-2 ring-amber-300 font-black shadow-md';
                      } else if (isPairHovered) {
                        chipStyle = 'bg-indigo-600 text-white ring-2 ring-indigo-300 font-black shadow-md scale-[1.03] z-10';
                      } else if (isSingleHovered) {
                        chipStyle = 'bg-emerald-600 text-white ring-2 ring-emerald-300 font-black shadow-md scale-[1.03] z-10';
                      } else if (isDimmed) {
                        chipStyle = 'bg-slate-200/60 text-slate-400 opacity-30';
                      } else if (pairInfo.isPair) {
                        chipStyle += ' border-r-2 border-r-indigo-500';
                      }

                      return (
                        <div
                          key={b.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBooking(b, dayObj.dateStr);
                          }}
                          onMouseEnter={() => {
                            setHoveredBookingId(b.id);
                            if (pairInfo.isPair) {
                              setHoveredHousehold(pairInfo.householdKey);
                            }
                          }}
                          onMouseLeave={() => {
                            setHoveredBookingId(null);
                            setHoveredHousehold(null);
                          }}
                          className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold truncate flex items-center justify-between border cursor-pointer hover:scale-[1.02] transition-all ${chipStyle}`}
                          title={`${b.dogName} (${b.ownerName}) - ${getServiceTypeHebrew(b.serviceType)}${pairInfo.isPair ? ` - 🔗 זוג` : ''}${stayColors.isReleasing ? ' - משתחרר ביום זה!' : isEnded ? ' - הסתיים' : b.stayStatus === 'checked_in' ? ' - שוהה כעת' : ' - שוריין'}`}
                        >
                          <span className="truncate flex items-center gap-1 min-w-0">
                            {isTrainingBooking(b) ? (
                              <img
                                src="/resort-logo.svg"
                                alt="אילוף"
                                title="כלב בתהליך אילוף"
                                className="w-3 h-3 object-contain shrink-0 rounded-full"
                              />
                            ) : (
                              <span className="text-[10px] shrink-0">🐾</span>
                            )}
                            <span className={`truncate ${isMatch || isPairHovered || isSingleHovered ? 'text-white font-black' : stayColors.dogClass}`}>{b.dogName}</span>
                            <span className={`text-[9px] shrink-0 ${isMatch || isPairHovered || isSingleHovered ? 'text-white/90 font-medium' : stayColors.ownerClass}`}>({b.ownerName})</span>
                          </span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {isMatch && <span className="text-[9px]">⭐</span>}
                            {!isMatch && stayColors.isReleasing && <span className="text-[9px]" title="משתחרר ביום זה">🚪</span>}
                            {!isMatch && !stayColors.isReleasing && isEnded && <span className="text-[9px] opacity-70">🏁</span>}
                            {!isEnded && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isPaid
                                    ? 'bg-emerald-500'
                                    : isDeposit
                                    ? 'bg-amber-400'
                                    : 'bg-red-500'
                                }`}
                                title={isPaid ? (b.isFreeStay ? 'שולם במלואו (זוג)' : 'שולם מלא') : isDeposit ? 'שולמה מקדמה' : 'חוב פתוח'}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {dateBookings.length > 2 && (
                      <div className="text-[9px] text-center text-slate-500 font-bold">
                        +{dateBookings.length - 2} נוספים
                      </div>
                    )}
                  </div>

                  {/* Shabbat / Holiday Direct Greeting Button */}
                  {holidayInfo.isSpecial && dateBookings.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGreetingModalDate(dayObj.dateStr);
                      }}
                      className="w-full mt-1 bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 text-white text-[9px] font-black py-0.5 px-1 rounded-md flex items-center justify-center gap-1 shadow-2xs cursor-pointer transition-all hover:scale-102"
                      title={`שלח ד״ש ${holidayInfo.label} לכל בעלי הכלבים של יום זה`}
                    >
                      <span className="text-[10px]">📲</span>
                      <span>ד״ש לבעלים ({dateBookings.length})</span>
                    </button>
                  )}

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
              const holidayInfo = getDateShabbatOrHoliday(day.dateStr);

              return (
                <div
                  key={day.dateStr}
                  className={`rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                    isToday
                      ? 'bg-emerald-50/50 border-2 border-emerald-500 shadow-sm'
                      : holidayInfo.isYomKippur
                      ? 'bg-purple-50/40 border-purple-200 hover:border-purple-300 shadow-2xs hover:shadow-xs'
                      : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Header: Day Name + Date (Right) & Badges (Left empty area) */}
                  <div className="pb-2 border-b border-slate-200 flex items-start justify-between gap-1.5 min-h-[44px]">
                    <div className="flex flex-col justify-center">
                      <span className="font-extrabold text-sm text-slate-900 leading-tight">
                        יום {day.dayName}
                      </span>
                      <span className="text-xs text-slate-500 font-medium leading-tight mt-0.5">
                        {formatDateIL(day.dateStr)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end justify-center gap-1 shrink-0">
                      {isToday && (
                        <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
                          היום ⭐
                        </span>
                      )}
                      {holidayInfo.calendarBadge && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-lg font-black inline-flex items-center gap-1 shadow-2xs ${holidayInfo.calendarBadge.badgeClass}`}
                          title={holidayInfo.calendarBadge.label}
                        >
                          <span>{holidayInfo.calendarBadge.icon}</span>
                          <span>{holidayInfo.calendarBadge.label}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Occupancy Mini Progress Bar */}
                  <div className="my-2 bg-white p-2 rounded-xl border border-slate-200/80">
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span>תפוסה: {Math.round((dayBookings.length / Math.max(1, settings.maxCapacity)) * 100)}%</span>
                      <span className={isFull ? 'text-red-600 font-black' : 'text-slate-900'}>
                        {dayBookings.length}/{settings.maxCapacity} {isFull ? '🔴' : ''}
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
                        const isPaid = b.paymentStatus === 'fully_paid' || b.isFreeStay;
                        const isDeposit = b.paymentStatus === 'deposit_paid';
                        const isArrival = b.startDate === day.dateStr;
                        const isDeparture = b.endDate === day.dateStr;
                        const pairInfo = getBookingPairInfo(b, dayBookings);
                        const isPairHovered = Boolean(hoveredHousehold && hoveredHousehold === pairInfo.householdKey && pairInfo.isPair);
                        const isSingleHovered = Boolean(hoveredBookingId && hoveredBookingId === b.id && !pairInfo.isPair);

                        const isMatch = Boolean(searchQuery.trim() && matchingBookings.some(m => m.id === b.id));
                        const isDimmed = Boolean(searchQuery.trim() && !isMatch);
                        const stayColors = getStayStatusColors(b.stayStatus, b.endDate, todayStr, b.startDate, day.dateStr);

                        let cardClasses = `border rounded-xl p-2 text-xs transition-all cursor-pointer shadow-2xs `;
                        if (isMatch) {
                          cardClasses += 'bg-amber-50/90 border-2 border-amber-400 text-amber-950 ring-2 ring-amber-400/80 shadow-md scale-[1.02]';
                        } else if (isPairHovered) {
                          cardClasses += 'bg-indigo-100/90 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500 shadow-md scale-[1.02] z-10';
                        } else if (isSingleHovered) {
                          cardClasses += 'bg-emerald-100/90 border-emerald-400 text-emerald-950 ring-2 ring-emerald-500 shadow-md scale-[1.02] z-10';
                        } else if (isDimmed) {
                          cardClasses += 'bg-white/60 border-slate-200 text-slate-400 opacity-30 hover:opacity-90';
                        } else if (pairInfo.isPair) {
                          cardClasses += `${stayColors.cardBorderBg} border-r-[3.5px] border-r-indigo-500`;
                        } else {
                          cardClasses += stayColors.cardBorderBg;
                        }

                        return (
                          <div
                            key={b.id}
                            onClick={() => onSelectBooking(b)}
                            onMouseEnter={() => {
                              setHoveredBookingId(b.id);
                              if (pairInfo.isPair) {
                                setHoveredHousehold(pairInfo.householdKey);
                              }
                            }}
                            onMouseLeave={() => {
                              setHoveredBookingId(null);
                              setHoveredHousehold(null);
                            }}
                            className={cardClasses}
                            title={`${b.dogName} (${b.ownerName}) - ${getServiceTypeHebrew(b.serviceType)}${pairInfo.isPair ? ` - 🔗 זוג` : ''}${stayColors.isReleasing ? ' (משתחרר היום)' : isEnded ? ' (שוחרר)' : b.stayStatus === 'checked_in' ? ' (שוהה כעת)' : ' (שוריין)'}`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1 min-w-0">
                                {isTrainingBooking(b) ? (
                                  <img
                                    src="/resort-logo.svg"
                                    alt="אילוף"
                                    title="כלב בתהליך אילוף"
                                    className="w-3.5 h-3.5 object-contain shrink-0 rounded-full"
                                  />
                                ) : (
                                  <Dog className={`w-3 h-3 shrink-0 ${isMatch ? 'text-amber-700' : isPairHovered ? 'text-indigo-700' : isSingleHovered ? 'text-emerald-700' : stayColors.iconClass}`} />
                                )}
                                <span className="truncate">
                                  <span className={isMatch ? 'text-amber-950 font-black' : isPairHovered ? 'text-indigo-950 font-black' : isSingleHovered ? 'text-emerald-950 font-black' : stayColors.dogClass}>{b.dogName}</span>{' '}
                                  <span className={isMatch ? 'text-amber-900 font-bold text-[11px]' : isPairHovered ? 'text-indigo-900 font-bold text-[10px]' : isSingleHovered ? 'text-emerald-900 font-bold text-[10px]' : stayColors.ownerClass}>({b.ownerName})</span>
                                </span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                {isEnded ? '🏁 הסתיים' : getServiceTypeHebrew(b.serviceType)}
                              </span>
                            </div>

                            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                              <span>בעלים: <strong className={isMatch ? 'text-amber-950' : stayColors.ownerClass ? 'text-slate-800' : 'text-slate-700'}>{b.ownerName}</strong></span>
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
                                {isEnded ? 'הסתיים ושוחרר' : isPaid ? (b.isFreeStay ? 'שולם במלואו (זוג)' : 'שולם מלא') : isDeposit ? `מקדמה ₪${b.depositAmount}` : 'חוב פתוח'}
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

                  const isMatch = Boolean(searchQuery.trim() && matchingBookings.some(m => m.id === booking.id));
                  const isDimmed = Boolean(searchQuery.trim() && !isMatch);
                  const stayColors = getStayStatusColors(booking.stayStatus, booking.endDate, todayStr, booking.startDate, focusedDate);
                  const pairInfo = getBookingPairInfo(booking, dayBreakdown.all);
                  const isPairHovered = Boolean(hoveredHousehold && hoveredHousehold === pairInfo.householdKey && pairInfo.isPair);
                  const isSingleHovered = Boolean(hoveredBookingId && hoveredBookingId === booking.id && !pairInfo.isPair);

                  let cardClasses = `rounded-xl p-3.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between `;
                  if (isMatch) {
                    cardClasses += 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300 shadow-md scale-[1.01]';
                  } else if (isPairHovered) {
                    cardClasses += 'bg-indigo-50/90 border-2 border-indigo-400 ring-2 ring-indigo-300 shadow-md scale-[1.01]';
                  } else if (isSingleHovered) {
                    cardClasses += 'bg-emerald-50/90 border-2 border-emerald-400 ring-2 ring-emerald-300 shadow-md scale-[1.01]';
                  } else if (isDimmed) {
                    cardClasses += 'bg-white/60 border border-slate-200 opacity-30 hover:opacity-90';
                  } else {
                    cardClasses += stayColors.cardBorderBg;
                  }

                  return (
                    <div
                      key={booking.id}
                      onClick={() => onSelectBooking(booking)}
                      onMouseEnter={() => {
                        setHoveredBookingId(booking.id);
                        if (pairInfo.isPair) {
                          setHoveredHousehold(pairInfo.householdKey);
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredBookingId(null);
                        setHoveredHousehold(null);
                      }}
                      className={cardClasses}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            {isTrainingBooking(booking) ? (
                              <img
                                src="/resort-logo.svg"
                                alt="אילוף"
                                title="כלב בתהליך אילוף"
                                className="w-5 h-5 object-contain shrink-0 rounded-full"
                              />
                            ) : (
                              <span className={`text-base shrink-0 ${isPairHovered ? 'text-indigo-600' : isSingleHovered ? 'text-emerald-600' : ''}`}>🐾</span>
                            )}
                            <span className={`font-black text-base ${isMatch ? 'text-amber-950 font-black' : isPairHovered ? 'text-indigo-950 font-black' : isSingleHovered ? 'text-emerald-950 font-black' : stayColors.dogClass}`}>{booking.dogName}</span>
                            <span className={`text-xs font-bold ${isMatch ? 'text-amber-900 font-bold' : isPairHovered ? 'text-indigo-900 font-bold' : isSingleHovered ? 'text-emerald-900 font-bold' : stayColors.ownerClass}`}>({booking.ownerName})</span>
                            {booking.dogBreed && (
                              <span className="text-xs text-slate-500 font-normal">({booking.dogBreed})</span>
                            )}
                            <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-md">
                              {getServiceTypeHebrew(booking.serviceType)}
                            </span>
                            {stayColors.isReleasing && (
                              <span className="bg-sky-200 text-sky-950 text-[11px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs border border-sky-300">
                                <span>🚪</span>
                                <span>משתחרר היום!</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                            <span className="flex items-center gap-1 font-bold text-slate-800">
                              <User className="w-3 h-3 text-indigo-500" />
                              <span>בעלים: <strong className={isMatch ? 'text-amber-950' : stayColors.ownerClass ? 'text-slate-800' : 'text-slate-700'}>{booking.ownerName}</strong></span>
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
                              {isTrainingBooking(booking) ? (
                                <span className="inline-flex items-center gap-1">
                                  <img src="/resort-logo.svg" alt="אילוף" className="w-3.5 h-3.5 object-contain inline rounded-full" />
                                  <span>באילוף</span>
                                </span>
                              ) : (
                                '🐾 שוהה'
                              )}
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
                            : !booking.isFreeStay && (booking.totalPrice || 0) > 0 && booking.depositAmount === 0
                            ? 'bg-red-600 text-white'
                            : 'bg-red-500 text-white'
                        }`}>
                          {isPaid
                            ? `שולם מלא (₪${Math.round(booking.totalPrice)})`
                            : isDeposit
                            ? `מקדמה ₪${Math.round(booking.depositAmount)} (חוב ₪${remainingDebt})`
                            : !booking.isFreeStay && (booking.totalPrice || 0) > 0 && booking.depositAmount === 0
                            ? `⚠️ ₪0 מקדמה (חוב ₪${remainingDebt})`
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

      {/* Shabbat & Jewish Holiday Dog Greeting Modal */}
      {greetingModalDate && (
        <ShabbatHolidayGreetingModal
          dateStr={greetingModalDate}
          bookings={bookings}
          settings={settings}
          onClose={() => setGreetingModalDate(null)}
        />
      )}

    </div>
  );
};
