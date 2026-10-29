const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
});

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_KEY;
const supabase = createClient(url, key);

async function check() {
  const { data: sRows, error } = await supabase.from('settings').select('*');
  if (error) { console.error(error); return; }
  for (const sRow of sRows) {
    const intakes = sRow?.data?.intakeRequests || [];
    console.log('Row ID:', sRow.id, 'Total intakes:', intakes.length);
    intakes.forEach(p => {
      console.log({
        id: p.id,
        dog: p.dog_name || p.dogName,
        owner: p.owner_name || p.ownerName,
        phone: p.owner_phone || p.ownerPhone,
        start: p.start_date || p.startDate,
        end: p.end_date || p.endDate,
        created_at: p.created_at || p.createdAt || p.submittedAt,
        status: p.status
      });
    });
  }
}
check();
