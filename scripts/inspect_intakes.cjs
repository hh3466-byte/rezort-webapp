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

async function main() {
  const { data: sRow, error } = await supabase.from('settings').select('*').limit(1);
  if (error) {
    console.error('Error fetching settings:', error);
    return;
  }
  const settings = sRow?.[0]?.data || {};
  const reqs = settings.intakeRequests || [];
  
  const targetDogs = ['לוקי', 'קוקו', 'באז', 'מילקי', 'קאי', 'מקס', 'וויסקי', 'קודה'];
  
  console.log('--- Targeted Dogs in intakeRequests ---');
  reqs.forEach((r, idx) => {
    const isTarget = targetDogs.some(t => (r.dogName || '').includes(t) || (r.ownerName || '').includes(t));
    if (isTarget) {
      console.log(`[${idx + 1}] ID: ${r.id} | Dog: ${r.dogName} | Owner: ${r.ownerName} | Phone: ${r.ownerPhone} | Status: '${r.status}' | Dates: ${r.startDate} to ${r.endDate} | Created: ${r.createdAt || r.submittedAt}`);
    }
  });

  console.log('\n--- Count by status across all intakeRequests ---');
  const counts = {};
  reqs.forEach(r => {
    counts[r.status] = (counts[r.status] || 0) + 1;
  });
  console.log(counts);
}

main().catch(console.error);
