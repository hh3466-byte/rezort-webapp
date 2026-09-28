const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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

function getTodayIsraelStr() {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return dtf.format(now);
}

async function archivePastBookings() {
  const todayStr = getTodayIsraelStr();
  console.log(`Archiving past bookings where end_date < ${todayStr}...`);

  const { data: bookings } = await supabase.from('bookings').select('*');
  const pastActive = (bookings || []).filter(b => {
    const end = b.end_date || b.endDate;
    const status = b.stay_status || b.stayStatus;
    return end && end < todayStr && status !== 'checked_out' && status !== 'cancelled';
  });

  console.log(`Found ${pastActive.length} past bookings to mark as checked_out / archived.`);

  for (const b of pastActive) {
    const dog = b.dog_name || b.dogName;
    const curData = b.data || {};
    await supabase.from('bookings').update({
      stay_status: 'checked_out',
      data: {
        ...curData,
        stayStatus: 'checked_out',
        kennelNumber: undefined
      }
    }).eq('id', b.id);
    console.log(`✓ Closed past booking: ${dog} (${b.id})`);
  }

  console.log('Done archiving past bookings!');
}

archivePastBookings();
