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
  const { data: settings } = await supabase.from('settings').select('*');
  console.log('=== SETTINGS KEYS & VALUES ===');
  if (settings && settings[0]) {
    const s = settings[0].data || settings[0];
    Object.keys(s).forEach(k => {
      if (typeof s[k] === 'string' && (s[k].includes('http') || s[k].includes('05') || s[k].includes('בנק') || s[k].includes('הודעה') || s[k].includes('pay'))) {
        console.log(`${k}: ${s[k]}`);
      }
    });
    console.log('managerPhone:', s.managerPhone);
    console.log('whatsappNotificationPhone:', s.whatsappNotificationPhone);
    console.log('bankDetails:', s.bankDetails);
    console.log('growPaymentLink:', s.growPaymentLink);
    console.log('intakeRequests array in settings.data:', Array.isArray(s.intakeRequests) ? s.intakeRequests.length : typeof s.intakeRequests);
    if (Array.isArray(s.intakeRequests)) {
      s.intakeRequests.forEach((ir, idx) => {
        console.log(`Intake ${idx+1}: ID=${ir.id}, Dog=${ir.dogName}, Owner=${ir.ownerName}, Phone=${ir.ownerPhone}, Dates=${ir.startDate} to ${ir.endDate}, Status=${ir.status}`);
      });
    }
  }

  const { data: intakes, error: errI } = await supabase.from('intake_requests').select('*');
  console.log('\n=== INTAKE REQUESTS RESULT ===');
  console.log('Error:', errI);
  console.log('Count:', intakes ? intakes.length : 'null');
  if (intakes && intakes.length > 0) {
    intakes.forEach(i => {
      console.log(`ID: ${i.id}, Created: ${i.created_at}, Owner: ${i.owner_name || i.ownerName}, Phone: ${i.owner_phone || i.ownerPhone}, Dog: ${i.dog_name || i.dogName}, Dates: ${i.start_date || i.startDate} to ${i.end_date || i.endDate}, Status: ${i.status}`);
    });
  }
}

main().catch(console.error);
