const fs = require('fs');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

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

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

function extractPhoneFromChatId(chatId) {
  const digits = chatId.replace(/@.*$/, '').replace(/\D/g, '');
  if (digits.startsWith('972') && digits.length >= 12) {
    return '0' + digits.substring(3);
  }
  return digits;
}

function isActionableIncomingMessage(rawText) {
  if (!rawText) return false;
  const text = String(rawText).trim();
  if (text.length === 0) return false;

  if (/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\s.,!?:;"'()\-–—~`_+=\[\]{}<>]+$/gu.test(text)) {
    return false;
  }

  const clean = text
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, ' ')
    .replace(/[.,!?:;"'()\-–—~`_+=\[\]{}<>/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (clean.length === 0) return false;

  if (/^(ח{2,}|ה{3,}|חה|חח|lol|haha|xd|\s)+$/i.test(clean)) return false;
  if (clean.includes('חחח') || clean.includes('חחחח') || clean.includes('תתפנק') || clean.includes('אין על') || clean.includes('מלך אתה') || clean.includes('אתה אלוף') || clean.includes('אלופים')) return false;

  const regardsAndComplimentsPhrases = [
    'איזה חמוד', 'איזה חמודה', 'איזה מתוק', 'איזה מתוקה', 'איזה יופי', 'איזה יפה', 'איזה מותק',
    'איזה נסיך', 'איזה נסיכה', 'איזה מושלם', 'איזה מושלמת', 'איזה כיף', 'איזה כיף לראות', 'איזה כיף לשמוע',
    'תמונה מהממת', 'תמונות מהממות', 'תמונה יפה', 'תמונות יפות', 'סרטון מהמם', 'סרטון יפה',
    'תודה על התמונות', 'תודה על התמונה', 'תודה על הסרטון', 'תודה על הסרטונים', 'תודה על העדכון',
    'תודה שמוליק', 'תודה רבה שמוליק', 'המון תודה שמוליק', 'תודה רבה מותק', 'תודה רבה יקירי',
    'חיים שלי', 'אהבה שלי', 'הלב שלי', 'אהוב שלי', 'מתגעגעים', 'געגועים', 'נשיקות', 'חיבוקים',
    'שמור עליו', 'שמרי עליו', 'שמרו עליו', 'תמסור לו נשיקה', 'תמסור לה נשיקה', 'דש לכולם', 'דש חם',
    'שמחים לשמוע', 'כיף לראות אותו', 'כיף לראות אותה', 'נראה מאושר', 'נראית מאושרת', 'נראה שהוא נהנה',
    'נראה שהיא נהנית', 'הכל נראה מושלם', 'תודה על הטיפול המסור', 'תודה על הטיפול', 'אין עליך שמוליק'
  ];

  for (const phrase of regardsAndComplimentsPhrases) {
    if (clean === phrase || clean.includes(phrase)) {
      if (!text.includes('דחוף') && !text.includes('בעיה') && !text.includes('תקלה') && !text.includes('כמה עולה') && !text.includes('רוצה לשריין')) {
        return false;
      }
    }
  }

  const nonActionablePhrases = [
    'תודה', 'תודה רבה', 'המון תודה', 'תודה רבה שוב', 'תודה על הכל', 'תודה ענקית', 'תודה לכם', 'תודה אחי',
    'סבבה', 'אחלה', 'מעולה', 'מצוין', 'יופי', 'בסדר גמור', 'בסדר', 'הבנתי', 'סגור', 'ברור',
    'מעולה תודה', 'סבבה תודה', 'אחלה תודה', 'יופי תודה', 'תודה ניפגש', 'תודה נתראה',
    'ניפגש', 'נתראה', 'נתראה מחר', 'נתראה בקרוב', 'להתראות', 'ביי', 'ביי ביי', 'בי',
    'לילה טוב', 'בוקר טוב', 'יום טוב', 'סופש נעים', 'סוף שבוע נעים', 'שבת שלום', 'שבוע טוב',
    'חג שמח', 'גמר חתימה טובה', 'חתימה טובה', 'שנה טובה',
    'כן בטח', 'כן תודה', 'אין בעיה', 'בשמחה', 'הכל טוב', 'תיהנו',
    'היי הגענו', 'הגענו', 'אנחנו פה', 'בחוץ', 'תחבר', 'ok', 'okay', 'sure', 'thanks', 'thx',
    'כן', 'לא', 'טוב', 'גזע מיוחד', 'אתה בסדר גמור', 'אמרת לי מראש',
    'אשלם מחר', 'אשלם באשראי', 'אשלם במזומן', 'אשלם לך באשראי או מזומן מחר', 'אעביר מחר',
    'העברתי', 'שילמתי', 'שלחתי', 'אז מגיע מחר', 'מגיע אחר הצהריים', 'בנסיעה'
  ];

  for (const phrase of nonActionablePhrases) {
    if (clean === phrase || clean.startsWith(phrase + ' ') || clean.endsWith(' ' + phrase)) {
      if (!text.includes('?') && !text.includes('דחוף') && !text.includes('בעיה') && !text.includes('תקלה')) {
        return false;
      }
    }
  }

  const words = clean.split(' ').filter(w => w.length > 0);
  if (words.length <= 3) {
    const isAck = words.every(w => [
      'כן', 'לא', 'טוב', 'יופי', 'אחלה', 'סבבה', 'תודה', 'מעולה', 'מצוין',
      'בסדר', 'ברור', 'הבנתי', 'אוקי', 'אוקיי', 'שלום', 'היי', 'הי', 'חח', 'חחח', 'בי', 'ביי',
      'סגור', 'בשמחה', 'הכל', 'מחר', 'היום', 'בנסיעה', 'הגענו', 'חיים', 'אהבה', 'נסיך', 'נסיכה', 'מתוק', 'חמוד'
    ].includes(w));
    if (isAck) return false;
  }

  if (text.includes('?') || text.includes('؟')) {
    if (
      clean === 'אכל הבוקר' || clean === 'אכלה הבוקר' || clean === 'איך הוא' || clean === 'איך היא' ||
      clean.includes('הכל בסדר איתו') || clean.includes('הכל בסדר איתה') || clean.includes('הוא בסדר') || clean.includes('היא בסדר')
    ) {
      return false;
    }
    return true;
  }

  const actionableKeywords = [
    'כמה עולה', 'כמה יעלה', 'מה המחיר', 'מה העלות', 'יש מקום', 'יש לכם מקום', 'פנוי בתאריכים',
    'רוצה לשריין', 'רוצים לשריין', 'מעוניין לשריין', 'מעוניינת לשריין', 'מעוניין בפנסיון', 'מעוניינת בפנסיון',
    'מעוניין באילוף', 'מעוניינת באילוף', 'רוצה הצעת מחיר',
    'דחוף', 'חשוב', 'טעות', 'שגוי', 'תקלה', 'בעיה', 'הבטחתם', 'מאוכזב',
    'לבטל את ההזמנה', 'לבטל הגעה', 'ביטול שריון', 'החזר כספי'
  ];

  for (const kw of actionableKeywords) {
    if (clean.includes(kw)) {
      return true;
    }
  }

  return false;
}

function getJson(urlPath) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.green-api.com',
      path: urlPath,
      method: 'GET',
      timeout: 10000
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
    req.end();
  });
}

