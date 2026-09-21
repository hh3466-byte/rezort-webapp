import { Booking } from '../types';

export const DEFAULT_REFUND_REASONS = [
  'הזמנה בוטלה יותר משבוע לפני הקליטה',
  'בעיה רפואית של הכלב',
  'כלב ברח',
  'בעיה רפואית של הבעלים',
] as const;

const STORAGE_KEY = 'resort_custom_refund_reasons';

/**
 * Returns all available refund reasons, including the core defaults,
 * reasons accumulated in localStorage, and any custom reasons found on existing bookings.
 */
export function getLearnedRefundReasons(existingBookings: Booking[] = []): string[] {
  const reasonSet = new Set<string>(DEFAULT_REFUND_REASONS);

  // 1. Load from localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((r: any) => {
            if (typeof r === 'string' && r.trim()) {
              reasonSet.add(r.trim());
            }
          });
        }
      }
    } catch {}
  }

  // 2. Discover from existing bookings
  existingBookings.forEach(b => {
    const d = (b as any).data || {};
    const reason = (b.refundReason || d.refundReason || '').trim();
    if (reason && !reasonSet.has(reason)) {
      reasonSet.add(reason);
    }
  });

  return Array.from(reasonSet);
}

/**
 * Saves a new custom refund reason to the learned reasons list so it becomes a quick button.
 */
export function saveLearnedRefundReason(newReason: string, existingBookings: Booking[] = []): string[] {
  const trimmed = newReason.trim();
  if (!trimmed) return getLearnedRefundReasons(existingBookings);

  const current = getLearnedRefundReasons(existingBookings);
  if (!current.includes(trimmed)) {
    current.push(trimmed);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const customOnly = current.filter(r => !(DEFAULT_REFUND_REASONS as readonly string[]).includes(r));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
      } catch {}
    }
  }
  return current;
}

/**
 * Retrieves all bookings that had refunds executed in a given month (YYYY-MM).
 * Accepts either (bookings, monthKey) or (monthKey, bookings) safely.
 */
export function getRefundsForMonth(arg1: any, arg2: any): Booking[] {
  const bookings: Booking[] = Array.isArray(arg1) ? arg1 : Array.isArray(arg2) ? arg2 : [];
  const monthKey: string = typeof arg1 === 'string' ? arg1 : typeof arg2 === 'string' ? arg2 : '';
  if (!bookings || !bookings.length || !monthKey) return [];
  return bookings.filter(b => {
    if (!b) return false;
    const d = (b as any).data || {};
    const refAmt = Number(b.refundAmount ?? d.refundAmount ?? 0);
    if (refAmt <= 0) return false;
    const refDate = (b.refundDate || d.refundDate || b.startDate || d.startDate || '').substring(0, 7);
    return refDate === monthKey;
  });
}

/**
 * Retrieves all bookings that had refunds executed in a given year (YYYY).
 * Accepts either (bookings, yearKey) or (yearKey, bookings) safely.
 */
export function getRefundsForYear(arg1: any, arg2: any): Booking[] {
  const bookings: Booking[] = Array.isArray(arg1) ? arg1 : Array.isArray(arg2) ? arg2 : [];
  const yearKey: string = typeof arg1 === 'string' ? arg1 : typeof arg2 === 'string' ? arg2 : '';
  if (!bookings || !bookings.length || !yearKey) return [];
  return bookings.filter(b => {
    if (!b) return false;
    const d = (b as any).data || {};
    const refAmt = Number(b.refundAmount ?? d.refundAmount ?? 0);
    if (refAmt <= 0) return false;
    const refDate = (b.refundDate || d.refundDate || b.startDate || d.startDate || '').substring(0, 4);
    return refDate === yearKey;
  });
}

export interface AnnualRefundSummary {
  year: string;
  totalRefundAmount: number;
  totalRefundsCount: number;
  refunds: Booking[];
  reasonBreakdown: { reason: string; count: number; totalAmount: number }[];
}

/**
 * Computes annual refund statistics, totals, and reason breakdowns for annual tracking.
 */
export function getAnnualRefundSummary(bookings: Booking[], yearKey: string): AnnualRefundSummary {
  const refunds = getRefundsForYear(bookings, yearKey);
  let totalRefundAmount = 0;
  const reasonMap: Record<string, { count: number; totalAmount: number }> = {};

  refunds.forEach(b => {
    const d = (b as any).data || {};
    const amt = Number(b.refundAmount ?? d.refundAmount ?? 0);
    totalRefundAmount += amt;
    const r = (b.refundReason || d.refundReason || 'הזמנה בוטלה').trim();
    if (!reasonMap[r]) {
      reasonMap[r] = { count: 0, totalAmount: 0 };
    }
    reasonMap[r].count += 1;
    reasonMap[r].totalAmount += amt;
  });

  const reasonBreakdown = Object.entries(reasonMap).map(([reason, stats]) => ({
    reason,
    count: stats.count,
    totalAmount: stats.totalAmount
  })).sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    year: yearKey,
    totalRefundAmount,
    totalRefundsCount: refunds.length,
    refunds,
    reasonBreakdown
  };
}
