const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = (m[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[m[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function findItay() {
  console.log('Searching for Itay Aaronson / 0543044647...');
  
  // 1. Search bookings
  const { data: b1 } = await supabase.from('bookings').select('*');
  const matchedBookings = (b1 || []).filter(b => {
    const s = JSON.stringify(b);
    return s.includes('אהרונסון') || s.includes('0543044647') || s.includes('3044647') || s.includes('איתי');
  });
  console.log('Matched bookings count:', matchedBookings.length);
  matchedBookings.forEach(b => console.log('Booking:', {
    id: b.id,
    customer_name: b.customer_name || b.ownerName,
    dog_name: b.dog_name || b.dogName,
    start_date: b.start_date || b.startDate,
    end_date: b.end_date || b.endDate,
    total_price: b.total_price || b.totalPrice,
    notes: b.notes
  }));

  // 2. Search settings
  const { data: set } = await supabase.from('settings').select('*');
  if (set && set[0]) {
    const s = set[0].data || set[0];
    const gp = s.pendingGrowPayments || [];
    console.log('Total pending Grow payments in settings:', gp.length);
    const matchedGp = gp.filter(p => JSON.stringify(p).includes('אהרונסון') || JSON.stringify(p).includes('3044647') || JSON.stringify(p).includes('4900844785'));
    console.log('Matched Grow payments:', matchedGp);

    const intakes = s.intakeRequests || [];
    const matchedIntakes = intakes.filter(i => JSON.stringify(i).includes('אהרונסון') || JSON.stringify(i).includes('3044647') || JSON.stringify(i).includes('איתי'));
    console.log('Matched Intakes:', matchedIntakes);
  }

  // 3. Search Green API Chat history
  const greenApiId = '7105267323';
  const greenApiToken = 'f6ce83ecde134f719b9175ef36e5ca9a2245b73d8f814980a3';
  const phone = '972543044647';
  console.log('Fetching Green API chat history for', phone);
  try {
    const url = `https://api.green-api.com/waInstance${greenApiId}/getChatHistory/${greenApiToken}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ chatId: phone + '@c.us', count: 30 })
    });
    const msgs = await resp.json();
    console.log('Chat msgs count for 0543044647:', Array.isArray(msgs) ? msgs.length : msgs);
    if (Array.isArray(msgs) && msgs.length > 0) {
      msgs.reverse().forEach(m => {
        const text = m.textMessage || (m.extendedTextMessage && m.extendedTextMessage.text) || '';
        const date = new Date(m.timestamp * 1000).toLocaleString('he-IL');
        console.log(`[${date}] [${m.type}]: ${text}`);
      });
    }
  } catch (e) {
    console.error('Error fetching chat:', e);
  }
}

findItay();
