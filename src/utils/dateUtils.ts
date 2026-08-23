import { Booking } from '../types';

export const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const HEBREW_DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

export const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

/**
 * Format YYYY-MM-DD to Israeli display format (DD/MM/YYYY)
 */
export function formatDateIL(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateDisplay(dateStr: string): string {
  return formatDateIL(dateStr);
}

export function getDayNameHebrew(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return HEBREW_DAYS[d.getDay()] || '';
}

/**
 * Format date string with Hebrew day name and month name
 */
export function formatFullHebrewDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const dayName = HEBREW_DAYS[d.getDay()];
  const day = d.getDate();
  const monthName = HEBREW_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `יום ${dayName}, ${day} ב${monthName} ${year}`;
}

/**
 * Calculate difference in days between two YYYY-MM-DD dates (inclusive of nights)
 */
export function calculateDaysCount(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate + 'T00:00:00').getTime();
  const end = new Date(endDate + 'T00:00:00').getTime();
  const diffTime = end - start;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Check if a booking is active on a specific date (YYYY-MM-DD)
 */
export function isBookingOnDate(booking: Booking, dateStr: string): boolean {
  if (booking.stayStatus === 'cancelled') return false;
  return dateStr >= booking.startDate && dateStr <= booking.endDate;
}

/**
 * Get the state of a booking on a specific date: 'arrival' | 'staying' | 'departure' | 'single_day'
 */
export function getBookingDayState(booking: Booking, dateStr: string): 'arrival' | 'staying' | 'departure' | 'single_day' | null {
  if (!isBookingOnDate(booking, dateStr)) return null;
  if (booking.startDate === booking.endDate) return 'single_day';
  if (dateStr === booking.startDate) return 'arrival';
  if (dateStr === booking.endDate) return 'departure';
  return 'staying';
}

/**
 * Get list of bookings for a specific date
 */
export function getBookingsForDate(bookings: Booking[], dateStr: string): Booking[] {
  return bookings.filter(b => isBookingOnDate(b, dateStr));
}

/**
 * Get daily arrivals, stayers, and departures for a specific date
 */
export function getDailyBreakdown(bookings: Booking[], dateStr: string) {
  const dayBookings = getBookingsForDate(bookings, dateStr);
  
  const arrivals = dayBookings.filter(b => b.startDate === dateStr);
  const departures = dayBookings.filter(b => b.endDate === dateStr && b.startDate !== dateStr);
  const staying = dayBookings.filter(b => b.startDate < dateStr && b.endDate > dateStr);

  return {
    total: dayBookings.length,
    arrivals,
    departures,
    staying,
    all: dayBookings
  };
}

/**
 * Check occupancy for date range and detect overbooking against maxCapacity
 */
export function checkRangeOccupancy(
  bookings: Booking[],
  startDate: string,
  endDate: string,
  maxCapacity: number,
  excludeBookingId?: string
) {
  const dates: { dateStr: string; count: number; isOverbooked: boolean }[] = [];
  let highestCount = 0;
  let hasOverbooking = false;
  const conflictDates: string[] = [];

  const curr = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (curr <= end) {
    const dateStr = curr.toISOString().split('T')[0];
    const active = bookings.filter(
      b => b.id !== excludeBookingId && b.stayStatus !== 'cancelled' && isBookingOnDate(b, dateStr)
    );
    const count = active.length;
    if (count > highestCount) highestCount = count;
    
    // If adding 1 new booking causes count + 1 > maxCapacity
    if (count >= maxCapacity) {
      hasOverbooking = true;
      conflictDates.push(dateStr);
    }

    dates.push({
      dateStr,
      count,
      isOverbooked: count >= maxCapacity
    });

    curr.setDate(curr.getDate() + 1);
  }

  return {
    dates,
    highestCount,
    hasOverbooking,
    conflictDates,
    maxCapacity
  };
}

/**
 * Get date string for today in YYYY-MM-DD
 */
export function getTodayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add days to YYYY-MM-DD
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Build calendar grid matrix for a given year & month (0-indexed month)
 */
export function getMonthGrid(year: number, month: number) {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
  const daysInMonth = lastDayOfMonth.getDate();

  const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

  const prevMonthYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  // Previous month trailing days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const dateStr = `${prevMonthYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    days.push({ dateStr, dayNumber: dayNum, isCurrentMonth: false });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    days.push({ dateStr, dayNumber: i, isCurrentMonth: true });
  }

  // Next month leading days to complete full 7-day rows
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const dateStr = `${nextMonthYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    days.push({ dateStr, dayNumber: i, isCurrentMonth: false });
  }

  return days;
}

/**
 * Get 7 days of the week containing a specific date (from Sunday to Saturday)
 */
export function getWeekDays(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay(); // 0 is Sunday
  
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dayOfWeek);

  const days: { dateStr: string; dayNumber: number; dayName: string; dayNameShort: string; isToday: boolean }[] = [];
  const todayStr = getTodayStr();

  for (let i = 0; i < 7; i++) {
    const curr = new Date(sunday);
    curr.setDate(sunday.getDate() + i);
    const currYear = curr.getFullYear();
    const currMonth = String(curr.getMonth() + 1).padStart(2, '0');
    const currDay = String(curr.getDate()).padStart(2, '0');
    const currDateStr = `${currYear}-${currMonth}-${currDay}`;

    days.push({
      dateStr: currDateStr,
      dayNumber: curr.getDate(),
      dayName: HEBREW_DAYS[i],
      dayNameShort: HEBREW_DAYS_SHORT[i],
      isToday: currDateStr === todayStr
    });
  }

  return days;
}

