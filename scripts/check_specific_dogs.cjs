const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkSpecificDogs() {
  const { data: allBookings } = await supabase.from('bookings').select('*');
  const searchNames = ['ברנדי', 'לולה', 'גינגס', "ג'ינגס", 'ג’ינג’ס', 'ג’ינגס', 'בוני', 'מייק', 'לונה', 'גוי', "ג'וי", 'רייבן', 'קירה', 'תיאו', 'בוס', 'יולי', 'טוני', 'ראיה', 'קאיה'];
  
  console.log('=== Searching for specific dogs in all bookings ===');
  for (const name of searchNames) {
    const matches = (allBookings || []).filter(b => {
      const d = b.data || {};
      const dName = b.dog_name || d.dogName || '';
      const notes = b.notes || d.notes || '';
      return dName.includes(name) || notes.includes(name);
    });
    console.log(`\n--- Name: ${name} (${matches.length} matches) ---`);
    matches.forEach(m => {
      const d = m.data || {};
      console.log(`ID: ${m.id} | Dog: "${m.dog_name || d.dogName}" | Owner: "${m.owner_name || d.ownerName}" (${m.owner_phone || d.ownerPhone}) | Dates: ${m.start_date || d.startDate} -> ${m.end_date || d.endDate} | Room: "${d.kennelNumber}" | Status: ${m.stay_status || d.stayStatus} | Price: ${m.total_price || d.totalPrice} | Dep: ${m.deposit_amount || d.depositAmount} | Paid: ${m.payment_status || d.paymentStatus}`);
    });
  }
}

checkSpecificDogs().catch(console.error);
