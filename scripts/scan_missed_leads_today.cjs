const fs = require('fs');
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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const cluster = '7107';
const idInstance = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

const INTERNAL_PHONES = ['0506336896', '0543200007', '0543180407', '0524467314', '0548765888', '0506816001'];

function cleanPhone(p) {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.startsWith('972') && d.length >= 12) return '0' + d.slice(3);
  return d;
}

async function scanTodayLeads() {
  console.log('סורק שיחות פעילות מהיום ב-Green-API...\n');

  const chats = await fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/getChats/${token}`).then(r => r.json()).catch(() => []);
  if (!Array.isArray(chats)) {
    console.error('Failed to get chats:', chats);
    return;
  }

  const { data: bookings } = await supabase.from('bookings').select('*');
  const existingPhones = new Set();
  (bookings || []).forEach(b => {
    const d = b.data || {};
    const p = cleanPhone(b.owner_phone || d.ownerPhone);
    if (p) existingPhones.add(p);
  });

  const todayStartSec = Math.floor(new Date('2026-10-04T00:00:00+03:00').getTime() / 1000);

  // Take top 35 direct customer chats
  const directChats = chats
    .filter(c => c.id && c.id.endsWith('@c.us') && !c.id.includes('-'))
    .filter(c => !INTERNAL_PHONES.includes(cleanPhone(c.id.replace('@c.us', ''))))
    .slice(0, 35);

  const leads = [];

  // Fetch in parallel chunks of 5
  for (let i = 0; i < directChats.length; i += 5) {
    const chunk = directChats.slice(i, i + 5);
    await Promise.all(chunk.map(async (chat) => {
      const chatId = chat.id;
      const phone = cleanPhone(chatId.replace('@c.us', ''));

      const messages = await fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/GetChatHistory/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, count: 8 })
      }).then(r => r.json()).catch(() => []);

      if (!Array.isArray(messages) || messages.length === 0) return;

      const todayMsgs = messages.filter(m => m.timestamp >= todayStartSec);
      if (todayMsgs.length === 0) return;

      const isClientExisting = existingPhones.has(phone);
      const clientMsgs = todayMsgs.filter(m => m.type === 'incoming');
      const outgoingMsgs = todayMsgs.filter(m => m.type === 'outgoing');

      const hasIntakeLinkSent = outgoingMsgs.some(m => {
        const text = m.textMessage || '';
        return text.includes('request=true') || text.includes('שאלון קליטה') || text.includes('rezort-webapp');
      });

      const hasShmulikReplied = outgoingMsgs.length > 0;

      leads.push({
        chatId,
        phone,
        contactName: chat.name || '',
        isExisting: isClientExisting,
        clientMsgsCount: clientMsgs.length,
        outgoingMsgsCount: outgoingMsgs.length,
        hasIntakeLinkSent,
        hasShmulikReplied,
        lastClientText: clientMsgs[0]?.textMessage || '',
        lastOutgoingText: outgoingMsgs[0]?.textMessage || '',
        lastMsgTime: new Date((todayMsgs[0]?.timestamp || 0) * 1000).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })
      });
    }));
  }

  console.log(`=== ממצאי סריקת פניות מהיום (${leads.length} שיחות פעילות) ===\n`);
  leads.forEach((l, i) => {
    console.log(`[${i + 1}] ${l.contactName || 'ללא שם'} (${l.phone}) - שעה ${l.lastMsgTime}`);
    console.log(`    לקוח קיים ביומן: ${l.isExisting ? 'כן 🐕' : 'לא (ליד חדש 🆕)'}`);
    console.log(`    נשלח קישור שאלון: ${l.hasIntakeLinkSent ? 'כן ✅' : 'לא ❌'}`);
    console.log(`    מענה משמוליק: ${l.hasShmulikReplied ? 'כן 💬' : 'אין מענה ⏳'}`);
    if (l.lastClientText) console.log(`    לקוח כתב: "${l.lastClientText.slice(0, 70)}"`);
    if (l.lastOutgoingText) console.log(`    הודעה יוצאת: "${l.lastOutgoingText.slice(0, 70)}"`);
    console.log('');
  });
}

scanTodayLeads().catch(console.error);
