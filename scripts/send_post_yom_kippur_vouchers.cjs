const fs = require('fs');
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

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

const YANIV_VOUCHER = {
  id: 'v-yaniv-elad-vip-2026',
  code: 'VIP-YANIV-2026',
  type: 'loyalty',
  customerName: 'יניב אלעד',
  dogName: "ג'נגו ולונה",
  phone: '0545443222',
  benefitText: 'שובר VIP אישי לשהות הבאה: 150 ₪ הנחה / יום כיף מתנה / מארז שף גורמה כפול + צ\'ק-אאוט מוצ"ש ללא עלות',
  selectedBenefitId: 'discount_100',
  status: 'active',
  createdAt: new Date().toISOString(),
  expiryDate: '2027-03-31',
  notes: "שובר פיצוי ופינוק VIP מיוחד שהונפק עבור יניב אלעד לשהות הבאה של ג'נגו ולונה"
};

const YANIV_POST_YK_MESSAGE = `גמר חתימה טובה ושנה טובה יניב! 🕯️🐾🤍
אנו מקווים מכל הלב שעבר עליכם צום מועיל וחג שקט ורגוע.

רצינו לפנות אליך שוב באופן אישי מכל הלב.
היה לנו מאוד חשוב לבדוק מה שלומכם, ולחזור ולומר כמה שאנחנו מעריכים אותך, את ג'נגו ואת לונה היקרים. 🐕🤍

כדי לפנק אתכם לקראת הפעם הבאה ולהבטיח חוויית אירוח מושלמת ומכל הלב, הכנו עבורכם שובר VIP בלעדי לשהות הבאה של ג'נגו ולונה, שבו אתם בוחרים את הפינוק:

🎁 *תפריט פינוקי VIP מיוחדים לבחירתכם:*
 • 💰 *150 ₪ הנחה ישירה* בשהות הבאה
 • ☀️ *יום כיף ושהות יומית VIP מלאה (09:00-19:00)* מתנה מלאה עבור שני הכלבים
 • 🌙 *צ'ק-אאוט VIP רגוע וגמיש במוצאי שבת או חג (19:00-21:00)* ללא עלות
 • 🦴 *מארז שף גורמה כפול:* עצמות מעושנות טבעיות ומעדני בריאות מובחרים לג'נגו ולונה
 • 🐾 *שיחת ייעוץ והדרכת התנהגות אישית 1-על-1 עם שמוליק*

🏷️ *קוד שובר אישי:* VIP-YANIV-2026
📅 *תוקף השובר:* עד 31.03.2027 (תקף לחצי שנה מלאה)
📌 *השובר כבר מופעל וממתין לכם במערכת!*

לשריון מקום ישיר עם השובר שהוטמע עבורכם בקליק אחד:
👉 https://rezort-webapp.vercel.app/?request=true&voucher=VIP-YANIV-2026

תמיד כאן באהבה גדולה בשבילכם,
שמוליק וצוות הריזורט לכלב 🐾🐕`;

async function queueAndSyncVouchers(action = 'sync') {
  console.log('=== סנכרון שובר ותזמון הודעת צאת יום כיפור ליניב אלעד ===\n');

  // 1. Get current settings from Supabase
  const { data: sRow, error: sErr } = await supabase.from('settings').select('*').single();
  if (sErr || !sRow) {
    console.error('שגיאה בשליפת הגדרות:', sErr);
    return;
  }

  const sData = sRow.data || {};
  const vouchers = sData.vouchers || [];
  const followups = sData.yomKippurCustomFollowups || [];

  // 2. Add or update Yaniv's voucher
  const existingVoucherIdx = vouchers.findIndex(v => v.code === YANIV_VOUCHER.code || v.id === YANIV_VOUCHER.id);
  if (existingVoucherIdx >= 0) {
    vouchers[existingVoucherIdx] = { ...vouchers[existingVoucherIdx], ...YANIV_VOUCHER };
  } else {
    vouchers.push(YANIV_VOUCHER);
  }

  // 3. Add or update Yaniv's queued post-Yom Kippur message
  const existingFollowupIdx = followups.findIndex(f => f.phone === '0545443222' && f.type === 'post_yk_voucher');
  const followupItem = {
    id: 'post_yk_yaniv_voucher_2026',
    name: 'יניב אלעד',
    phone: '0545443222',
    dogName: "ג'נגו ולונה",
    type: 'post_yk_voucher',
    voucherCode: YANIV_VOUCHER.code,
    message: YANIV_POST_YK_MESSAGE,
    status: 'pending',
    scheduledFor: 'motzei_yom_kippur_2026',
    createdAt: new Date().toISOString()
  };

  if (existingFollowupIdx >= 0) {
    followups[existingFollowupIdx] = followupItem;
  } else {
    followups.push(followupItem);
  }

  // 4. Save to Supabase settings
  sData.vouchers = vouchers;
  sData.yomKippurCustomFollowups = followups;

  const { error: upErr } = await supabase.from('settings').update({
    data: sData,
    updated_at: new Date().toISOString()
  }).eq('id', sRow.id);

  if (upErr) {
    console.error('שגיאה בשמירה ל-Supabase:', upErr);
    return;
  }

  console.log('✓ שובר VIP-YANIV-2026 נרשם בהצלחה במסד הנתונים (תוקף עד 31.03.2027)');
  console.log('✓ הודעת הוואטסאפ תוזמנה בהצלחה בתור צאת יום כיפור (yomKippurCustomFollowups)');
  console.log('\n--- תוכן ההודעה שתוזמנה לשליחה ---');
  console.log(YANIV_POST_YK_MESSAGE);
  console.log('-----------------------------------\n');

  // If action is 'send_now' (for testing or immediate execution)
  if (action === 'send_now') {
    console.log('שולח כעת בפועל דרך Green-API...');
    const chatId = '972545443222@c.us';
    const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message: YANIV_POST_YK_MESSAGE })
    });
    const resJson = await res.json();
    console.log('תוצאת שליחה:', resJson);
  }
}

const action = process.argv[2] || 'sync';
queueAndSyncVouchers(action);
