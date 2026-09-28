const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
else if (fs.existsSync('.env')) dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('bookings').select('*');
  if (error) {
    console.error(error);
    return;
  }
  const today = '2026-09-28';
  console.log('Total bookings in DB:', data.length);
  
  const current = data.filter(b => {
    const sDate = b.start_date || b.data?.startDate;
    const eDate = b.end_date || b.data?.endDate;
    return sDate <= today && eDate >= today;
  });
  console.log('Bookings active on today (' + today + '):', current.length);
  current.forEach(b => {
    const sDate = b.start_date || b.data?.startDate;
    const eDate = b.end_date || b.data?.endDate;
    const dName = b.dog_name || b.data?.dogName;
    const oName = b.owner_name || b.data?.ownerName;
    const rawStay = b.stay_status || b.data?.stayStatus;
    const kennel = b.data?.kennelNumber;
    console.log(`- ${dName} (${oName}): ${sDate} -> ${eDate} | stay_status: ${rawStay} | kennel: ${kennel}`);
  });

  const allStatuses = {};
  data.forEach(b => {
    const s = b.stay_status || b.data?.stayStatus || 'empty';
    allStatuses[s] = (allStatuses[s] || 0) + 1;
  });
  console.log('All stay_status distribution in DB:', allStatuses);
}
check();
