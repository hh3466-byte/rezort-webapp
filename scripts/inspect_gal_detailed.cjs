const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
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

async function inspectGal() {
  console.log('=== SEARCHING EVERYTHING FOR 0522458841 OR ONIL OR GAL ===');
  
  // 1. Settings data intake requests
  const { data: sRows } = await supabase.from('settings').select('*');
  const d = sRows?.[0]?.data || {};
  
  const allIntakes = d.intakeRequests || [];
  const galIntakes = allIntakes.filter(r => {
    return JSON.stringify(r).includes('0522458841') || JSON.stringify(r).includes('אוניל') || JSON.stringify(r).includes('גל');
  });
  console.log('Gal intakes found in settings.data:', JSON.stringify(galIntakes, null, 2));

  // 2. All bookings with 0522458841
  const { data: bookings } = await supabase.from('bookings').select('*');
  const galBookings = bookings?.filter(b => {
    return JSON.stringify(b).includes('0522458841') || JSON.stringify(b).includes('אוניל');
  });
  console.log('Gal bookings in Supabase:', JSON.stringify(galBookings, null, 2));

  // 3. Grow payments
  const { data: payments } = await supabase.from('grow_incoming_payments').select('*');
  const galPayments = payments?.filter(p => JSON.stringify(p).includes('0522458841') || JSON.stringify(p).includes('גל'));
  console.log('Gal Grow payments:', JSON.stringify(galPayments, null, 2));

  // 4. Check git log or codebase for 054-8889900
  console.log('Default settings in code:');
}

inspectGal();
