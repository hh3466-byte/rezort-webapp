async function fetchChats() {
  const GREEN_API_ID = '710722735421';
  const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const CLUSTER = '7107';

  console.log('=== CHAT WITH TAMAR (0542188921) ===');
  try {
    const res = await fetch(`https://${CLUSTER}.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972542188921@c.us', count: 30 })
    });
    const msgs = await res.json();
    console.log(`Found ${Array.isArray(msgs) ? msgs.length : 0} messages:`);
    if (Array.isArray(msgs)) {
      msgs.reverse().forEach(m => {
        const text = m.textMessage || m.extendedTextMessage?.text || (m.caption ? `[Media: ${m.caption}]` : `[${m.typeMessage}]`);
        console.log(`[${new Date(m.timestamp * 1000).toLocaleString('he-IL')}] ${m.type === 'outgoing' ? 'Resort ->' : '<- Tamar'}: ${text}`);
      });
    }
  } catch (e) {
    console.error('Error Tamar:', e.message);
  }

  console.log('\n=== CHAT WITH KOBI (0523679637) ===');
  try {
    const res = await fetch(`https://${CLUSTER}.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972523679637@c.us', count: 30 })
    });
    const msgs = await res.json();
    console.log(`Found ${Array.isArray(msgs) ? msgs.length : 0} messages:`);
    if (Array.isArray(msgs)) {
      msgs.reverse().forEach(m => {
        const text = m.textMessage || m.extendedTextMessage?.text || (m.caption ? `[Media: ${m.caption}]` : `[${m.typeMessage}]`);
        console.log(`[${new Date(m.timestamp * 1000).toLocaleString('he-IL')}] ${m.type === 'outgoing' ? 'Resort ->' : '<- Kobi'}: ${text}`);
      });
    }
  } catch (e) {
    console.error('Error Kobi:', e.message);
  }
}
fetchChats();
