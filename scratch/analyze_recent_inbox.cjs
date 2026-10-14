const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function test() {
  const url = `https://7107.api.greenapi.com/waInstance${id}/lastIncomingMessages/${token}?minutes=7200`;
  const res = await fetch(url);
  const msgs = await res.json();
  console.log('Incoming count (last 5 days):', msgs.length);
  
  const byChat = {};
  msgs.forEach(m => {
    if (!byChat[m.chatId]) byChat[m.chatId] = [];
    byChat[m.chatId].push(m);
  });

  const leads = [];
  for (const [chatId, list] of Object.entries(byChat)) {
    const textAll = list.map(m => m.textMessage || m.caption || m.extendedTextMessage?.text || '').join(' ');
    const firstMsg = list[list.length - 1];
    const d = new Date(firstMsg.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    leads.push({
      chatId,
      name: firstMsg.senderName || '',
      date: d,
      isLeadForm: textAll.includes('השלמתי את הטופס'),
      sample: textAll.slice(0, 150)
    });
  }

  console.log('Unique incoming chats:', leads.length);
  leads.forEach(l => {
    console.log(`[${l.date}] ${l.chatId} (${l.name}) [LeadForm: ${l.isLeadForm}]: ${l.sample.replace(/\n/g, ' ')}`);
  });
}
test();
