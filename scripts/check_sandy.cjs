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

async function check() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const sandy = (bookings || []).filter(b => 
    (b.dog_name && (b.dog_name.includes('סינדי') || b.dog_name.includes('סנדי') || b.dog_name.toLowerCase().includes('sandy'))) ||
    (b.owner_name && (b.owner_name.toLowerCase().includes('abta') || b.owner_name.includes('אבטה'))) ||
    (b.dogName && (b.dogName.includes('סינדי') || b.dogName.includes('סנדי')))
  );
  console.log('Sandy bookings in bookings table:', JSON.stringify(sandy, null, 2));

  const { data: sData } = await supabase.from('settings').select('*');
  if (sData) {
    for (const s of sData) {
      const data = s.data || {};
      if (data.bookings) {
        const sb = data.bookings.filter(b => 
          (b.dog_name && (b.dog_name.includes('סינדי') || b.dog_name.includes('סנדי'))) ||
          (b.dogName && (b.dogName.includes('סינדי') || b.dogName.includes('סנדי'))) ||
          (b.ownerName && (b.ownerName.toLowerCase().includes('abta') || b.ownerName.includes('אבטה')))
        );
        console.log('Sandy in settings.bookings:', JSON.stringify(sb, null, 2));
      }
      if (data.intakeRequests) {
        const si = data.intakeRequests.filter(i => 
          (i.dogName && (i.dogName.includes('סינדי') || i.dogName.includes('סנדי'))) ||
          (i.ownerName && (i.ownerName.toLowerCase().includes('abta') || i.ownerName.includes('אבטה')))
        );
        console.log('Sandy in intakeRequests:', JSON.stringify(si, null, 2));
      }
    }
  }
}
check();
