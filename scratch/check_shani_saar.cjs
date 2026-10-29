const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkDetails() {
  const { data: settings } = await supabase.from('settings').select('*');
  console.log('Settings rows:', settings?.length);
  if (settings && settings[0]) {
    const s0 = settings[0];
    console.log('Top keys in settings[0]:', Object.keys(s0));
    // check punchCards or vipPasses
    ['vipPasses', 'punchCards', 'packages', 'vip_passes', 'punch_cards'].forEach(k => {
      if (s0[k]) console.log(`Found ${k}:`, s0[k]);
      if (s0.data && s0.data[k]) console.log(`Found s0.data.${k}:`, s0.data[k]);
    });
    // search inside json for 8935
    const str = JSON.stringify(s0);
    const idx = str.indexOf('8935');
    if (idx !== -1) {
      console.log('Found 8935 snippet:', str.slice(Math.max(0, idx - 100), idx + 200));
    }
  }

  // Let's search all intake requests
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  console.log('Intakes count:', intakes?.length);
  intakes?.forEach(i => {
    const text = `${i.owner_name} ${i.dog_name} ${i.owner_phone} ${i.notes || ''}`;
    if (text.includes('סער') || text.includes('קצח') || text.includes('ירדנה') || text.includes('שני') || text.includes('ריקו') || text.includes('עדי') || text.includes('קצ')) {
      console.log('Intake match:', i.id, i.owner_name, i.dog_name, i.owner_phone, i.start_date, i.end_date, i.status);
    }
  });

  // Let's check recent Green API chats or contacts for "סער"
  const GREEN_API_ID = '710722735421';
  const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const urlContacts = `https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/getContacts/${GREEN_API_TOKEN}`;
  try {
    const resp = await fetch(urlContacts);
    const contacts = await resp.json();
    console.log('Contacts fetched:', Array.isArray(contacts) ? contacts.length : 'not array');
    if (Array.isArray(contacts)) {
      contacts.filter(c => (c.name || '').includes('סער') || (c.name || '').includes('קצח') || (c.name || '').includes('ירדנה')).forEach(c => {
        console.log('Found contact:', c.id, c.name);
      });
    }
  } catch (e) {
    console.log('Contacts error:', e.message);
  }
}

checkDetails();
