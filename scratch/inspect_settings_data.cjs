const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function run() {
  const { data: sData } = await supabase.from('settings').select('*');
  const d = sData?.[0]?.data || {};
  console.log('Keys in settings.data:');
  for (const k of Object.keys(d)) {
    if (Array.isArray(d[k])) {
      console.log(`- ${k} (Array, length: ${d[k].length})`);
    } else {
      console.log(`- ${k} (${typeof d[k]})`);
    }
  }

  // Check intakeForms or intakeRequests
  const intakes = d.intakeRequests || d.intakeForms || d.intake_forms || [];
  console.log(`\nIntake items found: ${intakes.length}`);
  const today = '2026-10-16';
  intakes.forEach(i => {
    const end = i.endDate || i.end_date || '';
    console.log(`  * ${i.dogName || i.dog_name} (${i.ownerName || i.owner_name}) | Status: ${i.status} | Dates: ${i.startDate || i.start_date}..${end} | Phone: ${i.ownerPhone || i.owner_phone}`);
  });
}
run();
