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

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

function isActionableIncomingMessage(rawText) {
  if (!rawText) return false;
  const text = String(rawText).trim();
  if (text.length === 0) return false;

  const clean = text
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[.,!?:;"'()\-–—~`_+=\[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (clean.length === 0) return false;
  if (text.includes('?') || text.includes('؟')) return true;

  const actionableKeywords = [
    'כמה', 'מתי', 'איפה', 'איך', 'האם', 'למה', 'מדוע', 'מי',
    'אפשר', 'אפשרי', 'תוכל', 'תוכלו', 'תוכלי', 'יש מקום', 'יש לכם', 'פנוי',
    'מחיר', 'עלות', 'תעריף', 'תאריכים', 'שאלון', 'לינק', 'קישור', 'תשלום',
    'חיסון', 'חיסונים', 'כלוב', 'אוכל', 'תרופות', 'שעות', 'מתי לבוא', 'מתי להביא',
    'תחזרו', 'תחזור', 'דחוף', 'חשוב', 'טעות', 'שגוי', 'תקלה', 'בעיה', 'הבטחתם',
    'מאוכזב', 'לבטל', 'ביטול', 'לשנות', 'להקדים', 'לדחות', 'החזר', 'שלום רציתי', 'היי רציתי'
  ];

  for (const kw of actionableKeywords) {
    const regex = new RegExp(`(^|\\s)${kw}(\\s|$)`, 'i');
    if (regex.test(clean) || clean.includes(kw)) return true;
  }

  if (/^(ח{2,}|ה{3,}|חה|חח|lol|haha|xd|\s)+$/i.test(clean)) return false;

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

  for (const phrase of closingPhrases) {
    if (clean === phrase) return false;
  }

  if (clean.startsWith('חח') && (clean.includes('תפגשו') || clean.includes('תודה') || clean.includes('שמח'))) {
    return false;
  }

  const words = clean.split(' ').filter(w => w.length > 0);
  if (words.length <= 2) {
    const isSingleAck = words.every(w => [
      'כן', 'לא', 'טוב', 'יופי', 'אחלה', 'סבבה', 'תודה', 'מעולה', 'מצוין',
      'בסדר', 'ברור', 'הבנתי', 'אוקי', 'אוקיי', 'שלום', 'היי', 'הי', 'חח', 'חחח', 'בי', 'ביי'
    ].includes(w));
    if (isSingleAck) return false;
  }

  if (words.length >= 4) return true;
  return false;
}

async function testLiveChats() {
  const req = https.request({
    hostname: 'api.green-api.com',
    path: `/waInstance${GREEN_API_ID}/GetChats/${GREEN_API_TOKEN}`,
    method: 'GET'
  }, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      const chats = JSON.parse(body);
      console.log(`Analyzing ${chats.length} active chats...`);
      
      const nowMs = Date.now();
      const past24h = nowMs - (24 * 60 * 60 * 1000);
      let incomingCount = 0;
      let actionableCount = 0;

      chats.forEach(c => {
        if (!c.lastMessage || c.lastMessage.type !== 'incoming') return;
        const msgTime = (c.lastMessage.timestamp || 0) * 1000;
        if (msgTime < past24h) return;

        incomingCount++;
        const text = c.lastMessage.textMessage || c.lastMessage.extendedTextMessage?.text || '';
        const actionable = isActionableIncomingMessage(text);
        if (actionable) actionableCount++;

        console.log(`[${actionable ? '🔴 דורש מענה' : '⚪ סונן (סגירה/חחח)'}] ${c.name || c.id}: "${text}"`);
      });

      console.log(`\nSummary: Out of ${incomingCount} incoming chats in 24h, ${actionableCount} were flagged as truly actionable, and ${incomingCount - actionableCount} were cleanly filtered out!`);
    });
  });
  req.end();
}

testLiveChats();
