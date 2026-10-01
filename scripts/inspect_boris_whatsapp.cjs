const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectBorisWhatsApp() {
  const { data: settingsRow } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  const settings = settingsRow?.data || {};
  const idInstance = settings.greenApiIdInstance;
  const apiTokenInstance = settings.greenApiToken;

  console.log('Green API Configured:', Boolean(idInstance && apiTokenInstance));
  if (!idInstance || !apiTokenInstance) return;

  const chatId = '972545970156@c.us';
  const url = `https://api.green-api.com/waInstance${idInstance}/getChatHistory/${apiTokenInstance}`;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, count: 50 })
    });
    const history = await res.json();
    console.log(`=== CHAT HISTORY FOR BORIS (${chatId}) [${Array.isArray(history) ? history.length : 'error'}] ===`);
    if (Array.isArray(history)) {
      history.reverse().forEach(m => {
        const text = m.textMessage || m.extendedTextMessage?.text || m.caption || m.typeMessage;
        const time = new Date(m.timestamp * 1000).toLocaleString('he-IL');
        console.log(`[${time}] ${m.type === 'outgoing' ? 'ריזורט' : 'בוריס'}: ${text}`);
      });
    } else {
      console.log(history);
    }
  } catch (err) {
    console.error('Fetch chat history error:', err);
  }

  // Also check Shmulik chat for any mentions of Boris / בוריס
  const shmulikChatId = '972506336896@c.us';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: shmulikChatId, count: 100 })
    });
    const history = await res.json();
    console.log(`\n=== SHMULIK CHAT MENTIONS OF BORIS ===`);
    if (Array.isArray(history)) {
      const mentions = history.filter(m => {
        const t = (m.textMessage || m.extendedTextMessage?.text || m.caption || '');
        return t.includes('בוריס') || t.includes('מייק') || t.includes('545970156');
      });
      mentions.reverse().forEach(m => {
        const text = m.textMessage || m.extendedTextMessage?.text || m.caption;
        const time = new Date(m.timestamp * 1000).toLocaleString('he-IL');
        console.log(`[${time}] ${m.type === 'outgoing' ? 'מערכת/מנהל' : 'שמוליק'}: ${text}`);
      });
    }
  } catch (err) {
    console.error('Fetch shmulik chat error:', err);
  }
}

inspectBorisWhatsApp();
