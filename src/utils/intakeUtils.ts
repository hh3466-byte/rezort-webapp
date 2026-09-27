import { IntakeRequest, Booking } from '../types';
import { cleanPhoneNumber } from './whatsappUtils';
import { isShabbatOrHolidayRestricted } from './jewishCalendar';

export const normalizeHebrew = (str: string = '') => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[״"׳']/g, '')
    .replace(/ו{2,}/g, 'ו')
    .replace(/י{2,}/g, 'י');
};

/**
 * Checks if an intake request already matches an active (non-cancelled) booking in the calendar.
 * If yes, this customer has already been booked and handled!
 */
export const hasActiveBookingForIntake = (r: IntakeRequest, bookings: Booking[] = []): boolean => {
  if (!bookings || bookings.length === 0) return false;
  const rPhone = cleanPhoneNumber(r.ownerPhone);
  const rDog = normalizeHebrew(r.dogName);
  const rStart = r.startDate;
  const rEnd = r.endDate;

  return bookings.some(b => {
    if (b.stayStatus === 'cancelled') return false;
    const bPhone = cleanPhoneNumber(b.ownerPhone);
    const bDog = normalizeHebrew(b.dogName);
    
    // Must match the client phone
    const phoneMatch = Boolean(bPhone && rPhone && (bPhone.slice(-7) === rPhone.slice(-7)));
    if (!phoneMatch) return false;

    // Must match dog name
    const dogMatch = !rDog || !bDog || bDog === rDog || bDog.includes(rDog) || rDog.includes(bDog);
    if (!dogMatch) return false;

    // Crucial: Must match or overlap with the requested stay dates!
    // Past stays (e.g. ended before the requested startDate) must never mark a new stay request as booked!
    const bStart = b.startDate;
    const bEnd = b.endDate;
    if (rStart && rEnd && bStart && bEnd) {
      return bStart <= rEnd && bEnd >= rStart;
    }

    return false;
  });
};

/**
 * Calculates elapsed weekday hours between two dates, excluding:
 * - Friday after 14:00
 * - Entire Saturday (Shabbat)
 * - Jewish Holidays / Yom Tov restricted periods
 */
export const calculateWeekdayBusinessHours = (
  fromInput: Date | number | string,
  toInput: Date | number | string = new Date()
): number => {
  const from = new Date(fromInput).getTime();
  const to = new Date(toInput).getTime();
  if (isNaN(from) || isNaN(to) || to <= from) return 0;

  const ONE_HOUR = 60 * 60 * 1000;
  let current = from;
  let weekdayHours = 0;

  while (current < to) {
    const nextStep = Math.min(current + ONE_HOUR, to);
    const fractionOfHour = (nextStep - current) / ONE_HOUR;
    const checkDate = new Date(current);
    
    const day = checkDate.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
    const hour = checkDate.getHours();
    
    const isSaturday = day === 6;
    const isFridayAfternoon = day === 5 && hour >= 14;
    const holidayCheck = isShabbatOrHolidayRestricted(checkDate);

    // If it's not Saturday, not Friday afternoon, and not holiday restricted, count this hour
    if (!isSaturday && !isFridayAfternoon && !holidayCheck.isRestricted) {
      weekdayHours += fractionOfHour;
    }

    current = nextStep;
  }

  return weekdayHours;
};

/**
 * Age of an intake request in raw calendar hours
 */
export const getIntakeRequestAgeHours = (r: IntakeRequest): number => {
  const created = new Date(r.createdAt || r.startDate).getTime();
  if (isNaN(created)) return 0;
  return (Date.now() - created) / (1000 * 60 * 60);
};

/**
 * Age of an intake request in weekday business hours (pausing on Shabbat / Friday 14:00+ / Holidays)
 */
export const getIntakeRequestWeekdayAgeHours = (r: IntakeRequest, now: Date = new Date()): number => {
  const created = new Date(r.createdAt || r.startDate).getTime();
  if (isNaN(created)) return 0;
  return calculateWeekdayBusinessHours(created, now);
};

/**
 * Returns effective intake status: if an active booking exists, it is considered 'approved'
 */
export const getEffectiveIntakeStatus = (r: IntakeRequest, bookings: Booking[] = []): IntakeRequest['status'] => {
  if (r.status === 'approved') return 'approved';
  if (r.status === 'abandoned') return 'abandoned';
  if (hasActiveBookingForIntake(r, bookings)) return 'approved';
  return r.status;
};

/**
 * Extracts the latest action timestamp from the internal notes string (e.g. "[25/09 15:01] ...")
 */
export const getLatestActionDateFromNotes = (notes: string): Date | null => {
  if (!notes) return null;
  const regex = /\[(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})\]/g;
  const matches = [...notes.matchAll(regex)];
  if (!matches || matches.length === 0) return null;
  const lastMatch = matches[matches.length - 1];
  const [, d, m, hh, mm] = lastMatch;
  const nowYear = new Date().getFullYear();
  const date = new Date(nowYear, parseInt(m, 10) - 1, parseInt(d, 10), parseInt(hh, 10), parseInt(mm, 10));
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Identifies if a request is archived/abandoned.
 * Note: Per resort business rules, requests are never auto-hidden by a timer;
 * they remain visible in active tabs until Shmulik explicitly moves them to archive or books them.
 */
export const isUnansweredIntakeRequest = (r: IntakeRequest, bookings: Booking[] = []): boolean => {
  if (r.status === 'approved' || hasActiveBookingForIntake(r, bookings)) return false;
  if (r.status === 'rejected') return false;
  return r.status === 'abandoned';
};

/**
 * Is this a brand new intake questionnaire waiting for initial review by Shmulik?
 * Remains in 'new' until Shmulik adds notes, records a call, sends a payment link, or archives/approves it.
 */
export const isIntakeRequestNew = (r: IntakeRequest, bookings: Booking[] = []): boolean => {
  if (r.status === 'abandoned' || r.status === 'rejected') return false;
  const effStatus = getEffectiveIntakeStatus(r, bookings);
  return effStatus === 'pending' && (!r.internalNotes || !r.internalNotes.trim());
};

/**
 * Is this an intake request actively in progress / waiting for payment / follow-up?
 * Remains in treatment until explicitly approved or moved to archive.
 */
export const isIntakeRequestInTreatment = (r: IntakeRequest, bookings: Booking[] = []): boolean => {
  if (r.status === 'abandoned' || r.status === 'rejected') return false;
  const effStatus = getEffectiveIntakeStatus(r, bookings);
  return effStatus === 'payment_requested' || (effStatus === 'pending' && Boolean(r.internalNotes && r.internalNotes.trim()));
};



