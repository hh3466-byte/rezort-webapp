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

async function cleanDuplicateBoss() {
  console.log('Fetching Itay booking b-1789732108163...');
  const { data: itayRows } = await supabase.from('bookings').select('*').eq('id', 'b-1789732108163');
  const itay = itayRows[0];
  if (!itay) {
    console.error('Itay booking not found!');
    return;
  }

  // Preserve Ariel Shraiber's details inside Itay's notes & data
  const updatedNotes = `${itay.notes || ''} | [שותף/איש קשר נוסף: אריאל שרייבר 0544452521 arielshraiber124@gmail.com] | [הערה רפואית: שעלת מכלאות אובחנה ב-17.9, כניסה נדחתה ל-2.10]`.trim();
  const curData = itay.data || {};
  const updatedData = {
    ...curData,
    notes: updatedNotes,
    emergencyContact: 'אריאל שרייבר (054-4452521)'
  };

  const { error: updateErr } = await supabase.from('bookings').update({
    notes: updatedNotes,
    emergency_contact: 'אריאל שרייבר (054-4452521)',
    data: updatedData,
    updated_at: new Date().toISOString()
  }).eq('id', 'b-1789732108163');

  if (updateErr) {
    console.error('Error updating Itay booking:', updateErr);
    return;
  }
  console.log('Successfully enriched Itay booking with Ariel Shraiber contact and medical notes!');

  // Now delete the duplicate placeholder b-1789630883447
  console.log('Deleting redundant placeholder booking b-1789630883447...');
  const { error: delErr } = await supabase.from('bookings').delete().eq('id', 'b-1789630883447');
  if (delErr) {
    console.error('Error deleting duplicate booking:', delErr);
  } else {
    console.log('Successfully deleted redundant booking b-1789630883447 from Supabase!');
  }
}

cleanDuplicateBoss();
