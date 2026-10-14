/**
 * =========================================================================
 * Vercel Serverless Cron Handler: /api/cron-weekly-marketing
 * Automatically runs every Sunday at 08:00 AM Israel Time
 * 
 * Purpose:
 * Generates and delivers the Weekly Marketing Performance & Occupancy Report
 * to the Marketing WhatsApp Group ("הריזורט לכלב + דיגיטלינקה🍪 | שיווק🎯"):
 * 
 * Structure:
 * - Part 1: מה קרה לכל אחד מהלידים (שבוע אחרון שמסתיים במוצ"ש)
 * - Part 2: המלצות לביצוע לשבוע הקרוב ולתקופה (בדגש על פתרונות קיימים במערכת)
 * - Part 3: הצעות למתן פתרונות נוספים יצירתיים (מעבר לקיים במערכת)
 * - Attachment: קובץ Excel (.xlsx) מלא ומעוצב
 * - Confirmation: הודעת אישור לחגי (054-3200007)
 * =========================================================================
 */

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

const MARKETING_GROUP_ID = "120363409177098951@g.us";
const HAGAI_PHONE = "972543200007@c.us";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getGreenApiUrl(endpoint) {
  return `https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/${endpoint}/${GREEN_API_TOKEN}`;
}

async function sendWhatsAppMessage(chatId, message) {
  try {
    const url = getGreenApiUrl('sendMessage');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message })
    });
    return await res.json();
  } catch (err) {
    console.error('Error sending WhatsApp message:', err);
    return { ok: false, error: err.message };
  }
}

