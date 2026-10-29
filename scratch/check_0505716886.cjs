const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function run() {
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const d = sRows?.[0]?.data || {};
  const idInstance = d.greenApiIdInstance;
  const token = d.greenApiToken;
  console.log('Instance:', idInstance);
  
  const res = await fetch('https://api.green-api.com/waInstance' + idInstance + '/getContactInfo/' + token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972505716886@c.us' })
  });
  console.log('Contact info:', await res.json());

  const resHist = await fetch('https://api.green-api.com/waInstance' + idInstance + '/getChatHistory/' + token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972505716886@c.us', count: 10 })
  });
  console.log('Chat history:', await resHist.json());
}
run().catch(console.error);
