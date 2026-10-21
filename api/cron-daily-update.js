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

function isDogFemale(b) {
  const g = String(b.dog_gender || b.dogGender || b.data?.dogGender || '').toLowerCase();
  if (g.includes('female') || g.includes('נקבה') || g.includes('spayed')) return true;
  const notes = String((b.notes || '') + ' ' + (b.data?.notes || '')).toLowerCase();
  if (notes.includes('נקבה') || notes.includes('מעוקרת')) return true;
  const name = String(b.dog_name || b.dogName || '').trim();
  const knownFemales = ['ניצה', 'פיבי', 'לונה', 'קצ\'טה', 'קאיה', 'מילי', 'בלה', 'לולה', 'מיה', 'נלה', 'טופי', 'לוסי', 'סנדי', 'שוקי'];
  return knownFemales.includes(name);
}

function applyFemaleInflection(text, cleanDog) {
  return text
    // ברכות סיום וחיבה
    .replace(/אוהב\s+{dogName}/g, `אוהבת ${cleanDog}`)
    .replace(/אוהב\s+המון,\s+{dogName}/g, `אוהבת המון, ${cleanDog}`)
    .replace(/אוהב,\s+{dogName}/g, `אוהבת, ${cleanDog}`)
    .replace(/אוהב\s+אותכם/g, 'אוהבת אתכם')
    .replace(/אוהב\s+אתכם/g, 'אוהבת אתכם')
    .replace(/אוהב\s+המון/g, 'אוהבת המון')
    .replace(/אוהב\s+מלא/g, 'אוהבת מלא')
    .replace(/אוהב(?![תותםן])/g, 'אוהבת')
    // שכיבה ומנוחה
    .replace(/שוכב\s+רגוע\s+ומרוצה/g, 'שוכבת רגועה ומרוצה')
    .replace(/שוכב\s+מרוצה/g, 'שוכבת מרוצה')
    .replace(/שוכב\s+בכיף/g, 'שוכבת בכיף')
    .replace(/שוכב\s+על\s+הגב/g, 'שוכבת על הגב')
    .replace(/שוכב(?![תותםן])/g, 'שוכבת')
    // שינה
    .replace(/ישן\s+עמוק\s+ושלו/g, 'ישנה עמוק ושלווה')
    .replace(/ישן\s+עמוק/g, 'ישנה עמוק')
    .replace(/ישן(?![הותםן])/g, 'ישנה')
    .replace(/נרדם\s+מחויך\s+ומרופד/g, 'נרדמת מחויכת ומרופדת')
    .replace(/נרדם\s+מחויך/g, 'נרדמת מחויכת')
    .replace(/נרדם(?![תותםן])/g, 'נרדמת')
    // מנוחה ומלכות
    .replace(/נח\s+כמו\s+מלך\s+אמיתי/g, 'נחה כמו מלכה אמיתית')
    .replace(/נח\s+כמו\s+מלך/g, 'נחה כמו מלכה')
    .replace(/נח\s+בסוויטה/g, 'נחה בסוויטה')
    .replace(/נח\s+בכיף/g, 'נחה בכיף')
    .replace(/נח(?![הותםן])/g, 'נחה')
    .replace(/כמו\s+מלך\s+אמיתי/g, 'כמו מלכה אמיתית')
    .replace(/כמו\s+מלך/g, 'כמו מלכה')
    .replace(/למלך\s+שלו/g, 'למלכה שלו')
    // תלמיד / אילוף
    .replace(/תלמיד\s+מצטיין\s+של\s+אלופים/g, 'תלמידה מצטיינת של אלופים')
    .replace(/תלמיד\s+מצטיין/g, 'תלמידה מצטיינת')
    // רגשות ומצב רוח
    .replace(/אני\s+שליו\s+ושמח/g, 'אני שלווה ושמחה')
    .replace(/רגוע\s+ומרוצה/g, 'רגועה ומרוצה')
    .replace(/שבע\s+ומפונק/g, 'שבעה ומפונקת')
    .replace(/מלא\s+ומאושר/g, 'מלאה ומאושרת')
    .replace(/עייף\s+אך\s+מאושר/g, 'עייפה אך מאושרת')
    .replace(/מפונק(?![תותםן])/g, 'מפונקת')
    .replace(/שמח(?![הותםן])/g, 'שמחה')
    .replace(/רגוע(?![הותםן])/g, 'רגועה')
    .replace(/מסודר\s+ללילה/g, 'מסודרת ללילה');
}

