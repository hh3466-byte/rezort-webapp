import { IntakeRequest, Booking } from '../types';
import { cleanPhoneNumber } from './whatsappUtils';

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

  return bookings.some(b => {
    if (b.stayStatus === 'cancelled') return false;
    const bPhone = cleanPhoneNumber(b.ownerPhone);
    const bDog = normalizeHebrew(b.dogName);
    const phoneMatch = Boolean(bPhone && rPhone && (bPhone.slice(-7) === rPhone.slice(-7)));
    const dogMatch = Boolean(bDog && rDog && (bDog === rDog || bDog.includes(rDog) || rDog.includes(bDog)));
    return phoneMatch || (dogMatch && r.ownerName && (b.ownerName || '').includes(r.ownerName));
  });
};

/**
 * Age of an intake request in hours
 */
export const getIntakeRequestAgeHours = (r: IntakeRequest): number => {
  const created = new Date(r.createdAt || r.startDate).getTime();
  if (isNaN(created)) return 0;
  return (Date.now() - created) / (1000 * 60 * 60);
};

/**
 * Returns effective intake status: if an active booking exists, it is considered 'approved'
 */
export const getEffectiveIntakeStatus = (r: IntakeRequest, bookings: Booking[] = []): IntakeRequest['status'] => {
  if (r.status === 'approved') return 'approved';
  if (hasActiveBookingForIntake(r, bookings)) return 'approved';
  return r.status;
};

/**
 * Identifies if a request is unanswered (>24h without reply or marked 'לא ענה').
 * These are hidden from active treatment counters until the customer contacts again.
 */
export const isUnansweredIntakeRequest = (r: IntakeRequest, bookings: Booking[] = []): boolean => {
  if (r.status === 'approved' || hasActiveBookingForIntake(r, bookings)) return false;
  if (r.status === 'rejected') return false;
  const notes = r.internalNotes || '';
  const hasUnansweredNote = notes.includes('לא ענה') || notes.includes('תזכורת שיווקית');
  const isAgeOver24h = getIntakeRequestAgeHours(r) >= 24;
  return hasUnansweredNote || isAgeOver24h;
};

/**
 * Is this a brand new intake questionnaire waiting for initial review by Shmulik?
 * Must be pending, without notes, no active booking, and within 24h.
 */
export const isIntakeRequestNew = (r: IntakeRequest, bookings: Booking[] = []): boolean => {
  if (isUnansweredIntakeRequest(r, bookings)) return false;
  const effStatus = getEffectiveIntakeStatus(r, bookings);
  return effStatus === 'pending' && (!r.internalNotes || !r.internalNotes.trim());
};

/**
 * Is this an intake request actively in progress / waiting for payment?
 * (Excluded if customer already booked in calendar or unanswered >24h).
 */
export const isIntakeRequestInTreatment = (r: IntakeRequest, bookings: Booking[] = []): boolean => {
  if (isUnansweredIntakeRequest(r, bookings)) return false;
  const effStatus = getEffectiveIntakeStatus(r, bookings);
  return effStatus === 'payment_requested' || (effStatus === 'pending' && Boolean(r.internalNotes && r.internalNotes.trim()));
};