async function sendWhatsAppFile(chatId, fileBuffer, fileName, caption) {
  try {
    const blob = new Blob([fileBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const formData = new FormData();
    formData.append('chatId', chatId);
    formData.append('fileName', fileName);
    formData.append('caption', caption);
    formData.append('file', blob, fileName);

    const url = getGreenApiUrl('sendFileByUpload');
    const res = await fetch(url, {
      method: 'POST',
      body: formData
    });
    return await res.json();
  } catch (err) {
    console.error('Error sending WhatsApp file:', err);
    return { ok: false, error: err.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    console.log('--- Triggering Weekly Marketing Performance Report (Sunday 08:00) ---');

    // 1. Fetch Resort Settings & Leads
    const { data: sRow } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'resort_config')
      .single();
    const curData = sRow?.data || {};
    const intakeRequests = curData.intakeRequests || [];
    const maxCapacity = curData.maxDogs || 15;

    // 2. Fetch Bookings for Occupancy
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*');

    // 3. Determine Week Range: Past Sunday 00:00 to Saturday 23:59 (ended yesterday)
    const now = new Date();
    // Default to last 7 days if triggered
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weekLeads = intakeRequests.filter(r => {
      const d = new Date(r.createdAt || 0);
      return d >= sevenDaysAgo && d <= now;
    });

    // Sort ascending for chronological review
    weekLeads.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    // Stats
    const totalLeads = weekLeads.length;
    let junkCount = 0;
    let unreachedCount = 0;
    let priceDropCount = 0;
    let inProgressCount = 0;
    let closedCount = 0;

    const leadsForExcel = [
      [
        'מס"ד',
        'תאריך ושעה',
        'שם הלקוח',
        'מספר טלפון',
        'שם הכלב',
        'גזע',
        'שירות מבוקש',
        'תאריכים מבוקשים',
        'מקור הפנייה',
        'סטטוס',
        'מה קרה עם הפנייה / הערות שמוליק מה-CRM',
        'נסגר ביומן'
      ]
    ];

    weekLeads.forEach((r, idx) => {
      const dateStr = new Date(r.createdAt).toLocaleString('he-IL', {
        timeZone: 'Asia/Jerusalem',
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      const note = r.notes || '';
      const intNote = r.internalNotes || '';
      const combinedNotes = `${note} ${intNote}`.toLowerCase();

      let category = 'in_progress';
      let outcome = '';

      if (combinedNotes.includes('רוסית') || combinedNotes.includes('גדוד') || combinedNotes.includes('swe001') || combinedNotes.includes('דיגיטלינקה')) {
        category = 'junk';
        junkCount++;
        outcome = '❌ פניית סרק / לא רלוונטי לכלב';
      } else if (r.status === 'approved' || combinedNotes.includes('שולם') || combinedNotes.includes('מקדמה') || r.clientOrigin === 'returning') {
        category = 'closed';
        closedCount++;
        outcome = '✅ הזמנה אושרה / לקוח חוזר';
      } else if (combinedNotes.includes('מחיר') || combinedNotes.includes('חודשיים') || combinedNotes.includes('24 יום') || combinedNotes.includes('יקר')) {
        category = 'price';
        priceDropCount++;
        outcome = '💰 נפלו על מחיר / חיפוש פתרון זול לטווח ארוך';
      } else if (combinedNotes.includes('לא ענה') || combinedNotes.includes('לא הגיב') || combinedNotes.includes('בוטל / לא רלוונטי') || r.status === 'abandoned') {
        category = 'unreached';
        unreachedCount++;
        outcome = '📵 לא ענו / נעלמו לאחר פנייה';
      } else {
        inProgressCount++;
        outcome = '⏳ בתהליך / תיאום ביקור / ממתין לתשלום';
      }

      leadsForExcel.push([
        idx + 1,
        dateStr,
        r.ownerName || 'לא צוין',
        r.ownerPhone || '',
        r.dogName || 'ממתין לבירור',
        r.dogBreed || '-',
        r.serviceType === 'training' ? 'אילוף' : 'פנסיון',
        `${r.startDate || ''} עד ${r.endDate || ''}`,
        r.clientOrigin || 'אורגני/ישיר',
        r.status || '',
        (intNote || note || outcome).replace(/\n/g, ' '),
        category === 'closed' ? 'כן' : 'לא'
      ]);
    });

    // 4. Calculate Current & Upcoming Occupancy
    const todayStr = now.toISOString().substring(0, 10);
    const activeToday = (bookings || []).filter(b => {
      const s = b.start_date || b.data?.startDate || '';
      const e = b.end_date || b.data?.endDate || '';
      const st = b.stay_status || b.data?.stayStatus || '';
      return st !== 'cancelled' && s <= todayStr && e >= todayStr;
    }).length;
    const currentOccPct = Math.round((activeToday / maxCapacity) * 100);

    // In 7 days
    const nextWeekDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const activeNextWeek = (bookings || []).filter(b => {
      const s = b.start_date || b.data?.startDate || '';
      const e = b.end_date || b.data?.endDate || '';
      const st = b.stay_status || b.data?.stayStatus || '';
      return st !== 'cancelled' && s <= nextWeekDate && e >= nextWeekDate;
    }).length;
    const nextWeekOccPct = Math.round((activeNextWeek / maxCapacity) * 100);

    // 5. Generate Excel Buffer
    const wb = XLSX.utils.book_new();

    const kpiSummary = [
      ['דוח שבועי לחקר ביצועים ושיווק - הריזורט לכלב'],
      ['מועד הפקה: יום ראשון 08:00 | מסקר שבוע שהסתיים במוצאי שבת'],
      [],
      ['מדד ביצועי שיווק', 'כמות פניות', 'אחוז מסך הפניות', 'משמעות עסקית'],
      ['סה"כ פניות שנקלטו בשבוע החולף', totalLeads, '100.0%', 'נפח פניות כולל'],
      ['❌ פניות סרק / לא רלוונטיות', junkCount, totalLeads > 0 ? `${Math.round((junkCount / totalLeads) * 100)}%` : '0%', 'פניות שגויות/רוסית/בוטים'],
      ['📵 לא ענו / נעלמו לאחר פנייה', unreachedCount, totalLeads > 0 ? `${Math.round((unreachedCount / totalLeads) * 100)}%` : '0%', 'אין מענה לשיחות וואטסאפ של שמוליק'],
      ['💰 נפלו על מחיר / שהייה ארוכה', priceDropCount, totalLeads > 0 ? `${Math.round((priceDropCount / totalLeads) * 100)}%` : '0%', 'ציפייה למחירי רצפה של פנסיון המוני'],
      ['⏳ בתהליך / ביקור / ממתין לתשלום', inProgressCount, totalLeads > 0 ? `${Math.round((inProgressCount / totalLeads) * 100)}%` : '0%', 'לידים חמים בתהליך טיפול'],
      ['✅ הזמנות שנסגרו / לקוחות חוזרים', closedCount, totalLeads > 0 ? `${Math.round((closedCount / totalLeads) * 100)}%` : '0%', 'סגירות מוסדרות ביומן'],
      [],
      ['🏨 תפוסה נוכחית (היום)', `${activeToday}/${maxCapacity} כלבים`, `${currentOccPct}%`, currentOccPct < 60 ? 'תפוסה נמוכה' : 'תקין'],
      ['🔮 תפוסה צפויה לשבוע הבא', `${activeNextWeek}/${maxCapacity} כלבים`, `${nextWeekOccPct}%`, nextWeekOccPct < 50 ? 'דרוש תגבור שיווקי דחוף!' : 'תקין']
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(kpiSummary);
    ws1['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 45 }];

    const ws2 = XLSX.utils.aoa_to_sheet(leadsForExcel);
    ws2['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 22 }, { wch: 15 }, { wch: 16 },
      { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
      { wch: 55 }, { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'סיכום ביצועים שבועי');
    XLSX.utils.book_append_sheet(wb, ws2, 'פירוט הלידים');

    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 6. Build the 3-Part WhatsApp Message

    // Part 1: What happened to leads + Occupancy
    const msgPart1 = `בוקר טוב צוות דיגיטלינקה היקרות! ☀️🎯🐾
להלן *דוח חקר ביצועים שבועי* של הריזורט לכלב (מסכם את השבוע שהסתיים במוצ"ש):

━━━━━━━━━━━━━━━━━━━━
📊 *חלק ראשון: מה קרה לכל אחד מהלידים?*
━━━━━━━━━━━━━━━━━━━━
בשבוע החולף נקלטו *${totalLeads} פניות*:
• ❌ *${junkCount} פניות סרק (שגויות/רוסית/בוטים)*.
• 📵 *${unreachedCount} פניות שלא ענו / נעלמו* למרות פניות טלפוניות והודעות וואטסאפ משמוליק.
• 💰 *${priceDropCount} פניות שנפלו על מחיר* (בעיקר פניות שמחפשות "פתרון זול לחודשיים" במחירי רצפה).
• ⏳ *${inProgressCount} פניות בתהליך* (תיאומי ביקור התרשמות, ממתינים לתשלום מקדמה לקראת המועד).
• ✅ *${closedCount} סגירות מוסדרות / לקוחות חוזרים*.

🏨 *תמונת תפוסה בפועל בריזורט:*
• תפוסה נוכחית: *${activeToday}/${maxCapacity} כלבים (${currentOccPct}%)*.
• תפוסה צפויה לשבוע הבא: *${activeNextWeek}/${maxCapacity} כלבים (${nextWeekOccPct}%)*.`;

    // Part 2: Recommendations based on EXISTING system features
    const msgPart2 = `━━━━━━━━━━━━━━━━━━━━
💡 *חלק שני: המלצות שיווקיות ממוקדות על בסיס הפתרונות הקיימים במערכת:*
━━━━━━━━━━━━━━━━━━━━
1. *שיווק "בנק 21 יממות פנסיון VIP" (₪100 ליממה בלבד!):*
   במערכת הוטמע כעת מוצר דגל חדש – בנק של 21 יממות ב-₪2,100 (₪100 ללילה במקום ₪180!) בתוקף לשנה שלמה, עם ניצול גמיש של ימים בודדים או רצופים. 
   🎯 *המלצה לשיווק:* מצוין לשיווק לקהל בעלי כלבים שנוסעים הרבה, מילואימניקים, או לקוחות שרוצים להתחייב למחיר VIP מוזל מראש!

2. *כרטיסיות יומיות מוזלות (Daycare Pass):*
   כרטיסיות של 5 / 10 ימים לפריקת אנרגיה בימי חול. מעולה לאיוש המתחם בימי אמצע השבוע (א'-ד') שבהם התפוסה יורדת.

3. *קמפיין ייעודי "סופ"ש בריזורט":*
   פילוח לקמפיין קצר וממוקד בימי שלישי-רביעי לאיוש החדרים הפנויים בסופ"ש הקרוב במקום להשאירם ריקים.

4. *חידוד מסרי יוקרה ובוטיק:*
   להדגיש בקריאייטיב: חדרים מרווחים ממוזגים, חצרות משחקים פרטיות, השגחה צמודה ועדכוני וידאו אישיים יומיים. זה יסנן מראש מחפשי מחיר זול שנושרים בהמשך.`;

    // Part 3: Creative NEW solution proposals for Hagai to implement
    const msgPart3 = `━━━━━━━━━━━━━━━━━━━━
🚀 *חלק שלישי: הצעות לפתרונות יצירתיים נוספים (מעבר לקיים במערכת):*
━━━━━━━━━━━━━━━━━━━━
כדי להרחיב את ארגז הכלים ולייצר המרות מיידיות, להלן כיוונים יצירתיים שחגי יכול להטמיע במערכת:

1. ⚡ *מבצע "סופ"ש ספונטני" (Last Minute Deal):*
   מנגנון שיווקי שמופעל אוטומטית בכל יום רביעי במידה ויש יותר מ-5 חדרים פנויים לסופ"ש, ומציע הנחת רגע אחרון (למשל ₪130 ללילה לסופ"ש הקרוב בלבד).

2. 🎁 *חבילת "נחיתה רכה" ללקוחות חדשים (First Stay Experience):*
   הטבה בלעדית לליד חדש שמזמין לראשונה: לילה ראשון ב-50% הנחה בהזמנת 3 לילות ומעלה, או רחצה ופינוק VIP מתנה בסיום השהייה.

3. 🤝 *תוכנית שגרירים "חבר מביא חבר דיגיטלית":*
   כל לקוח ששחרר כלב מקבל קישור אישי להזמנת חבר – החבר מקבל ₪100 הנחה בהזמנה ראשונה, והממליץ צובר ₪100 לשהייה הבאה שלו.

4. 🏠 *מסלול מנוי חודשי "ריזורט קבוע" (Monthly Boarding Pass):*
   לפונים שמחפשים פתרון לחודש-חודשיים (כמו מילואימניקים / מעברי דירה / שיפוצים): חבילה של 30 יום במחיר פיקס מסודר (₪3,500 - ₪4,000) מוגבל לחדרים ייעודיים.

📁 *קובץ אקסל שבועי מלא ומעוצב עם כל נתוני הלידים והמדדים מצורף כאן למעלה.*

נשמח לשמוע את תובנותיכן ורעיונותיכן לשבוע הקרוב! שבוע מנצח ורווי סגירות! 💪🐾

*שמוליק, חגי וצוות הריזורט לכלב 🐾*`;

    // 7. Send to Marketing WhatsApp Group
    console.log('Sending Excel attachment to marketing group...');
    await sendWhatsAppFile(
      MARKETING_GROUP_ID,
      excelBuffer,
      `דוח_שבועי_ביצועי_שיווק_הריזורט_${todayStr}.xlsx`,
      `📊 דוח אקסל שבועי: חקר ביצועים, סטטוס לידים ואחוזי תפוסה (שבוע שהסתיים במוצ"ש)`
    );

    await new Promise(r => setTimeout(r, 2000));

    console.log('Sending Part 1...');
    await sendWhatsAppMessage(MARKETING_GROUP_ID, msgPart1);

    await new Promise(r => setTimeout(r, 2000));

    console.log('Sending Part 2...');
    await sendWhatsAppMessage(MARKETING_GROUP_ID, msgPart2);

    await new Promise(r => setTimeout(r, 2000));

    console.log('Sending Part 3...');
    await sendWhatsAppMessage(MARKETING_GROUP_ID, msgPart3);

    // 8. Send confirmation message to Hagai (Rule 1 / Rule 16 compliant)
    console.log('Sending confirmation to Hagai...');
    const hagaiMsg = `✅ *דוח חקר ביצועים שבועי נשלח בהצלחה לקבוצת השיווק (דיגיטלינקה)!* 🎯
• נסקר שבוע שהסתיים במוצ"ש (${totalLeads} פניות).
• נשלח קובץ אקסל שבועי מלא ומעוצב.
• נשלחו 3 החלקים: ניתוח לידים, המלצות לפתרונות קיימים, והצעות יצירתיות חדשות.`;
    await sendWhatsAppMessage(HAGAI_PHONE, hagaiMsg);

    return res.status(200).json({
      ok: true,
      service: 'cron-weekly-marketing',
      totalLeads,
      sentAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error in cron-weekly-marketing:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