function selectDogTemplate(b, isWeekend = false, recipientName = null) {
  const oName = (b.owner_name || '').toLowerCase();
  const dName = (b.dog_name || '').toLowerCase();
  const phone = (b.owner_phone || '').replace(/\D/g, '');
  const isShlomiLuna = (oName.includes('שלומי') && (dName.includes('לונה') || phone.includes('5445512'))) ||
                       dName.includes('המתגעגעת') ||
                       oName.includes('שלומי ממן');

  if (isShlomiLuna) {
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
  const cleanOwner = (recipientName || b.owner_name || 'חבר').trim().split(/\s+/)[0];
  const cleanDog = (b.dog_name || 'הכלב').trim();

  let formatted = chosen.text
    .replace(/{ownerName}/g, cleanOwner)
    .replace(/{dogName}/g, cleanDog);

  if (isDogFemale(b)) {
    formatted = applyFemaleInflection(formatted, cleanDog);
  }

  return formatted;
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

    // 1. Fetch active staying dogs for daily greeting - ONLY dogs that are currently checked-in!
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .lte('start_date', todayStr)
      .gt('end_date', todayStr)
      .eq('stay_status', 'checked_in');

    const activeBookings = bookings || [];
    let dogSentCount = 0;
    let dogFailCount = 0;
    const sentDogsMap = new Set();

    for (const b of activeBookings) {
      if (b.stay_status !== 'checked_in') {
        continue;
      }
      const cleanDog = (b.dog_name || '').trim().toLowerCase();
      const bData = (b.data && typeof b.data === 'object') ? b.data : {};
      const dogKey = `${b.id}_${cleanDog}`;

      if (bData.lastDailyDogUpdateSent === todayStr || sentDogsMap.has(dogKey)) {
        continue;
      }

      // Build recipients list
      const recipients = [];
      const mainPhone = cleanPhoneNumber(b.owner_phone);
      const mainName = (b.owner_name || 'חבר').trim().split(/\s+/)[0];
      if (mainPhone && mainPhone.length >= 9) {
        recipients.push({ phone: mainPhone, name: mainName });
      }

      // Extra recipients from booking data
      const extraList = bData.additionalDailyGreetingRecipients || [];
      for (const extra of extraList) {
        const extraP = cleanPhoneNumber(extra.phone);
        if (extraP && extraP.length >= 9 && !recipients.some(r => r.phone === extraP)) {
          recipients.push({ phone: extraP, name: extra.name || '' });
        }
      }

      // Nitza specific family broadcast rule (Eti 052-4467314, Rotem 054-9800300, Nir 054-3400505)
      if (cleanDog.includes('ניצה')) {
        const nitzaFamily = [
          { name: 'אתי', phone: '0524467314' },
          { name: 'רותם', phone: '0549800300' },
          { name: 'ניר', phone: '0543400505' }
        ];
        for (const fam of nitzaFamily) {
          const famP = cleanPhoneNumber(fam.phone);
          if (!recipients.some(r => r.phone === famP)) {
            recipients.push({ phone: famP, name: fam.name });
          }
        }
      }

      if (recipients.length === 0) continue;

      let anySent = false;
      for (const rec of recipients) {
        const intlPhone = rec.phone.startsWith('0') ? '972' + rec.phone.slice(1) : rec.phone;
        const chatId = `${intlPhone}@c.us`;
        const msgText = selectDogTemplate(b, weekday === 'Sat', rec.name);

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
            anySent = true;
          } else {
            dogFailCount++;
          }
        } catch (err) {
          console.error(`Error sending daily dog update for ${b.dog_name} to ${rec.phone}:`, err);
          dogFailCount++;
        }
      }

      if (anySent) {
        sentDogsMap.add(dogKey);
        // Mark in database so it cannot be double-sent
        await supabase.from('bookings').update({
          data: { ...bData, lastDailyDogUpdateSent: todayStr },
          updated_at: new Date().toISOString()
        }).eq('id', b.id);
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
    const hasDispatches = (dogSentCount > 0 || reviewSentCount > 0 || totalFails > 0);
    const confirmationText = hasDispatches 
      ? `נשלחו ד"ש ל-${dogSentCount} בעלי כלבים ו-${reviewSentCount} בקשות חוות דעת. כולם קיבלו. ${totalFails > 0 ? `יש ${totalFails} כשלים` : 'אין כשל ✅'}`
      : 'כל הכלבים השוהים כבר קיבלו ד"ש מוקדם יותר היום, ואין שחרורים חדשים. אין כשל ✅';

    if (hasDispatches) {
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
    } else {
      console.log('No new dog greetings or review requests to dispatch (all dogs already greeted earlier today). Skipping redundant admin message.');
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
    try {
      const emergencyUrl = getGreenApiUrl('710722735421', 'sendMessage', 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b');
      await fetch(emergencyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: '972543200007@c.us',
          message: `🚨 *התראת כשל מערכת במשלוח ד"ש יומי (20:00)*\nפונקציה: cron-daily-update\nשגיאה: ${err.message}\nנא לבדוק את התקלה באופן מיידי!`
        })
      });
    } catch (_) {}
    return res.status(500).json({ error: err.message });
  }
}
