/**
 * =========================================================================
 * Grow (Meshulam) Webhook Handler - הריזורט לכלב
 * Vercel Serverless Function: /api/grow-webhook
 * 
 * Logic:
 * 1. Receives incoming transaction event payload from Grow.
 * 2. Extracts: customer name, phone, amount, transaction ID, transactionTypeId (Bit, ApplePay, GooglePay, PayBox, Credit Card, Bank Transfer).
 * 3. Matches existing booking in Supabase by cField1 (bookingId) / phone / customer name.
 * 4. Automatically updates deposit_amount, payment_status, and notes.
 * 5. Calls Grow approveTransaction to acknowledge receipt.
 * 6. Sends real-time notification to Manager (054-3200007).
 * =========================================================================
 */

import { sendMetaPurchaseEvent } from './meta-capi.js';

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";
const MANAGER_PHONE = "0543200007";
const SHMULIK_PHONE = "0506336896";
const ETTI_PHONE = "0524467314";
const GROW_API_KEY = process.env.GROW_API_KEY || "hfBND9mlC28BGvUkwQBls9hypPUIoJIj4Sy6LyUH";

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

async function sendWhatsAppDirect(phone, message) {
  try {
    const clean = cleanPhoneNumber(phone);
    const chatId = `${clean.startsWith('0') ? '972' + clean.slice(1) : clean}@c.us`;
    const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message })
    });
  } catch (err) {
    console.error(`Error sending WhatsApp to ${phone}:`, err);
  }
}

function flattenBracketParams(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const res = { ...obj };
  for (const [k, v] of Object.entries(obj)) {
    const match = k.match(/^data\[([^\]]+)\]$/i) || k.match(/^([^\[]+)\[([^\]]+)\]$/i);
    if (match) {
      const field = match[match.length - 1];
      if (res[field] === undefined) {
        res[field] = v;
      }
    }
  }
  return res;
}

