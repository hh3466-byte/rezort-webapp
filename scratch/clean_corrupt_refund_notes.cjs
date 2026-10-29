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

async function main() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const activeCorrupt = (bookings || []).filter(b => {
    const st = b.stay_status || b.stayStatus;
    if (st === 'cancelled') return false;
    const rNotes = (b.data && b.data.refundNotes) || '';
    return rNotes.includes('בוצע ביטול');
  });

  console.log('Found corrupt active bookings in data:', activeCorrupt.length);
  for (const b of activeCorrupt) {
    console.log(`Cleaning ${b.dog_name || b.dogName} (${b.id})...`);
    const curData = { ...(b.data || {}) };
    delete curData.refundNotes;
    delete curData.refundAmount;
    delete curData.refundDate;
    delete curData.refundReason;

    const res = await supabase.from('bookings').update({
      data: curData,
      updated_at: new Date().toISOString()
    }).eq('id', b.id);
    if (res.error) {
      console.error('Update error:', res.error);
    }
  }
  console.log('Done cleaning data column!');
}

main();
