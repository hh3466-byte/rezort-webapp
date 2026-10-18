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
  if (r.status === 'abandoned' || r.status === 'archived') return 'abandoned';
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
 * Rule 6: Check if an intake request is expired (dates passed and no active booking)
 */
export const isIntakeRequestExpired = (r: IntakeRequest, bookings: Booking[] = []): boolean => {
  if (r.status === 'approved' || hasActiveBookingForIntake(r, bookings)) return false;
  if (r.status === 'abandoned' || r.status === 'archived') return false;
  // Requests actively in progress or waiting for payment are NOT auto-expired - Shmulik is actively handling them!
  if ((r.status as string) === 'in_progress' || r.status === 'payment_requested') return false;

  const todayStr = new Date().toISOString().split('T')[0];
  const eDate = r.endDate;
  const sDate = r.startDate;
  // If end date has arrived/passed, or start date was in the past and no booking
  if (eDate && eDate <= todayStr) return true;
  if (sDate && sDate < todayStr) return true;
  return false;
};

/**
 * Checks if notes indicate Shmulik marked this request as cancelled / not relevant / removed
 */
export const isIntakeMarkedIrrelevant = (r: IntakeRequest): boolean => {
  if (!r.internalNotes) return false;
  const n = r.internalNotes;
  return n.includes('לא רלוונטי') || n.includes('הוסר מהרשימה') || n.includes('בוטל') || n.includes('הסר');
};

/**
 * Checks if the internal notes contain actual human notes written by staff (Shmulik),
 * as opposed to automated system/lead-webhook stamps.
 */
export const hasManualStaffNotes = (internalNotes?: string): boolean => {
  if (!internalNotes || !internalNotes.trim()) return false;
  const cleaned = internalNotes
    .replace(/הליד נקלט מקמפיין[^\n|]*/g, '')
    .replace(/הלקוח השלים טופס מודעה[^\n|]*/g, '')
    .replace(/פנייה ראשונית בוואטסאפ[^\n|]*/g, '')
    .replace(/\[📢 ליד מקמפיין[^\]]*\]/g, '')
    .replace(/\[💬 פנייה חדשה מוואטסאפ[^\]]*\]/g, '')
    .replace(/\[תזכורת מעקב[^\]]*\]/g, '')
    .replace(/\[הועבר לארכיון[^\]]*\]/g, '')
    .replace(/\[מזהה הודעה:[^\]]*\]/g, '')
    .replace(/\[נשלח שאלון[^\]]*\]/g, '')
    .replace(/\[נשלח קישור לתשלום Grow\]/g, '')
    .replace(/[|\s\-\:\.\,]+/g, '')
    .trim();
  return cleaned.length > 0;
};

/**
 * Identifies if a request is archived/abandoned.
 */
export const isUnansweredIntakeRequest = (r: IntakeRequest, bookings: Booking[] = []): boolean => {
  if (r.status === 'approved' || hasActiveBookingForIntake(r, bookings)) return false;
  if (r.status === 'rejected') return false;
  return r.status === 'abandoned' || r.status === 'archived';
};

/**
 * Is this a brand new intake questionnaire waiting for initial review by Shmulik?
 * Remains in 'new' until Shmulik adds manual notes, changes status to in_progress, sends payment, or archives/approves it.
 */
export const isIntakeRequestNew = (r: IntakeRequest, bookings: Booking[] = []): boolean => {
  if (r.status === 'abandoned' || r.status === 'archived' || r.status === 'rejected') return false;
  if ((r.status as string) === 'in_progress' || r.status === 'payment_requested') return false;
  if (isIntakeMarkedIrrelevant(r)) return false;
  if (isIntakeRequestExpired(r, bookings)) return false;
  const effStatus = getEffectiveIntakeStatus(r, bookings);
  return effStatus === 'pending' && !hasManualStaffNotes(r.internalNotes);
};

/**
 * Is this an intake request actively in progress / waiting for payment / follow-up?
 * Remains in treatment until explicitly approved or moved to archive.
 */
export const isIntakeRequestInTreatment = (r: IntakeRequest, bookings: Booking[] = []): boolean => {
  if (r.status === 'abandoned' || r.status === 'archived' || r.status === 'rejected') return false;
  if (isIntakeMarkedIrrelevant(r)) return false;
  const effStatus = getEffectiveIntakeStatus(r, bookings);
  if (effStatus === 'approved') return false;

  // 1. Explicit in_progress or payment_requested status (NEVER auto-expires!)
  if ((effStatus as string) === 'in_progress' || effStatus === 'payment_requested' || (r.status as string) === 'in_progress' || r.status === 'payment_requested') {
    return true;
  }

  // 2. Pending request that has human staff notes from Shmulik
  if (effStatus === 'pending' && hasManualStaffNotes(r.internalNotes)) {
    if (isIntakeRequestExpired(r, bookings)) return false;
    return true;
  }

  return false;
};




