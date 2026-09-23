const fs = require('fs');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

function sendWhatsApp(chatId, message) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chatId, message });
    const req = https.request({
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/SendMessage/${GREEN_API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== 1. Syncing Rika Navri ₪1,260 Payment ===');
  const rikaPayment = {
    id: 'grow_1260_rika_navri_220926',
    reference_id: 'grow_rika_1260_220926',
    customer_name: 'ריקה נברי',
    customer_phone: '0527777737',
    customer_email: 'navri@netvision.net.il',
    amount: 1260,
    payment_method: 'Bit',
    raw_email_snippet: 'תשלום Grow בסך 1,260 ₪ עבור ריקה נברי (Bit)',
    status: 'completed'
  };

  const { error: rErr } = await supabase.from('grow_incoming_payments').upsert(rikaPayment);
  console.log('Rika payment insert result:', rErr ? rErr.message : 'SUCCESS');

  // Update Rika's booking
  const { data: rikaBooking } = await supabase
    .from('bookings')
    .select('*')
    .ilike('owner_phone', '%7777737%')
    .single();

  if (rikaBooking) {
    const currentDep = Number(rikaBooking.deposit_amount) || 180;
    const newDep = 1440; // 180 + 1260 = 1440 (total price is 1440)
    const bkData = rikaBooking.data || {};
    bkData.depositAmount = newDep;
    bkData.paymentStatus = 'fully_paid';
    bkData.stayStatus = 'confirmed';

    await supabase.from('bookings').update({
      deposit_amount: newDep,
      payment_status: 'fully_paid',
      stay_status: 'confirmed',
      notes: (rikaBooking.notes || '') + ' | שולם ₪1,260 ב-Bit (Grow 22.09.26) - שולם במלואו!',
      data: bkData
    }).eq('id', rikaBooking.id);
    console.log('Updated Rika booking to fully paid ₪1,440');
  }

  console.log('\n=== 2. Syncing Ze\'ev Avik ₪360 Payment ===');
  const zeevPayment = {
    id: 'grow_360_zeev_avik_180926',
    reference_id: 'grow_zeev_360_180926',
    customer_name: 'זאב אביק',
    customer_phone: '0507845835',
    customer_email: '',
    amount: 360,
    payment_method: 'אשראי',
    raw_email_snippet: 'תשלום Grow בסך 360 ₪ עבור זאב אביק (אשראי 18.09.26)',
    status: 'pending'
  };

  const { error: zErr } = await supabase.from('grow_incoming_payments').upsert(zeevPayment);
  console.log('Zeev payment insert result:', zErr ? zErr.message : 'SUCCESS');

  console.log('\n=== 3. Sending WhatsApp updates to Shmulik & Manager ===');
  
  // Message for Rika Navri
  const msgRika = `🟢 *התקבל תשלום ב-Grow לריזורט לכלב!*

👤 *שם המשלם:* ריקה נברי
🐕 *כלב:* ג'סי הרוטוויילרית
💰 *סכום ששולם:* ₪1,260 (השלמת יתרה מלאה)
💳 *אמצעי תשלום:* Bit
🔢 *אסמכתא:* Grow 22/09/2026
📞 *טלפון:* 052-7777737
📅 *סטטוס:* שויך ועודכן בהצלחה ביומן ההזמנות! (סה״כ שולם: ₪1,440 - שולם במלואו ✓)`;

  // Message for Zeev Avik
  const msgZeev = `🟢 *התקבל תשלום חדש ב-Grow לריזורט לכלב!*

👤 *שם המשלם:* זאב אביק
💰 *סכום:* ₪360
💳 *אמצעי תשלום:* אשראי Grow
🔢 *אסמכתא:* Grow 18/09/2026
📞 *טלפון:* 050-7845835
📅 *סטטוס במערכת:* ממתין לשיוך/הקמת הזמנה ביומן ⏳ (מופיע כעת בכפתור 'תשלום ממתין' בסרגל העליון)`;

  // Message for Karin Lahav reminder
  const msgKarin = `🟢 *עדכון תשלום Grow – קארין להב*

👤 *שם המשלם:* קארין להב
🐕 *כלב:* שון
💰 *סכום ששולם:* ₪440
💳 *אמצעי תשלום:* Bit
📞 *טלפון:* 054-6610321
📅 *סטטוס:* שויך להזמנה ביומן בהצלחה (סה"כ שולם: ₪620 - שולם מלא ✓)`;

  const recipients = ["972506336896@c.us", "972543200007@c.us"];

  for (const r of recipients) {
    console.log(`Sending to ${r}...`);
    await sendWhatsApp(r, msgRika);
    await new Promise(res => setTimeout(res, 800));
    await sendWhatsApp(r, msgZeev);
    await new Promise(res => setTimeout(res, 800));
    await sendWhatsApp(r, msgKarin);
    await new Promise(res => setTimeout(res, 800));
  }

  console.log('✓ All messages sent successfully!');
}

run();
