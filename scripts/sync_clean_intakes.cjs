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

async function cleanIntakes() {
  const { data: sData } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();
  const curData = sData?.data || {};
  let intakes = curData.intakeRequests || [];
  const todayStr = '2026-10-04';

  let updatedCount = 0;
  intakes = intakes.map(i => {
    // Shtuts is already booked in calendar
    if (i.dogName === 'שטוץ' && (i.status === 'payment_requested' || i.status === 'pending')) {
      updatedCount++;
      return { ...i, status: 'approved' };
    }
    // Past date intakes without bookings -> archive per Rule 6
    if (i.startDate && i.startDate < todayStr && i.status !== 'approved' && i.status !== 'archived') {
      updatedCount++;
      return { ...i, status: 'archived' };
    }
    return i;
  });

  await supabase.from('settings').update({
    data: { ...curData, intakeRequests: intakes },
    updated_at: new Date().toISOString()
  }).eq('id', 'resort_config');

  console.log(`Successfully updated and synchronized ${updatedCount} intakes (Rule 6 archive & Shtuts approved)!`);
}

cleanIntakes();
