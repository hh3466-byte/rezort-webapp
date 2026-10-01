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

async function updateSandy() {
  const { data: b, error: fetchErr } = await supabase.from('bookings').select('*').eq('id', 'b-1790619347733').single();
  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }
  if (b) {
    const updatedData = { ...(b.data || {}), stayStatus: 'checked_in', updatedAt: new Date().toISOString() };
    const { error } = await supabase.from('bookings').update({
      stay_status: 'checked_in',
      data: updatedData,
      updated_at: new Date().toISOString()
    }).eq('id', 'b-1790619347733');
    
    if (error) {
      console.error('Error updating booking:', error);
    } else {
      console.log('Successfully updated Sandy to checked_in in bookings table!');
    }
  }

  // Also check settings table
  const { data: settingsData } = await supabase.from('settings').select('*');
  for (const s of settingsData || []) {
    if (s.data && s.data.bookings) {
      let changed = false;
      const newBookings = s.data.bookings.map(bk => {
        if (bk.id === 'b-1790619347733' || (bk.dogName === 'סינדי' && bk.ownerPhone === '052-8191261')) {
          changed = true;
          return { ...bk, stayStatus: 'checked_in' };
        }
        return bk;
      });
      if (changed) {
        await supabase.from('settings').update({ data: { ...s.data, bookings: newBookings } }).eq('id', s.id);
        console.log('Updated Sandy in settings table row:', s.id);
      }
    }
  }
}

updateSandy();
