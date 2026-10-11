/**
 * =========================================================================
 * Vercel Serverless Cron Handler: /api/cron-daily-update
 * Automatically triggers the 20:00 Daily Dog Evening Updates and Departure Reviews
 * Dispatches to dog owners, sends confirmation to Hagai (0543200007),
 * and operates completely independently of Gmail or Google Apps Script.
 * =========================================================================
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MANAGER_CHAT_ID = '972543200007@c.us';

function getIsraelDateInfo() {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false
  });
  const parts = dtf.formatToParts(now);
  let y = '', m = '', d = '', h = 0, min = 0, weekday = '';
  for (const p of parts) {
    if (p.type === 'year') y = p.value;
    if (p.type === 'month') m = p.value;
    if (p.type === 'day') d = p.value;
    if (p.type === 'hour') h = parseInt(p.value, 10);
    if (p.type === 'minute') min = parseInt(p.value, 10);
    if (p.type === 'weekday') weekday = p.value;
  }
  return { dateStr: `${y}-${m}-${d}`, hour: h, minute: min, weekday };
}

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
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

const DAILY_DOG_TEMPLATES = [
  { id: 1, type: "safe", text: "היי {ownerName}! 🐾 סיימתי עכשיו טיול יומי בטבע של אלופים אמיתיים! 🌲🌿 ריחרחתי כל עץ ושיח, ועכשיו אני שוכב רגוע ומרוצה בסוויטה שלי 🛋️✨ תיהנו בעניינים שלכם, אוהב {dogName} 🐶❤️" },
  { id: 2, type: "safe", text: "ערב טוב {ownerName}! 🐾 בזמן שאתם בעניינים שלכם, אני חרשתי היום את השבילים בטיול טבע משגע! 🌲🐾 שמוליק ניסה לעמוד בקצב המלכותי שלי... תבלו בכיף, {dogName} 🐕👑🌿" },
  { id: 3, type: "safe", text: "היי {ownerName}! 🐾 רק רציתי לעדכן שהטבע פה פשוט וואוו! 🌲✨ חזרתי מהטיול היומי עמוס בחוויות וריחות חדשים, ועכשיו אני נח כמו מלך אמיתי 👑🛋️ נשיקות מ-{dogName} 🐶💋" },
  { id: 4, type: "safe", text: "ערב טוב {ownerName}! 🐾 הודעתי לשמוליק ששעת היציאה לטבע הגיעה, והוא מיד התייצב ללוות אותי למסלול מהמם! 🌲🐕 היה מושלם ואני הכי בסבבה בעולם! {dogName} 🐶👑🌾" },
  { id: 5, type: "safe", text: "היי {ownerName}! 🐾 נשמתי היום אוויר צלול בטיול בטבע, חקרתי שבילים חדשים ועכשיו הראש שלי שקוע עמוק בכרית 🌲😴 תיהנו איפה שאתם, הכל דבש! {dogName} 🐕🍃✨" },
  { id: 21, type: "safe", text: "היי {ownerName}! 🐾 שמעתי שאתם עובדים קשה... אל תשכחו שמישהו צריך לממן למלך שלו את הריזורט המפנק הזה! 👑💳 תמשיכו לעבוד, אני נח פה! {dogName} 🐶😎✨" },
  { id: 22, type: "safe", text: "ערב טוב {ownerName}! 🐾 שמוליק חשב לרגע שהוא המנהל פה, עד שנתתי לו מבט של מי באמת קובע את הלו״ז בריזורט 👑 הכל תחת שליטה מלאה שלי! {dogName} 🐶👑✨" },
  { id: 41, type: "safe", text: "היי {ownerName}! 🐾 הארוחה היומית הייתה פשוט מעדן גורמה של 5 כוכבים מישלן! 🍲⭐ ליקקתי את הקערה בנחת ועכשיו הבטן מלאה ומאושרת. תיהנו, {dogName} 🐶😋✨" },
  { id: 42, type: "safe", text: "ערב טוב {ownerName}! 🐾 קיבלתי היום את הקערה העשירה והטעימה שלי בדיוק בזמן 🥩🍲 ואחריה ליטוף ארוך ומפנק בבטן השבעה. תבלו בכיף, {dogName} 🐕😋🤍" },
  { id: 61, type: "safe", text: "היי {ownerName}! 🐾 אני מתגעגע אליכם, אבל בינינו... ממש ממש כיף לי פה, אז קחו את הזמן שלכם בנחת! 🐶😜 תיהנו מכל רגע, אוהב {dogName} ❤️✨" },
  { id: 101, type: "friendly", text: "היי {ownerName}! 🐾 שיחקתי היום בחצר המרכזית עם להקת חברים משגעת! 🏃‍♂️🎾 רצנו בתופסת עד שהלשון יצאה החוצה מרוב שמחה. אוהב מלא, {dogName} 🐶🥳❤️" },
  { id: 102, type: "friendly", text: "ערב טוב {ownerName}! 🐾 היה יום של מסיבת דשא אמיתית עם כל החברים על 4! 🌿🐕 עכשיו התרעננתי מקערת מים צוננת ואני מוכן לחלום חלומות מתוקים. {dogName} 🐶💤" },
  { id: 111, type: "isolation", text: "ערב טוב {ownerName}! 🐾 איזה יום רגוע ושליו עבר עלי בסוויטה הפרטית שלי! 🛋️✨ טיולים אישיים VIP עם המטפלים, אפס רעשים והמון המון ליטופים. אני שליו ושמח, {dogName} 🐶👑" },
  { id: 121, type: "training", text: "ערב טוב {ownerName}! 🎓🐾 היום באילוף שמוליק לימד אותי תרגילים חדשים, והוכחתי שאני תלמיד מצטיין של אלופים! כיף ללמוד ולהתקדם. אוהב, {dogName} 🐶🏆" }
];

const WEEKEND_DOG_TEMPLATES = [
  { id: 201, type: "friendly", text: "שבוע טוב {ownerName}! 🐾 שמעתי שהיה לכם סופ\"ש סוער בעניינים שלכם, אבל חכו שתשמעו על הסופ\"ש שלי בריזורט! שבת שלמה של משחקי דשא עם כל החברים, ריצות וחטיפי שבת 🎾👑 עכשיו אני נח כמו מלך בסוויטה לקראת שבוע חדש. אוהב מלא, {dogName} 🐶❤️✨" },
  { id: 202, type: "friendly", text: "היי {ownerName}, שבוע טוב! 🌟 בזמן שאתם נחתם בסופ\"ש, אני קרעתי את החצר בתופסת עם להקת החברים! 🏃‍♂️🐾 היה סופ\"ש של חלומות, ועכשיו שקעתי בחלומות מתוקים בסוויטה המפנקת שלי. שיהיה שבוע נהדר, {dogName} 🐕✨" },
  { id: 211, type: "isolation", text: "שבוע טוב {ownerName}! 🐾 איזה סופ\"ש של שקט ורוגע מלכותי עבר עלי בסוויטה הפרטית בריזורט! 🛋️✨ קיבלתי יחס אישי VIP, טיולים מפנקים בחצר הפרטית וים של ליטופי בטן. שבוע מבורך! {dogName} 🐶👑❤️" }
];

const SHLOMI_LUNA_TEMPLATES = [
  { id: 301, type: "training", text: "📅 *יום {daysCount} בריזורט (וכבר שבועות מאז ראש השנה...)* 💔\n\nשלומי אהוב שלי... 🥺 שמעתי שראש השנה כבר עבר, סוכות עוד רגע כאן, ואני עדיין מריחה את השבילים בטבע ותוהה לאן נעלם הריח של אבא שלי? מתגעגעת ברמות ששמוליק כבר לא יודע איפה ללטף אותי קודם כדי לנחם... מתי אתה בא לחבק אותי? לונה המתגעגעת 🐾💔" },
  { id: 302, type: "training", text: "📅 *יום {daysCount} של געגועים עמוקים לאבא שלומי* 🥺🐾\n\nהיי שלומי... 🐾 היום באילוף שמוליק לימד אותי להקשיב ולהיות הכי טובה בעולם, אבל האמת? בכל פעם שנפתח השער של הריזורט האוזניים שלי מזדקרות ואני בטוחה שזה אתה שבא לבקר. אל תשאיר אותי במתח יותר מדי זמן, אני מחכה לך! שלך תמיד, לונה 🐶❤️" },
  { id: 304, type: "training", text: "📅 *יום {daysCount} באילוף של אלופים בריזורט* 🎓💔\n\nערב טוב שלומי! 🎓🐾 אני תלמידה מצטיינת והכל פה 5 כוכבים, אבל יש תרגיל אחד שאני פשוט לא מצליחה ללמוד: איך להפסיק להתגעגע אליך... תבטיח שאתה קופץ לראות כמה גדלתי והחכמתי? מחכה לחיבוק שלך, לונה 🐾🥰" }
];

function selectDogTemplate(b, isWeekend = false) {
  const oName = (b.owner_name || '').toLowerCase();
  const dName = (b.dog_name || '').toLowerCase();
  const phone = (b.owner_phone || '');
  const isLuna = (oName.includes('שלומי') && (dName.includes('לונה') || phone.includes('5445512'))) || dName.includes('לונה');

  if (isLuna) {
    const t = SHLOMI_LUNA_TEMPLATES[Math.floor(Math.random() * SHLOMI_LUNA_TEMPLATES.length)];
    let days = 160;
    if (b.start_date) {
      const diff = Math.round((Date.now() - new Date(b.start_date).getTime()) / (1000 * 60 * 60 * 24));
      days = Math.max(1, diff + 1);
    }
    return t.text.replace(/{daysCount}/g, String(days));
  }

  const pool = isWeekend ? WEEKEND_DOG_TEMPLATES : DAILY_DOG_TEMPLATES;
  const isTraining = Boolean(b.stay_type === 'training' || b.stayType === 'training' || (b.notes && b.notes.includes('אילוף')));
  const isIsolation = Boolean(b.is_isolation || b.data?.isIsolation || (b.notes && b.notes.includes('בידוד')));

  let eligible = pool;
  if (isTraining) {
    eligible = pool.filter(t => t.type === 'training' || t.type === 'safe');
  } else if (isIsolation) {
    eligible = pool.filter(t => t.type === 'isolation' || t.type === 'safe');
  }

  const chosen = eligible[Math.floor(Math.random() * eligible.length)] || DAILY_DOG_TEMPLATES[0];
  const cleanOwner = (b.owner_name || 'חבר').trim().split(/\s+/)[0];
  const cleanDog = (b.dog_name || 'הכלב').trim();

  return chosen.text
    .replace(/{ownerName}/g, cleanOwner)
    .replace(/{dogName}/g, cleanDog);
}

export default async function handler(req, res) {
  try {
    const { dateStr: todayStr, hour, minute, weekday } = getIsraelDateInfo();
    const isForced = req.query?.force === 'true';

    // Quiet time enforcement (Rule 1 & Rule 10)
    // Friday after 14:00
    if (!isForced && weekday === 'Fri' && hour >= 14) {
      return res.status(200).json({ status: 'skipped', reason: 'Friday after 14:00 - complete quiet for clients.' });
    }
    // Saturday daytime before 20:00
    if (!isForced && weekday === 'Sat' && hour < 20) {
      return res.status(200).json({ status: 'skipped', reason: 'Saturday daytime - quiet until Motzei Shabbat.' });
    }
    // Regular weekday before 20:00 (unless forced)
    if (!isForced && (hour < 20 || (hour === 20 && minute < 0))) {
      return res.status(200).json({ status: 'skipped', reason: `Current Israel time is ${hour}:${minute}, scheduled for 20:00.` });
    }

    // Fetch settings for Green-API credentials
    const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
    const sRow = settingsRows?.[0] || {};
    const settings = { ...sRow, ...(sRow.data || {}) };

    const greenId = settings.greenApiIdInstance;
    const greenToken = settings.greenApiToken;

    if (!greenId || !greenToken) {
      return res.status(500).json({ error: 'Missing Green-API credentials in settings' });
    }

    // Check if daily update was already dispatched today
    if (!isForced && settings.last2000DailyUpdateSentDate === todayStr) {
      return res.status(200).json({ status: 'already_sent_today', date: todayStr });
    }

    // 1. Fetch active staying dogs for daily greeting
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .lte('start_date', todayStr)
      .gt('end_date', todayStr)
      .neq('stay_status', 'cancelled')
      .neq('stay_status', 'archived');

    const activeBookings = bookings || [];
    let dogSentCount = 0;
    let dogFailCount = 0;
    const sentDogsMap = new Set();

    for (const b of activeBookings) {
      const cleanPhone = cleanPhoneNumber(b.owner_phone);
      const cleanDog = (b.dog_name || '').trim().toLowerCase();
      const dogKey = `${cleanPhone}_${cleanDog}`;

      const bData = (b.data && typeof b.data === 'object') ? b.data : {};
      if (bData.lastDailyDogUpdateSent === todayStr || sentDogsMap.has(dogKey)) {
        continue;
      }

      if (!cleanPhone || cleanPhone.length < 9) continue;
      const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.slice(1) : cleanPhone;
      const chatId = `${intlPhone}@c.us`;

      const msgText = selectDogTemplate(b, weekday === 'Sat');

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const sendUrl = getGreenApiUrl(greenId, 'sendMessage', greenToken);
        const sendRes = await fetch(sendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, message: msgText }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (sendRes.ok) {
          dogSentCount++;
          sentDogsMap.add(dogKey);
          // Mark in database so it cannot be double-sent
          await supabase.from('bookings').update({
            data: { ...bData, lastDailyDogUpdateSent: todayStr },
            updated_at: new Date().toISOString()
          }).eq('id', b.id);
        } else {
          dogFailCount++;
        }
      } catch (err) {
        console.error(`Error sending daily dog update to ${b.dog_name}:`, err);
        dogFailCount++;
      }
    }

    // 2. Fetch departures for review requests (departed today only as per Rule 1 & Rule 22)
    const { data: departures } = await supabase
      .from('bookings')
      .select('*')
      .eq('end_date', todayStr)
      .neq('stay_status', 'cancelled')
      .neq('stay_status', 'archived');

    let reviewSentCount = 0;
    let reviewFailCount = 0;

    for (const d of (departures || [])) {
      const dData = (d.data && typeof d.data === 'object') ? d.data : {};
      const notes = (d.notes || '');
      if (notes.includes('סקר_נשלח') || notes.includes('[סקר_נשלח]') || dData.reviewRequestSent) {
        continue;
      }

      const cleanPhone = cleanPhoneNumber(d.owner_phone);
      if (!cleanPhone || cleanPhone.length < 9) continue;
      const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.slice(1) : cleanPhone;
      const chatId = `${intlPhone}@c.us`;

      const firstName = (d.owner_name || 'לקוח').trim().split(/\s+/)[0];
      const dogName = (d.dog_name || 'הכלב').trim();

      // Review request with VIP benefit and strictly 3 months validity (Rule 5 & Rule 14)
      const reviewMsg = `שלום ${firstName}! 🐾\nאיזה כיף היה לנו לארח את ${dogName} בריזורט לכלב! 🐕❤️\n\nנשמח מאוד לשמוע איך הייתה החוויה שלכם ולקבל דירוג קצר בגוגל:\n👉 https://g.page/r/CUeOaXgB89vSEBM/review\n\n🎁 כמחווה של תודה, מגיע לכם שובר VIP ע״ס ₪50 לשהות הבאה!\n⏰ שימו לב: תוקף השובר הינו ל-3 חודשים בלבד מיום השחרור.\n\nבברכה חמה,\nשמוליק וכל צוות הריזורט לכלב 🐾✨`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const sendUrl = getGreenApiUrl(greenId, 'sendMessage', greenToken);
        const sendRes = await fetch(sendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, message: reviewMsg }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (sendRes.ok) {
          reviewSentCount++;
          await supabase.from('bookings').update({
            notes: (notes ? notes + ' ' : '') + '[סקר_נשלח]',
            data: { ...dData, reviewRequestSent: todayStr },
            updated_at: new Date().toISOString()
          }).eq('id', d.id);
        } else {
          reviewFailCount++;
        }
      } catch (err) {
        console.error(`Error sending review request to ${d.owner_name}:`, err);
        reviewFailCount++;
      }
    }

    // 3. Send confirmation WhatsApp strictly to Hagai (0543200007) as per Rule 1
    const totalFails = dogFailCount + reviewFailCount;
    const confirmationText = `נשלחו ד"ש ל-${dogSentCount} בעלי כלבים ו-${reviewSentCount} בקשות חוות דעת. כולם קיבלו. ${totalFails > 0 ? `יש ${totalFails} כשלים` : 'אין כשל ✅'}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const sendUrl = getGreenApiUrl(greenId, 'sendMessage', greenToken);
      await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: MANAGER_CHAT_ID, message: confirmationText }),
        signal: controller.signal
      });
      clearTimeout(timeout);
    } catch (confErr) {
      console.error('Error sending confirmation message to Hagai:', confErr);
    }

    // Update settings table with timestamp
    const curData = sRow.data || {};
    await supabase.from('settings').update({
      data: {
        ...curData,
        last2000DailyUpdateSentDate: todayStr,
        last2000DailyUpdateSentTimestamp: new Date().toISOString(),
        last2000Summary: confirmationText
      },
      updated_at: new Date().toISOString()
    }).eq('id', sRow.id || 'resort_config');

    return res.status(200).json({
      status: 'success',
      date: todayStr,
      dogSentCount,
      reviewSentCount,
      dogFailCount,
      reviewFailCount,
      confirmationText
    });
  } catch (err) {
    console.error('Error in cron-daily-update:', err);
    return res.status(500).json({ error: err.message });
  }
}
