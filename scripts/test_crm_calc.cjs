const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
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

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) {
    digits = '0' + digits.slice(3);
  } else if (digits.length === 9 && digits.startsWith('5')) {
    digits = '0' + digits;
  }
  return digits;
}

function extractPhoneFromChatId(chatId) {
  const digits = chatId.replace(/@.*$/, '').replace(/\D/g, '');
  if (digits.startsWith('972') && digits.length >= 12) {
    return '0' + digits.substring(3);
  }
  return digits;
}

function detectCustomerIntent(lastMessage, senderName, dogName) {
  if (!lastMessage || typeof lastMessage !== 'string') return null;
  const msg = lastMessage.trim().toLowerCase();

  const archivePhrases = [
    'הסתדרתי', 'כבר הסתדרנו', 'מצאנו פתרון', 'לא רלוונטי', 'לא אקטואלי',
    'טעות במספר', 'טעות', 'ביי', 'תודה רבה ביי', 'בינתיים לא',
    'ירדנו מזה', 'ביטלנו', 'לא צריכים', 'נרשמנו במקום אחר', 'מצאנו פנסיון אחר',
    'סגרנו במקום אחר', 'לא מתאים לנו', 'תודה והמשך יום נעים'
  ];
  if (archivePhrases.some(p => msg.includes(p))) {
    return { type: 'closed', shouldArchive: true };
  }

  const deferralPhrases = [
    'נדבר שבוע הבא', 'נדבר מחר', 'אחזור אליך', 'אדבר איתך', 'אעדכן אותך',
    'אבדוק ואחזור', 'אבדוק עם בעלי', 'אבדוק עם אשתי', 'שבוע הבא', 'בהמשך', 'עוד כמה ימים'
  ];
  if (deferralPhrases.some(p => msg.includes(p))) {
    return { type: 'deferral', shouldArchive: false };
  }

  const pricePhrases = [
    'יקר', 'יקר מדי', 'מחיר גבוה', 'יש הנחה', 'אפשר הנחה', 'גבוה לנו', 'קצת יקר'
  ];
  if (pricePhrases.some(p => msg.includes(p))) {
    return { type: 'price_objection', shouldArchive: false };
  }

  return null;
}

function getChatTreatmentStatus(chat, statusOverrides = {}) {
  const now = Date.now();
  const chatTime = chat.timestamp || now;
  const ageHours = (now - chatTime) / (1000 * 60 * 60);

  if (chat.lastMessageType === 'outgoing') {
    if (ageHours >= 24 || statusOverrides[chat.cleanPhone] === 'handled' || statusOverrides[chat.cleanPhone] === 'unanswered') {
      return 'handled';
    }
  }

  if (statusOverrides[chat.cleanPhone] && chat.lastMessageType !== 'incoming') {
    return statusOverrides[chat.cleanPhone];
  }

  if (ageHours >= 48) {
    return 'handled';
  }

  if (chat.lastMessageType === 'incoming') {
    const intent = detectCustomerIntent(chat.lastMessage, chat.name, chat.matchedDogName);
    if (intent) {
      if (intent.shouldArchive) return 'handled';
      if (intent.type === 'deferral') return 'waiting_reply';
      if (intent.type === 'price_objection') return 'in_chat';
    }
  }

  if (chat.lastMessageType === 'incoming' && ageHours < 48) {
    return 'new';
  }

  if (chat.lastMessageType === 'outgoing' && ageHours < 24) {
    return 'waiting_reply';
  }

  return 'handled';
}

const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function run() {
  const { data: dbSettings } = await supabase.from('settings').select('*').limit(1);
  const { data: dbBookings } = await supabase.from('bookings').select('*');
  const settings = dbSettings ? dbSettings[0] : {};
  const bookings = dbBookings || [];
  const intakeRequests = settings.extra_data?.intakeRequests || [];

  const [incRes, outRes, chatsRes] = await Promise.all([
    fetch(`https://api.green-api.com/waInstance${id}/lastIncomingMessages/${token}?minutes=10080`).then(r => r.json()),
    fetch(`https://api.green-api.com/waInstance${id}/lastOutgoingMessages/${token}?minutes=10080`).then(r => r.json()),
    fetch(`https://api.green-api.com/waInstance${id}/getChats/${token}`).then(r => r.json()).catch(() => [])
  ]);

  const nameMap = {};
  if (Array.isArray(chatsRes)) {
    chatsRes.forEach(c => {
      if (c.id && c.name) nameMap[c.id] = c.name;
    });
  }

  const incoming = Array.isArray(incRes) ? incRes : [];
  const outgoing = Array.isArray(outRes) ? outRes : [];

  const chatMap = new Map();
  const processMessage = (m, direction) => {
    const chatId = m.chatId;
    if (!chatId || chatId.includes('@g.us') || chatId.includes('@broadcast') || chatId === 'status@broadcast') return;
    if (chatId.includes('506336896') || chatId.includes('506816001') || chatId.includes('548765888')) return;

    const phone = extractPhoneFromChatId(chatId);
    const cleanP = cleanPhoneNumber(phone);
    const msgTime = (m.timestamp || 0) * 1000;
    const msgText = m.textMessage || (m.extendedTextMessage?.text) || '';

    if (!chatMap.has(chatId)) {
      chatMap.set(chatId, {
        id: chatId,
        name: m.senderName || nameMap[chatId] || phone,
        cleanPhone: cleanP,
        unreadCount: direction === 'incoming' ? 1 : 0,
        lastMessage: msgText,
        timestamp: msgTime,
        lastMessageType: direction,
        incomingCount: direction === 'incoming' ? 1 : 0,
        outgoingCount: direction === 'outgoing' ? 1 : 0
      });
    } else {
      const existing = chatMap.get(chatId);
      if (m.senderName && (!existing.name || existing.name.includes('@'))) existing.name = m.senderName;
      if (direction === 'incoming') {
        existing.incomingCount = (existing.incomingCount || 0) + 1;
      } else {
        existing.outgoingCount = (existing.outgoingCount || 0) + 1;
      }
      if (msgTime > (existing.timestamp || 0)) {
        existing.timestamp = msgTime;
        existing.lastMessageType = direction;
        if (msgText) existing.lastMessage = msgText;
      }
    }
  };

  incoming.forEach(m => processMessage(m, 'incoming'));
  outgoing.forEach(m => processMessage(m, 'outgoing'));

  const rawChats = Array.from(chatMap.values()).filter(c => c.name !== '♥️' && c.name !== '❤️');
  
  const evaluated = rawChats.map(c => {
    const status = getChatTreatmentStatus(c);
    return { ...c, status };
  });

  const newOnes = evaluated.filter(c => c.status === 'new');
  console.log(`Total Evaluated: ${evaluated.length}, In Status 'new': ${newOnes.length}`);
  newOnes.forEach((c, i) => {
    const dt = new Date(c.timestamp).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    console.log(`[${i+1}] Name: ${c.name} | Phone: ${c.cleanPhone}`);
    console.log(`    Last Msg: "${c.lastMessage}" | Time: ${dt}`);
  });
}

run().catch(console.error);
