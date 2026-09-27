const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function findPoll() {
  const { data } = await supabase.from('settings').select('*').single();
  const d = data.data || {};
  const greenId = d.greenApiIdInstance;
  const greenToken = d.greenApiToken;

  const urlChats = `https://api.green-api.com/waInstance${greenId}/getChats/${greenToken}`;
  const resChats = await fetch(urlChats);
  const chats = await resChats.json();

  console.log(`Searching across ${chats.length} chats...`);

  for (let i = 0; i < Math.min(chats.length, 30); i++) {
    const c = chats[i];
    try {
      const urlHist = `https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`;
      const resHist = await fetch(urlHist, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: c.id, count: 5 })
      });
      const msgs = await resHist.json();
      if (Array.isArray(msgs)) {
        for (const m of msgs) {
          const str = JSON.stringify(m);
          if (str.includes('המתגעגעת') || str.includes('טוני') || str.includes('סוכות')) {
            console.log(`\n=== MATCH FOUND in chat: ${c.id} (${c.name || 'unnamed'}) ===`);
            console.log('Timestamp:', new Date(m.timestamp * 1000).toLocaleString('he-IL'));
            console.log('Type:', m.typeMessage || m.type);
            console.log('Sender:', m.senderName || m.senderId);
            console.log(str.substring(0, 500));
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
}
findPoll();