async function run() {
  const [incRes, outRes] = await Promise.all([
    getJson(`/waInstance${GREEN_API_ID}/lastIncomingMessages/${GREEN_API_TOKEN}?minutes=1440`),
    getJson(`/waInstance${GREEN_API_ID}/lastOutgoingMessages/${GREEN_API_TOKEN}?minutes=1440`)
  ]);

  const { data: bookings } = await supabase.from('bookings').select('*');

  console.log(`Incoming messages (24h): ${incRes.length}, Outgoing: ${outRes.length}`);

  const chatMap = new Map();

  const all = [
    ...(Array.isArray(incRes) ? incRes.map(m => ({ ...m, dir: 'incoming' })) : []),
    ...(Array.isArray(outRes) ? outRes.map(m => ({ ...m, dir: 'outgoing' })) : [])
  ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  all.forEach(m => {
    if (!m.chatId || m.chatId.includes('@g.us') || m.chatId.includes('@broadcast')) return;
    const phone = extractPhoneFromChatId(m.chatId);
    const cleanP = cleanPhoneNumber(phone);
    if (['0506336896', '0543200007', '0548765888', '0506816001'].includes(cleanP)) return;

    if (!chatMap.has(m.chatId)) {
      chatMap.set(m.chatId, {
        id: m.chatId,
        senderName: m.senderName,
        phone,
        cleanP,
        lastDir: m.dir,
        lastText: m.textMessage || m.extendedTextMessage?.text || '',
        timestamp: m.timestamp
      });
    }
  });

  console.log(`Total active unique customer chats in 24h: ${chatMap.size}`);

  const waitingChats = [];
  chatMap.forEach((c) => {
    if (c.lastDir === 'incoming') {
      const isActionable = isActionableIncomingMessage(c.lastText);
      const hasBooking = (bookings || []).some(b => {
        if (b.stay_status === 'cancelled') return false;
        const bPhone = cleanPhoneNumber(b.owner_phone || '');
        return bPhone && c.cleanP && bPhone.slice(-7) === c.cleanP.slice(-7);
      });

      console.log(`Chat ${c.senderName || c.phone} (${c.cleanP}): "${c.lastText}" -> isActionable: ${isActionable}, hasBooking: ${hasBooking}`);
      if (isActionable && !hasBooking) {
        waitingChats.push(c);
      }
    }
  });

  console.log(`\n=== Genuinely waiting actionable chats: ${waitingChats.length} ===`);
  waitingChats.forEach(w => {
    console.log(`- ${w.senderName || w.phone} (${w.phone}): "${w.lastText}"`);
  });
}

run();
