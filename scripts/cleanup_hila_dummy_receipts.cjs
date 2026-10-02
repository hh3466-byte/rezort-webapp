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

async function cleanDummyReceipts() {
  const { data: sData, error: readErr } = await supabase.from('settings').select('*').eq('id', 'resort_config');
  if (readErr || !sData || !sData.length) {
    console.error('Error reading settings:', readErr);
    return;
  }
  const curData = sData[0].data || {};
  const receipts = curData.trainerReceipts || [];
  console.log('Before cleanup, total receipts:', receipts.length);

  // Keep only real receipts, filter out fake/video dummy ones
  const cleanedReceipts = receipts.filter(r => {
    const isVideo = (r.receiptImageUrl || '').includes('.mp4');
    const isFakePending = r.id.startsWith('rcpt-17908') && isVideo;
    return !isFakePending;
  });

  console.log('After cleanup, total receipts:', cleanedReceipts.length);
  console.log(JSON.stringify(cleanedReceipts, null, 2));

  const { error: updateErr } = await supabase.from('settings').update({
    data: { ...curData, trainerReceipts: cleanedReceipts }
  }).eq('id', 'resort_config');

  if (updateErr) {
    console.error('Error updating settings:', updateErr);
  } else {
    console.log('Successfully cleaned settings.trainerReceipts in Supabase!');
  }
}

cleanDummyReceipts().catch(console.error);
