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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  console.log('--- SETTINGS ---');
  const { data: sRows } = await supabase.from('settings').select('*');
  sRows?.forEach(r => {
    console.log('ID:', r.id);
    console.log('manager_phone:', r.manager_phone);
    console.log('data.managerPhone:', r.data?.managerPhone);
    console.log('data.whatsappNotificationPhone:', r.data?.whatsappNotificationPhone);
    console.log('data.bitNumber:', r.data?.bitNumber);
  });

  console.log('\n--- SEARCH FOR GAL / ONIL / 288 ---');
  const { data: bookings } = await supabase.from('bookings').select('*');
  console.log('Total bookings in Supabase:', bookings?.length);
  const matchedBookings = bookings?.filter(b => {
    const text = JSON.stringify(b);
    return text.includes('אוניל') || text.includes('גל') || text.includes('288') || text.includes('27/09') || text.includes('2026-09-27');
  });
  console.log('Matched bookings:', JSON.stringify(matchedBookings, null, 2));

  console.log('\n--- SEARCH IN SETTINGS.DATA (INTAKE / BOOKINGS) ---');
  if (sRows && sRows[0]?.data) {
    const d = sRows[0].data;
    if (d.intakeRequests) {
      console.log('Intake requests count in settings.data:', d.intakeRequests.length);
      const matchedIntakes = d.intakeRequests.filter(r => {
        const text = JSON.stringify(r);
        return text.includes('אוניל') || text.includes('גל') || text.includes('288');
      });
      console.log('Matched intakes in settings.data:', JSON.stringify(matchedIntakes, null, 2));
    }
    if (d.bookings) {
      console.log('Bookings in settings.data count:', d.bookings.length);
      const matchedB = d.bookings.filter(b => {
        const text = JSON.stringify(b);
        return text.includes('אוניל') || text.includes('גל') || text.includes('288');
      });
      console.log('Matched bookings in settings.data:', JSON.stringify(matchedB, null, 2));
    }
  }

  console.log('\n--- GROW INCOMING PAYMENTS ---');
  const { data: payments } = await supabase.from('grow_incoming_payments').select('*').order('created_at', { ascending: false }).limit(10);
  console.log('Recent 10 Grow payments:');
  payments?.forEach(p => {
    console.log(`- ${p.created_at}: ${p.customer_name}, dog: ${p.dog_name}, amount: ${p.amount}, phone: ${p.customer_phone}, status: ${p.status}`);
  });
}

check();
