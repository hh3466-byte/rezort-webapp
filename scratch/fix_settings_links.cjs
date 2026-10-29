const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('c:/Projects/הריזורט לכלב/.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const GROW_OFFICIAL_LINK = 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

async function updateSettings() {
  const { data: rows, error } = await supabase.from('settings').select('*');
  if (error) {
    console.error('Fetch error:', error);
    return;
  }

  const s = rows[0];
  console.log('Current settings keys:');
  console.log('id:', s.id);
  console.log('paybox_link:', s.paybox_link);
  console.log('bit_number:', s.bit_number);
  console.log('bank_details:', s.bank_details);

  const updatedData = {
    ...(s.data || {}),
    growPaymentLink: GROW_OFFICIAL_LINK,
    payboxPaymentLink: GROW_OFFICIAL_LINK,
    payboxLink: GROW_OFFICIAL_LINK
  };

  // Clean out any lingering shmulikdogresort references from data
  Object.keys(updatedData).forEach(k => {
    if (typeof updatedData[k] === 'string' && updatedData[k].includes('shmulikdogresort')) {
      console.log(`Replacing shmulikdogresort in data.${k}`);
      updatedData[k] = GROW_OFFICIAL_LINK;
    }
  });

  const { error: updateError } = await supabase
    .from('settings')
    .update({
      paybox_link: GROW_OFFICIAL_LINK,
      data: updatedData,
      updated_at: new Date().toISOString()
    })
    .eq('id', s.id);

  if (updateError) {
    console.error('Update error:', updateError);
  } else {
    console.log('Successfully updated settings table in Supabase!');
  }

  // Verify
  const { data: verified } = await supabase.from('settings').select('*');
  console.log('Verified paybox_link:', verified[0].paybox_link);
  console.log('Verified data.growPaymentLink:', verified[0].data?.growPaymentLink);
  console.log('Verified data.payboxPaymentLink:', verified[0].data?.payboxPaymentLink);
}

updateSettings().catch(console.error);
