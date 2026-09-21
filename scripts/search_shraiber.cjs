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

async function search() {
  console.log('Searching for Ariel Shraiber / 0544452521...');
  
  // 1. CRM Leads / Settings
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings[0]?.data || {};
  
  // 2. Intakes
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const matchingIntakes = (intakes || []).filter(i => 
    JSON.stringify(i).includes('0544452521') || JSON.stringify(i).includes('שרייבר')
  );
  console.log('Matching Intakes:', matchingIntakes);

  // 3. Green API chats if possible
  const id = s.greenApiIdInstance;
  const token = s.greenApiToken;
  if (id && token) {
    try {
      const res = await fetch(`https://api.green-api.com/waInstance${id}/getChatHistory/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: '972544452521@c.us', count: 10 })
      });
      const hist = await res.json();
      console.log('GreenAPI Chat History for 0544452521:', Array.isArray(hist) ? hist.length : hist);
      if (Array.isArray(hist) && hist.length > 0) {
        hist.forEach(m => console.log(m.type, m.textMessage || m.extendedTextMessage?.text));
      }
    } catch (e) {
      console.log('Error fetching chat history:', e.message);
    }

    // Also check Shmulik chat for mention of Ariel Shraiber or Boss
    try {
      const res2 = await fetch(`https://api.green-api.com/waInstance${id}/getChatHistory/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: '972548765888@c.us', count: 50 })
      });
      const shmulikHist = await res2.json();
      if (Array.isArray(shmulikHist)) {
        const found = shmulikHist.filter(m => {
          const t = m.textMessage || m.extendedTextMessage?.text || '';
          return t.includes('שרייבר') || t.includes('0544452521') || (t.includes('בוס') && !t.includes('אהרונסון'));
        });
        console.log('Mentions in Shmulik chat:', found.length);
        found.forEach(m => console.log(m.textMessage || m.extendedTextMessage?.text));
      }
    } catch (e) {
      console.log('Error searching Shmulik chat:', e.message);
    }
  }
}

search();
