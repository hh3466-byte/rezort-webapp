import { Booking } from '../types';
import { cleanPhoneNumber } from './whatsappUtils';
import { formatDateIL, getTodayStr } from './dateUtils';

export interface PastStayDebtItem {
  bookingId: string;
  dogName: string;
  startDate: string;
  endDate: string;
  datesText: string;
  totalPrice: number;
  depositAmount: number;
  debtAmount: number;
  notes?: string;
}

export interface CustomerPastDebtSummary {
  hasPastDebt: boolean;
  totalDebt: number;
  pastStays: PastStayDebtItem[];
}

/**
 * Rule 21: Finds if a returning client has an unsettled past debt.
 * Debts are ONLY surfaced when a client reaches out again (new intake or CRM inquiry),
 * and NEVER shown on daily routine sanity reports.
 */
export function findCustomerPastDebt(
  phone: string,
  ownerName: string = '',
  bookings: Booking[] = []
): CustomerPastDebtSummary {
  const pClean = cleanPhoneNumber(phone || '');
  const oName = (ownerName || '').trim().toLowerCase();

  if (!pClean && !oName) {
    return { hasPastDebt: false, totalDebt: 0, pastStays: [] };
  }

  const todayStr = getTodayStr();
  const pastStays: PastStayDebtItem[] = [];

  bookings.forEach(b => {
    if (b.stayStatus === 'cancelled') return;

    // Must be a historical or checked_out booking
    const isPast = b.endDate < todayStr || b.stayStatus === 'checked_out';
    if (!isPast) return;

    const bPhone = cleanPhoneNumber(b.ownerPhone || '');
    const bOwner = (b.ownerName || '').trim().toLowerCase();

    const isMatch =
      (pClean && bPhone && pClean === bPhone) ||
      (oName && bOwner && (oName === bOwner || oName.includes(bOwner) || bOwner.includes(oName)));

    if (!isMatch) return;

    const price = Number(b.totalPrice) || 0;
    const deposit = Number(b.depositAmount) || 0;
    const notes = b.notes || '';
    const isFree =
      Boolean(b.isFreeStay) ||
      notes.includes('זוג') ||
      notes.includes('שולם דרך') ||
      notes.includes('חוב_עבר_נמחל') ||
      notes.includes('מחל') ||
      notes.includes('חינם');

    // Only flagged if price > deposit and NOT marked fully_paid or waived
    if (!isFree && price > deposit && b.paymentStatus !== 'fully_paid') {
      const debtAmount = price - deposit;
      if (debtAmount > 0) {
        pastStays.push({
          bookingId: b.id,
          dogName: b.dogName || 'כלב',
          startDate: b.startDate,
          endDate: b.endDate,
          datesText: `${formatDateIL(b.startDate)}–${formatDateIL(b.endDate)}`,
          totalPrice: price,
          depositAmount: deposit,
          debtAmount,
          notes: b.notes
        });
      }
    }
  });

  const totalDebt = pastStays.reduce((sum, s) => sum + s.debtAmount, 0);

  return {
    hasPastDebt: totalDebt > 0,
    totalDebt,
    pastStays
  };
}
