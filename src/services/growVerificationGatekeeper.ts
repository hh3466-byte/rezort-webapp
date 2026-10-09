import { supabase } from '../utils/supabase';
import { cleanPhoneNumber } from '../utils/whatsappUtils';
import { VERIFIED_GROW_LEDGER } from '../utils/dateUtils';

export interface GrowVerificationResult {
  isVerified: boolean;
  matchedAmount: number;
  matchedTransactions: Array<{
    id?: string;
    ref: string;
    amount: number;
    date: string;
    method: string;
    customerName?: string;
  }>;
  status: 'verified' | 'unverified' | 'partial' | 'free_stay' | 'manual_cash';
  warningMessage?: string;
}

/**
 * Checks in real-time whether a claimed payment exists in Grow / Meshulam
 * (cross-referencing both live grow_incoming_payments table and static verified ledger)
 */
export async function verifyGrowPayment(
  phone: string,
  claimedAmount: number,
  paymentMethod?: string,
  isFreeStay?: boolean
): Promise<GrowVerificationResult> {
  // 1. Free stay / secondary dog is exempt
  if (isFreeStay || claimedAmount === 0) {
    return {
      isVerified: true,
      matchedAmount: 0,
      matchedTransactions: [],
      status: 'free_stay'
    };
  }

  // 2. Explicit physical cash
  if (paymentMethod === 'cash') {
    return {
      isVerified: true,
      matchedAmount: claimedAmount,
      matchedTransactions: [],
      status: 'manual_cash'
    };
  }

  const cleanP = cleanPhoneNumber(phone);
  const suffix = cleanP.length >= 7 ? cleanP.slice(-7) : cleanP;

  const matchedList: Array<{
    id?: string;
    ref: string;
    amount: number;
    date: string;
    method: string;
    customerName?: string;
  }> = [];

  // A. Check static ledger
  if (suffix) {
    VERIFIED_GROW_LEDGER.forEach(t => {
      const tPhone = cleanPhoneNumber((t as any).phone || '');
      if (tPhone && tPhone.slice(-7) === suffix) {
        matchedList.push({
          ref: t.ref,
          amount: Number(t.amount) || 0,
          date: t.date,
          method: 'Grow Ledger',
          customerName: (t as any).customerName
        });
      }
    });
  }

  // B. Check live grow_incoming_payments in Supabase
  if (Boolean(supabase) && suffix) {
    try {
      const { data: rows } = await supabase
        .from('grow_incoming_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (rows && rows.length > 0) {
        rows.forEach((r: any) => {
          const rPhone = cleanPhoneNumber(r.customer_phone || r.customerPhone || '');
          if (rPhone && rPhone.slice(-7) === suffix) {
            const ref = String(r.reference_id || r.referenceId || r.id);
            if (!matchedList.some(m => m.ref === ref)) {
              matchedList.push({
                id: r.id,
                ref,
                amount: Number(r.amount) || 0,
                date: r.created_at || r.createdAt,
                method: r.payment_method || r.paymentMethod || 'Grow',
                customerName: r.customer_name || r.customerName
              });
            }
          }
        });
      }
    } catch (e) {
      console.warn('Grow live check notice:', e);
    }
  }

  const totalMatched = matchedList.reduce((sum, t) => sum + t.amount, 0);

  if (totalMatched >= claimedAmount && claimedAmount > 0) {
    return {
      isVerified: true,
      matchedAmount: totalMatched,
      matchedTransactions: matchedList,
      status: 'verified'
    };
  }

  if (totalMatched > 0 && totalMatched < claimedAmount) {
    return {
      isVerified: false,
      matchedAmount: totalMatched,
      matchedTransactions: matchedList,
      status: 'partial',
      warningMessage: `נמצא תשלום חלקי ב-Grow בסך ₪${totalMatched.toLocaleString()} מתוך ₪${claimedAmount.toLocaleString()} הנדרשים.`
    };
  }

  return {
    isVerified: false,
    matchedAmount: 0,
    matchedTransactions: [],
    status: 'unverified',
    warningMessage: `🛑 לא נמצא תשלום מאומת ב-Grow עבור מספר טלפון ${phone} על סך ₪${claimedAmount.toLocaleString()}.`
  };
}

/**
 * Fetch all verified transactions for a customer by phone
 */
export async function fetchCustomerVerifiedGrowPayments(phone: string) {
  const cleanP = cleanPhoneNumber(phone);
  const suffix = cleanP.length >= 7 ? cleanP.slice(-7) : cleanP;
  if (!suffix) return [];

  const results: any[] = [];

  // Static ledger
  VERIFIED_GROW_LEDGER.forEach(t => {
    const tPhone = cleanPhoneNumber((t as any).phone || '');
    if (tPhone && tPhone.slice(-7) === suffix) {
      results.push({
        ref: t.ref,
        amount: Number(t.amount) || 0,
        date: t.date,
        method: 'Grow Ledger',
        source: 'ledger'
      });
    }
  });

  // Live Supabase
  if (Boolean(supabase)) {
    try {
      const { data: rows } = await supabase
        .from('grow_incoming_payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (rows) {
        rows.forEach((r: any) => {
          const rPhone = cleanPhoneNumber(r.customer_phone || r.customerPhone || '');
          if (rPhone && rPhone.slice(-7) === suffix) {
            const ref = String(r.reference_id || r.referenceId || r.id);
            if (!results.some(x => x.ref === ref)) {
              results.push({
                ref,
                amount: Number(r.amount) || 0,
                date: r.created_at || r.createdAt,
                method: r.payment_method || r.paymentMethod || 'Grow',
                customerName: r.customer_name || r.customerName,
                source: 'live'
              });
            }
          }
        });
      }
    } catch (e) {}
  }

  return results;
}
