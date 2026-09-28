const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
else if (fs.existsSync('.env')) dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectAll() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const today = '2026-09-28';
  
  console.log('=== CURRENT ACTIVE BOOKINGS IN DB (TODAY) ===');
  bookings.filter(b => {
    const s = b.start_date || b.data?.startDate;
    const e = b.end_date || b.data?.endDate;
    return s <= today && e >= today;
  }).forEach(b => {
    const dName = b.dog_name || b.data?.dogName;
    const oName = b.owner_name || b.data?.ownerName;
    const stay = b.stay_status || b.data?.stayStatus;
    const kennel = b.data?.kennelNumber;
    const srv = b.service_type || b.data?.serviceType;
    console.log(`- ${dName} (${oName}): ${b.start_date} -> ${b.end_date} | stay: ${stay} | kennel: ${kennel} | service: ${srv}`);
  });

  console.log('\n=== ALL DOGS RELEVANT TO SHMULIK LIST ===');
  const targetDogs = ['מגן', 'לולה', 'קירה', 'סקובי', 'ג\'ינגס', 'ג\'נגו', 'טר', 'ג\'סי', 'תיאו', 'ג\'וי', 'לונה', 'דאפי', 'רייבן', 'מייק', 'שליו'];
  
  bookings.filter(b => {
    const d = (b.dog_name || b.data?.dogName || '').toLowerCase();
    const o = (b.owner_name || b.data?.ownerName || '').toLowerCase();
    return targetDogs.some(n => d.includes(n) || o.includes(n));
  }).forEach(b => {
    const dName = b.dog_name || b.data?.dogName;
    const oName = b.owner_name || b.data?.ownerName;
    const stay = b.stay_status || b.data?.stayStatus;
    const kennel = b.data?.kennelNumber;
    const srv = b.service_type || b.data?.serviceType;
    console.log(`[${b.id}] ${dName} (${oName}) | ${b.start_date} -> ${b.end_date} | stay: ${stay} | kennel: ${kennel} | service: ${srv} | price: ₪${b.total_price}`);
  });
}
inspectAll();
