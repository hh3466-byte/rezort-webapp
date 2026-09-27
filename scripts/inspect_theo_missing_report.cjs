const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkWhyTheoMissing() {
  const { data: bookings, error } = await supabase.from('bookings').select('*');
  if (error) {
    console.error(error);
    return;
  }
  const targetDate = '2026-09-28';
  console.log('Target date:', targetDate);

  const theo = bookings.find(b => (b.dog_name || '').includes('תיאו'));
  console.log('Theo booking:', {
    id: theo.id,
    dog_name: theo.dog_name,
    owner_name: theo.owner_name,
    service_type: theo.service_type,
    start_date: theo.start_date,
    end_date: theo.end_date,
    stay_status: theo.stay_status
  });

  const activeOnDate = bookings.filter(b => {
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    const status = b.stay_status || b.stayStatus;
    if (status === 'cancelled') return false;
    return start <= targetDate && end >= targetDate;
  });

  console.log('\nTotal active on 2026-09-28:', activeOnDate.length);
  activeOnDate.forEach(b => {
    console.log(`- ${b.dog_name} (${b.owner_name}) | service: ${b.service_type} | stay: ${b.start_date}->${b.end_date}`);
  });
}
checkWhyTheoMissing();
