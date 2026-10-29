const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('c:/Projects/הריזורט לכלב/.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function fixNitzaBooking() {
  console.log('=== FIXING NITZA BOOKING IN SUPABASE ===');
  
  const { data: bRows } = await supabase
    .from('bookings')
    .select('*')
    .ilike('dog_name', '%ניצה%');

  for (const b of bRows) {
    console.log(`Updating booking ${b.id} for ${b.dog_name}...`);
    const bData = b.data || {};
    bData.stayStatus = 'cancelled';
    bData.cancelReason = 'לא התקבלה בפועל בריזורט';
    bData.cancelledAt = new Date().toISOString();

    const { error } = await supabase
      .from('bookings')
      .update({
        stay_status: 'cancelled',
        notes: (b.notes ? b.notes + ' | ' : '') + '[🚫 בוטל - לא התקבלה בפועל בריזורט]',
        data: bData,
        updated_at: new Date().toISOString()
      })
      .eq('id', b.id);

    if (error) console.error(`Error updating ${b.id}:`, error);
    else console.log(`✓ Booking ${b.id} marked as cancelled (did not arrive)!`);
  }
}

fixNitzaBooking().catch(console.error);
