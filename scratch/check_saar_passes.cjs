const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkPasses() {
  console.log('--- checking daycare_passes table ---');
  const { data: dbPasses, error: dbErr } = await supabase.from('daycare_passes').select('*');
  if (dbPasses) {
    const saarPasses = dbPasses.filter(p => 
      (p.owner_phone && p.owner_phone.includes('5716886')) ||
      (p.dog_name && (p.dog_name.includes('ירדנה') || p.dog_name.includes('קצח'))) ||
      (p.owner_name && p.owner_name.includes('סער'))
    );
    console.log('Found in daycare_passes table:', saarPasses.length);
    saarPasses.forEach(p => {
      console.log(`ID: ${p.id}, Code: ${p.pass_code}, Dog: ${p.dog_name}, Total: ${p.total_days}, Used: ${p.used_days}, Phone: ${p.owner_phone}`);
    });
  }

  console.log('--- checking settings.data.daycare_passes ---');
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const sData = sRows?.[0]?.data || {};
  const sPasses = sData.daycare_passes || sData.daycarePasses || [];
  const saarSettingsPasses = sPasses.filter(p => 
    (p.ownerPhone && p.ownerPhone.includes('5716886')) ||
    (p.dogName && (p.dogName.includes('ירדנה') || p.dogName.includes('קצח'))) ||
    (p.ownerName && p.ownerName.includes('סער'))
  );
  console.log('Found in settings passes:', saarSettingsPasses.length);
  saarSettingsPasses.forEach(p => {
    console.log(`ID: ${p.id}, Code: ${p.passCode}, Dog: ${p.dogName}, Total: ${p.totalDays}, Used: ${p.usedDays}, Phone: ${p.ownerPhone}`);
  });
}

checkPasses().catch(console.error);
