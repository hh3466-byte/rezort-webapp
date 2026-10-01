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

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";
const MANAGER_PHONE = "0543200007";
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

export default async function handler(req, res) {
  // Allow GET for verification health check
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'Resort Grow Webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body || {};
    console.log('Received Grow Webhook payload:', JSON.stringify(payload));

    // Handle Grow/Meshulam payload structures
    const data = payload.data || payload;
    const amount = Number(data.sum || data.amount || data.total || data.payment_sum || 0);
    const fullName = (data.fullName || data.customer_name || data.payer_name || data.name || '').trim();
    const rawPhone = data.phone || data.payerPhone || data.customer_phone || data.payer_phone || data.mobile || '';
    const cleanPhone = cleanPhoneNumber(rawPhone);
    const transactionId = String(data.transactionId || data.asmachta || data.transaction_id || data.id || Date.now());
    const paymentType = (data.paymentType || data.payment_method || data.type || '').toLowerCase();
    const transactionTypeId = String(data.transactionTypeId || '');
    const customField = data.customFields || data.description || data.comments || '';
    const cField1 = String(data.cField1 || (data.customFields && data.customFields.cField1) || '').trim();

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

    if (amount <= 0 && !fullName && !cleanPhone) {
      return res.status(200).json({ status: 'ignored', reason: 'empty_data' });
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

      matchSummary = `עודכן בהזמנה של *${matchedBooking.dog_name || curData.dogName}* (${matchedBooking.owner_name || curData.ownerName}). סטטוס: ${isFullyPaid ? 'שולם במלואו ✅' : 'שולמה מקדמה 🟢'}`;
    } else if (matchingIntake) {
      matchSummary = `נקלטה מקדמה לשאלון קליטה של *${matchingIntake.dog_name || matchingIntake.dogName}* (${matchingIntake.owner_name || matchingIntake.ownerName}).`;
    }

    // Send real-time WhatsApp alert to manager ONLY for verified Resort transactions
    const alertMsg = `💳 *התקבל תשלום ריזורט ב-GROW!*
• *לקוח:* ${fullName || 'לא צוין'} (📞 ${cleanPhone || 'ללא טלפון'})
• *סכום:* ₪${amount.toLocaleString()} (${methodDisplay}${bankInfoStr})
• *אסמכתא:* ${transactionId}
• *סנכרון יומן:* ${matchSummary}`;

    await sendWhatsAppDirect(MANAGER_PHONE, alertMsg);

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
