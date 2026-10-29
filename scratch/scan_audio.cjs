const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function scanForAudio() {
  const cluster = id.length >= 4 ? id.slice(0, 4) : '7107';
  const chatsUrl = `https://${cluster}.api.greenapi.com/waInstance${id}/getChats/${token}`;
  
  const res = await fetch(chatsUrl);
  if (!res.ok) {
    console.log('Error fetching chats:', res.status, await res.text());
    return;
  }
  const chats = await res.json();
  console.log(`Checking ${chats.length} chats for audio messages...`);

  for (const c of chats.slice(0, 15)) {
    const histUrl = `https://${cluster}.api.greenapi.com/waInstance${id}/getChatHistory/${token}`;
    const hRes = await fetch(histUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: c.id, count: 20 })
    });
    if (!hRes.ok) continue;
    const msgs = await hRes.json();
    if (!Array.isArray(msgs)) continue;
    const audios = msgs.filter(m => m.typeMessage === 'audioMessage' || m.downloadUrl?.includes('audio') || m.typeMessage?.includes('audio'));
    if (audios.length > 0) {
      console.log(`Found ${audios.length} audio message(s) in chat ${c.id} (${c.name}):`);
      audios.forEach(a => console.log('Audio message object:', JSON.stringify(a, null, 2)));
      break;
    }
  }
  console.log('Scan completed.');
}

scanForAudio();
