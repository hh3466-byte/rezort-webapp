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

function cleanPhoneNumber(p) {
  if (!p) return '';
  return String(p).replace(/\D/g, '');
}

function normalizeHebrew(str = '') {
  return str
    .toLowerCase()
    .trim()
    .replace(/[״"׳']/g, '')
    .replace(/ו{2,}/g, 'ו')
    .replace(/י{2,}/g, 'י');
}

function hasActiveBookingForIntake(r, bookings = []) {
  if (!bookings || bookings.length === 0) return false;
  const rPhone = cleanPhoneNumber(r.ownerPhone);
  const rDog = normalizeHebrew(r.dogName);

  return bookings.some(b => {
    const d = b.data || {};
    const stayStatus = b.stay_status || d.stayStatus;
    if (stayStatus === 'cancelled') return false;
    const bPhone = cleanPhoneNumber(b.owner_phone || d.ownerPhone);
    const bDog = normalizeHebrew(b.dog_name || d.dogName);
    const bOwner = normalizeHebrew(b.owner_name || d.ownerName);
    const rOwner = normalizeHebrew(r.ownerName);

    const phoneMatch = Boolean(bPhone && rPhone && (bPhone.slice(-7) === rPhone.slice(-7)));
    const dogMatch = Boolean(bDog && rDog && (bDog === rDog || bDog.includes(rDog) || rDog.includes(bDog)));
    return phoneMatch || (dogMatch && rOwner && bOwner.includes(rOwner));
  });
}

function getIntakeRequestAgeHours(r) {
  const created = new Date(r.createdAt || r.startDate).getTime();
  if (isNaN(created)) return 0;
  return (Date.now() - created) / (1000 * 60 * 60);
}

function getEffectiveIntakeStatus(r, bookings = []) {
  const status = r.status;
  if (status === 'approved') return 'approved';
  if (hasActiveBookingForIntake(r, bookings)) return 'approved';
  return status;
}

function isUnansweredIntakeRequest(r, bookings = []) {
  const status = r.status;
  if (status === 'approved' || hasActiveBookingForIntake(r, bookings)) return false;
  if (status === 'rejected') return false;
  const notes = r.internalNotes || '';
  const hasUnansweredNote = notes.includes('לא ענה') || notes.includes('תזכורת שיווקית');
  const isAgeOver24h = getIntakeRequestAgeHours(r) >= 24;
  return hasUnansweredNote || isAgeOver24h;
}

function isIntakeRequestInTreatment(r, bookings = []) {
  if (isUnansweredIntakeRequest(r, bookings)) return false;
  const effStatus = getEffectiveIntakeStatus(r, bookings);
  const notes = r.internalNotes || '';
  return effStatus === 'payment_requested' || (effStatus === 'pending' && Boolean(notes && notes.trim()));
}

function generateUnansweredFollowUpMarketingText(ownerName, dogName, serviceType, intakeUrl) {
  const firstName = ownerName && ownerName !== 'לקוח' && !ownerName.startsWith('05')
    ? ownerName.trim().split(' ')[0]
    : '';
  const greeting = firstName ? `היי ${firstName}! 🐾` : 'היי! 🐾';
  const dogMention = dogName ? ` עבור *${dogName}*` : '';

  return `${greeting}
ניסינו לתפוס אתכם בטלפון בהמשך לפנייתכם ל"ריזורט לכלב"${dogMention} 🐕🤍

רצינו לשתף אתכם בכמה מילים על החוויה המיוחדת ועל מה שאנחנו עושים אצלנו בריזורט:

🏡 **פנסיון בוטיק בתנאי VIP:**
• סוויטות שינה אישיות, מרווחות ומאווררות – ללא כלובים!
• מדשאות ענק ירוקות, מוצלות ומאובטחות למשחקים חופשיים ולהוצאת אנרגיה
• טיולי טבע יומיים מודרכים באוויר הפתוח
• השגחה צמודה, יחס אישי חם והמון אהבה מסביב לשעון
• עדכון יומי בוואטסאפ על ההתאקלמות והשגרה – כדי שתוכלו לבלות בראש שקט ב-100%!
• התאמה מלאה לאופי הכלב (קבוצות משחק חברתיות / אגף שקט 1-על-1)

🎓 **אילוף מקצועי וחינוך משמעת בהובלת שמוליק:**
• שילוב אילוף במהלך השהות בפנסיון (Board & Train) או בתהליכים ממוקדים
• עבודה על פקודות משמעת, הליכה רגועה ברצועה וגבולות
• חינוך גורים ופתרון בעיות התנהגות מורכבות
• הדרכה מעשית לבעלים בסיום התהליך להצלחה מובטחת גם בבית!

🌟 **מוזמנים להתרשם מהעמודים שלנו ומהביקורות החמות של האורחים:**
📘 פייסבוק: https://www.facebook.com/profile.php?id=61576998315714&sk=reviews
📷 אינסטגרם: https://www.instagram.com/dogz.resort/
${intakeUrl ? `\n📋 קישור לשאלון הקליטה המהיר:\n${intakeUrl}\n` : ''}
נשמח לדבר כשתהיו פנויים ולתת לכם ול${dogName || 'כלבכם'} את המענה הטוב ביותר! 🐶❤️
שמוליק וצוות הריזורט לכלב`;
}

async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`=== 08:30 AM Orange Follow-Up Marketing Runner (DryRun: ${isDryRun}) ===`);

  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: sRow } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();

  const intakes = sRow?.data?.intakeRequests || [];
  const settings = sRow?.data || {};

  const candidates = intakes.filter(r => {
    if (!isIntakeRequestInTreatment(r, bookings)) return false;
    const notes = r.internalNotes || '';
    if (notes.includes('תזכורת שיווקית') || notes.includes('הודעת שיווק')) return false;
    return true;
  });

  console.log(`Found ${candidates.length} active candidate(s) in Orange Button:`);
  candidates.forEach(c => {
    console.log(`• [${c.id}] כלב: ${c.dogName} | בעלים: ${c.ownerName} | טלפון: ${c.ownerPhone} | גיל בשעות: ${getIntakeRequestAgeHours(c).toFixed(1)}`);
  });

  if (candidates.length === 0) {
    console.log('No candidates pending follow-up at this moment.');
    return;
  }

  const intakeUrl = 'https://rezort-webapp.vercel.app/?intake=true';
  const idInstance = env.VITE_GREEN_API_ID_INSTANCE || settings.greenApiIdInstance || '7105260195';
  const apiToken = env.VITE_GREEN_API_TOKEN || settings.greenApiToken || 'a4e3fae5ad7d40238eeb4bb4cb077dffad82ce7f642646c2b1';

  let updatedIntakes = [...intakes];

  for (const c of candidates) {
    const phone = cleanPhoneNumber(c.ownerPhone);
    const text = generateUnansweredFollowUpMarketingText(c.ownerName, c.dogName, c.serviceType, intakeUrl);

    console.log(`\n--- Preparing Follow-Up for ${c.ownerName} (${phone}) ---`);
    console.log(text.slice(0, 200) + '...\n');

    if (isDryRun) {
      console.log(`[DRY-RUN] Skipped actual WhatsApp transmission.`);
      continue;
    }

    try {
      const chatId = `${phone}@c.us`;
      const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiToken}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: text })
      });
      const data = await resp.json();
      console.log(`Message sent successfully:`, data);

      const now = new Date();
      const timeStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} 08:30`;
      const stamp = `[${timeStr}] 📲 נשלחה תזכורת שיווקית בוואטסאפ (לא ענה בטלפון - 08:30)`;

      updatedIntakes = updatedIntakes.map(item => {
        if (item.id === c.id) {
          return {
            ...item,
            internalNotes: item.internalNotes ? `${item.internalNotes} | ${stamp}` : stamp
          };
        }
        return item;
      });
    } catch (err) {
      console.error(`Failed to send to ${phone}:`, err);
    }
  }

  if (!isDryRun) {
    await supabase.from('settings').update({
      data: { ...settings, intakeRequests: updatedIntakes }
    }).eq('id', 'resort_config');
    console.log(`Updated notes in Supabase. Requests are now tagged as unanswered and moved to archive.`);
  }
}

run();
