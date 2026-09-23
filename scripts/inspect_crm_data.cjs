const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const sb = createClient(url, key);

async function run() {
  const { data: intakes } = await sb.from('intake_requests').select('*');
  console.log('--- INTAKES TABLE (' + (intakes ? intakes.length : 0) + ') ---');
  if (intakes && intakes.length > 0) {
    intakes.forEach(i => {
      console.log(`ID: ${i.id} | Status: ${i.status} | Dog: ${i.dog_name} | Owner: ${i.owner_name} | Phone: ${i.owner_phone} | Dates: ${i.start_date}-${i.end_date}`);
    });
  }

  const { data: sRows } = await sb.from('settings').select('*');
  const sRow = sRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const sIntakes = settings.intakeRequests || [];
  console.log('\n--- SETTINGS INTAKES (' + sIntakes.length + ') ---');
  sIntakes.forEach(i => {
    console.log(`ID: ${i.id} | Status: ${i.status} | Dog: ${i.dogName} | Owner: ${i.ownerName} | Phone: ${i.ownerPhone} | Dates: ${i.startDate}-${i.endDate}`);
  });

  const greenId = settings.greenApiIdInstance || '710722735421';
  const greenToken = settings.greenApiToken || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  console.log('\n--- FETCHING GREEN-API LAST INCOMING ---');
  try {
    const res = await fetch(`https://api.green-api.com/waInstance${greenId}/lastIncomingMessages/${greenToken}?minutes=10080`);
    const msgs = await res.json();
    console.log('Incoming messages count:', msgs ? msgs.length : 0);
    if (Array.isArray(msgs)) {
      msgs.slice(0, 20).forEach(m => {
        const text = m.textMessage || (m.extendedTextMessage && m.extendedTextMessage.text) || '';
        console.log(`[${m.chatId}] (${m.senderName || ''}) -> "${text}"`);
      });
    }
  } catch (e) {
    console.error('Green-API error:', e.message);
  }
}

run();
