const fs = require('fs');
const https = require('https');

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

function getChats() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/GetChats/${GREEN_API_TOKEN}`,
      method: 'GET'
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function getChatHistory(chatId, count = 5) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chatId, count });
    const req = https.request({
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/GetChatHistory/${GREEN_API_TOKEN}`,
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
          resolve([]);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Smart classification: Does an incoming message truly require a reply from Shmulik?
 */
function isActionableIncomingMessage(rawText) {
  if (!rawText) return false;
  const text = rawText.trim();
  if (text.length === 0) return false;

  // Remove emojis, symbols, and punctuation for clean analysis
  const clean = text
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[.,!?:;"'()\-–—~`_+=\[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  // If text was only emojis or punctuation
  if (clean.length === 0) return false;

  // 1. Definite Actionable: Contains a question mark in original text
  if (text.includes('?') || text.includes('؟')) return true;

  // 2. Definite Actionable: Question / Inquiry / Problem / Action keywords
  const actionableKeywords = [
    'כמה', 'מתי', 'איפה', 'איך', 'האם', 'למה', 'מדוע', 'מי',
    'אפשר', 'אפשרי', 'תוכל', 'תוכלו', 'תוכלי', 'יש מקום', 'יש לכם', 'פנוי',
    'מחיר', 'עלות', 'תעריף', 'תאריכים', 'שאלון', 'לינק', 'קישור', 'תשלום',
    'חיסון', 'חיסונים', 'כלוב', 'אוכל', 'תרופות', 'שעות', 'מתי לבוא', 'מתי להביא',
    'תחזרו', 'תחזור', 'דחוף', 'חשוב', 'טעות', 'שגוי', 'תקלה', 'בעיה', 'הבטחתם',
    'מאוכזב', 'לבטל', 'ביטול', 'לשנות', 'להקדים', 'לדחות', 'החזר', 'שלום רציתי', 'היי רציתי'
  ];

  for (const kw of actionableKeywords) {
    // Match whole word or keyword boundary
    const regex = new RegExp(`(^|\\s)${kw}(\\s|$)`, 'i');
    if (regex.test(clean) || clean.includes(kw)) {
      return true;
    }
  }

  // 3. Laughing patterns (e.g., "חחחח", "חחח", "חח..", "haha")
  if (/^(ח{2,}|ה{3,}|חה|חח|lol|haha|xd|\s)+$/i.test(clean)) return false;

  // 4. Polite Closings / Acknowledgements / Gratitude
  const closingPhrases = [
    'תודה', 'תודה רבה', 'המון תודה', 'תודה רבה שוב', 'תודה על הכל', 'תודה ענקית', 'תודה לכם',
    'סבבה', 'אחלה', 'מעולה', 'מצוין', 'יופי', 'בסדר גמור', 'בסדר', 'הבנתי',
    'מעולה תודה', 'סבבה תודה', 'אחלה תודה', 'יופי תודה', 'תודה ניפגש', 'תודה נתראה',
    'ניפגש', 'נתראה', 'נתראה מחר', 'נתראה בקרוב', 'להתראות', 'ביי', 'ביי ביי',
    'לילה טוב', 'בוקר טוב', 'יום טוב', 'סופש נעים', 'סוף שבוע נעים', 'שבת שלום', 'שבוע טוב',
    'חג שמח', 'גמר חתימה טובה', 'חתימה טובה', 'שנה טובה',
    'כן בטח', 'כן תודה', 'אין בעיה', 'בשמחה', 'הכל טוב', 'תיהנו', 'דש לכולם', 'דש חם',
    'היי הגענו', 'הגענו', 'אנחנו פה', 'בחוץ', 'תחבר', 'ok', 'okay', 'sure', 'thanks', 'thx'
  ];

  // Check if clean matches any closing phrase exactly or starts/ends with thank you
  for (const phrase of closingPhrases) {
    if (clean === phrase) return false;
  }

  // If the entire message is basically laughter + thank you + emojis (e.g., "חח..יש לך עוד חודש לבלות אתו, ובטוחה שעוד תפגשו בהמשך 😊")
  if (clean.startsWith('חח') && (clean.includes('תפגשו') || clean.includes('תודה') || clean.includes('שמח'))) {
    return false;
  }

  // If very short (1-2 words) without an actionable keyword, usually just a conversational ack
  const words = clean.split(' ').filter(w => w.length > 0);
  if (words.length <= 2) {
    const isSingleAck = words.every(w => [
      'כן', 'לא', 'טוב', 'יופי', 'אחלה', 'סבבה', 'תודה', 'מעולה', 'מצוין',
      'בסדר', 'ברור', 'הבנתי', 'אוקי', 'אוקיי', 'שלום', 'היי', 'הי', 'חח', 'חחח', 'בי', 'ביי'
    ].includes(w));
    if (isSingleAck) return false;
  }

  // If message length is very long and has specific content, treat as actionable
  if (words.length >= 4) return true;

  return false;
}

async function testClassification() {
  const testSamples = [
    'חח..יש לך עוד חודש לבלות אתו, ובטוחה שעוד תפגשו בהמשך 😊',
    'תודה, ניפגש',
    'תחבר',
    'שלום',
    '',
    'כן בטח לשניכם',
    'תודה רבה!',
    'סבבה תודה',
    'מתי אפשר להביא את הכלב?',
    'היי יש מקום לסופש הקרוב?',
    'שלום כמה עולה לילה לפנסיון?',
    'הכלב שלי מקבל כדורים פעמיים ביום, זה בסדר?',
    'רצינו לבטל את ההזמנה',
    '👍',
    'חחחחחחח',
    'לילה טוב שמוליק'
  ];

  console.log('=== TESTING CLASSIFICATION ON SAMPLE MESSAGES ===');
  testSamples.forEach(msg => {
    const actionable = isActionableIncomingMessage(msg);
    console.log(`[${actionable ? '🔴 דורש מענה' : '⚪ סגירת שיחה/דילוג'}] "${msg}"`);
  });
}

testClassification();
