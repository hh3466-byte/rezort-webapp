const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
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

async function run() {
  console.log('=== SEARCHING SUPABASE ===');
  
  // 1. Bookings
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
  if (bErr) console.error('Booking error:', bErr);
  const matchedBookings = (bookings || []).filter(b => 
    JSON.stringify(b).includes('ניבה') || 
    JSON.stringify(b).includes('פורן') || 
    JSON.stringify(b).toLowerCase().includes('niva') ||
    JSON.stringify(b).toLowerCase().includes('poran')
  );
  console.log(`Matched bookings (${matchedBookings.length}):`, JSON.stringify(matchedBookings, null, 2));

  // 2. Settings & Intakes
  const { data: settings, error: sErr } = await supabase.from('settings').select('*');
  if (sErr) console.error('Settings error:', sErr);
  if (settings && settings[0]) {
    const s = settings[0];
    const raw = JSON.stringify(s);
    console.log('Settings has ניבה:', raw.includes('ניבה'), 'פורן:', raw.includes('פורן'));
    if (s.intake_forms) {
      const matched = s.intake_forms.filter(i => 
        JSON.stringify(i).includes('ניבה') || 
        JSON.stringify(i).includes('פורן') || 
        JSON.stringify(i).toLowerCase().includes('niva') ||
        JSON.stringify(i).toLowerCase().includes('poran')
      );
      console.log(`Matched intake forms in settings (${matched.length}):`, JSON.stringify(matched, null, 2));
    }
  }

  // 3. Grow payments
  const { data: grow, error: gErr } = await supabase.from('grow_incoming_payments').select('*');
  if (gErr) console.error('Grow error:', gErr);
  const matchedGrow = (grow || []).filter(g => 
    JSON.stringify(g).includes('ניבה') || 
    JSON.stringify(g).includes('פורן') || 
    JSON.stringify(g).toLowerCase().includes('niva') ||
    JSON.stringify(g).toLowerCase().includes('poran')
  );
  console.log(`Matched grow payments (${matchedGrow.length}):`, JSON.stringify(matchedGrow, null, 2));

  // 4. Also check Green API chats list
  console.log('\n=== SEARCHING GREEN API CHATS ===');
  const id = '710722735421';
  const tok = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  
  try {
    const res = await fetch(`https://api.green-api.com/waInstance${id}/getChats/${tok}`);
    if (res.ok) {
      const chats = await res.json();
      console.log(`Total chats returned: ${chats.length}`);
      const matchedChats = chats.filter(c => 
        (c.name && (c.name.includes('ניבה') || c.name.includes('פורן') || c.name.toLowerCase().includes('niva') || c.name.toLowerCase().includes('poran'))) ||
        (c.contactName && (c.contactName.includes('ניבה') || c.contactName.includes('פורן')))
      );
      console.log('Matched chats in Green API:', matchedChats);

      // Check last 20 chats to see if any recent chat is relevant
      console.log('\nLast 15 active chats:');
      chats.slice(0, 15).forEach(c => console.log(`- ${c.id}: ${c.name || c.contactName || 'No Name'}`));
    } else {
      console.log('Green API getChats status:', res.status);
    }
  } catch(e) {
    console.error('Green API error:', e.message);
  }
}

run();
