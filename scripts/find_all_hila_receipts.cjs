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

async function main() {
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings?.[0]?.data || {};
  const greenId = s.greenApiIdInstance;
  const greenToken = s.greenApiToken;

  console.log('Current trainerReceipts in settings:', JSON.stringify(s.trainerReceipts || [], null, 2));

  // Let's get the image URL / downloadUrl for message 3A32B80F94E14C97D5D6 in Hila's chat
  console.log('\n--- Checking specific message 3A32B80F94E14C97D5D6 ---');
  try {
    const dRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getMessage/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972526908943@c.us', idMessage: '3A32B80F94E14C97D5D6' })
    });
    const msgData = await dRes.json();
    console.log('Message 3A32B80F94E14C97D5D6 detail:', msgData);
    if (msgData.downloadUrl) {
      console.log('Download URL:', msgData.downloadUrl);
    }
  } catch (e) {
    console.log('Error getting msg:', e);
  }

  // Also check downloadFile api if available
  try {
    const dfRes = await fetch(`https://api.green-api.com/waInstance${greenId}/downloadFile/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972526908943@c.us', idMessage: '3A32B80F94E14C97D5D6' })
    });
    const dfData = await dfRes.json();
    console.log('downloadFile response:', dfData);
  } catch (e) {
    console.log('downloadFile err:', e);
  }

  // Let's check Shmulik's chat for images or receipt mentions around 22.9 or recently
  console.log('\n--- Checking Shmulik chat 972506336896@c.us (last 50 msgs) ---');
  const sRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972506336896@c.us', count: 50 })
  });
  const sMsgs = await sRes.json();
  if (Array.isArray(sMsgs)) {
    sMsgs.forEach(m => {
      const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || '';
      if (text.includes('קבלה') || text.includes('הילה') || m.typeMessage === 'imageMessage' || m.type === 'incoming') {
        console.log(`[${time}] ID:${m.idMessage} Type:${m.type}/${m.typeMessage} Text: "${text.replace(/\n/g, ' ')}" URL: ${m.downloadUrl || m.fileUrl || ''}`);
      }
    });
  }

  // Let's check Hagai's chat 972543200007@c.us (last 50 msgs)
  console.log('\n--- Checking Hagai chat 972543200007@c.us (last 50 msgs) ---');
  const hRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972543200007@c.us', count: 50 })
  });
  const hMsgs = await hRes.json();
  if (Array.isArray(hMsgs)) {
    hMsgs.forEach(m => {
      const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || '';
      if (text.includes('קבלה') || text.includes('הילה') || m.typeMessage === 'imageMessage') {
        console.log(`[${time}] ID:${m.idMessage} Type:${m.type}/${m.typeMessage} Text: "${text.replace(/\n/g, ' ')}" URL: ${m.downloadUrl || m.fileUrl || ''}`);
      }
    });
  }
}

main().catch(console.error);
