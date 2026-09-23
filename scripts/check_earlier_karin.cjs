const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkEarlierChat() {
  const { data: settingsRows } = await supabase.from('settings').select('*');
  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const greenId = settings.greenApiIdInstance;
  const greenToken = settings.greenApiToken;

  const phone = '972546610321';
  const chatId = `${phone}@c.us`;

  try {
    const res = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, count: 100 })
    });
    const history = await res.json();
    if (Array.isArray(history)) {
      history.reverse().forEach(m => {
        const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
        const sender = m.type === 'outgoing' ? 'שמוליק/ריזורט' : 'קארין';
        const text = m.textMessage || m.extendedTextMessage?.text || (m.typeMessage ? `[${m.typeMessage}]` : '');
        if (text) {
          console.log(`[${time}] ${sender}: ${text.slice(0, 150)}`);
        }
      });
    }
  } catch (e) {
    console.error(e);
  }
}

checkEarlierChat().catch(console.error);
