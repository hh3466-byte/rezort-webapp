const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function extractPhone(chatId) {
  const digits = chatId.replace('@c.us', '').replace(/\D/g, '');
  if (digits.startsWith('972')) {
    return '0' + digits.slice(3);
  }
  return digits;
}

async function run() {
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

  console.log(`Incoming count: ${incoming.length}, Outgoing count: ${outgoing.length}`);

  const chatMap = new Map();
  const processMessage = (m, direction) => {
    const chatId = m.chatId;
    if (!chatId || chatId.includes('@g.us') || chatId.includes('@broadcast') || chatId === 'status@broadcast') return;
    if (chatId.includes('506336896') || chatId.includes('506816001') || chatId.includes('548765888')) return;

    const phone = extractPhone(chatId);
    const msgTime = (m.timestamp || 0) * 1000;
    const msgText = m.textMessage || (m.extendedTextMessage?.text) || '';

    if (!chatMap.has(chatId)) {
      chatMap.set(chatId, {
        id: chatId,
        phone,
        name: m.senderName || nameMap[chatId] || phone,
        unreadCount: direction === 'incoming' ? 1 : 0,
        lastMessage: msgText,
        timestamp: msgTime,
        lastMessageType: direction,
        incomingCount: direction === 'incoming' ? 1 : 0,
        outgoingCount: direction === 'outgoing' ? 1 : 0
      });
    } else {
      const existing = chatMap.get(chatId);
      if (m.senderName && (!existing.name || existing.name === phone)) existing.name = m.senderName;
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

  const chats = Array.from(chatMap.values()).sort((a,b) => b.timestamp - a.timestamp);
  const now = Date.now();
  const newChats = chats.filter(c => {
    const ageHours = (now - c.timestamp) / (1000 * 60 * 60);
    return c.lastMessageType === 'incoming' && ageHours < 48;
  });

  console.log('Total business chats:', chats.length);
  console.log(`\n=== 🔴 ${newChats.length} CHATS CURRENTLY CLASSIFIED AS 'NEW' (5 שלא נקראו 🔥) ===\n`);
  newChats.forEach((c, idx) => {
    const dt = new Date(c.timestamp).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    console.log(`[${idx+1}] Name: "${c.name}" | Phone: ${c.phone} (${c.id})`);
    console.log(`    Last Message: "${c.lastMessage}"`);
    console.log(`    Direction: ${c.lastMessageType} | Incoming msgs: ${c.incomingCount}, Outgoing msgs: ${c.outgoingCount}`);
    console.log(`    Time: ${dt}\n`);
  });
}

run().catch(console.error);
