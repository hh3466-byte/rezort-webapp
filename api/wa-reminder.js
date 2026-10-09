/**
 * =========================================================================
 * Vercel Serverless Function: /api/wa-reminder
 * Clean redirect endpoint for client payment reminders.
 * Replaces ugly 20-line percent-encoded wa.me links in reports with a short clean link.
 * Automatically loads personalized reminder text and redirects directly into WhatsApp.
 * =========================================================================
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const GROW_PAYMENT_LINK = "https://pay.grow.link/FMjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function cleanPhoneNumber(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('972')) return '0' + digits.slice(3);
  if (digits.length === 9 && digits.startsWith('5')) return '0' + digits;
  return digits;
}

export default async function handler(req, res) {
  try {
    const { b: bookingId, phone: queryPhone, name: queryName, dog: queryDog, debt: queryDebt, t: stayType } = req.query || {};

    let ownerPhone = queryPhone || '';
    let ownerName = queryName || 'לקוח';
    let dogName = queryDog || 'הכלב';
    let debtAmount = Number(queryDebt) || 0;
    let isIncoming = stayType === 'in' || stayType === 'incoming';

    // If booking ID is provided, fetch latest details from database
    if (bookingId) {
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle();

      if (booking && !error) {
        ownerPhone = booking.owner_phone || booking.ownerPhone || ownerPhone;
        ownerName = booking.owner_name || booking.ownerName || ownerName;
        dogName = booking.dog_name || booking.dogName || dogName;
        const total = Number(booking.total_price || booking.totalPrice) || 0;
        const deposit = Number(booking.deposit_amount || booking.depositAmount) || 0;
        if (!booking.is_free_stay && booking.payment_status !== 'fully_paid') {
          debtAmount = Math.max(0, total - deposit);
        }
      }
    }

    const cleaned = cleanPhoneNumber(ownerPhone);
    const intlPhone = cleaned.startsWith('0') ? '972' + cleaned.slice(1) : (cleaned || '972548765888');
    const firstName = (ownerName || 'לקוח').trim().split(/\s+/)[0];

    const messageText = isIncoming
      ? `היי ${firstName}! 🐾\nמתרגשים ומחכים מחר לתחילת השהות של ${dogName} בריזורט לכלב! 🐶❤️\n\n${debtAmount > 0 ? `לקראת ההגעה מחר, נשמח להסדרת יתרת התשלום בסך ₪${debtAmount.toLocaleString()}.\nלתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:\n👉 ${GROW_PAYMENT_LINK}\n\n` : ''}מחכים לכם בשמחה,\nשמוליק וצוות הריזורט לכלב 🐾✨`
      : `היי ${firstName}! 🐾\nרצינו לעדכן שמחר ${dogName} מסיים/ת את השהות בריזורט לכלב! 🐕🥰 נהנה/תה מכל רגע ומתגעגע/ת אליכם מאוד.\n\n${debtAmount > 0 ? `לקראת האיסוף והשחרור מחר, נשמח להסדרת יתרת התשלום בסך ₪${debtAmount.toLocaleString()}.\nלתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:\n👉 ${GROW_PAYMENT_LINK}\n\n` : ''}תודה רבה ונתראה מחר,\nשמוליק וצוות הריזורט לכלב 🐾✨`;

    const targetUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(messageText)}`;

    // Return instant HTTP 302 redirect with HTML auto-redirect fallback
    res.setHeader('Location', targetUrl);
    res.status(302).send(`
      <!DOCTYPE html>
      <html lang="he" dir="rtl">
        <head>
          <meta charset="utf-8">
          <meta http-equiv="refresh" content="0;url=${targetUrl}">
          <title>מעביר לוואטסאפ...</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0fdf4; text-align: center; }
            .card { background: white; padding: 2rem; border-radius: 1.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.08); max-width: 90%; }
            .btn { display: inline-block; background: #059669; color: white; padding: 0.8rem 1.6rem; border-radius: 1rem; text-decoration: none; font-weight: bold; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>🐾 מעביר אותך לצ׳אט הוואטסאפ...</h2>
            <p>אם המעבר לא התבצע אוטומטית, לחץ על הכפתור למטה:</p>
            <a class="btn" href="${targetUrl}">פתח בוואטסאפ 📲</a>
          </div>
          <script>window.location.href = ${JSON.stringify(targetUrl)};</script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Error in wa-reminder redirect handler:', err);
    res.status(500).send('Error generating WhatsApp redirect link');
  }
}
