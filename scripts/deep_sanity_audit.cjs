const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const idInstance = '710722735421';
const apiToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function deepAudit() {
  console.log('===============================================================');
  console.log('      בדיקת עומק ושפיות מקיפה לכלל מערכות הריזורט');
  console.log('===============================================================\n');

  const todayStr = new Date().toISOString().split('T')[0];
  console.log(`תאריך נוכחי של הבדיקה: ${todayStr}`);

  // 1. Settings
  console.log('\n--- [1] בדיקת הגדרות מערכת (Settings) ---');
  const { data: settings, error: sErr } = await supabase.from('settings').select('*');
  if (sErr) {
    console.error('❌ שגיאה בקריאת settings:', sErr.message);
  } else if (!settings || settings.length === 0) {
    console.warn('⚠️ לא נמצאו הגדרות ב-settings');
  } else {
    const s = settings[0];
    console.log('✓ שם העסק:', s.business_name || s.resort_name);
    console.log('✓ מחיר לילה ברירת מחדל:', s.default_price_per_night, '₪');
    console.log('✓ מחיר יום מלא ברירת מחדל:', s.default_day_care_price, '₪');
    console.log('✓ מקדמה נדרשת:', s.default_deposit_amount, '₪');
    console.log('✓ קישור לתשלום Grow:', s.grow_payment_link || s.payment_link ? 'מוגדר' : 'לא מוגדר');
    console.log('✓ תבניות וואטסאפ מוגדרות:', {
      booking_confirmation: !!s.booking_confirmation_template,
      payment_request: !!s.payment_request_template,
      reminder: !!s.reminder_template,
      daily_update: !!s.daily_update_template,
    });
  }

  // 2. Bookings Analysis
  console.log('\n--- [2] ניתוח נתוני הזמנות (Bookings) ---');
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
  if (bErr) {
    console.error('❌ שגיאה בקריאת bookings:', bErr.message);
  } else {
    console.log(`סה"כ הזמנות במסד הנתונים: ${bookings.length}`);
    
    // Status breakdown
    const statuses = {};
    bookings.forEach(b => {
      statuses[b.stay_status] = (statuses[b.stay_status] || 0) + 1;
    });
    console.log('התפלגות סטטוסים:', statuses);

    // Today's occupancy
    const todayArrivals = bookings.filter(b => b.start_date === todayStr && b.stay_status !== 'cancelled');
    const todayDepartures = bookings.filter(b => b.end_date === todayStr && b.stay_status !== 'cancelled');
    const todayStayers = bookings.filter(b => b.start_date < todayStr && b.end_date > todayStr && b.stay_status !== 'cancelled');

    console.log(`נוכחות להיום (${todayStr}):`);
    console.log(`  - כניסות היום: ${todayArrivals.length}`);
    todayArrivals.forEach(b => console.log(`    🐾 כניסה: ${b.dog_name} (${b.owner_name} - ${b.owner_phone})`));
    
    console.log(`  - שוהים היום: ${todayStayers.length}`);
    todayStayers.forEach(b => console.log(`    🐾 שוהה: ${b.dog_name} (${b.owner_name} - ${b.owner_phone})`));

    console.log(`  - עזיבות היום: ${todayDepartures.length}`);
    todayDepartures.forEach(b => console.log(`    🐾 עזיבה: ${b.dog_name} (${b.owner_name} - ${b.owner_phone})`));

    // Data anomalies check
    const anomalies = [];
    bookings.forEach(b => {
      if (!b.dog_name || b.dog_name.trim() === '') anomalies.push(`הזמנה #${b.id}: חסר שם כלב`);
      if (!b.owner_phone || b.owner_phone.trim() === '') anomalies.push(`הזמנה #${b.id} (${b.dog_name}): חסר טלפון בעלים`);
      if (b.start_date > b.end_date) anomalies.push(`הזמנה #${b.id} (${b.dog_name}): תאריך כניסה מאוחר מתאריך יציאה!`);
      if (b.total_price < 0) anomalies.push(`הזמנה #${b.id} (${b.dog_name}): מחיר כולל שלילי`);
    });

    if (anomalies.length === 0) {
      console.log('✓ אין שום אנומליה או חריגה בטבלת ההזמנות! כל הרשומות תקינות.');
    } else {
      console.warn(`⚠️ נמצאו ${anomalies.length} אנומליות בהזמנות:`, anomalies);
    }

    // Debt check on completed or active bookings
    const withDebt = bookings.filter(b => {
      if (b.stay_status === 'cancelled') return false;
      const total = Number(b.total_price) || 0;
      const paid = Number(b.paid_amount) || 0;
      return total > paid;
    });
    console.log(`הזמנות עם יתרת חוב לתשלום: ${withDebt.length}`);
  }

  // 3. Intake Requests
  console.log('\n--- [3] בקשות קליטה מקוונות (Intake Requests) ---');
  const { data: intakes, error: inErr } = await supabase.from('intake_requests').select('*');
  if (inErr) {
    console.error('❌ שגיאה בקריאת intake_requests:', inErr.message);
  } else {
    console.log(`סה"כ בקשות קליטה: ${intakes.length}`);
    const pendingIntakes = intakes.filter(i => i.status === 'pending');
    const approvedIntakes = intakes.filter(i => i.status === 'approved');
    const rejectedIntakes = intakes.filter(i => i.status === 'rejected');
    console.log(`  - ממתינות: ${pendingIntakes.length} | מאושרות: ${approvedIntakes.length} | נדחו: ${rejectedIntakes.length}`);
    if (pendingIntakes.length > 0) {
      console.log('  בקשות ממתינות:');
      pendingIntakes.forEach(i => console.log(`    📋 ${i.dog_name} של ${i.owner_name} (${i.start_date} - ${i.end_date})`));
    }
  }

  // 4. Grow Incoming Payments
  console.log('\n--- [4] סנכרון תשלומי Grow (grow_incoming_payments) ---');
  const { data: payments, error: pErr } = await supabase.from('grow_incoming_payments').select('*').order('created_at', { ascending: false });
  if (pErr) {
    console.error('❌ שגיאה בקריאת grow_incoming_payments:', pErr.message);
  } else {
    console.log(`סה"כ תשלומים שנרשמו: ${payments.length}`);
    const unassociated = payments.filter(p => p.status === 'pending');
    console.log(`תשלומים הממתינים לשיוך: ${unassociated.length}`);
    if (unassociated.length > 0) {
      unassociated.forEach(p => console.log(`  💳 שובר ${p.reference_id}: ₪${p.amount} מ-${p.customer_name}`));
    }
  }

  // 5. Green-API WhatsApp Live Health
  console.log('\n--- [5] חיבור Green-API בוואטסאפ ---');
  await new Promise((resolve) => {
    https.get(`https://api.green-api.com/waInstance${idInstance}/getStateInstance/${apiToken}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('✓ מצב מופע (State):', json.stateInstance);
          if (json.stateInstance === 'authorized') {
            console.log('✓ מופע מאושר ומחובר לפלאפון');
          } else {
            console.warn('⚠️ מופע אינו authorized!');
          }
        } catch (e) {
          console.error('שגיאה בפיענוח מצב:', data);
        }
        resolve();
      });
    }).on('error', (err) => {
      console.error('שגיאת תקשורת עם Green-API:', err.message);
      resolve();
    });
  });

  // Check Green-API device info
  await new Promise((resolve) => {
    https.get(`https://api.green-api.com/waInstance${idInstance}/getDeviceInfo/${apiToken}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('✓ פרטי מכשיר מחובר:', json);
        } catch (e) {
          console.log('תגובת פרטי מכשיר:', data);
        }
        resolve();
      });
    }).on('error', () => resolve());
  });

  // Check outgoing queue
  await new Promise((resolve) => {
    https.get(`https://api.green-api.com/waInstance${idInstance}/showMessagesQueue/${apiToken}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('✓ תור הודעות יוצאות (Queue):', json.totalSize !== undefined ? json.totalSize : json);
        } catch (e) {
          console.log('Queue data:', data);
        }
        resolve();
      });
    }).on('error', () => resolve());
  });

  console.log('\n===============================================================');
  console.log('               סיום בדיקת עומק למערכת');
  console.log('===============================================================');
}

deepAudit().catch(err => console.error('FATAL AUDIT ERROR:', err));