export default async function handler(req, res) {
  // Allow GET for verification health check
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'Resort Grow Webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let payload = req.body || {};
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        try {
          const params = new URLSearchParams(payload);
          payload = Object.fromEntries(params.entries());
        } catch (e2) {}
      }
    }
    payload = flattenBracketParams(payload);
    console.log('Received Grow Webhook payload:', JSON.stringify(payload));

    // Handle Grow/Meshulam payload structures
    let data = payload.data || payload;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        try {
          const params = new URLSearchParams(data);
          data = Object.fromEntries(params.entries());
        } catch (e2) {}
      }
    }
    data = flattenBracketParams(data);

    const rawSum = data.sum ?? data.amount ?? data.total ?? data.payment_sum ?? data.price ?? data.transactionAmount ?? payload.sum ?? payload.amount ?? payload.total ?? payload.payment_sum ?? payload.price ?? 0;
    const amount = Number(rawSum) || 0;
    const fullName = (data.fullName || data.payerName || data.payer_name || data.customer_name || data.customerName || data.name || payload.fullName || payload.payerName || payload.customer_name || '').trim();
    const rawPhone = data.phone || data.payerPhone || data.payer_phone || data.customer_phone || data.customerPhone || data.mobile || payload.phone || payload.payerPhone || payload.customer_phone || '';
    const cleanPhone = cleanPhoneNumber(rawPhone);
    const transactionId = String(data.transactionId || data.asmachta || data.transaction_id || data.id || payload.transactionId || payload.asmachta || Date.now());
    const paymentType = (data.paymentType || data.payment_method || data.type || payload.paymentType || '').toLowerCase();
    const transactionTypeId = String(data.transactionTypeId || payload.transactionTypeId || '');
    const customField = data.customFields || data.description || data.comments || payload.customFields || payload.description || '';
    const cField1 = String(data.cField1 || (data.customFields && data.customFields.cField1) || payload.cField1 || '').trim();

    // Determine payment method and labels
    let methodDisplay = 'כרטיס אשראי';
    let dbPaymentMethod = 'credit_card';

    if (transactionTypeId === '6' || paymentType.includes('bit')) {
      methodDisplay = 'Bit';
      dbPaymentMethod = 'bit';
    } else if (transactionTypeId === '13' || paymentType.includes('apple')) {
      methodDisplay = 'Apple Pay';
      dbPaymentMethod = 'apple_pay';
    } else if (transactionTypeId === '14' || paymentType.includes('google')) {
      methodDisplay = 'Google Pay';
      dbPaymentMethod = 'google_pay';
    } else if (transactionTypeId === '5' || paymentType.includes('paybox')) {
      methodDisplay = 'PayBox';
      dbPaymentMethod = 'paybox';
    } else if (transactionTypeId === '15' || paymentType.includes('bank') || data.payerBankAccountDetails) {
      methodDisplay = 'העברה בנקאית';
      dbPaymentMethod = 'bank_transfer';
    }

    // Parse bank details if present
    let bankInfoStr = '';
    const bankDetails = data.payerBankAccountDetails;
    if (bankDetails && typeof bankDetails === 'object') {
      bankInfoStr = ` (בנק ${bankDetails.bankNum || ''}, סניף ${bankDetails.branchNum || ''}, חשבון ${bankDetails.accountNum || ''} - ${bankDetails.accountName || ''})`;
    }

    // Ignore 0₪ transactions (card verification / token tests / empty pings)
    if (amount <= 0) {
      console.log(`Ignoring 0₪ or negative transaction from Grow for: ${fullName} (${cleanPhone}), asmachta: ${transactionId}`);
      return res.status(200).json({ status: 'ignored', reason: 'zero_amount_verification', transactionId });
    }

    // Multi-layer filter to separate "זכויות המורה" and other non-resort businesses:
    const textCorpus = `${fullName} ${customField} ${data.description || ''} ${data.itemName || ''} ${data.productName || ''}`.toLowerCase();
    
    const TEACHER_RIGHTS_KEYWORDS = [
      'זכויות המורה', 'מורה', 'מורים', 'הוראה', 'עובד הוראה', 'עובדי הוראה',
      'שכר', 'תלוש', 'פנסיה', 'ייעוץ פנסיוני', 'בדיקת שכר', 'ערעור', 'גמול',
      'דרגה', 'ותק', 'שבתון', 'אופק חדש', 'עוז לתמורה', 'מיכל סלע'
    ];

    const isTeacherRights = TEACHER_RIGHTS_KEYWORDS.some(kw => textCorpus.includes(kw)) || cleanPhone.includes('4446337');
    if (isTeacherRights) {
      console.log(`Routing Teacher Rights transaction to Etti & Manager: ${fullName} - ₪${amount}`);
      
      const nowIL = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const serviceDesc = data.itemName || data.productName || data.description || customField || 'זכויות המורה';

      const teacherRightsMsg = `📚 *התקבל תשלום חדש - זכויות המורה!*
• *שם הלקוח:* ${fullName || 'לא צוין'} (📞 ${cleanPhone || 'ללא טלפון'})
• *סכום:* ₪${amount.toLocaleString()} (${methodDisplay})
• *שירות/פירוט:* ${serviceDesc}
• *אסמכתא:* ${transactionId}
• *תאריך ושעה:* ${nowIL}`;

      // Send to both Etti (052-4467314) and Manager (054-3200007)
      await sendWhatsAppDirect(ETTI_PHONE, teacherRightsMsg);
      await sendWhatsAppDirect(MANAGER_PHONE, teacherRightsMsg);

      return res.status(200).json({
        status: 'success',
        type: 'teacher_rights_routed_to_etti_and_manager',
        amount,
        customer: fullName
      });
    }

    // Connect to Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Find matching booking & intake requests in Resort database
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .neq('stay_status', 'cancelled');

    const { data: intakes } = await supabase
      .from('intake_requests')
      .select('*');

    let matchedBooking = null;

    // 1. Match by exact cField1 (booking ID)
    if (cField1 && cField1.startsWith('b-')) {
      matchedBooking = (bookings || []).find(b => b.id === cField1);
    }

    // 2. Match by phone
    if (!matchedBooking && cleanPhone && cleanPhone.length >= 7) {
      const phoneSuffix = cleanPhone.slice(-7);
      matchedBooking = (bookings || []).find(b => {
        const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
        return bPhone && bPhone.endsWith(phoneSuffix);
      });
    }

    // 3. Match by customer name
    if (!matchedBooking && fullName) {
      const targetName = fullName.toLowerCase();
      matchedBooking = (bookings || []).find(b => {
        const bName = (b.owner_name || b.ownerName || '').trim().toLowerCase();
        return bName && (bName.includes(targetName) || targetName.includes(bName));
      });
    }

    // If still no booking, check if matching intake questionnaire exists
    const matchingIntake = !matchedBooking && cleanPhone ? (intakes || []).find(r => {
      const rPhone = cleanPhoneNumber(r.owner_phone || r.ownerPhone || '');
      return rPhone && rPhone.endsWith(cleanPhone.slice(-7));
    }) : null;

    // Strict guard: If this payment has NO relation to Resort bookings, intakes, or dogs, ignore it cleanly
    if (!matchedBooking && !matchingIntake) {
      console.log(`No resort booking or intake matched for: ${fullName} (${cleanPhone}) - treated as non-resort transaction.`);
      return res.status(200).json({ status: 'ignored', reason: 'non_resort_transaction' });
    }

    // Prevent duplicate processing of the same transaction
    const existingPayment = transactionId ? (await supabase.from('grow_incoming_payments').select('id, created_at').eq('reference_id', String(transactionId)).maybeSingle()).data : null;
    
    if (existingPayment) {
      console.log(`Transaction ${transactionId} was already processed earlier at ${existingPayment.created_at}. Suppressing duplicate alert.`);
      return res.status(200).json({ status: 'already_processed', transactionId });
    }

    let matchSummary = '';

    if (matchedBooking) {
      const curData = matchedBooking.data || {};
      const curDeposit = Number(matchedBooking.deposit_amount || matchedBooking.depositAmount || 0);
      const totalPrice = Number(matchedBooking.total_price || matchedBooking.totalPrice || 0);
      const newDeposit = curDeposit + amount;
      const isFullyPaid = totalPrice > 0 && newDeposit >= (totalPrice - 1);
      const newPaymentStatus = isFullyPaid ? 'fully_paid' : 'deposit_paid';

      const newNotes = `${curData.notes || matchedBooking.notes || ''} | נקלט תשלום ₪${amount.toLocaleString()} ב-Grow (${methodDisplay}${bankInfoStr} אסמכתא ${transactionId})`;

      await supabase.from('bookings').update({
        deposit_amount: newDeposit,
        payment_status: newPaymentStatus,
        payment_method: dbPaymentMethod,
        data: {
          ...curData,
          depositAmount: newDeposit,
          paymentStatus: newPaymentStatus,
          paymentMethod: dbPaymentMethod,
          notes: newNotes
        },
        updated_at: new Date().toISOString()
      }).eq('id', matchedBooking.id);

      if (isFullyPaid) {
        matchSummary = `עודכן בהזמנה של *${matchedBooking.dog_name || curData.dogName}* (${matchedBooking.owner_name || curData.ownerName}). סטטוס: שולם במלואו ✅ (₪${newDeposit.toLocaleString()})`;
      } else {
        const remaining = totalPrice > newDeposit ? totalPrice - newDeposit : 0;
        matchSummary = `עודכן בהזמנה של *${matchedBooking.dog_name || curData.dogName}* (${matchedBooking.owner_name || curData.ownerName}). סטטוס: שולמה מקדמה 🟢 (₪${amount.toLocaleString()} מתוך ₪${totalPrice.toLocaleString()}${remaining > 0 ? ` | יתרה: ₪${remaining.toLocaleString()}` : ''})`;
      }
    } else if (matchingIntake) {
      matchSummary = `נקלטה מקדמה לשאלון קליטה של *${matchingIntake.dog_name || matchingIntake.dogName}* (${matchingIntake.owner_name || matchingIntake.ownerName}). סטטוס: שולמה מקדמה 🟢 (₪${amount.toLocaleString()})`;
    }

    // Record in grow_incoming_payments table in Supabase
    try {
      await supabase.from('grow_incoming_payments').upsert({
        id: `grow_${transactionId}`,
        reference_id: transactionId,
        customer_name: fullName,
        customer_phone: cleanPhone,
        customer_email: data.email || data.payerEmail || data.customer_email || payload.email || '',
        amount: amount,
        payment_method: methodDisplay,
        raw_email_snippet: `Grow Webhook: ${methodDisplay}${bankInfoStr}`,
        status: matchedBooking ? 'completed' : 'pending'
      }, { onConflict: 'id' });
    } catch (eGrowIns) {
      console.error('Error recording grow_incoming_payments:', eGrowIns);
    }

    // Report Purchase Conversion to Meta Conversions API (CAPI)
    sendMetaPurchaseEvent({
      phone: cleanPhone,
      customerName: fullName,
      amount: amount,
      transactionId: transactionId,
      currency: 'ILS',
      eventSourceUrl: 'https://rezort-webapp.vercel.app/'
    }).catch(capiErr => console.warn('Non-blocking Meta CAPI purchase event warning:', capiErr));

    // Send real-time WhatsApp alert to BOTH Manager (054-3200007) and Shmulik (050-6336896) ONLY for verified Resort transactions
    const alertMsg = `💳 *התקבל תשלום ריזורט ב-GROW!*
• *לקוח:* ${fullName || 'לא צוין'} (📞 ${cleanPhone || 'ללא טלפון'})
• *סכום:* ₪${amount.toLocaleString()} (${methodDisplay}${bankInfoStr})
• *אסמכתא:* ${transactionId}
• *סנכרון יומן:* ${matchSummary}`;

    await sendWhatsAppDirect(MANAGER_PHONE, alertMsg);
    await sendWhatsAppDirect(SHMULIK_PHONE, alertMsg);

    // Call Grow approveTransaction to acknowledge receipt if identifiers exist
    if (data.processId && data.processToken && data.transactionId && data.transactionToken) {
      try {
        const approveEndpoint = 'https://sandbox.meshulam.co.il/api/light/server/1.0/approveTransaction';
        await fetch(approveEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': GROW_API_KEY
          },
          body: JSON.stringify({
            userId: data.userId || 'e1ceee55b717e60b',
            pageCode: data.pageCode || '538cbf6f8827',
            processId: data.processId,
            processToken: data.processToken,
            transactionId: data.transactionId,
            transactionToken: data.transactionToken,
            sum: amount,
            fullName,
            payerPhone: cleanPhone
          })
        });
      } catch (appErr) {
        console.warn('Grow approveTransaction warning:', appErr.message);
      }
    }

    return res.status(200).json({
      status: 'success',
      matched: true,
      bookingId: matchedBooking ? matchedBooking.id : null
    });
  } catch (err) {
    console.error('Error processing Grow webhook:', err);
    return res.status(500).json({ error: err.message });
  }
}
