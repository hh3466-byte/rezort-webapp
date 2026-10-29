const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
});

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_KEY;
const supabase = createClient(url, key);

async function run() {
  const { data: sRow, error } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();
  if (error || !sRow) {
    console.error('Error fetching settings:', error);
    return;
  }

  const curData = sRow.data || {};
  const curIntakes = Array.isArray(curData.intakeRequests) ? curData.intakeRequests : [];

  let updatedCount = 0;
  const mapped = curIntakes.map(r => {
    if (r.ownerPhone && (r.ownerPhone.includes('5000052') || r.ownerPhone.includes('4461741'))) {
      console.log(`Updating lead ${r.id} (${r.ownerName}) from ${r.status} to in_progress`);
      updatedCount++;
      return {
        ...r,
        status: 'in_progress'
      };
    }
    return r;
  });

  if (updatedCount > 0) {
    const { error: updateError } = await supabase
      .from('settings')
      .update({
        data: { ...curData, intakeRequests: mapped },
        updated_at: new Date().toISOString()
      })
      .eq('id', 'resort_config');

    if (updateError) {
      console.error('Error updating settings:', updateError);
    } else {
      console.log(`Successfully updated ${updatedCount} leads to in_progress!`);
    }
  } else {
    console.log('No matching leads found to update.');
  }
}
run();
