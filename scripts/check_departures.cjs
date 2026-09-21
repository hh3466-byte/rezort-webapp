const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = (m[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[m[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkRecentDepartures() {
  const now = new Date();
  const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];
  
  const { data } = await supabase.from('bookings').select('id, dog_name, owner_name, start_date, end_date, stay_status, notes').gte('end_date', fourDaysAgo).lte('end_date', todayStr);
  console.log('Recent departures in last 4 days:', (data || []).length);
  (data || []).forEach(b => console.log({
    dog: b.dog_name,
    owner: b.owner_name,
    end: b.end_date,
    status: b.stay_status,
    notes: (b.notes || '').slice(0, 40)
  }));
}

checkRecentDepartures();
