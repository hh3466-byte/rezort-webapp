const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: sRows } = await supabase.from('settings').select('*');
  const d = sRows?.[0]?.data || {};
  const intakes = d.intakeRequests || [];
  const foundIntake = intakes.filter(i => {
    const s = JSON.stringify(i);
    return s.includes('5970156') || s.includes('בוריס') || s.includes('ברנר');
  });
  console.log('Found in intakeRequests:', foundIntake);

  const greenId = d.greenApiIdInstance || '710722735421';
  const greenToken = d.greenApiToken || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  
  try {
    const url = `https://api.green-api.com/waInstance${greenId}/getChats/${greenToken}`;
    const res = await fetch(url);
    if (res.ok) {
      const chats = await res.json();
      const foundChat = chats.filter(c => {
        const s = JSON.stringify(c);
        return s.includes('5970156') || s.includes('בוריס') || s.includes('ברנר');
      });
      console.log('Found in WhatsApp chats:', foundChat);

      // Check chat history if found
      if (foundChat.length > 0) {
        const chatId = foundChat[0].id;
        const hUrl = `https://api.green-api.com/waInstance${greenId}/GetChatHistory/${greenToken}`;
        const hRes = await fetch(hUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, count: 20 })
        });
        if (hRes.ok) {
          const msgs = await hRes.json();
          console.log('Chat messages:', msgs.map(m => ({ type: m.type, text: m.textMessage })));
        }
      }
    }
  } catch (e) {
    console.log('Green API error:', e);
  }
}

run();
