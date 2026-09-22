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

async function searchAllChatsForHilaAndLuna() {
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings?.[0]?.data || {};
  const greenId = s.greenApiIdInstance;
  const greenToken = s.greenApiToken;

  console.log('--- Fetching all chats from Green-API ---');
  const res = await fetch(`https://api.green-api.com/waInstance${greenId}/getChats/${greenToken}`);
  const chats = await res.json();
  console.log('Total chats in Green-API:', Array.isArray(chats) ? chats.length : chats);

  if (!Array.isArray(chats)) return;

  // Find any chats matching Hila, Luna, Ronen, or phone numbers
  const matchedChats = chats.filter(c => {
    const id = c.id || '';
    const name = c.name || '';
    return id.includes('526908943') || 
           name.includes('הילה') || 
           name.includes('Halodog') || 
           name.includes('לונה') || 
           name.includes('מלמוד') || 
           id.includes('544452521') || 
           id.includes('506336896') || 
           id.includes('543200007');
  });

  console.log('Matched chats count:', matchedChats.length);
  for (const mc of matchedChats) {
    console.log(`Chat ID: ${mc.id}, Name: ${mc.name}`);
  }

  // Let's check history in Hila's chat with count 100
  console.log('\n--- Checking Hila Chat 972526908943@c.us (last 100 msgs) ---');
  const hRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972526908943@c.us', count: 100 })
  });
  const hMsgs = await hRes.json();
  if (Array.isArray(hMsgs)) {
    console.log(`Found ${hMsgs.length} messages in Hila's chat:`);
    hMsgs.forEach(m => {
      const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
      console.log(`[${time}] ID:${m.idMessage} Type:${m.type}/${m.typeMessage} Text: "${(m.textMessage || m.extendedTextMessage?.text || m.caption || '').replace(/\n/g, ' ')}" URL: ${m.downloadUrl || m.fileUrl || ''}`);
    });
  }

  // Also check Ronen Malamud (Luna's owner) chat
  const ronenChat = chats.find(c => (c.name || '').includes('מלמוד') || (c.name || '').includes('רונן'));
  if (ronenChat) {
    console.log(`\n--- Checking Ronen Malamud chat ${ronenChat.id} ---`);
    const rRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: ronenChat.id, count: 30 })
    });
    const rMsgs = await rRes.json();
    if (Array.isArray(rMsgs)) {
      rMsgs.forEach(m => {
        const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
        console.log(`[${time}] ${m.type}/${m.typeMessage}: "${(m.textMessage || m.extendedTextMessage?.text || m.caption || '').replace(/\n/g, ' ')}"`);
      });
    }
  }

  // Also check Shmulik's private chat (972506336896@c.us)
  console.log('\n--- Checking Shmulik Private Chat 972506336896@c.us ---');
  const sRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972506336896@c.us', count: 20 })
  });
  const sMsgs = await sRes.json();
  if (Array.isArray(sMsgs)) {
    sMsgs.forEach(m => {
      const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
      console.log(`[${time}] ${m.type}/${m.typeMessage}: "${(m.textMessage || m.extendedTextMessage?.text || m.caption || '').replace(/\n/g, ' ')}" URL: ${m.downloadUrl || m.fileUrl || ''}`);
    });
  }
}

searchAllChatsForHilaAndLuna();
