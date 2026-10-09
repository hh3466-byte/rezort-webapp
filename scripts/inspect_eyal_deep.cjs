const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  console.log('=== BOOKINGS FOR EYAL BERCOVITZ / LOLA & BRANDY ===');
  const { data: bookings } = await supabase.from('bookings').select('*');
  const eyalBookings = bookings.filter(b => 
    (b.owner_phone && b.owner_phone.includes('556694789')) ||
    (b.owner_name && b.owner_name.includes('ברקוביץ')) ||
    (b.dog_name && (b.dog_name.includes('לולה') || b.dog_name.includes('ברנדי')))
  );
  console.log('Found bookings:', JSON.stringify(eyalBookings, null, 2));

  console.log('\n=== WHATSAPP CHAT WITH EYAL (0556694789) ===');
  // Check Green API messages or chats table in DB if exists
  const { data: messages, error: mErr } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
  if (!mErr && messages) {
    const eyalMsgs = messages.filter(m => JSON.stringify(m).includes('556694789'));
    console.log(`DB messages for Eyal (${eyalMsgs.length}):`, JSON.stringify(eyalMsgs, null, 2));
  } else {
    console.log('No messages table or error:', mErr);
  }

  // Also let's query Green API directly if possible or check settings
  const { data: settingsData } = await supabase.from('settings').select('*');
  let greenApiUrl = env.VITE_GREEN_API_URL || env.GREEN_API_URL;
  let greenApiInstance = env.VITE_GREEN_API_INSTANCE_ID || env.GREEN_API_INSTANCE_ID;
  let greenApiToken = env.VITE_GREEN_API_TOKEN || env.GREEN_API_TOKEN;

  if (settingsData) {
    settingsData.forEach(s => {
      if (s.data) {
        if (s.data.greenApi) {
          greenApiUrl = s.data.greenApi.apiUrl || greenApiUrl;
          greenApiInstance = s.data.greenApi.idInstance || greenApiInstance;
          greenApiToken = s.data.greenApi.apiTokenInstance || greenApiToken;
        }
      }
    });
  }

  console.log('Green API Config:', { greenApiUrl, greenApiInstance, hasToken: !!greenApiToken });

  if (greenApiUrl && greenApiInstance && greenApiToken) {
    try {
      const chatId = '972556694789@c.us';
      const historyUrl = `${greenApiUrl}/waInstance${greenApiInstance}/getChatHistory/${greenApiToken}`;
      console.log('Fetching chat history from Green API for', chatId);
      const res = await fetch(historyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, count: 50 })
      });
      const history = await res.json();
      console.log('Chat history response:');
      if (Array.isArray(history)) {
        history.reverse().forEach(msg => {
          const sender = msg.type === 'outgoing' ? 'RESORT' : 'EYAL';
          const text = msg.textMessage || (msg.extendedTextMessage && msg.extendedTextMessage.text) || msg.caption || `[${msg.typeMessage}]`;
          const time = new Date(msg.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
          console.log(`[${time}] ${sender}: ${text}`);
        });
      } else {
        console.log(history);
      }
    } catch (e) {
      console.error('Error fetching Green API history:', e);
    }
  }
}

main().catch(console.error);
