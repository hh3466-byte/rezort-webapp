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

async function inspectHilaVideos() {
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings?.[0]?.data || {};
  const greenId = s.greenApiIdInstance;
  const greenToken = s.greenApiToken;

  const hRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972526908943@c.us', count: 100 })
  });
  const msgs = await hRes.json();
  if (!Array.isArray(msgs)) {
    console.error('Failed to fetch messages:', msgs);
    return;
  }

  const videoMsgs = msgs.filter(m => m.typeMessage === 'videoMessage' || m.type === 'videoMessage');
  console.log(`Found ${videoMsgs.length} video messages from Hila:\n`);

  for (const vm of videoMsgs) {
    const time = vm.timestamp ? new Date(vm.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
    let downloadUrl = vm.downloadUrl || vm.fileUrl || '';

    // If downloadUrl is empty, try downloadFile or getMessage
    if (!downloadUrl) {
      try {
        const dfRes = await fetch(`https://api.green-api.com/waInstance${greenId}/downloadFile/${greenToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: '972526908943@c.us', idMessage: vm.idMessage })
        });
        const dfData = await dfRes.json();
        downloadUrl = dfData.downloadUrl || '';
      } catch (e) {
        console.warn('Error downloading file info:', e);
      }
    }

    console.log({
      idMessage: vm.idMessage,
      time,
      type: vm.type,
      caption: vm.caption || vm.textMessage || '',
      downloadUrl
    });
  }
}

inspectHilaVideos().catch(console.error);
