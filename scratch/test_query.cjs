const fs = require('fs');

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const [k, ...v] = l.split('=');
      return [k.trim(), v.join('=').trim().replace(/^['"]|['"]$/g, '')];
    })
);

async function test() {
  // Query 1: with stay_status=eq.checked_in
  const url1 = `${env.VITE_SUPABASE_URL}/rest/v1/bookings?start_date=lte.2026-10-17&end_date=gt.2026-10-17&stay_status=eq.checked_in&select=id,dog_name,stay_status`;
  const res1 = await fetch(url1, {
    headers: {
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`
    }
  });
  const d1 = await res1.json();
  console.log('Checked-in only count:', d1.length, d1.map(x => x.dog_name));

  // Query 2: without stay_status=eq.checked_in (e.g. stay_status=neq.cancelled or no status filter)
  const url2 = `${env.VITE_SUPABASE_URL}/rest/v1/bookings?start_date=lte.2026-10-17&end_date=gt.2026-10-17&select=id,dog_name,stay_status`;
  const res2 = await fetch(url2, {
    headers: {
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`
    }
  });
  const d2 = await res2.json();
  console.log('All active dates count:', d2.length, d2.map(x => `${x.dog_name} (${x.stay_status})`));
}

test();
