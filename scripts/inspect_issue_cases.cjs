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

async function inspect() {
  console.log('=== Checking bookings table ===');
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
  if (bErr) console.error('Bookings error:', bErr);
  else {
    console.log(`Total rows in bookings: ${bookings.length}`);
    const relevantBookings = bookings.filter(b => {
      const d = b.data || b;
      const start = b.start_date || d.startDate || '';
      const end = b.end_date || d.endDate || '';
      const name = (b.dog_name || d.dogName || '') + ' ' + (b.owner_name || d.ownerName || '');
      return (end >= '2026-09-28' && start <= '2026-10-05') || 
             name.includes('ג\'סי') || name.includes('סינדי') || name.includes('סנדי') || name.includes('לונה') || name.includes('מלמוד');
    });

    console.log(`\nRelevant bookings around 30.09 - 01.10 (${relevantBookings.length} found):`);
    relevantBookings.forEach(b => {
      const d = b.data || {};
      console.log({
        id: b.id,
        dog_name: b.dog_name || d.dogName,
        owner_name: b.owner_name || d.ownerName,
        start_date: b.start_date || d.startDate,
        end_date: b.end_date || d.endDate,
        stay_status: b.stay_status || d.stayStatus,
        service_type: b.service_type || d.serviceType,
        training_days: d.trainingDays || b.training_days || d.days,
        kennel_number: b.kennel_number || d.kennelNumber,
        updated_at: b.updated_at
      });
    });
  }

  console.log('\n=== Checking settings table ===');
  const { data: settings, error: sErr } = await supabase.from('settings').select('*');
  if (sErr) console.error('Settings error:', sErr);
  else {
    console.log(`Total rows in settings: ${settings.length}`);
    settings.forEach(s => {
      console.log(`Key: ${s.key}, updated: ${s.updated_at}, value length/type: ${typeof s.value === 'object' ? JSON.stringify(s.value).length : (s.value || '').length}`);
      if (s.key === 'resort_bookings' || s.key === 'bookings' || s.key === 'intakes' || s.key === 'resort_intakes') {
        const val = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
        if (Array.isArray(val)) {
          console.log(`  -> Array with ${val.length} items`);
          const rel = val.filter(x => {
            const name = (x.dogName || x.dog_name || '') + ' ' + (x.ownerName || x.owner_name || '');
            const start = x.startDate || x.start_date || '';
            const end = x.endDate || x.end_date || '';
            return (end >= '2026-09-28' && start <= '2026-10-05') || 
                   name.includes('ג\'סי') || name.includes('סינדי') || name.includes('סנדי') || name.includes('לונה') || name.includes('מלמוד');
          });
          console.log(`  -> Matching items in ${s.key} (${rel.length}):`);
          rel.forEach(item => {
            console.log('    ', {
              id: item.id,
              dogName: item.dogName || item.dog_name,
              ownerName: item.ownerName || item.owner_name,
              startDate: item.startDate || item.start_date,
              endDate: item.endDate || item.end_date,
              stayStatus: item.stayStatus || item.stay_status,
              serviceType: item.serviceType || item.service_type,
              trainingDays: item.trainingDays || item.trainingDaysCount,
              kennelNumber: item.kennelNumber
            });
          });
        }
      }
    });
  }
}

inspect();
