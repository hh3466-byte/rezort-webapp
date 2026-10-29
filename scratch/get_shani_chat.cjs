const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function getChat() {
  const { data: s } = await supabase.from('settings').select('*').limit(1);
  const greenApiId = s[0].data?.greenApiIdInstance?.trim();
  const greenApiToken = s[0].data?.greenApiToken?.trim();

  const clusterPrefix = greenApiId.substring(0, 4);
  const host = `https://${clusterPrefix}.api.greenapi.com`;

  const res = await fetch(`${host}/waInstance${greenApiId}/getChatHistory/${greenApiToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972546474151@c.us', count: 100 })
  });
  const data = await res.json();
  console.log('Messages with Shani count:', data?.length);
  (data || []).reverse().forEach(m => {
    const text = m.textMessage || m.extendedTextMessage?.text || m.caption || '';
    const sender = m.type === 'outgoing' ? 'RESORT' : 'SHANI';
    const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    if (text) {
      console.log(`[${date}] ${sender}: ${text}`);
    }
  });
}
getChat();
