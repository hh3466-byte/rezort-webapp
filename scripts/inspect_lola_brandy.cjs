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
  console.log('=== SEARCHING FOR LOLA & BRANDY IN BOOKINGS ===');
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
  if (bErr) console.error('Bookings err:', bErr);
  
  const lolaBrandyBookings = (bookings || []).filter(b => {
    const str = JSON.stringify(b).toLowerCase();
    return str.includes('לולה') || str.includes('ברנדי') || str.includes('lola') || str.includes('brandy');
  });
  console.log(`Found ${lolaBrandyBookings.length} bookings matching Lola / Brandy:`);
  lolaBrandyBookings.forEach(b => console.log(JSON.stringify(b, null, 2)));

  console.log('\n=== SEARCHING IN SETTINGS (intakes, stays, etc.) ===');
  const { data: settingsData } = await supabase.from('settings').select('*');
  if (settingsData) {
    settingsData.forEach(s => {
      const sStr = JSON.stringify(s);
      if (sStr.includes('לולה') || sStr.includes('ברנדי') || sStr.toLowerCase().includes('lola') || sStr.toLowerCase().includes('brandy')) {
        console.log(`Found match in settings row id: ${s.id}, key: ${s.key || 'unknown'}`);
        // Let's inspect intakes or stays
        if (s.data && s.data.intakeRequests) {
          const matchIntakes = s.data.intakeRequests.filter(i => {
            const is = JSON.stringify(i).toLowerCase();
            return is.includes('לולה') || is.includes('ברנדי') || is.includes('lola') || is.includes('brandy');
          });
          console.log(`Matched intakes in settings:`, JSON.stringify(matchIntakes, null, 2));
        }
        if (s.data && s.data.stays) {
          const matchStays = s.data.stays.filter(st => {
            const ss = JSON.stringify(st).toLowerCase();
            return ss.includes('לולה') || ss.includes('ברנדי') || ss.includes('lola') || ss.includes('brandy');
          });
          console.log(`Matched stays in settings:`, JSON.stringify(matchStays, null, 2));
        }
      }
    });
  }

  console.log('\n=== SEARCHING IN GROW INCOMING PAYMENTS ===');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');
  const matchGrow = (growPayments || []).filter(g => {
    const gs = JSON.stringify(g).toLowerCase();
    return gs.includes('לולה') || gs.includes('ברנדי') || gs.includes('lola') || gs.includes('brandy');
  });
  console.log(`Found ${matchGrow.length} grow payments for Lola/Brandy:`, JSON.stringify(matchGrow, null, 2));

  // If we found owner names or phones from bookings/intakes, let's search payments by phone/name
  const phones = new Set();
  const names = new Set();
  lolaBrandyBookings.forEach(b => {
    if (b.owner_phone) phones.add(b.owner_phone.replace(/\D/g, ''));
    if (b.owner_name) names.add(b.owner_name);
  });

  console.log('\nPhones found:', Array.from(phones));
  console.log('Names found:', Array.from(names));

  if (phones.size > 0 || names.size > 0) {
    const allGrowForOwner = (growPayments || []).filter(g => {
      const gs = JSON.stringify(g);
      for (let p of phones) {
        if (p && p.length > 6 && gs.includes(p.slice(-7))) return true;
      }
      for (let n of names) {
        if (n && gs.includes(n)) return true;
      }
      return false;
    });
    console.log(`\nAll Grow Payments for owner (${allGrowForOwner.length}):`, JSON.stringify(allGrowForOwner, null, 2));
  }
}

main().catch(console.error);
