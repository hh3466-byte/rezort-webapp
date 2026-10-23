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

import { sendMetaPurchaseEvent } from './_meta-capi.js';
import { syncMorningCustomer } from './_morning-service.js';

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

function getGreenApiUrl(id, endpoint, token) {
  const cleanId = String(id || '').trim();
  const clusterPrefix = cleanId.length >= 4 ? cleanId.slice(0, 4) : '';
  const domain = clusterPrefix ? `${clusterPrefix}.api.greenapi.com` : 'api.greenapi.com';
  return `https://${domain}/waInstance${cleanId}/${endpoint}/${token}`;
}

async function sendWhatsAppDirect(phone, message) {
  try {
    const clean = cleanPhoneNumber(phone);
    const chatId = `${clean.startsWith('0') ? '972' + clean.slice(1) : clean}@c.us`;
    const url = getGreenApiUrl(GREEN_API_ID, 'sendMessage', GREEN_API_TOKEN);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
      signal: controller.signal
    });
    clearTimeout(timeout);
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
    let fullName = (data.fullName || data.payerName || data.payer_name || data.customer_name || data.customerName || data.name || payload.fullName || payload.payerName || payload.customer_name || '').trim();
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

      // 1. Send to both Etti (052-4467314) and Manager (054-3200007)
      await sendWhatsAppDirect(ETTI_PHONE, teacherRightsMsg);
      await sendWhatsAppDirect(MANAGER_PHONE, teacherRightsMsg);

      // 2. Persist to grow_incoming_payments so monthly Grow bank deposit totals to Hagai include Teacher Rights
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        await supabase.from('grow_incoming_payments').upsert({
          id: `grow_teacher_${transactionId || Date.now()}`,
          reference_id: String(transactionId || ''),
          customer_name: `${fullName || 'לקוח'} (זכויות המורה)`,
          customer_phone: cleanPhone || '',
          customer_email: data.email || '',
          amount: amount,
          payment_method: methodDisplay,
          raw_email_snippet: `זכויות המורה: ${serviceDesc} (אסמכתא: ${transactionId})`,
          status: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        console.log(`✓ Teacher Rights transaction logged into grow_incoming_payments: ${fullName} - ₪${amount}`);
      } catch (errDb) {
        console.error('Failed to log Teacher Rights payment into grow_incoming_payments:', errDb);
      }

      // 3. Automatically ensure customer is created in Morning with Teacher Rights remarks
      syncMorningCustomer({
        fullName: fullName || 'לקוח',
        phone: cleanPhone || '',
        email: data.email || data.payerEmail || '',
        amount: amount,
        transactionId: transactionId,
        businessType: 'teacher_rights',
        serviceName: serviceDesc
      }).catch(mErr => console.warn('[Morning] Non-blocking teacher rights sync warning:', mErr));

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

    // If still no booking, check if matching intake questionnaire exists (by phone or by exact amount/installments)
    let matchingIntake = !matchedBooking && cleanPhone ? (intakes || []).find(r => {
      const rPhone = cleanPhoneNumber(r.owner_phone || r.ownerPhone || '');
      return rPhone && rPhone.endsWith(cleanPhone.slice(-7));
    }) : null;

    // Check if amount matches a pending intake (e.g. 800 NIS total or 2 installments of 400 NIS)
    if (!matchedBooking && !matchingIntake) {
      const pendingIntakes = (intakes || []).filter(r => r.status === 'pending' || r.status === 'payment_requested');
      matchingIntake = pendingIntakes.find(r => {
        const p = Number(r.depositRequested || r.calculatedPrice || 0);
        return p > 0 && (p === amount || (data.installments && Number(data.installments) * amount === p) || (p === 800 && amount === 400));
      }) || null;
    }

    // Fetch all Daycare / Boarding passes (from daycare_passes table and settings fallback)
    let allPasses = [];
    try {
      const { data: pData } = await supabase.from('daycare_passes').select('*');
      if (pData && pData.length > 0) {
        allPasses = pData.map(p => ({
          id: p.id,
          passCode: p.pass_code || p.passCode,
          ownerName: p.owner_name || p.ownerName,
          ownerPhone: p.owner_phone || p.ownerPhone,
          dogName: p.dog_name || p.dogName,
          pricePaid: Number(p.price_paid || p.pricePaid || 0),
          serviceType: p.service_type || p.serviceType,
          paymentStatus: p.payment_status || p.paymentStatus,
          status: p.status,
          ...p
        }));
      }
    } catch (_) {}

    try {
      const { data: sData } = await supabase.from('settings').select('data').eq('id', 'resort_config').maybeSingle();
      if (sData?.data?.daycare_passes && Array.isArray(sData.data.daycare_passes)) {
        for (const sp of sData.data.daycare_passes) {
          if (!allPasses.some(ap => ap.id === sp.id || ap.passCode === sp.passCode)) {
            allPasses.push(sp);
          }
        }
      }
    } catch (_) {}

    // Check if this payment matches a Daycare / Boarding pass
    let matchedPass = null;
    if (cField1 && (cField1.toLowerCase().startsWith('pass-') || cField1.startsWith('PASS-'))) {
      const cleanCode = cField1.trim().toUpperCase();
      matchedPass = allPasses.find(p => (p.passCode && p.passCode.toUpperCase() === cleanCode) || p.id === cField1) || null;
    }

    if (!matchedPass && cleanPhone && cleanPhone.length >= 7) {
      const phoneSuffix = cleanPhone.slice(-7);
      matchedPass = allPasses.find(p => {
        const pPhone = cleanPhoneNumber(p.ownerPhone || '');
        const isPhoneMatch = pPhone && pPhone.endsWith(phoneSuffix);
        const isDebt = p.paymentStatus !== 'fully_paid';
        return isPhoneMatch && (isDebt || Number(p.pricePaid || 0) === amount);
      }) || allPasses.find(p => {
        const pPhone = cleanPhoneNumber(p.ownerPhone || '');
        return pPhone && pPhone.endsWith(phoneSuffix);
      }) || null;
    }

    if (!matchedPass && fullName) {
      const targetName = fullName.toLowerCase().trim();
      matchedPass = allPasses.find(p => {
        const pName = (p.ownerName || '').toLowerCase().trim();
        const isNameMatch = pName && (pName.includes(targetName) || targetName.includes(pName));
        const isDebt = p.paymentStatus !== 'fully_paid';
        return isNameMatch && (isDebt || Number(p.pricePaid || 0) === amount);
      }) || null;
    }

    // If matchedPass exists and matchedBooking is an associated pass booking or has pass debt, route to pass flow
    const isPassBooking = Boolean(
      matchedPass && matchedBooking && (
        matchedBooking.daycare_pass_id === matchedPass.id ||
        matchedBooking.daycare_pass_code === matchedPass.passCode ||
        (matchedBooking.notes || '').includes('חוב כרטיסייה') ||
        matchedBooking.data?.daycarePassPaid === false
      )
    );

    if (isPassBooking) {
      matchedBooking = null; // Route to matchedPass handler for complete pass & booking reconciliation
    }

    // Check if payload contains keywords for OTHER Danilov businesses (Zkhuyot HaMoreh, Knaan, etc.)
    const otherBusinessKeywords = ['זכויות המורה', 'זכויות מורה', 'אתי דנילוב', 'כנען', 'טרקטור', 'עפרה', 'שפר'];
    const payloadStr = JSON.stringify(payload).toLowerCase();
    const isOtherBusiness = otherBusinessKeywords.some(kw => payloadStr.includes(kw));

    if (isOtherBusiness) {
      console.log(`Explicit non-resort transaction detected for: ${fullName} (${cleanPhone}) - ignored cleanly.`);
      return res.status(200).json({ status: 'ignored', reason: 'other_business_transaction' });
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
    let dogName = '';
    let serviceName = 'פנסיון';
    let paymentClassification = 'מקדמה';
    let detailsText = '';
    let statusText = '';

    if (matchedBooking) {
      dogName = matchedBooking.dog_name || (matchedBooking.data && matchedBooking.data.dogName) || '';
      if (!fullName || fullName === 'לקוח') {
        fullName = matchedBooking.owner_name || (matchedBooking.data && matchedBooking.data.ownerName) || fullName;
      }
      const st = (matchedBooking.service_type || (matchedBooking.data && matchedBooking.data.serviceType) || '').toLowerCase();
      if (st.includes('train') || st.includes('אילוף')) serviceName = 'אילוף';
      else if (st.includes('daycare') || st.includes('מעון') || st.includes('יום')) serviceName = 'מעון יום';
      else serviceName = 'פנסיון';

      const curDeposit = Number(matchedBooking.deposit_amount || (matchedBooking.data && matchedBooking.data.depositAmount) || 0);
      const totalPrice = Number(matchedBooking.total_price || (matchedBooking.data && matchedBooking.data.totalPrice) || 0);
      if (totalPrice > 0 && curDeposit >= (totalPrice - 1)) {
        paymentClassification = 'תשלום מלא';
      } else {
        paymentClassification = 'מקדמה';
      }
      detailsText = `${serviceName} (${paymentClassification})`;
      statusText = 'ההזמנה ביומן עודכנה כמשולמת/מקדמה הוסדרה! ✅';
    } else if (matchingIntake) {
      dogName = matchingIntake.dog_name || matchingIntake.dogName || '';
      if (!fullName || fullName === 'לקוח') {
        fullName = matchingIntake.owner_name || matchingIntake.ownerName || fullName;
      }
      const st = (matchingIntake.service_type || matchingIntake.serviceType || '').toLowerCase();
      if (st.includes('train') || st.includes('אילוף')) serviceName = 'אילוף';
      else if (st.includes('daycare') || st.includes('מעון')) serviceName = 'מעון יום';
      else serviceName = 'פנסיון';
      
      const intakeFullPrice = Number(matchingIntake.calculated_price || matchingIntake.calculatedPrice || matchingIntake.total_price || (matchingIntake.data && matchingIntake.data.calculatedPrice) || 0);
      if (intakeFullPrice > 0 && amount >= (intakeFullPrice - 1)) {
        paymentClassification = 'תשלום מלא';
      } else {
        paymentClassification = 'מקדמה';
      }
      detailsText = `שאלון קליטה: ${serviceName} (${paymentClassification})`;
      statusText = 'שאלון הקליטה עודכן עם המקדמה! ✅';
    } else if (matchedPass) {
      dogName = matchedPass.dogName || '';
      if (!fullName || fullName === 'לקוח') {
        fullName = matchedPass.ownerName || fullName;
      }
      serviceName = matchedPass.serviceType === 'boarding' ? 'בנק 21 יממות פנסיון VIP' : 'כרטיסיית פעילות יומית';
      paymentClassification = 'תשלום מלא';
      detailsText = `${serviceName} (כרטיסייה ${matchedPass.passCode})`;
      statusText = `הכרטיסייה ${matchedPass.passCode} הופעלה והשהייה ביומן עודכנה כירוקה ומאושרת! 🟢`;
      
      // 1. Update pass in daycare_passes table
      try {
        await supabase.from('daycare_passes').update({
          payment_status: 'fully_paid',
          status: 'active',
          updated_at: new Date().toISOString()
        }).eq('id', matchedPass.id);
      } catch (passUpErr) {
        console.warn('Error updating daycare pass table:', passUpErr);
      }

      // 2. Update pass in settings fallback
      try {
        const { data: sData } = await supabase.from('settings').select('data').eq('id', 'resort_config').maybeSingle();
        if (sData?.data?.daycare_passes) {
          const updatedPasses = sData.data.daycare_passes.map(p => {
            if (p.id === matchedPass.id || p.passCode === matchedPass.passCode) {
              return { ...p, paymentStatus: 'fully_paid', status: 'active', updatedAt: new Date().toISOString() };
            }
            return p;
          });
          await supabase.from('settings').update({
            data: { ...sData.data, daycare_passes: updatedPasses }
          }).eq('id', 'resort_config');
        }
      } catch (sErr) {
        console.warn('Error updating daycare pass in settings:', sErr);
      }

      // 3. Find and update any associated bookings in calendar (e.g. Chaimi today!)
      try {
        const { data: allBks } = await supabase.from('bookings').select('*');
        const passBookings = (allBks || []).filter(b => {
          const bData = b.data || {};
          const isDirectMatch = b.daycare_pass_id === matchedPass.id || 
                                b.daycare_pass_code === matchedPass.passCode ||
                                bData.daycarePassId === matchedPass.id ||
                                bData.daycarePassCode === matchedPass.passCode;
          const isOwnerMatch = cleanPhone && cleanPhoneNumber(b.owner_phone || b.ownerPhone || '').endsWith(cleanPhone.slice(-7));
          const hasDebtNote = (b.notes || '').includes('חוב כרטיסייה') || bData.daycarePassPaid === false || b.payment_status !== 'fully_paid';
          return isDirectMatch || (isOwnerMatch && hasDebtNote);
        });

        for (const pb of passBookings) {
          const curData = pb.data || {};
          const cleanedNotes = (pb.notes || '')
            .replace(/\|\s*\[⚠️ חוב כרטיסייה טרם שולם - אושר בהקפה\]/g, '')
            .replace(/\[⚠️ חוב כרטיסייה טרם שולם - אושר בהקפה\]/g, '')
            .replace(/\[⚠️ חוב כרטיסייה\]/g, '')
            .trim();
          
          await supabase.from('bookings').update({
            payment_status: 'fully_paid',
            notes: cleanedNotes ? `${cleanedNotes} | כרטיסייה שולמה ב-Grow (אסמכתא ${transactionId})` : `כרטיסייה שולמה ב-Grow (אסמכתא ${transactionId})`,
            data: {
              ...curData,
              daycarePassPaid: true,
              paymentStatus: 'fully_paid',
              growTransactionId: transactionId
            },
            updated_at: new Date().toISOString()
          }).eq('id', pb.id);
          console.log(`Auto-reconciled pass booking ${pb.id} (${pb.dog_name || pb.dogName}) to fully_paid!`);
        }
      } catch (bkErr) {
        console.warn('Error auto-reconciling pass bookings:', bkErr);
      }
    } else {
      detailsText = 'תשלום כללי ב-Grow';
      statusText = 'התשלום זוהה ועודכן במערכת. ⚠️ נדרש אימות שיוך להזמנה ביומן.';
    }

    // Try fallback lookup from Green-API WhatsApp contact book if dogName or fullName are missing
    if ((!dogName || !fullName || fullName === 'לקוח') && cleanPhone) {
      try {
        const contactChatId = `${cleanPhone.startsWith('0') ? '972' + cleanPhone.slice(1) : cleanPhone}@c.us`;
        const contactUrl = getGreenApiUrl(GREEN_API_ID, 'getContactInfo', GREEN_API_TOKEN);
        const contactRes = await fetch(contactUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: contactChatId })
        });
        if (contactRes.ok) {
          const cInfo = await contactRes.json();
          const cName = cInfo.name || cInfo.contactName || '';
          const m = cName.match(/^\[?(?:חדש)?\]?\s*([^(]+?)\s*\(([^)]+)\)/);
          if (m) {
            if (!fullName || fullName === 'לקוח') fullName = m[1].trim();
            if (!dogName) dogName = m[2].trim();
          } else if (cName && (!fullName || fullName === 'לקוח')) {
            fullName = cName.replace(/^\[?(?:חדש)?\]?\s*/, '').trim();
          }
        }
      } catch (eContact) {
        console.warn('Green-API contact lookup fallback warning:', eContact);
      }
    }

    // Build standard alert WhatsApp message - GUARANTEE customer name and dog name are ALWAYS present
    const displayOwner = fullName && fullName !== 'לקוח' ? fullName : (cleanPhone ? `לקוח (${cleanPhone})` : 'לא צוין');
    const displayDog = dogName || 'בבירור';

    const displayService = detailsText || 'שירותי הריזורט לכלב';

    const alertMsg = "🟢 *התקבל תשלום Grow חדש לריזורט לכלב!*\n\n" +
                     "👤 *שם הלקוח:* " + displayOwner + "\n" +
                     "🐶 *שם הכלב:* " + displayDog + "\n" +
                     "💰 *סכום:* ₪" + amount.toLocaleString() + " (Grow / Bit)\n" +
                     (cleanPhone ? "📞 *טלפון:* " + cleanPhone + "\n" : "") +
                     "📄 *נושא (שירות שנרכש):* " + displayService + "\n" +
                     (transactionId ? "🧾 *אסמכתא:* " + transactionId + "\n" : "") +
                     "✅ *סטטוס:* " + statusText;

    // Automatically ensure customer is created in Morning and associate Grow document
    syncMorningCustomer({
      fullName: fullName || 'לקוח',
      phone: cleanPhone || '',
      email: data.email || data.payerEmail || data.customer_email || payload.email || '',
      amount: amount,
      transactionId: transactionId,
      businessType: 'resort',
      serviceName: serviceName,
      dogName: dogName
    }).catch(mErr => console.warn('[Morning] Non-blocking resort customer sync warning:', mErr));

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
