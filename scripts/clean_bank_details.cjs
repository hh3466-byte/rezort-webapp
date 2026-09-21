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

async function cleanBankDetails() {
  const { data: sRows } = await supabase.from('settings').select('*');
  const s = sRows?.[0];
  if (!s) {
    console.log('No settings row found');
    return;
  }
  console.log('Existing bank_details:', s.bank_details);
  console.log('Existing data.bankDetails:', s.data?.bankDetails);

  const curData = s.data || {};
  delete curData.bankDetails;

  const { error } = await supabase.from('settings').update({
    bank_details: '',
    data: curData,
    updated_at: new Date().toISOString()
  }).eq('id', s.id);

  if (error) {
    console.error('Error updating Supabase settings:', error);
  } else {
    console.log('Successfully cleared bank details from Supabase settings!');
  }
}

cleanBankDetails();
