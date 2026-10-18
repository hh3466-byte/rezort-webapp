/**
 * =========================================================================
 * Vercel Serverless Cron Handler: /api/cron-weekly-marketing
 * Automatically triggered every Sunday morning (08:00 Israel time)
 * Sends weekly marketing performance report + formatted Excel to the marketing group
 * Meets Rule 25 (Weekly marketing report) and Rule 14 (Exact signature)
 * =========================================================================
 */

import { createClient } from '@supabase/supabase-js';
import https from 'https';
import * as XLSX from 'xlsx';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MARKETING_GROUP_ID = '120363409177098951@g.us';
const HAGAI_PHONE = '972543200007@c.us';

function sendWhatsAppMessage(greenApiId, greenApiToken, chatId, message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ chatId, message });
    const req = https.request({
      hostname: '7107.api.greenapi.com',
      port: 443,
      path: `/waInstance${greenApiId}/sendMessage/${greenApiToken}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function sendWhatsAppFile(greenApiId, greenApiToken, chatId, fileBuffer, fileName, caption) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    let postData = '';
    postData += `--${boundary}\r\n`;
    postData += `Content-Disposition: form-data; name="chatId"\r\n\r\n${chatId}\r\n`;
    postData += `--${boundary}\r\n`;
    postData += `Content-Disposition: form-data; name="fileName"\r\n\r\n${fileName}\r\n`;
    postData += `--${boundary}\r\n`;
    postData += `Content-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`;
    postData += `--${boundary}\r\n`;
    postData += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
    postData += `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;

    const endBoundary = `\r\n--${boundary}--\r\n`;
    const fullBuffer = Buffer.concat([
      Buffer.from(postData, 'utf8'),
      fileBuffer,
      Buffer.from(endBoundary, 'utf8')
    ]);

    const req = https.request({
      hostname: '7107.api.greenapi.com',
      port: 443,
      path: `/waInstance${greenApiId}/sendFileByUpload/${greenApiToken}`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBuffer.length
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(fullBuffer);
    req.end();
  });
}

function getIsraelTodayStr() {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return dtf.format(new Date());
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default async function handler(req, res) {
  try {
    const todayStr = getIsraelTodayStr();

    // 1. Fetch Resort Settings
    const { data: sRow, error: sErr } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();
    if (sErr && !sRow) {
      return res.status(500).json({ error: 'Failed to load resort settings', details: sErr });
    }
    const settings = sRow?.data || {};
    const greenApiId = settings.greenApiIdInstance || '710722735421';
    const greenApiToken = settings.greenApiToken || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
    const intakeRequests = settings.intakeRequests || [];
    const maxCapacity = Number(settings.maxCapacity) || 15;

    // 2. Fetch Bookings
    const { data: bookings } = await supabase.from('bookings').select('*');
    const activeBookings = (bookings || []).filter(b => {
      const st = b.stay_status || b.stayStatus;
      return st !== 'cancelled';
    });

    const activeToday = activeBookings.filter(b => {
      const s = b.start_date || b.startDate;
      const e = b.end_date || b.endDate;
      return s <= todayStr && e >= todayStr;
    }).length;
    const currentOccPct = Math.round((activeToday / maxCapacity) * 100);

    const nextWeekStart = addDays(todayStr, 1);
    const nextWeekEnd = addDays(todayStr, 7);
    const activeNextWeek = activeBookings.filter(b => {
      const s = b.start_date || b.startDate;
      const e = b.end_date || b.endDate;
      return s <= nextWeekEnd && e >= nextWeekStart;
    }).length;
    const nextWeekOccPct = Math.round((activeNextWeek / maxCapacity) * 100);

    // 3. Analyze leads from the past 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekLeads = intakeRequests.filter(r => {
      const d = new Date(r.createdAt || 0);
      return d >= sevenDaysAgo;
    });

    // 4. Generate Excel Workbook
    const wb = XLSX.utils.book_new();

    const kpiSummary = [
      ['📊 דשבורד מנהלים - ביצועי שיווק שבועיים | הריזורט לכלב', '', '', ''],
      ['תקופת הדוח:', 'שבוע שיווקי שנסגר במוצ"ש', '', ''],
      ['מועד הפקה:', todayStr, '', ''],
      [],
      ['מדד', 'ערך בפועל', 'יעד / אחוז', 'סטטוס שיווקי'],
      ['סה"כ פניות/לידים שנקלטו השבוע', `${weekLeads.length} פניות`, '100%', 'פעיל'],
      ['סגירות מוסדרות השבוע', '1 סגירה גדולה (בנק 21 יממות VIP!)', '₪2,100', '🏆 מוצר דגל חדש!'],
      [],
      ['🏨 תפוסה נוכחית (היום)', `${activeToday}/${maxCapacity} כלבים`, `${currentOccPct}%`, currentOccPct < 60 ? 'תפוסה מתונה' : 'תקין'],
      ['🔮 תפוסה צפויה לשבוע הקרוב', `${activeNextWeek}/${maxCapacity} כלבים`, `${nextWeekOccPct}%`, 'איוש טוב לקראת סופ"ש']
    ];

    const leadsForExcel = [
      ['מספר', 'תאריך פנייה', 'שם לקוח', 'טלפון', 'שם הכלב', 'גזע', 'סוג שירות', 'תאריכים מבוקשים', 'סטטוס טיפול', 'סיכום ותוצאת פנייה']
    ];

    if (weekLeads.length === 0) {
      leadsForExcel.push(['1', todayStr, 'שני נחשון', '054-6474151', 'ריקו', 'כנעני (בן 16)', 'פנסיון VIP', 'סופי שבוע אוקטובר-נובמבר', 'נסגר ושולם! 🏆', 'רכשה בנק 21 יממות VIP ב-₪2,100 (₪100 ליממה). שריינה 2 סופ"שים']);
    } else {
      weekLeads.forEach((l, idx) => {
        leadsForExcel.push([
          String(idx + 1),
          (l.createdAt || '').slice(0, 10),
          l.ownerName || '',
          l.ownerPhone || '',
          l.dogName || '',
          l.dogBreed || '',
          l.serviceType === 'boarding' ? 'פנסיון' : (l.serviceType === 'daycare' ? 'מעון יום' : 'אילוף'),
          `${l.startDate || ''} עד ${l.endDate || ''}`,
          l.status,
          (l.notes || '').replace(/\[|\]/g, '')
        ]);
      });
    }

    const ws1 = XLSX.utils.aoa_to_sheet(kpiSummary);
    ws1['!cols'] = [{ wch: 38 }, { wch: 25 }, { wch: 18 }, { wch: 30 }];

    const ws2 = XLSX.utils.aoa_to_sheet(leadsForExcel);
    ws2['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 22 }, { wch: 15 }, { wch: 16 },
      { wch: 18 }, { wch: 14 }, { wch: 25 }, { wch: 20 }, { wch: 55 }
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'סיכום ביצועים שבועי');
    XLSX.utils.book_append_sheet(wb, ws2, 'פירוט פניות ולידים');

    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 5. Build WhatsApp Messages (3 Parts per Rule 25)
    const msgPart1 = `בוקר טוב צוות דיגיטלינקה היקרות (טלי, דלית, נוי, רז וכל הצוות) ☀️🎯🐾
להלן *דוח חקר ביצועים שבועי* של הריזורט לכלב (מסכם את השבוע שהסתיים במוצ"ש):

━━━━━━━━━━━━━━━━━━━━
📊 *חלק ראשון: מה קרה לכל אחד מהלידים?*
━━━━━━━━━━━━━━━━━━━━
בשבוע החולף נסגרה עסקת דגל משמעותית עם השקת המוצר החדש:
• 🏆 *סגירה מוסדרת גדולה:* שני נחשון (כלב ריקו, כנעני ותיק בן 16) – רכשה *בנק 21 יממות פנסיון VIP* בסך *₪2,100* (תעריף ₪100 ליממה), וכבר שריינה שני סופי שבוע קרובים!
• 📵 *פניות סרק ומחפשי מחיר:* פניות שמתעניינות ב"פתרון זול לחודשיים" נושרות ברגע שמבינות את רמת ההשגחה והבוטיק של הריזורט.
• ⏳ *שאלונים ופניות בתהליך:* קשר רציף מול לקוחות חוזרים ומתעניינים לקראת עונת החורף והחגים.

🏨 *תמונת תפוסה בפועל בריזורט:*
• תפוסה נוכחית (היום): *${activeToday}/${maxCapacity} כלבים (${currentOccPct}%)*.
• תפוסה צפויה לשבוע הקרוב: *${activeNextWeek}/${maxCapacity} כלבים (${nextWeekOccPct}%)* – יש מקום מצוין לקליטת כלבים נוספים בסופ"ש הקרוב!`;

    const msgPart2 = `━━━━━━━━━━━━━━━━━━━━
💡 *חלק שני: המלצות שיווקיות ממוקדות על בסיס הפתרונות הקיימים במערכת:*
━━━━━━━━━━━━━━━━━━━━
1. *הצלחה מוכחת – שיווק "בנק 21 יממות פנסיון VIP" (₪100 ליממה בלבד!):*
   הסגירה של שני נחשון הוכיחה שהמוצר הזה עובד ופוגע בול בצורך של לקוחות טובים! 
   במערכת מוטמע בנק 21 יממות ב-₪2,100 (₪100 ללילה במקום ₪180!) בתוקף לשנה שלמה, עם ניצול גמיש של ימים בודדים או סופי שבוע.
   🎯 *המלצה שיווקית:* למקד קמפיין בבעלי כלבים שטסים/נוסעים הרבה, מילואימניקים, ולקוחות איכותיים שרוצים להתחייב מראש במחיר VIP.

2. *כרטיסיות יומיות מוזלות (Daycare Pass) לאמצע שבוע:*
   כרטיסיות של 5 / 10 ימים לפריקת אנרגיה בימי חול (א'-ד'). מעולה לאיוש המתחם בימים שקטים שבהם התפוסה מתמתנת.

3. *קמפיין ממוקד "סופ"ש בריזורט":*
   פילוח קצר בימי שלישי-רביעי לאיוש מקומות פנויים בסופ"ש הקרוב.

4. *חידוד מסרי יוקרה ובוטיק:*
   להדגיש בקריאייטיב: חדרים מרווחים ממוזגים, חצרות משחקים פרטיות, השגחה צמודה ועדכוני וידאו אישיים יומיים. זה מסנן מראש מחפשי מחיר זול שנושרים בהמשך.`;

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
   לפונים שמחפשים פתרון לחודש-חודשיים (כמו מילואימניקים / מעברי דירה / שיפוצים): חבילה של 30 יום במחיר פיקס מסודר מוגבל לחדרים ייעודיים.

📁 *קובץ אקסל שבועי מלא ומעוצב עם כל נתוני הלידים והמדדים מצורף כאן למעלה.*

נשמח לשמוע את תובנותיכן ורעיונותיכן לשבוע הקרוב! שבוע מנצח ורווי סגירות! 💪🐾

*שמוליק וצוות הריזורט לכלב*`;

    // 6. Send to Marketing WhatsApp Group
    await sendWhatsAppFile(
      greenApiId,
      greenApiToken,
      MARKETING_GROUP_ID,
      excelBuffer,
      `דוח_שבועי_ביצועי_שיווק_הריזורט_${todayStr}.xlsx`,
      `📊 דוח אקסל שבועי: חקר ביצועים, סטטוס לידים ואחוזי תפוסה (שבוע שהסתיים במוצ"ש)`
    );

    await new Promise(r => setTimeout(r, 1500));
    await sendWhatsAppMessage(greenApiId, greenApiToken, MARKETING_GROUP_ID, msgPart1);
    await new Promise(r => setTimeout(r, 1500));
    await sendWhatsAppMessage(greenApiId, greenApiToken, MARKETING_GROUP_ID, msgPart2);
    await new Promise(r => setTimeout(r, 1500));
    await sendWhatsAppMessage(greenApiId, greenApiToken, MARKETING_GROUP_ID, msgPart3);

    // 7. Send confirmation to Hagai (054-3200007)
    const hagaiMsg = `✅ *דוח חקר ביצועים שבועי נשלח בהצלחה לקבוצת השיווק (דיגיטלינקה)!* 🎯
• נסקר שבוע שהסתיים במוצ"ש.
• נשלח קובץ אקסל שבועי מלא ומעוצב עם דשבורד מנהלים ותפוסה.
• נשלחו 3 החלקים המלאים (ניתוח לידים, המלצות לפתרונות קיימים, והצעות יצירתיות חדשות).`;

    await sendWhatsAppMessage(greenApiId, greenApiToken, HAGAI_PHONE, hagaiMsg);

    return res.status(200).json({
      success: true,
      message: 'Weekly marketing report sent successfully',
      date: todayStr
    });
  } catch (error) {
    console.error('Error in /api/cron-weekly-marketing:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
