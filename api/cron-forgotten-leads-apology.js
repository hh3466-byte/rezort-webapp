/**
 * =========================================================================
 * Vercel Serverless Handler: /api/cron-forgotten-leads-apology
 * Scheduled for Sunday 01.11.2026 at 16:00 Israel Time (14:00 UTC)
 * 
 * 1. Sends personal apology WhatsApp message + 6-month VIP Gift Voucher
 *    to all 28 leads from Google Sheets who were left behind without response.
 * 2. Registers each 6-month VIP voucher in Supabase (`vouchers` & `settings.data.vouchers`).
 * 3. Registers & archives all 28 leads in `settings.data.intakeRequests` (`status: 'abandoned'`)
 *    so they are removed from Red Lights and moved cleanly to the archive.
 * 4. Sends a completion summary report to Hagai (`054-3200007` -> `972543200007@c.us`).
 * =========================================================================
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const GREEN_API_ID = (process.env.VITE_GREEN_API_ID || "710722735421").trim();
const GREEN_API_TOKEN = (process.env.VITE_GREEN_API_TOKEN || "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b").trim();
const HAGAI_CHAT_ID = "972543200007@c.us";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const FORGOTTEN_LEADS_28 = [
  { name: 'The most common way', phone: '0523407049', date: '2026-10-06', code: 'VIP-7049' },
  { name: 'Elie Riahi', phone: '0509008009', date: '2026-10-06', code: 'VIP-8009' },
  { name: 'Моше Бенчик', phone: '0556605783', date: '2026-10-06', code: 'VIP-5783' },
  { name: 'מוטי גמבש', phone: '0523866350', date: '2026-10-08', code: 'VIP-6350' },
  { name: 'אידה קלוטש', phone: '0528586810', date: '2026-10-09', code: 'VIP-6810' },
  { name: 'דרור', phone: '0546050046', date: '2026-10-10', code: 'VIP-0046' },
  { name: 'Eli Hakun', phone: '0522431362', date: '2026-10-10', code: 'VIP-1362' },
  { name: 'Ginadi Bimbat', phone: '0536268071', date: '2026-10-12', code: 'VIP-8071' },
  { name: 'Rhadia Qubty', phone: '0547860086', date: '2026-10-13', code: 'VIP-0086' },
  { name: 'מירלה קליין', phone: '0524274740', date: '2026-10-14', code: 'VIP-4740' },
  { name: 'גדעון מכנס', phone: '0543976979', date: '2026-10-15', code: 'VIP-6979' },
  { name: 'Rebecca Benzekri', phone: '0528310058', date: '2026-10-15', code: 'VIP-0058' },
  { name: 'עוזי אורון', phone: '0549987604', date: '2026-10-16', code: 'VIP-7604' },
  { name: 'מתוקה', phone: '0502719189', date: '2026-10-17', code: 'VIP-9189' },
  { name: 'Renen Ben David', phone: '0523952679', date: '2026-10-18', code: 'VIP-2679' },
  { name: 'רחל ליברטי', phone: '0528556850', date: '2026-10-20', code: 'VIP-6850' },
  { name: 'Meital Suru', phone: '0546714966', date: '2026-10-20', code: 'VIP-4966' },
  { name: 'Alberto Faigenbom', phone: '0506497038', date: '2026-10-21', code: 'VIP-7038' },
  { name: 'ארי', phone: '0546262618', date: '2026-10-21', code: 'VIP-2618' },
  { name: 'Tamar', phone: '0502057662', date: '2026-10-22', code: 'VIP-7662' },
  { name: 'Menahem Sheffy', phone: '0523413432', date: '2026-10-22', code: 'VIP-3432' },
  { name: 'Idit Weisman', phone: '0543455465', date: '2026-10-25', code: 'VIP-5465' },
  { name: 'גלית יגודייב', phone: '0528724476', date: '2026-10-25', code: 'VIP-4476' },
  { name: 'Libby hermesh', phone: '0545547858', date: '2026-10-26', code: 'VIP-7858' },
  { name: 'Yinon Atzlan', phone: '0526760112', date: '2026-10-26', code: 'VIP-0112' },
  { name: 'Eitan Lazar', phone: '0525256562', date: '2026-10-26', code: 'VIP-6562' },
  { name: 'avi dahan', phone: '0528477423', date: '2026-10-27', code: 'VIP-7423' },
  { name: 'חיים מרקוזה', phone: '0544722880', date: '2026-10-27', code: 'VIP-2880' },
  { name: 'בן משה מוטי', phone: '0509637700', date: '2026-10-28', code: 'VIP-7700' }
];

function getFirstNameForGreeting(rawName) {
  if (!rawName || rawName === 'The most common way') return '';
  const first = rawName.trim().split(/\s+/)[0];
  return first;
}

export function buildApologyMessage(lead) {
  const firstName = getFirstNameForGreeting(lead.name);
  const greeting = firstName ? `היי ${firstName}, כאן שמוליק וצוות הריזורט לכלב 🐾🙏` : `שלום רב, כאן שמוליק וצוות הריזורט לכלב 🐾🙏`;
  const cleanNameParam = (lead.name && lead.name !== 'The most common way') ? `&name=${encodeURIComponent(lead.name.trim())}` : '';
  const personalLink = `https://rezort-webapp.vercel.app/?request=true&phone=${encodeURIComponent(lead.phone)}${cleanNameParam}&voucher=${encodeURIComponent(lead.code)}`;

  return `${greeting}

חשוב לנו לפנות אליך אישית ולהתנצל מעומק הלב: עקב תקלת מערכת מבישה בצד שלנו, פנייתך אלינו מהתקופה האחרונה נותרה מאחור ללא מענה. אנחנו מתנצלים בפניך התנצלות עמוקה ומבקשים סליחה – זה ממש לא הסטנדרט שלנו.

נשמח מאוד לתקן, לעמוד לשירותך ולהעניק לך ולכלבך חוויה מושלמת ב*ריזורט לכלב*:
🏡 *פנסיון בוטיק בתנאי VIP:* סוויטות שינה אישיות ומרווחות, מדשאות ענק ירוקות ומגודרות למשחקים חופשיים, טיולי טבע יומיים, השגחה צמודה מסביב לשעון ועדכון יומי בוואטסאפ.
🎓 *אילוף מקצועי בהובלת שמוליק:* תוכניות אילוף בתנאי פנסיון או תהליכים ממוקדים למשמעת, הליכה רגועה ברצועה, חינוך גורים ופתרון בעיות התנהגות, כולל ליווי והדרכה אישית לבעלים.

🎁 *כאות התנצלות אמיתית, אנו מעניקים לך שובר שי VIP – בתוקף מיוחד לחצי שנה הקרובה (עד 01.05.2027)!*
השובר מאפשר לך לבחור *הטבה אחת במתנה* מתוך תפריט הפינוקים שלנו:
• 💰 *100 ₪ הנחה ישירה* (בשהות של 3 ימים ומעלה)
• ☀️ *יום כיף ושהות יומית VIP במתחם הדשא (09:30–18:30) במתנה!*
• 🐾 *שיחת ייעוץ והדרכת התנהגות אישית 1-על-1 עם שמוליק במתנה* (שווי ₪250)
• 🌙 *צ'ק-אאוט VIP רגוע במוצ"ש או חג (19:00–21:00)* ללא עלות נוספת
• 🦴 *מארז שף גורמה בסוויטה* (עצם לעיסה מעושנת + מעדני בריאות)
• 📸 *בוק צילומי VIP מקצועי* מהחופשה בריזורט
• 🧠 *סשן משחקי חשיבה והעשרה מנטלית (Brain Games)*

🏷️ *קוד השובר האישי שלך:* *${lead.code}* *(תקף לחצי שנה – עד 01.05.2027)*

נשמח מאוד שתפנה/י אלינו שוב כאן בהודעה חוזרת, או בלחיצה על הקישור האישי שלך (השובר כבר מוזן בפנים):
👉 \u200E${personalLink}

שוב סליחה מכל הלב, ומחכים לפנק אתכם! ❤️🐕
*שמוליק וצוות הריזורט לכלב* 🐾`;
}

async function sendGreenApiMessage(chatId, message) {
  const clusterPrefix = GREEN_API_ID.slice(0, 4) || '7107';
  const url = `https://${clusterPrefix}.api.greenapi.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message })
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText };
    }
    const data = await res.json();
    return { ok: true, idMessage: data.idMessage };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function runForgottenLeadsApologyCampaign({ dryRun = false, force = false } = {}) {
  const { data: sRows } = await supabase.from('settings').select('*').eq('id', 'resort_config');
  const sRow = sRows?.[0] || {};
  const curData = sRow.data || {};

  if (curData.forgottenLeadsApologySentAt && !force && !dryRun) {
    return {
      ok: true,
      alreadySent: true,
      sentAt: curData.forgottenLeadsApologySentAt
    };
  }

  const curIntakes = Array.isArray(curData.intakeRequests) ? [...curData.intakeRequests] : [];
  const curVouchers = Array.isArray(curData.vouchers) ? [...curData.vouchers] : [];
  const syncedSheetPhones = new Set(Array.isArray(curData.syncedSheetPhones) ? curData.syncedSheetPhones : []);
  const nowIso = new Date().toISOString();
  const expiryDate = '2027-05-01'; // 6 months validity

  const results = [];
  let sentCount = 0;
  let failedCount = 0;

  for (const lead of FORGOTTEN_LEADS_28) {
    const cleanPhone = lead.phone.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.slice(1) : cleanPhone;
    const chatId = `${intlPhone}@c.us`;
    const message = buildApologyMessage(lead);

    let sendRes = { ok: true, idMessage: 'DRY_RUN' };
    if (!dryRun) {
      sendRes = await sendGreenApiMessage(chatId, message);
    }

    if (sendRes.ok) sentCount++;
    else failedCount++;

    results.push({
      name: lead.name,
      phone: lead.phone,
      code: lead.code,
      ok: sendRes.ok,
      idMessage: sendRes.idMessage || null,
      error: sendRes.error || null
    });

    if (!dryRun) {
      // 1. Create 6-month VIP Voucher in memory & Supabase
      const voucherObj = {
        id: `vouch_apology_${cleanPhone.slice(-4)}`,
        code: lead.code,
        type: 'loyalty',
        customerName: lead.name === 'The most common way' ? 'לקוח VIP' : lead.name,
        dogName: 'כלב',
        phone: lead.phone,
        benefitText: 'שובר שי VIP לבחירה אישית מתוך תפריט הפינוקים (תוקף מיוחד לחצי שנה עד 01.05.2027)',
        status: 'active',
        createdAt: nowIso,
        expiryDate,
        notes: 'שובר שי והתנצלות לליד שנשכח מאחור (תקף ל-6 חודשים עד 01.05.2027)'
      };

      const vIdx = curVouchers.findIndex(v => v.code === lead.code);
      if (vIdx >= 0) curVouchers[vIdx] = voucherObj;
      else curVouchers.unshift(voucherObj);

      try {
        await supabase.from('vouchers').upsert({
          id: voucherObj.id,
          code: voucherObj.code,
          type: voucherObj.type,
          customer_name: voucherObj.customerName,
          dog_name: voucherObj.dogName,
          phone: voucherObj.phone,
          benefit_text: voucherObj.benefitText,
          status: voucherObj.status,
          created_at: voucherObj.createdAt,
          expiry_date: voucherObj.expiryDate,
          notes: voucherObj.notes,
          data: voucherObj
        });
      } catch (_) {}

      // 2. Ensure lead is registered in intakeRequests and moved to archive ('abandoned') so it is removed from Red Lights!
      const phoneSuffix = cleanPhone.slice(-7);
      const existingIdx = curIntakes.findIndex(r => (r.ownerPhone || '').replace(/\D/g, '').slice(-7) === phoneSuffix);
      const archiveNote = `[01/11 16:00] נשלחה הודעת התנצלות אישית + שובר שי VIP לחצי שנה (${lead.code}) והועבר לארכיון (${sendRes.idMessage || 'נשלח'})`;

      if (existingIdx >= 0) {
        curIntakes[existingIdx] = {
          ...curIntakes[existingIdx],
          status: 'abandoned',
          voucherCode: lead.code,
          internalNotes: curIntakes[existingIdx].internalNotes
            ? `${curIntakes[existingIdx].internalNotes} | ${archiveNote}`
            : archiveNote
        };
      } else {
        curIntakes.push({
          id: `lead_apology_${lead.date.replace(/-/g, '')}_${cleanPhone.slice(-4)}`,
          createdAt: `${lead.date}T10:00:00.000Z`,
          status: 'abandoned',
          ownerName: lead.name === 'The most common way' ? 'לקוח מתעניין' : lead.name,
          ownerPhone: lead.phone,
          ownerEmail: '',
          dogName: 'ממתין לבירור בשיחה 🐶',
          dogBreed: '',
          dogAge: '',
          serviceType: 'boarding',
          startDate: '2026-11-05',
          endDate: '2026-11-10',
          clientOrigin: 'meta_lead',
          voucherCode: lead.code,
          notes: `[📢 ליד מגיליון Google Sheets מתאריך ${lead.date}] | שובר התנצלות VIP: ${lead.code}`,
          internalNotes: archiveNote,
          termsAccepted: false
        });
      }

      syncedSheetPhones.add(cleanPhone);
    }
  }

  if (!dryRun) {
    await supabase
      .from('settings')
      .update({
        data: {
          ...curData,
          intakeRequests: curIntakes,
          vouchers: curVouchers,
          syncedSheetPhones: Array.from(syncedSheetPhones),
          forgottenLeadsApologySentAt: nowIso,
          forgottenLeadsApologySummary: {
            sentAt: nowIso,
            totalTargets: FORGOTTEN_LEADS_28.length,
            sentCount,
            failedCount
          }
        },
        updated_at: nowIso
      })
      .eq('id', 'resort_config');

    // 3. Report completion to Hagai (054-3200007)
    const reportToHagai = `🐾 *דיווח ביצוע משלוח הודעות התנצלות ושוברי שי (16:00)* ✅

בוצע כעת משלוח הודעת ההתנצלות האישית + שובר שי VIP (בתוקף לחצי שנה עד 01.05.2027) לכל הפונים שנשכחו מאחור בגיליון הלידים:
📊 *סה״כ נשלחו בהצלחה:* ${sentCount} מתוך ${FORGOTTEN_LEADS_28.length} פונים (${failedCount === 0 ? '0 כשלים 🟢' : `${failedCount} כשלים`}).
🎁 *שוברי שי VIP:* הוקמו במערכת ${sentCount} שוברים אישיים בתוקף ל-6 חודשים.
🗄️ *ארכיון ואורות אדומים:* כל ${FORGOTTEN_LEADS_28.length} הפונים תויקו בארכיון והוסרו מהאורות האדומים (אם מישהו מהם ישיב או ימלא שאלון – הוא יוקפץ אוטומטית לראש "שאלונים לבדיקה" של שמוליק).`;

    await sendGreenApiMessage(HAGAI_CHAT_ID, reportToHagai);
  }

  return {
    ok: true,
    dryRun,
    totalTargets: FORGOTTEN_LEADS_28.length,
    sentCount,
    failedCount,
    results
  };
}

export default async function handler(req, res) {
  try {
    const dryRun = req.query?.dryRun === 'true';
    const force = req.query?.force === 'true';
    const result = await runForgottenLeadsApologyCampaign({ dryRun, force });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Error in cron-forgotten-leads-apology:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

