/**
 * =========================================================================
 * Grow (Meshulam) Webhook Handler - הריזורט לכלב
 * Vercel Serverless Function: /api/grow-webhook
 * 
 * Logic:
 * 1. Receives incoming transaction event payload from Grow.
 * 2. Extracts: customer name, phone, amount, transaction ID, payment method.
 * 3. Matches existing booking in Supabase by phone / customer name.
 * 4. Automatically updates deposit_amount, payment_status, and notes.
 * 5. Sends real-time notification to Manager (054-3200007).
 * =========================================================================
 */

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";
const MANAGER_PHONE = "0543200007";

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

async function sendWhatsAppToManager(message) {
  try {
    const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: `${MANAGER_PHONE}@c.us`, message })
    });
  } catch (err) {
    console.error('Error sending WhatsApp to manager:', err);
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
    const rawPhone = data.phone || data.customer_phone || data.payer_phone || data.mobile || '';
    const cleanPhone = cleanPhoneNumber(rawPhone);
    const transactionId = String(data.transactionId || data.asmachta || data.transaction_id || data.id || Date.now());
    const paymentType = (data.paymentType || data.payment_method || data.type || 'אשראי').toLowerCase();
    const customField = data.customFields || data.description || data.comments || '';

    if (amount <= 0 && !fullName && !cleanPhone) {
      return res.status(200).json({ status: 'ignored', reason: 'empty_data' });
    }

    // Ignore Michal Sela per explicit business rule
    if (fullName.includes('מיכל סלע') || cleanPhone.includes('4446337')) {
      console.log('Skipping Michal Sela (excluded from Resort)');
      return res.status(200).json({ status: 'ignored', reason: 'excluded_customer' });
    }

    // Connect to Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Find matching booking
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .neq('stay_status', 'cancelled');

    let matchedBooking = null;

    if (cleanPhone && cleanPhone.length >= 7) {
      const phoneSuffix = cleanPhone.slice(-7);
      matchedBooking = (bookings || []).find(b => {
        const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
        return bPhone && bPhone.endsWith(phoneSuffix);
      });
    }

    if (!matchedBooking && fullName) {
      const targetName = fullName.toLowerCase();
      matchedBooking = (bookings || []).find(b => {
        const bName = (b.owner_name || b.ownerName || '').trim().toLowerCase();
        return bName && (bName.includes(targetName) || targetName.includes(bName));
      });
    }

    let matchSummary = '';

    if (matchedBooking) {
      const curData = matchedBooking.data || {};
      const curDeposit = Number(matchedBooking.deposit_amount || matchedBooking.depositAmount || 0);
      const totalPrice = Number(matchedBooking.total_price || matchedBooking.totalPrice || 0);
      const newDeposit = curDeposit + amount;
      const isFullyPaid = totalPrice > 0 && newDeposit >= (totalPrice - 1);
      const newPaymentStatus = isFullyPaid ? 'fully_paid' : 'deposit_paid';

      const methodLabel = paymentType.includes('bit') ? 'Bit' : paymentType.includes('apple') ? 'ApplePay' : 'כרטיס אשראי';
      const newNotes = `${curData.notes || matchedBooking.notes || ''} | נקלט תשלום ₪${amount.toLocaleString()} ב-Grow (${methodLabel} אסמכתא ${transactionId})`;

      await supabase.from('bookings').update({
        deposit_amount: newDeposit,
        payment_status: newPaymentStatus,
        payment_method: paymentType.includes('bit') ? 'bit' : 'credit_card',
        data: {
          ...curData,
          depositAmount: newDeposit,
          paymentStatus: newPaymentStatus,
          paymentMethod: paymentType.includes('bit') ? 'bit' : 'credit_card',
          notes: newNotes
        },
        updated_at: new Date().toISOString()
      }).eq('id', matchedBooking.id);

      matchSummary = `עודכן בהזמנה של *${matchedBooking.dog_name || curData.dogName}* (${matchedBooking.owner_name || curData.ownerName}). סטטוס: ${isFullyPaid ? 'שולם במלואו ✅' : 'שולמה מקדמה 🟢'}`;
    } else {
      matchSummary = `לא אותרה הזמנה פעילה במערכת עבור ${fullName} (${cleanPhone}) - נרשם בדוח הביקורת.`;
    }

    // Send real-time WhatsApp alert to manager
    const methodDisplay = paymentType.includes('bit') ? 'Bit' : paymentType.includes('apple') ? 'ApplePay' : 'כרטיס אשראי';
    const alertMsg = `💳 *התקבל תשלום חדש ב-GROW!*
• *לקוח:* ${fullName || 'לא צוין'} (📞 ${cleanPhone || 'ללא טלפון'})
• *סכום:* ₪${amount.toLocaleString()} (${methodDisplay})
• *אסמכתא:* ${transactionId}
• *סנכרון יומן:* ${matchSummary}`;

    await sendWhatsAppToManager(alertMsg);

    return res.status(200).json({
      status: 'success',
      matched: Boolean(matchedBooking),
      bookingId: matchedBooking ? matchedBooking.id : null
    });
  } catch (err) {
    console.error('Error processing Grow webhook:', err);
    return res.status(500).json({ error: err.message });
  }
}
